<?php

declare(strict_types=1);

namespace App\Modules\Pos\Actions;

use App\Modules\Inventory\Actions\RecordStockMovementAction;
use App\Modules\Pos\Models\PosSession;
use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Models\InvoiceItem;
use App\Modules\Sales\Models\Payment;
use App\Modules\Sales\Models\PaymentAllocation;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderItem;
use App\Modules\Sales\Models\SalesOrderPayment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProcessPosCheckoutAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement
    ) {}

    /**
     * @param array{
     *     tenant_id: int,
     *     user_id: int,
     *     pos_session_id: int,
     *     party_id?: int|null,
     *     customer_name?: string|null,
     *     customer_phone?: string|null,
     *     order_date?: string|null,
     *     discount_amount?: string,
     *     round_off?: string,
     *     notes?: string|null,
     *     idempotency_key?: string|null,
     *     items: list<array{
     *         product_id: int,
     *         quantity: string,
     *         unit_id: int,
     *         unit_price: string,
     *         variant_id?: int|null,
     *         discount_amount?: string,
     *         tax_profile_id?: int|null,
     *         tax_amount?: string
     *     }>,
     *     payments: list<array{
     *         method: string,
     *         amount: string,
     *         change_given?: string
     *     }>
     * } $data
     * @return array{
     *     order: SalesOrder,
     *     invoice: Invoice,
     *     session: PosSession
     * }
     */
    public function execute(array $data): array
    {
        return DB::transaction(function () use ($data): array {
            /** @var PosSession $session */
            $session = PosSession::where('tenant_id', $data['tenant_id'])
                ->where('id', $data['pos_session_id'])
                ->lockForUpdate()
                ->firstOrFail();

            if ($session->status !== 'open') {
                throw new \DomainException("POS Session [{$session->session_number}] is not open.");
            }

            $orderNumber   = 'POS-SO-' . date('Ymd') . '-' . strtoupper(Str::random(6));
            $invoiceNumber = 'POS-INV-' . date('Ymd') . '-' . strtoupper(Str::random(6));
            $orderDate     = $data['order_date'] ?? date('Y-m-d');

            /** @var numeric-string $subtotal */
            $subtotal = '0.0000';
            /** @var numeric-string $totalTax */
            $totalTax = '0.0000';
            /** @var numeric-string $totalLineDiscounts */
            $totalLineDiscounts = '0.0000';

            // First pass: compute line discounts and line gross/subtotals
            $computedItems = [];
            foreach ($data['items'] as $item) {
                /** @var numeric-string $qty */
                $qty = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                /** @var numeric-string $price */
                $price = is_numeric($item['unit_price']) ? (string) $item['unit_price'] : '0.0000';
                /** @var numeric-string $itemTax */
                $itemTax = isset($item['tax_amount']) && is_numeric($item['tax_amount']) ? (string) $item['tax_amount'] : '0.0000';

                /** @var numeric-string $lineGross */
                $lineGross = bcmul($qty, $price, 4);
                $subtotal = bcadd($subtotal, $lineGross, 4);
                $totalTax = bcadd($totalTax, $itemTax, 4);

                // Compute flat vs percentage line discount
                $itemDisc = '0.0000';
                $itemDiscPct = '0.00';
                if (isset($item['discount_type']) && $item['discount_type'] === 'percentage') {
                    $pct = isset($item['discount_value']) && is_numeric($item['discount_value']) ? (string) $item['discount_value'] : '0.00';
                    $itemDiscPct = $pct;
                    $itemDisc = bcdiv(bcmul($lineGross, $pct, 4), '100', 4);
                } elseif (isset($item['discount_percentage']) && is_numeric($item['discount_percentage']) && (float)$item['discount_percentage'] > 0) {
                    $pct = (string) $item['discount_percentage'];
                    $itemDiscPct = $pct;
                    $itemDisc = bcdiv(bcmul($lineGross, $pct, 4), '100', 4);
                } elseif (isset($item['discount_amount']) && is_numeric($item['discount_amount'])) {
                    $itemDisc = (string) $item['discount_amount'];
                } elseif (isset($item['discount_value']) && is_numeric($item['discount_value'])) {
                    $itemDisc = (string) $item['discount_value'];
                }

                if (bccomp($itemDisc, $lineGross, 4) > 0) {
                    $itemDisc = $lineGross;
                }

                $totalLineDiscounts = bcadd($totalLineDiscounts, $itemDisc, 4);
                $lineNet = bcsub($lineGross, $itemDisc, 4);

                $computedItems[] = [
                    'raw'         => $item,
                    'qty'         => $qty,
                    'price'       => $price,
                    'tax'         => $itemTax,
                    'lineGross'   => $lineGross,
                    'lineDisc'    => $itemDisc,
                    'lineDiscPct' => $itemDiscPct,
                    'lineNet'     => $lineNet,
                ];
            }

            // Order-level discount calculation (Flat or Percentage)
            $orderNetSubtotal = bcsub($subtotal, $totalLineDiscounts, 4);
            if (bccomp($orderNetSubtotal, '0.0000', 4) < 0) {
                $orderNetSubtotal = '0.0000';
            }

            $orderDiscountAmount = '0.0000';
            if (isset($data['order_discount_type']) && $data['order_discount_type'] === 'percentage') {
                $orderPct = isset($data['order_discount_value']) && is_numeric($data['order_discount_value']) ? (string) $data['order_discount_value'] : '0.00';
                $orderDiscountAmount = bcdiv(bcmul($orderNetSubtotal, $orderPct, 4), '100', 4);
            } elseif (isset($data['order_discount_value']) && is_numeric($data['order_discount_value'])) {
                $orderDiscountAmount = (string) $data['order_discount_value'];
            } elseif (isset($data['discount_amount']) && is_numeric($data['discount_amount'])) {
                // If only total discount_amount was provided without separate order_discount_value:
                // Subtract totalLineDiscounts so line discounts are never double-counted
                $orderDiscountAmount = bcsub((string) $data['discount_amount'], $totalLineDiscounts, 4);
                if (bccomp($orderDiscountAmount, '0.0000', 4) < 0) {
                    $orderDiscountAmount = '0.0000';
                }
            }

            if (bccomp($orderDiscountAmount, $orderNetSubtotal, 4) > 0) {
                $orderDiscountAmount = $orderNetSubtotal;
            }

            $totalDiscount = bcadd($totalLineDiscounts, $orderDiscountAmount, 4);

            /** @var numeric-string $roundOff */
            $roundOff = isset($data['round_off']) && is_numeric($data['round_off']) ? (string) $data['round_off'] : '0.0000';
            /** @var numeric-string $grandTotal */
            $grandTotal = bcadd(bcsub(bcadd($subtotal, $totalTax, 4), $totalDiscount, 4), $roundOff, 4);

            // 1. Create Sales Order
            $order = SalesOrder::create([
                'tenant_id'       => $data['tenant_id'],
                'order_number'    => $orderNumber,
                'channel'         => 'counter',
                'branch_id'       => $session->branch_id,
                'warehouse_id'    => $session->warehouse_id,
                'party_id'        => $data['party_id'] ?? null,
                'customer_name'   => $data['customer_name'] ?? null,
                'customer_phone'  => $data['customer_phone'] ?? null,
                'pos_session_id'  => $session->id,
                'order_date'      => $orderDate,
                'currency_code'   => 'BDT',
                'subtotal'        => $subtotal,
                'discount_amount' => $totalDiscount,
                'tax_amount'      => $totalTax,
                'shipping_amount' => '0.0000',
                'round_off'       => $roundOff,
                'total_amount'    => $grandTotal,
                'paid_amount'     => $grandTotal,
                'due_amount'      => '0.0000',
                'status'          => 'delivered',
                'payment_status'  => 'paid',
                'notes'           => $data['notes'] ?? null,
                'created_by'      => $data['user_id'],
            ]);

            // 2. Line Items & Stock Deduction with proportional order discount allocation
            foreach ($computedItems as $cIdx => $computed) {
                $item = $computed['raw'];
                $qty = $computed['qty'];
                $price = $computed['price'];
                $tax = $computed['tax'];
                $lineDisc = $computed['lineDisc'];
                $lineNet = $computed['lineNet'];

                // Allocate order discount proportionally across line items
                $allocatedOrderDisc = '0.0000';
                if (bccomp($orderNetSubtotal, '0.0000', 4) > 0 && bccomp($orderDiscountAmount, '0.0000', 4) > 0) {
                    $allocatedOrderDisc = bcdiv(bcmul($orderDiscountAmount, $lineNet, 6), $orderNetSubtotal, 4);
                }

                $effectiveLineDisc = bcadd($lineDisc, $allocatedOrderDisc, 4);
                $effectiveLineTotal = bcadd(bcsub($computed['lineGross'], $effectiveLineDisc, 4), $tax, 4);

                $computedItems[$cIdx]['effectiveLineDisc'] = $effectiveLineDisc;
                $computedItems[$cIdx]['effectiveLineTotal'] = $effectiveLineTotal;

                SalesOrderItem::create([
                    'tenant_id'          => $data['tenant_id'],
                    'sales_order_id'     => $order->id,
                    'product_id'         => $item['product_id'],
                    'variant_id'         => $item['variant_id'] ?? null,
                    'quantity'           => $qty,
                    'unit_id'            => $item['unit_id'],
                    'unit_price'         => $price,
                    'discount_percentage'=> $computed['lineDiscPct'],
                    'discount_amount'    => $effectiveLineDisc,
                    'tax_profile_id'     => $item['tax_profile_id'] ?? null,
                    'tax_amount'         => $tax,
                    'line_total'         => $effectiveLineTotal,
                    'delivered_quantity' => $qty,
                    'returned_quantity'  => '0.0000',
                ]);

                // Record stock movement (outbound POS sale)
                if ($session->warehouse_id) {
                    $this->recordStockMovement->execute([
                        'tenant_id'      => $data['tenant_id'],
                        'product_id'     => $item['product_id'],
                        'variant_id'     => $item['variant_id'] ?? null,
                        'warehouse_id'   => $session->warehouse_id,
                        'movement_type'  => 'pos_sale',
                        'direction'      => 'out',
                        'quantity'       => $qty,
                        'unit_id'        => $item['unit_id'],
                        'unit_cost'      => $price,
                        'reference_type' => 'sales_order',
                        'reference_id'   => $order->id,
                        'moved_at'       => $orderDate,
                        'created_by'     => $data['user_id'],
                    ]);
                }
            }

            // 3. Create Invoice
            $invoice = Invoice::create([
                'tenant_id'       => $data['tenant_id'],
                'invoice_number'  => $invoiceNumber,
                'sales_order_id'  => $order->id,
                'branch_id'       => $session->branch_id,
                'party_id'        => $data['party_id'] ?? null,
                'invoice_date'    => $orderDate,
                'subtotal'        => $subtotal,
                'discount_amount' => $totalDiscount,
                'tax_amount'      => $totalTax,
                'shipping_amount' => '0.0000',
                'round_off'       => $roundOff,
                'total_amount'    => $grandTotal,
                'paid_amount'     => $grandTotal,
                'status'          => 'paid',
                'created_by'      => $data['user_id'],
            ]);

            foreach ($computedItems as $computed) {
                $item = $computed['raw'];
                InvoiceItem::create([
                    'tenant_id'       => $data['tenant_id'],
                    'invoice_id'      => $invoice->id,
                    'product_id'      => $item['product_id'],
                    'quantity'        => $computed['qty'],
                    'unit_id'         => $item['unit_id'],
                    'unit_price'      => $computed['price'],
                    'discount_amount' => $computed['effectiveLineDisc'],
                    'tax_amount'      => $computed['tax'],
                    'line_total'      => $computed['effectiveLineTotal'],
                ]);
            }

            // 4. Payments and Shift Financial Tracking
            foreach ($data['payments'] as $paymentItem) {
                /** @var numeric-string $amt */
                $amt = (string) $paymentItem['amount'];
                /** @var numeric-string $change */
                $change = isset($paymentItem['change_given']) && is_numeric($paymentItem['change_given']) ? (string) $paymentItem['change_given'] : '0.0000';

                // Sales Order Payment record (tender)
                SalesOrderPayment::create([
                    'tenant_id'      => $data['tenant_id'],
                    'sales_order_id' => $order->id,
                    'method'         => $paymentItem['method'],
                    'amount'         => $amt,
                    'change_given'   => $change,
                ]);

                // Payment entry (allocated net settled amount to the invoice)
                /** @var numeric-string $netAmt */
                $netAmt = ($paymentItem['method'] === 'cash') ? bcsub($amt, $change, 4) : $amt;

                if (bccomp($netAmt, '0.0000', 4) > 0) {
                    $payment = Payment::create([
                        'tenant_id'          => $data['tenant_id'],
                        'payment_number'     => 'PAY-' . date('Ymd') . '-' . strtoupper(Str::random(6)),
                        'direction'          => 'in',
                        'party_id'           => $data['party_id'] ?? null,
                        'branch_id'          => $session->branch_id,
                        'payment_date'       => $orderDate,
                        'method'             => $paymentItem['method'],
                        'amount'             => $netAmt,
                        'allocated_amount'   => $netAmt,
                        'unallocated_amount' => '0.0000',
                        'currency_code'      => $data['currency_code'] ?? 'BDT',
                        'status'             => 'posted',
                        'created_by'         => $data['user_id'],
                    ]);

                    PaymentAllocation::create([
                        'tenant_id'        => $data['tenant_id'],
                        'payment_id'       => $payment->id,
                        'allocatable_type' => 'invoice',
                        'allocatable_id'   => $invoice->id,
                        'amount'           => $netAmt,
                    ]);
                }

                // Update Session totals
                if ($paymentItem['method'] === 'cash') {
                    // Subtract change given if any
                    /** @var numeric-string $netCash */
                    $netCash = bcsub($amt, $change, 4);
                    $session->expected_cash = bcadd((string) $session->expected_cash, $netCash, 4);
                } elseif ($paymentItem['method'] === 'card') {
                    $session->card_total = bcadd((string) $session->card_total, $amt, 4);
                } elseif ($paymentItem['method'] === 'mobile_banking') {
                    $session->mobile_total = bcadd((string) $session->mobile_total, $amt, 4);
                } elseif ($paymentItem['method'] === 'credit_adjustment') {
                    $session->credit_total = bcadd((string) $session->credit_total, $amt, 4);
                }
            }

            $session->sales_count += 1;
            $session->save();

            return [
                'order'   => $order->load(['items.product', 'items.unit']),
                'invoice' => $invoice->load(['items.product']),
                'session' => $session->refresh(),
            ];
        });
    }
}
