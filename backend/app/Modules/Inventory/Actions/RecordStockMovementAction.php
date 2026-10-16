<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Actions;

use App\Modules\Inventory\Models\StockBalance;
use App\Modules\Inventory\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RecordStockMovementAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     product_id: int,
     *     warehouse_id: int,
     *     movement_type: string,
     *     direction: 'in'|'out',
     *     quantity: numeric-string|string,
     *     unit_id: int,
     *     movement_number?: string,
     *     variant_id?: int|null,
     *     warehouse_location_id?: int|null,
     *     batch_code?: string|null,
     *     serial_number?: string|null,
     *     expiry_date?: string|null,
     *     stock_state?: string,
     *     unit_cost?: numeric-string|string,
     *     reference_type?: string|null,
     *     reference_id?: int|null,
     *     related_movement_id?: int|null,
     *     reason_code_id?: int|null,
     *     moved_at?: string|null,
     *     created_by?: int|null
     * } $data
     */
    public function execute(array $data): StockMovement
    {
        return DB::transaction(function () use ($data): StockMovement {
            $tenantId = $data['tenant_id'];
            $productId = $data['product_id'];
            $warehouseId = $data['warehouse_id'];
            $variantId = $data['variant_id'] ?? null;
            $locationId = $data['warehouse_location_id'] ?? null;
            $batchCode = $data['batch_code'] ?? null;
            $stockState = $data['stock_state'] ?? 'available';
            $direction = $data['direction'];

            /** @var numeric-string $quantity */
            $quantity = is_numeric($data['quantity']) ? (string) $data['quantity'] : '0.0000';
            /** @var numeric-string $unitCost */
            $unitCost = isset($data['unit_cost']) && is_numeric($data['unit_cost']) ? (string) $data['unit_cost'] : '0.0000';
            /** @var numeric-string $totalCost */
            $totalCost = bcmul($quantity, $unitCost, 4);

            $movementNumber = $data['movement_number'] ?? ('MOV-'.date('Ymd').'-'.strtoupper(Str::random(6)));
            $movedAt = isset($data['moved_at']) ? \Illuminate\Support\Carbon::parse($data['moved_at']) : now();

            // Find or initialize the exact StockBalance slot with pessimistic lock
            $balance = StockBalance::where('tenant_id', $tenantId)
                ->where('product_id', $productId)
                ->where('warehouse_id', $warehouseId)
                ->where('stock_state', $stockState)
                ->when($variantId !== null, fn ($q) => $q->where('variant_id', $variantId), fn ($q) => $q->whereNull('variant_id'))
                ->when($locationId !== null, fn ($q) => $q->where('warehouse_location_id', $locationId), fn ($q) => $q->whereNull('warehouse_location_id'))
                ->when($batchCode !== null, fn ($q) => $q->where('batch_code', $batchCode), fn ($q) => $q->whereNull('batch_code'))
                ->lockForUpdate()
                ->first();

            if (! $balance) {
                $balance = new StockBalance([
                    'tenant_id' => $tenantId,
                    'product_id' => $productId,
                    'variant_id' => $variantId,
                    'warehouse_id' => $warehouseId,
                    'warehouse_location_id' => $locationId,
                    'batch_code' => $batchCode,
                    'stock_state' => $stockState,
                    'quantity' => '0.0000',
                    'average_cost' => '0.0000',
                    'total_value' => '0.0000',
                ]);
            }

            /** @var numeric-string $currentQty */
            $currentQty = is_numeric($balance->quantity) ? (string) $balance->quantity : '0.0000';
            /** @var numeric-string $currentAvgCost */
            $currentAvgCost = is_numeric($balance->average_cost) ? (string) $balance->average_cost : '0.0000';
            /** @var numeric-string $currentTotalVal */
            $currentTotalVal = is_numeric($balance->total_value) ? (string) $balance->total_value : '0.0000';

            if ($direction === 'in') {
                /** @var numeric-string $newQty */
                $newQty = bcadd($currentQty, $quantity, 4);
                if (bccomp($newQty, '0.0000', 4) > 0 && bccomp($unitCost, '0.0000', 4) > 0) {
                    /** @var numeric-string $newTotalVal */
                    $newTotalVal = bcadd($currentTotalVal, $totalCost, 4);
                    /** @var numeric-string $newAvgCost */
                    $newAvgCost = bcdiv($newTotalVal, $newQty, 4);
                } else {
                    $newAvgCost = $currentAvgCost;
                    /** @var numeric-string $newTotalVal */
                    $newTotalVal = bcmul($newQty, $newAvgCost, 4);
                }
            } else {
                /** @var numeric-string $newQty */
                $newQty = bcsub($currentQty, $quantity, 4);
                $newAvgCost = $currentAvgCost;
                /** @var numeric-string $newTotalVal */
                $newTotalVal = bcmul($newQty, $newAvgCost, 4);
            }

            // Create append-only StockMovement
            $movement = StockMovement::create([
                'tenant_id' => $tenantId,
                'movement_number' => $movementNumber,
                'product_id' => $productId,
                'variant_id' => $variantId,
                'warehouse_id' => $warehouseId,
                'warehouse_location_id' => $locationId,
                'batch_code' => $batchCode,
                'serial_number' => $data['serial_number'] ?? null,
                'expiry_date' => $data['expiry_date'] ?? null,
                'movement_type' => $data['movement_type'],
                'direction' => $direction,
                'stock_state' => $stockState,
                'quantity' => $quantity,
                'unit_id' => $data['unit_id'],
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'balance_after' => $newQty,
                'reference_type' => $data['reference_type'] ?? null,
                'reference_id' => $data['reference_id'] ?? null,
                'related_movement_id' => $data['related_movement_id'] ?? null,
                'reason_code_id' => $data['reason_code_id'] ?? null,
                'moved_at' => $movedAt,
                'created_by' => $data['created_by'] ?? null,
            ]);

            // Update StockBalance
            $balance->quantity = $newQty;
            $balance->average_cost = $newAvgCost;
            $balance->total_value = $newTotalVal;
            $balance->last_movement_id = $movement->id;
            $balance->last_movement_at = $movedAt;
            $balance->save();

            return $movement;
        });
    }
}
