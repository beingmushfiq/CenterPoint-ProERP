<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Actions;

use App\Modules\Purchasing\Models\PurchaseBill;
use App\Modules\Purchasing\Models\PurchaseBillItem;
use App\Modules\Purchasing\Models\PurchaseOrder;
use App\Modules\Purchasing\Models\PurchaseOrderItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreatePurchaseBillAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     party_id: int,
     *     bill_date: string,
     *     due_date?: string|null,
     *     supplier_invoice_number?: string|null,
     *     supplier_bill_number?: string|null,
     *     bill_number?: string,
     *     purchase_order_id?: int|null,
     *     goods_receipt_id?: int|null,
     *     created_by?: int|null,
     *     items: list<array{
     *         product_id: int,
     *         quantity: numeric-string|string,
     *         unit_id: int,
     *         unit_price: numeric-string|string,
     *         purchase_order_item_id?: int|null,
     *         goods_receipt_item_id?: int|null,
     *         tax_profile_id?: int|null,
     *         tax_rate?: numeric-string|string,
     *         discount_amount?: numeric-string|string,
     *         description?: string|null
     *     }>
     * } $data
     */
    public function execute(array $data): PurchaseBill
    {
        return DB::transaction(function () use ($data): PurchaseBill {
            $billNumber = $data['bill_number'] ?? ('BILL-'.date('Ymd').'-'.strtoupper(Str::random(6)));
            $invoiceNumber = $data['supplier_bill_number'] ?? $data['supplier_invoice_number'] ?? ('INV-'.strtoupper(Str::random(8)));
            $dueDate = $data['due_date'] ?? $data['bill_date'];

            /** @var numeric-string $grossSubtotal */
            $grossSubtotal = '0.0000';
            $processedItems = [];

            // Pass 1: compute line gross and line discounts
            foreach ($data['items'] as $item) {
                /** @var numeric-string $qty */
                $qty = is_numeric($item['quantity'] ?? null) ? (string) $item['quantity'] : '0.0000';
                /** @var numeric-string $price */
                $price = is_numeric($item['unit_price'] ?? null) ? (string) $item['unit_price'] : '0.0000';
                /** @var numeric-string $lineGross */
                $lineGross = bcmul($qty, $price, 4);

                $discType = $item['discount_type'] ?? 'flat';
                $discVal = is_numeric($item['discount_value'] ?? null) ? (string) $item['discount_value'] : (is_numeric($item['discount_amount'] ?? null) ? (string) $item['discount_amount'] : '0.0000');
                $discPct = is_numeric($item['discount_percentage'] ?? null) ? (string) $item['discount_percentage'] : '0.0000';

                /** @var numeric-string $lineDisc */
                if ($discType === 'percentage' || (bccomp($discPct, '0.0000', 4) > 0 && bccomp($discVal, '0.0000', 4) === 0)) {
                    $pct = bccomp($discPct, '0.0000', 4) > 0 ? $discPct : $discVal;
                    $lineDisc = bcmul($lineGross, bcdiv($pct, '100.0000', 6), 4);
                } else {
                    $lineDisc = $discVal;
                }

                if (bccomp($lineDisc, $lineGross, 4) > 0) {
                    $lineDisc = $lineGross;
                }

                /** @var numeric-string $lineNet */
                $lineNet = bcsub($lineGross, $lineDisc, 4);
                $grossSubtotal = bcadd($grossSubtotal, $lineGross, 4);

                $processedItems[] = [
                    'item' => $item,
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'line_gross' => $lineGross,
                    'line_disc' => $lineDisc,
                    'line_net' => $lineNet,
                ];
            }

            // Net subtotal before order discount
            /** @var numeric-string $netSubtotalBeforeOrderDisc */
            $netSubtotalBeforeOrderDisc = '0.0000';
            foreach ($processedItems as $pi) {
                $netSubtotalBeforeOrderDisc = bcadd($netSubtotalBeforeOrderDisc, $pi['line_net'], 4);
            }

            // Total line discounts sum
            $totalLineDiscounts = '0.0000';
            foreach ($processedItems as $pi) {
                $totalLineDiscounts = bcadd($totalLineDiscounts, $pi['line_disc'], 4);
            }

            // Order-level discount
            $orderDiscType = $data['order_discount_type'] ?? 'flat';
            $orderDiscountAmount = '0.0000';

            if ($orderDiscType === 'percentage') {
                $orderPct = is_numeric($data['order_discount_value'] ?? null)
                    ? (string) $data['order_discount_value']
                    : (is_numeric($data['order_discount_percentage'] ?? null) ? (string) $data['order_discount_percentage'] : '0.0000');
                $orderDiscountAmount = bcmul($netSubtotalBeforeOrderDisc, bcdiv($orderPct, '100.0000', 6), 4);
            } elseif (isset($data['order_discount_value']) && is_numeric($data['order_discount_value'])) {
                $orderDiscountAmount = (string) $data['order_discount_value'];
            } elseif (isset($data['discount_amount']) && is_numeric($data['discount_amount'])) {
                // If only total discount_amount is provided, subtract line discounts so line discounts are never double-counted!
                $orderDiscountAmount = bcsub((string) $data['discount_amount'], $totalLineDiscounts, 4);
                if (bccomp($orderDiscountAmount, '0.0000', 4) < 0) {
                    $orderDiscountAmount = '0.0000';
                }
            }

            if (bccomp($orderDiscountAmount, $netSubtotalBeforeOrderDisc, 4) > 0) {
                $orderDiscountAmount = $netSubtotalBeforeOrderDisc;
            }

            // Pass 2: Allocate order discount proportionally
            /** @var numeric-string $totalDiscount */
            $totalDiscount = '0.0000';
            /** @var numeric-string $totalTax */
            $totalTax = '0.0000';
            $finalItems = [];

            foreach ($processedItems as $pi) {
                $allocatedOrderDisc = '0.0000';
                if (bccomp($netSubtotalBeforeOrderDisc, '0.0000', 4) > 0 && bccomp($orderDiscountAmount, '0.0000', 4) > 0) {
                    $ratio = bcdiv($pi['line_net'], $netSubtotalBeforeOrderDisc, 6);
                    $allocatedOrderDisc = bcmul($orderDiscountAmount, $ratio, 4);
                }

                $totalLineDisc = bcadd($pi['line_disc'], $allocatedOrderDisc, 4);
                if (bccomp($totalLineDisc, $pi['line_gross'], 4) > 0) {
                    $totalLineDisc = $pi['line_gross'];
                }

                $lineNetAfterAllDisc = bcsub($pi['line_gross'], $totalLineDisc, 4);

                /** @var numeric-string $taxR */
                $taxR = isset($pi['item']['tax_rate']) && is_numeric($pi['item']['tax_rate']) ? (string) $pi['item']['tax_rate'] : (isset($pi['item']['tax_percentage']) && is_numeric($pi['item']['tax_percentage']) ? (string) $pi['item']['tax_percentage'] : '0.0000');
                /** @var numeric-string $lineTax */
                $lineTax = bcmul($lineNetAfterAllDisc, bcdiv($taxR, '100.0000', 6), 4);
                /** @var numeric-string $lineTotal */
                $lineTotal = bcadd($lineNetAfterAllDisc, $lineTax, 4);

                $totalDiscount = bcadd($totalDiscount, $totalLineDisc, 4);
                $totalTax = bcadd($totalTax, $lineTax, 4);

                $finalItems[] = array_merge($pi, [
                    'allocated_order_disc' => $allocatedOrderDisc,
                    'total_line_disc' => $totalLineDisc,
                    'line_net_final' => $lineNetAfterAllDisc,
                    'line_tax' => $lineTax,
                    'line_total' => $lineTotal,
                ]);
            }

            /** @var numeric-string $grandTotal */
            $grandTotal = bcadd(bcsub($grossSubtotal, $totalDiscount, 4), $totalTax, 4);

            $bill = PurchaseBill::create([
                'tenant_id' => $data['tenant_id'],
                'bill_number' => $billNumber,
                'supplier_bill_number' => $invoiceNumber,
                'purchase_order_id' => $data['purchase_order_id'] ?? null,
                'goods_receipt_id' => $data['goods_receipt_id'] ?? null,
                'party_id' => $data['party_id'],
                'bill_date' => $data['bill_date'],
                'due_date' => $dueDate,
                'status' => 'draft',
                'subtotal' => $grossSubtotal,
                'discount_amount' => $totalDiscount,
                'tax_amount' => $totalTax,
                'other_charges' => '0.0000',
                'total_amount' => $grandTotal,
                'paid_amount' => '0.0000',
                'created_by' => $data['created_by'] ?? null,
            ]);

            foreach ($finalItems as $fi) {
                $rawItem = $fi['item'];
                $qty = $fi['quantity'];

                PurchaseBillItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'purchase_bill_id' => $bill->id,
                    'goods_receipt_item_id' => $rawItem['goods_receipt_item_id'] ?? null,
                    'product_id' => $rawItem['product_id'],
                    'description' => $rawItem['description'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => $rawItem['unit_id'],
                    'unit_price' => $fi['unit_price'],
                    'tax_profile_id' => $rawItem['tax_profile_id'] ?? null,
                    'tax_amount' => $fi['line_tax'],
                    'line_total' => $fi['line_total'],
                    'created_by' => $data['created_by'] ?? null,
                ]);

                // Update PO Item billed quantity if linked
                if (! empty($rawItem['purchase_order_item_id'])) {
                    /** @var PurchaseOrderItem|null $poItem */
                    $poItem = PurchaseOrderItem::where('tenant_id', $data['tenant_id'])
                        ->where('id', $rawItem['purchase_order_item_id'])
                        ->first();
                    if ($poItem instanceof PurchaseOrderItem) {
                        /** @var numeric-string $currentBilled */
                        $currentBilled = is_numeric($poItem->billed_quantity) ? (string) $poItem->billed_quantity : '0.0000';
                        $poItem->billed_quantity = bcadd($currentBilled, $qty, 4);
                        $poItem->save();
                    }
                }
            }

            // If linked to a PO, update PO billed_value
            if (! empty($data['purchase_order_id'])) {
                /** @var PurchaseOrder|null $po */
                $po = PurchaseOrder::where('tenant_id', $data['tenant_id'])
                    ->where('id', $data['purchase_order_id'])
                    ->first();
                if ($po instanceof PurchaseOrder) {
                    /** @var numeric-string $currentBilledVal */
                    $currentBilledVal = is_numeric($po->billed_value) ? (string) $po->billed_value : '0.0000';
                    $po->billed_value = bcadd($currentBilledVal, $grandTotal, 4);
                    $po->save();
                }
            }

            return $bill->load(['items.product', 'items.unit', 'supplier', 'purchaseOrder']);
        });
    }
}
