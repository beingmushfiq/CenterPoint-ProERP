<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Models\Party;
use App\Models\Product;
use App\Models\Unit;
use App\Modules\HR\Models\Employee;
use App\Modules\Sales\Models\CrmActivity;
use App\Modules\Sales\Models\CrmLead;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CreateSalesOrderAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     order_date: string,
     *     channel?: string,
     *     company_id?: int|null,
     *     branch_id?: int|null,
     *     warehouse_id?: int|null,
     *     party_id?: int|null,
     *     customer_name?: string|null,
     *     customer_phone?: string|null,
     *     pos_session_id?: int|null,
     *     required_date?: string|null,
     *     price_list_id?: int|null,
     *     currency_code?: string,
     *     shipping_amount?: string,
     *     round_off?: string,
     *     delivery_type?: string,
     *     salesperson_id?: int|null,
     *     notes?: string|null,
     *     internal_notes?: string|null,
     *     created_by?: int|null,
     *     order_number?: string,
     *     items: list<array{
     *         product_id: int,
     *         quantity: string,
     *         unit_id: int,
     *         unit_price: string,
     *         variant_id?: int|null,
     *         description?: string|null,
     *         discount_percentage?: string,
     *         discount_amount?: string,
     *         tax_profile_id?: int|null,
     *         tax_amount?: string,
     *         batch_code?: string|null,
     *         sort_order?: int
     *     }>
     * } $data
     */
    public function execute(array $data): SalesOrder
    {
        return DB::transaction(function () use ($data): SalesOrder {
            $orderNumber = $data['order_number'] ?? ('SO-' . date('Ymd') . '-' . strtoupper(Str::random(6)));

            /** @var numeric-string $grossSubtotal */
            $grossSubtotal = '0.0000';
            $processedItems = [];

            // Pass 1: calculate gross line amounts and line-level discounts
            foreach ($data['items'] as $idx => $item) {
                $rawProductId = $item['product_id'] ?? null;
                $productId = null;
                $product = null;

                if (is_numeric($rawProductId)) {
                    $productId = (int) $rawProductId;
                    $product = Product::where('tenant_id', $data['tenant_id'])->find($productId);
                } elseif (is_string($rawProductId) && $rawProductId !== '') {
                    $product = Product::where('tenant_id', $data['tenant_id'])->where('uuid', $rawProductId)->first();
                    $productId = $product?->id;
                }

                if (!$productId || !$product) {
                    throw ValidationException::withMessages([
                        "items.{$idx}.product_id" => ["The selected product is invalid or does not exist for this company."],
                    ]);
                }

                $rawUnitId = $item['unit_id'] ?? null;
                $unitId = null;
                if (is_numeric($rawUnitId)) {
                    $unitId = (int) $rawUnitId;
                } elseif (is_string($rawUnitId) && $rawUnitId !== '') {
                    $unit = Unit::where('tenant_id', $data['tenant_id'])->where('uuid', $rawUnitId)->first();
                    $unitId = $unit?->id;
                }

                if (!$unitId) {
                    $unitId = $product->base_unit_id;
                }

                if (!$unitId) {
                    throw ValidationException::withMessages([
                        "items.{$idx}.unit_id" => ["The selected unit of measure is invalid."],
                    ]);
                }

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
                    $discPct = $pct;
                } else {
                    $lineDisc = $discVal;
                    $discPct = bccomp($lineGross, '0.0000', 4) > 0 ? bcmul(bcdiv($lineDisc, $lineGross, 6), '100.0000', 4) : '0.0000';
                }

                if (bccomp($lineDisc, $lineGross, 4) > 0) {
                    $lineDisc = $lineGross;
                }

                /** @var numeric-string $lineNet */
                $lineNet = bcsub($lineGross, $lineDisc, 4);
                $grossSubtotal = bcadd($grossSubtotal, $lineGross, 4);

                $processedItems[] = [
                    'item' => $item,
                    'idx' => $idx,
                    'resolved_product_id' => $productId,
                    'resolved_unit_id' => $unitId,
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'line_gross' => $lineGross,
                    'line_disc' => $lineDisc,
                    'disc_pct' => $discPct,
                    'line_net' => $lineNet,
                ];
            }

            // Calculate net subtotal after item-level discounts
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

            // Calculate order-level discount
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

            // Pass 2: Allocate order discount proportionally to each item
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

                $taxAmt = isset($pi['item']['tax_amount']) && is_numeric($pi['item']['tax_amount']) ? (string) $pi['item']['tax_amount'] : '0.0000';
                $lineTotal = bcadd($lineNetAfterAllDisc, $taxAmt, 4);

                $totalDiscount = bcadd($totalDiscount, $totalLineDisc, 4);
                $totalTax = bcadd($totalTax, $taxAmt, 4);

                $finalItems[] = array_merge($pi, [
                    'allocated_order_disc' => $allocatedOrderDisc,
                    'total_line_disc' => $totalLineDisc,
                    'line_net_final' => $lineNetAfterAllDisc,
                    'tax_amount' => $taxAmt,
                    'line_total' => $lineTotal,
                ]);
            }

            /** @var numeric-string $shipping */
            $shipping = isset($data['shipping_amount']) && is_numeric($data['shipping_amount']) ? (string) $data['shipping_amount'] : '0.0000';
            /** @var numeric-string $roundOff */
            $roundOff = isset($data['round_off']) && is_numeric($data['round_off']) ? (string) $data['round_off'] : '0.0000';
            /** @var numeric-string $grandTotal */
            $grandTotal = bcadd(bcadd(bcsub(bcadd($grossSubtotal, $totalTax, 4), $totalDiscount, 4), $shipping, 4), $roundOff, 4);

            // 1. Resolve Party (Customer)
            $partyId = $data['party_id'] ?? null;
            $party = null;
            if ($partyId) {
                $partyQuery = Party::where('tenant_id', $data['tenant_id']);
                if (is_numeric($partyId)) {
                    $party = $partyQuery->find((int) $partyId);
                } else {
                    $party = $partyQuery->where('uuid', (string) $partyId)->first();
                }
                if ($party) {
                    $partyId = $party->id;
                }
            }

            $customerName = $data['customer_name'] ?? ($party?->name ?? 'Walk-in Customer');
            $customerPhone = $data['customer_phone'] ?? ($party?->phone ?? null);

            // 2. Resolve Salesman / Salesperson
            $userId = isset($data['created_by']) ? (int) $data['created_by'] : null;
            $salespersonId = isset($data['salesperson_id']) ? (int) $data['salesperson_id'] : $userId;
            $salesmanId = isset($data['salesman_id']) ? (int) $data['salesman_id'] : null;
            if (!$salesmanId && $userId) {
                $employee = Employee::where('tenant_id', $data['tenant_id'])->where('user_id', $userId)->first();
                if ($employee) {
                    $salesmanId = $employee->id;
                }
            }

            // 3. Create CRM Lead first with all info (pending verification if sold later)
            $leadId = isset($data['lead_id']) && is_numeric($data['lead_id']) ? (int) $data['lead_id'] : null;
            if (!$leadId) {
                $channel = $data['channel'] ?? 'counter';
                $sourceMapping = [
                    'counter' => 'walk_in',
                    'dealer'  => 'referral',
                    'phone'   => 'phone',
                    'field'   => 'field_visit',
                    'online'  => 'online',
                ];
                $leadSource = $sourceMapping[$channel] ?? 'walk_in';

                $lead = new CrmLead();
                $lead->tenant_id = $data['tenant_id'];
                $lead->name = $customerName;
                $lead->company_name = $party?->legal_name ?? $party?->name ?? null;
                $lead->phone = $customerPhone;
                $lead->email = $party?->email ?? null;
                $lead->source = $leadSource;
                $lead->stage = 'proposal'; // Placed order proposal, waiting for sale verification
                $lead->is_fake = false;
                $lead->validated_at = null; // Unverified initially; verified later when sold
                $lead->validated_by = null;
                $lead->assigned_to = $salespersonId;
                $lead->expected_value = $grandTotal;
                $lead->expected_close_date = $data['order_date'] ?? date('Y-m-d');
                $lead->converted_party_id = $partyId;

                $leadNotes = "Auto-created from sales order {$orderNumber}. Line items: " . count($data['items']) . ", Amount: {$grandTotal} BDT.";
                if (!empty($data['notes'])) {
                    $leadNotes .= "\nOrder Instructions: " . $data['notes'];
                }
                $lead->notes = $leadNotes;
                $lead->created_by = $userId;
                $lead->save();

                $leadId = $lead->id;

                // Log task activity on the newly minted lead
                $activity = new CrmActivity();
                $activity->tenant_id = $data['tenant_id'];
                $activity->subject_type = 'lead';
                $activity->subject_id = $lead->id;
                $activity->type = 'task';
                $activity->title = "Sales Order {$orderNumber} Placed";
                $activity->description = "Order for {$grandTotal} BDT placed. Lead pending sale verification.";
                $activity->assigned_to = $salespersonId;
                $activity->created_by = $userId;
                $activity->save();
            }

            // 4. Create Sales Order linked to Lead & Salesman
            $order = SalesOrder::create([
                'tenant_id'       => $data['tenant_id'],
                'order_number'    => $orderNumber,
                'channel'         => $data['channel'] ?? 'counter',
                'company_id'      => $data['company_id'] ?? null,
                'branch_id'       => $data['branch_id'] ?? null,
                'warehouse_id'    => $data['warehouse_id'] ?? null,
                'party_id'        => $partyId,
                'lead_id'         => $leadId,
                'salesman_id'     => $salesmanId,
                'customer_name'   => $customerName,
                'customer_phone'  => $customerPhone,
                'pos_session_id'  => $data['pos_session_id'] ?? null,
                'order_date'      => $data['order_date'],
                'required_date'   => $data['required_date'] ?? null,
                'price_list_id'   => $data['price_list_id'] ?? null,
                'currency_code'   => $data['currency_code'] ?? 'BDT',
                'subtotal'        => $grossSubtotal,
                'discount_amount' => $totalDiscount,
                'tax_amount'      => $totalTax,
                'shipping_amount' => $shipping,
                'round_off'       => $roundOff,
                'total_amount'    => $grandTotal,
                'paid_amount'     => '0.0000',
                'due_amount'      => $grandTotal,
                'delivery_type'   => $data['delivery_type'] ?? 'pickup',
                'status'          => 'draft',
                'payment_status'  => 'unpaid',
                'salesperson_id'  => $salespersonId,
                'notes'           => $data['notes'] ?? null,
                'internal_notes'  => $data['internal_notes'] ?? null,
                'created_by'      => $userId,
            ]);

            foreach ($finalItems as $fi) {
                SalesOrderItem::create([
                    'tenant_id'           => $data['tenant_id'],
                    'sales_order_id'      => $order->id,
                    'product_id'          => $fi['resolved_product_id'],
                    'variant_id'          => $fi['item']['variant_id'] ?? null,
                    'description'         => $fi['item']['description'] ?? null,
                    'quantity'            => $fi['quantity'],
                    'unit_id'             => $fi['resolved_unit_id'],
                    'unit_price'          => $fi['unit_price'],
                    'discount_percentage' => $fi['disc_pct'],
                    'discount_amount'     => $fi['total_line_disc'],
                    'tax_profile_id'      => $fi['item']['tax_profile_id'] ?? null,
                    'tax_amount'          => $fi['tax_amount'],
                    'line_total'          => $fi['line_total'],
                    'delivered_quantity'  => '0.0000',
                    'returned_quantity'   => '0.0000',
                    'batch_code'          => $fi['item']['batch_code'] ?? null,
                    'sort_order'          => $fi['item']['sort_order'] ?? $fi['idx'],
                    'created_by'          => $userId,
                ]);
            }

            // Sync salesman targets for the current month
            if ($salesmanId || $userId) {
                $periodMonth = substr($data['order_date'], 0, 7);
                app(\App\Modules\Sales\Actions\SyncSalesmanAchievementAction::class)
                    ->execute($data['tenant_id'], $salesmanId, $userId, $periodMonth);
            }

            return $order->load(['items.product', 'items.unit', 'customer', 'warehouse', 'lead']);
        });
    }
}
