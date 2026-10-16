<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Models\InvoiceItem;
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreateInvoiceAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     sales_order_id?: int|null,
     *     company_id?: int|null,
     *     branch_id?: int|null,
     *     party_id?: int|null,
     *     invoice_date: string,
     *     due_date?: string|null,
     *     invoice_template_id?: int|null,
     *     created_by?: int|null,
     *     invoice_number?: string,
     *     items: list<array{
     *         product_id?: int|null,
     *         sales_order_item_id?: int|null,
     *         description?: string|null,
     *         quantity: string,
     *         unit_id?: int|null,
     *         unit_price: string,
     *         discount_amount?: string,
     *         tax_profile_id?: int|null,
     *         tax_amount?: string,
     *         sort_order?: int
     *     }>
     * } $data
     */
    public function execute(array $data): Invoice
    {
        return DB::transaction(function () use ($data): Invoice {
            $invoiceNumber = $data['invoice_number'] ?? ('INV-'.date('Ymd').'-'.strtoupper(Str::random(6)));

            /** @var numeric-string $subtotal */
            $subtotal = '0.0000';
            /** @var numeric-string $totalTax */
            $totalTax = '0.0000';
            /** @var numeric-string $totalDiscount */
            $totalDiscount = '0.0000';

            foreach ($data['items'] as $item) {
                /** @var numeric-string $qty */
                $qty = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                /** @var numeric-string $price */
                $price = is_numeric($item['unit_price']) ? (string) $item['unit_price'] : '0.0000';
                /** @var numeric-string $disc */
                $disc = isset($item['discount_amount']) && is_numeric($item['discount_amount']) ? (string) $item['discount_amount'] : '0.0000';
                /** @var numeric-string $taxAmt */
                $taxAmt = isset($item['tax_amount']) && is_numeric($item['tax_amount']) ? (string) $item['tax_amount'] : '0.0000';

                /** @var numeric-string $lineSub */
                $lineSub = bcmul($qty, $price, 4);
                $subtotal = bcadd($subtotal, $lineSub, 4);
                $totalDiscount = bcadd($totalDiscount, $disc, 4);
                $totalTax = bcadd($totalTax, $taxAmt, 4);
            }

            /** @var numeric-string $grandTotal */
            $grandTotal = bcadd(bcsub(bcadd($subtotal, $totalTax, 4), $totalDiscount, 4), '0.0000', 4);

            $invoice = Invoice::create([
                'tenant_id' => $data['tenant_id'],
                'invoice_number' => $invoiceNumber,
                'sales_order_id' => $data['sales_order_id'] ?? null,
                'company_id' => $data['company_id'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
                'party_id' => $data['party_id'] ?? null,
                'invoice_date' => $data['invoice_date'],
                'due_date' => $data['due_date'] ?? null,
                'subtotal' => $subtotal,
                'discount_amount' => $totalDiscount,
                'tax_amount' => $totalTax,
                'shipping_amount' => '0.0000',
                'round_off' => '0.0000',
                'total_amount' => $grandTotal,
                'paid_amount' => '0.0000',
                'status' => 'draft',
                'invoice_template_id' => $data['invoice_template_id'] ?? null,
                'printed_count' => 0,
                'created_by' => $data['created_by'] ?? null,
            ]);

            // Also update the linked SalesOrder's due_amount if provided
            if (isset($data['sales_order_id'])) {
                $so = SalesOrder::where('tenant_id', $data['tenant_id'])
                    ->where('id', $data['sales_order_id'])
                    ->first();
                if ($so && $so->status === 'draft') {
                    $so->status = 'confirmed';
                    $so->save();
                }
            }

            foreach ($data['items'] as $idx => $item) {
                /** @var numeric-string $qty */
                $qty = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                /** @var numeric-string $price */
                $price = is_numeric($item['unit_price']) ? (string) $item['unit_price'] : '0.0000';
                /** @var numeric-string $disc */
                $disc = isset($item['discount_amount']) && is_numeric($item['discount_amount']) ? (string) $item['discount_amount'] : '0.0000';
                /** @var numeric-string $taxAmt */
                $taxAmt = isset($item['tax_amount']) && is_numeric($item['tax_amount']) ? (string) $item['tax_amount'] : '0.0000';

                /** @var numeric-string $lineNet */
                $lineNet = bcsub(bcmul($qty, $price, 4), $disc, 4);
                /** @var numeric-string $lineTotal */
                $lineTotal = bcadd($lineNet, $taxAmt, 4);

                InvoiceItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'invoice_id' => $invoice->id,
                    'sales_order_item_id' => $item['sales_order_item_id'] ?? null,
                    'product_id' => $item['product_id'] ?? null,
                    'description' => $item['description'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => $item['unit_id'] ?? null,
                    'unit_price' => $price,
                    'discount_amount' => $disc,
                    'tax_profile_id' => $item['tax_profile_id'] ?? null,
                    'tax_amount' => $taxAmt,
                    'line_total' => $lineTotal,
                    'sort_order' => $item['sort_order'] ?? $idx,
                    'created_by' => $data['created_by'] ?? null,
                ]);
            }

            return $invoice->load(['items.product', 'customer', 'salesOrder']);
        });
    }
}
