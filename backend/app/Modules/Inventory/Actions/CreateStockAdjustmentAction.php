<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Actions;

use App\Modules\Inventory\Models\StockAdjustment;
use App\Modules\Inventory\Models\StockAdjustmentItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreateStockAdjustmentAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     warehouse_id: int,
     *     adjustment_date: string,
     *     reason_code_id: int,
     *     type?: string,
     *     adjustment_number?: string,
     *     notes?: string|null,
     *     created_by?: int|null,
     *     items: list<array{
     *         product_id: int,
     *         direction?: 'in'|'out',
     *         quantity: numeric-string|string,
     *         unit_id?: int,
     *         variant_id?: int|null,
     *         batch_code?: string|null,
     *         unit_cost?: numeric-string|string,
     *         notes?: string|null
     *     }>
     * } $data
     */
    public function execute(array $data): StockAdjustment
    {
        return DB::transaction(function () use ($data): StockAdjustment {
            $adjustmentNumber = $data['adjustment_number'] ?? ('ADJ-'.date('Ymd').'-'.strtoupper(Str::random(6)));
            $firstDirection = $data['items'][0]['direction'] ?? 'out';
            $type = $data['type'] ?? ($firstDirection === 'in' ? 'increase' : 'decrease');

            /** @var numeric-string $totalValueImpact */
            $totalValueImpact = '0.0000';

            foreach ($data['items'] as $item) {
                /** @var numeric-string $quantity */
                $quantity = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                /** @var numeric-string $unitCost */
                $unitCost = isset($item['unit_cost']) && is_numeric($item['unit_cost']) ? (string) $item['unit_cost'] : '0.0000';
                /** @var numeric-string $lineVal */
                $lineVal = bcmul($quantity, $unitCost, 4);
                $totalValueImpact = bcadd($totalValueImpact, $lineVal, 4);
            }

            $adjustment = StockAdjustment::create([
                'tenant_id' => $data['tenant_id'],
                'adjustment_number' => $adjustmentNumber,
                'warehouse_id' => $data['warehouse_id'],
                'adjustment_date' => $data['adjustment_date'],
                'type' => $type,
                'reason_code_id' => $data['reason_code_id'],
                'status' => 'draft',
                'total_value_impact' => $totalValueImpact,
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['created_by'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                /** @var numeric-string $quantity */
                $quantity = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                /** @var numeric-string $unitCost */
                $unitCost = isset($item['unit_cost']) && is_numeric($item['unit_cost']) ? (string) $item['unit_cost'] : '0.0000';
                $direction = $item['direction'] ?? ($type === 'increase' ? 'in' : 'out');
                /** @var numeric-string $diffQty */
                $diffQty = $direction === 'in' ? $quantity : bcmul($quantity, '-1', 4);

                StockAdjustmentItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'stock_adjustment_id' => $adjustment->id,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'batch_code' => $item['batch_code'] ?? null,
                    'system_quantity' => '0.0000',
                    'adjusted_quantity' => $quantity,
                    'difference_quantity' => $diffQty,
                    'unit_cost' => $unitCost,
                    'notes' => $item['notes'] ?? null,
                    'created_by' => $data['created_by'] ?? null,
                ]);
            }

            return $adjustment->load(['items.product', 'warehouse', 'reasonCode']);
        });
    }
}
