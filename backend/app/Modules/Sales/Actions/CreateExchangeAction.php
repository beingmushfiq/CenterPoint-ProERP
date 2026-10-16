<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Models\Exchange;
use App\Modules\Sales\Models\ExchangeReplacementItem;
use App\Modules\Sales\Models\ExchangeReturnItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreateExchangeAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     exchange_date: string,
     *     warehouse_id: int,
     *     reason_code_id: int,
     *     original_invoice_id?: int|null,
     *     original_sales_order_id?: int|null,
     *     party_id?: int|null,
     *     pos_session_id?: int|null,
     *     exchange_number?: string,
     *     notes?: string|null,
     *     created_by?: int|null,
     *     return_items: list<array{
     *         product_id: int,
     *         quantity: string,
     *         unit_id: int,
     *         unit_price: string,
     *         variant_id?: int|null,
     *         condition?: string,
     *         restock?: bool,
     *         batch_code?: string|null
     *     }>,
     *     replacement_items: list<array{
     *         product_id: int,
     *         quantity: string,
     *         unit_id: int,
     *         unit_price: string,
     *         variant_id?: int|null,
     *         batch_code?: string|null
     *     }>
     * } $data
     */
    public function execute(array $data): Exchange
    {
        return DB::transaction(function () use ($data): Exchange {
            $exchangeNumber = $data['exchange_number'] ?? ('EX-'.date('Ymd').'-'.strtoupper(Str::random(6)));

            // Calculate return subtotal
            $returnSubtotal = '0.0000';
            foreach ($data['return_items'] as $item) {
                $qty = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                $price = is_numeric($item['unit_price']) ? (string) $item['unit_price'] : '0.0000';
                $returnSubtotal = bcadd($returnSubtotal, bcmul($qty, $price, 4), 4);
            }

            // Calculate replacement subtotal
            $replacementSubtotal = '0.0000';
            foreach ($data['replacement_items'] as $item) {
                $qty = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                $price = is_numeric($item['unit_price']) ? (string) $item['unit_price'] : '0.0000';
                $replacementSubtotal = bcadd($replacementSubtotal, bcmul($qty, $price, 4), 4);
            }

            // Difference: positive = customer owes top-up, negative = customer gets refund
            $differenceAmount = bcsub($replacementSubtotal, $returnSubtotal, 4);

            $differenceSettlement = 'none';
            if (bccomp($differenceAmount, '0.0000', 4) > 0) {
                $differenceSettlement = 'top_up';
            } elseif (bccomp($differenceAmount, '0.0000', 4) < 0) {
                $differenceSettlement = 'refund';
            }

            // Determine exchange type
            $exchangeType = 'like_for_like';
            if ($differenceSettlement === 'top_up') {
                $exchangeType = 'upgrade';
            } elseif ($differenceSettlement === 'refund') {
                $exchangeType = 'downgrade';
            }

            $exchange = Exchange::create([
                'tenant_id' => $data['tenant_id'],
                'exchange_number' => $exchangeNumber,
                'original_invoice_id' => $data['original_invoice_id'] ?? null,
                'original_sales_order_id' => $data['original_sales_order_id'] ?? null,
                'party_id' => $data['party_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'],
                'pos_session_id' => $data['pos_session_id'] ?? null,
                'exchange_date' => $data['exchange_date'],
                'reason_code_id' => $data['reason_code_id'],
                'exchange_type' => $exchangeType,
                'return_subtotal' => $returnSubtotal,
                'replacement_subtotal' => $replacementSubtotal,
                'difference_amount' => $differenceAmount,
                'difference_settlement' => $differenceSettlement,
                'status' => 'draft',
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['created_by'] ?? null,
            ]);

            // Create return items
            foreach ($data['return_items'] as $item) {
                $qty = (string) $item['quantity'];
                $price = (string) $item['unit_price'];
                $lineTotal = bcmul($qty, $price, 4);

                ExchangeReturnItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'exchange_id' => $exchange->id,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => $item['unit_id'],
                    'unit_price' => $price,
                    'line_total' => $lineTotal,
                    'condition' => $item['condition'] ?? 'good',
                    'restock' => $item['restock'] ?? true,
                    'batch_code' => $item['batch_code'] ?? null,
                    'created_by' => $data['created_by'] ?? null,
                ]);
            }

            // Create replacement items
            foreach ($data['replacement_items'] as $item) {
                $qty = (string) $item['quantity'];
                $price = (string) $item['unit_price'];
                $lineTotal = bcmul($qty, $price, 4);

                ExchangeReplacementItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'exchange_id' => $exchange->id,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => $item['unit_id'],
                    'unit_price' => $price,
                    'line_total' => $lineTotal,
                    'batch_code' => $item['batch_code'] ?? null,
                    'created_by' => $data['created_by'] ?? null,
                ]);
            }

            return $exchange->load(['returnItems.product', 'replacementItems.product', 'customer', 'warehouse', 'reasonCode']);
        });
    }
}
