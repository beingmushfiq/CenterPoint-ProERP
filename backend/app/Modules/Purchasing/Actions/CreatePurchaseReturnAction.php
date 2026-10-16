<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Actions;

use App\Modules\Inventory\Actions\RecordStockMovementAction;
use App\Modules\Purchasing\Models\PurchaseReturn;
use App\Modules\Purchasing\Models\PurchaseReturnItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreatePurchaseReturnAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordMovement
    ) {}

    /**
     * @param array{
     *     tenant_id: int,
     *     party_id: int,
     *     warehouse_id: int,
     *     return_date: string,
     *     return_number?: string,
     *     goods_receipt_id?: int|null,
     *     reason_code_id?: int|null,
     *     created_by?: int|null,
     *     items: list<array{
     *         product_id: int,
     *         quantity: numeric-string|string,
     *         unit_id: int,
     *         unit_price?: numeric-string|string,
     *         unit_cost?: numeric-string|string,
     *         reason_code_id?: int|null,
     *         variant_id?: int|null,
     *         warehouse_location_id?: int|null,
     *         batch_code?: string|null
     *     }>
     * } $data
     */
    public function execute(array $data): PurchaseReturn
    {
        return DB::transaction(function () use ($data): PurchaseReturn {
            $returnNumber = $data['return_number'] ?? ('PRT-'.date('Ymd').'-'.strtoupper(Str::random(6)));

            /** @var numeric-string $totalAmount */
            $totalAmount = '0.0000';

            foreach ($data['items'] as $item) {
                /** @var numeric-string $qty */
                $qty = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                /** @var numeric-string $price */
                $price = isset($item['unit_price']) && is_numeric($item['unit_price'])
                    ? (string) $item['unit_price']
                    : (isset($item['unit_cost']) && is_numeric($item['unit_cost']) ? (string) $item['unit_cost'] : '0.0000');
                /** @var numeric-string $lineTotal */
                $lineTotal = bcmul($qty, $price, 4);
                $totalAmount = bcadd($totalAmount, $lineTotal, 4);
            }

            $reasonCodeId = $data['reason_code_id'] ?? ($data['items'][0]['reason_code_id'] ?? 1);

            $return = PurchaseReturn::create([
                'tenant_id' => $data['tenant_id'],
                'return_number' => $returnNumber,
                'party_id' => $data['party_id'],
                'goods_receipt_id' => $data['goods_receipt_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'],
                'return_date' => $data['return_date'],
                'reason_code_id' => $reasonCodeId,
                'subtotal' => $totalAmount,
                'tax_amount' => '0.0000',
                'total_amount' => $totalAmount,
                'status' => 'completed',
                'created_by' => $data['created_by'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                /** @var numeric-string $qty */
                $qty = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                /** @var numeric-string $price */
                $price = isset($item['unit_price']) && is_numeric($item['unit_price'])
                    ? (string) $item['unit_price']
                    : (isset($item['unit_cost']) && is_numeric($item['unit_cost']) ? (string) $item['unit_cost'] : '0.0000');
                /** @var numeric-string $lineTotal */
                $lineTotal = bcmul($qty, $price, 4);

                // Post negative stock movement for return to vendor
                $movement = $this->recordMovement->execute([
                    'tenant_id' => $data['tenant_id'],
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'warehouse_id' => $data['warehouse_id'],
                    'warehouse_location_id' => $item['warehouse_location_id'] ?? null,
                    'batch_code' => $item['batch_code'] ?? null,
                    'movement_type' => 'purchase_return',
                    'direction' => 'out',
                    'quantity' => $qty,
                    'unit_id' => $item['unit_id'],
                    'unit_cost' => $price,
                    'reference_type' => 'purchase_returns',
                    'reference_id' => $return->id,
                    'reason_code_id' => $item['reason_code_id'] ?? $reasonCodeId,
                    'created_by' => $data['created_by'] ?? null,
                ]);

                PurchaseReturnItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'purchase_return_id' => $return->id,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'batch_code' => $item['batch_code'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => $item['unit_id'],
                    'unit_cost' => $price,
                    'line_total' => $lineTotal,
                    'stock_movement_id' => $movement->id,
                    'created_by' => $data['created_by'] ?? null,
                ]);
            }

            return $return->load(['items.product', 'items.unit', 'supplier', 'warehouse']);
        });
    }
}
