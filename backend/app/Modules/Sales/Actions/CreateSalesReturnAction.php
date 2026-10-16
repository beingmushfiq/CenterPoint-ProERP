<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Models\SalesReturn;
use App\Modules\Sales\Models\SalesReturnItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreateSalesReturnAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     return_date: string,
     *     warehouse_id: int,
     *     reason_code_id: int,
     *     invoice_id?: int|null,
     *     sales_order_id?: int|null,
     *     party_id?: int|null,
     *     restock?: bool,
     *     refund_method?: string,
     *     credit_note_number?: string|null,
     *     return_number?: string,
     *     created_by?: int|null,
     *     items: list<array{
     *         product_id: int,
     *         quantity: string,
     *         unit_id: int,
     *         unit_price: string,
     *         variant_id?: int|null,
     *         condition?: string,
     *         batch_code?: string|null
     *     }>
     * } $data
     */
    public function execute(array $data): SalesReturn
    {
        return DB::transaction(function () use ($data): SalesReturn {
            $returnNumber = $data['return_number'] ?? ('SR-'.date('Ymd').'-'.strtoupper(Str::random(6)));

            /** @var numeric-string $subtotal */
            $subtotal = '0.0000';

            foreach ($data['items'] as $item) {
                /** @var numeric-string $qty */
                $qty = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                /** @var numeric-string $price */
                $price = is_numeric($item['unit_price']) ? (string) $item['unit_price'] : '0.0000';

                /** @var numeric-string $lineSub */
                $lineSub = bcmul($qty, $price, 4);
                $subtotal = bcadd($subtotal, $lineSub, 4);
            }

            $salesReturn = SalesReturn::create([
                'tenant_id' => $data['tenant_id'],
                'return_number' => $returnNumber,
                'invoice_id' => $data['invoice_id'] ?? null,
                'sales_order_id' => $data['sales_order_id'] ?? null,
                'party_id' => $data['party_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'],
                'return_date' => $data['return_date'],
                'reason_code_id' => $data['reason_code_id'],
                'restock' => $data['restock'] ?? true,
                'subtotal' => $subtotal,
                'tax_amount' => '0.0000',
                'total_amount' => $subtotal,
                'refund_method' => $data['refund_method'] ?? 'credit_note',
                'credit_note_number' => $data['credit_note_number'] ?? (($data['refund_method'] ?? 'credit_note') === 'credit_note' ? 'CN-'.date('Ymd').'-'.strtoupper(Str::random(6)) : null),
                'status' => 'draft',
                'created_by' => $data['created_by'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                /** @var numeric-string $qty */
                $qty = (string) $item['quantity'];
                /** @var numeric-string $price */
                $price = (string) $item['unit_price'];
                /** @var numeric-string $lineTotal */
                $lineTotal = bcmul($qty, $price, 4);

                SalesReturnItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'sales_return_id' => $salesReturn->id,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => $item['unit_id'],
                    'unit_price' => $price,
                    'line_total' => $lineTotal,
                    'condition' => $item['condition'] ?? 'good',
                    'batch_code' => $item['batch_code'] ?? null,
                    'created_by' => $data['created_by'] ?? null,
                ]);
            }

            return $salesReturn->load(['items.product']);
        });
    }
}
