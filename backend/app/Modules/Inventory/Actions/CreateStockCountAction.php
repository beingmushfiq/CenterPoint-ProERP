<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Actions;

use App\Modules\Inventory\Models\StockBalance;
use App\Modules\Inventory\Models\StockCount;
use App\Modules\Inventory\Models\StockCountItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreateStockCountAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     warehouse_id: int,
     *     count_date: string,
     *     type?: string,
     *     count_type?: string,
     *     count_number?: string,
     *     notes?: string|null,
     *     created_by?: int|null,
     *     product_ids?: list<int>
     * } $data
     */
    public function execute(array $data): StockCount
    {
        return DB::transaction(function () use ($data): StockCount {
            $countNumber = $data['count_number'] ?? ('CNT-'.date('Ymd').'-'.strtoupper(Str::random(6)));
            $type = $data['type'] ?? $data['count_type'] ?? 'full';

            $stockCount = StockCount::create([
                'tenant_id' => $data['tenant_id'],
                'count_number' => $countNumber,
                'warehouse_id' => $data['warehouse_id'],
                'count_date' => $data['count_date'],
                'type' => $type,
                'status' => 'draft',
                'created_by' => $data['created_by'] ?? null,
            ]);

            // Query current stock balances in the warehouse to capture book snapshot
            $balancesQuery = StockBalance::with('product')
                ->where('tenant_id', $data['tenant_id'])
                ->where('warehouse_id', $data['warehouse_id'])
                ->where('stock_state', 'available');

            if (! empty($data['product_ids'])) {
                $balancesQuery->whereIn('product_id', $data['product_ids']);
            }

            /** @var \Illuminate\Database\Eloquent\Collection<int, StockBalance> $balances */
            $balances = $balancesQuery->get();

            foreach ($balances as $bal) {
                StockCountItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'stock_count_id' => $stockCount->id,
                    'product_id' => $bal->product_id,
                    'variant_id' => $bal->variant_id,
                    'warehouse_location_id' => $bal->warehouse_location_id,
                    'batch_code' => $bal->batch_code,
                    'system_quantity' => $bal->quantity,
                    'counted_quantity' => null,
                    'variance_quantity' => '0.0000',
                    'status' => 'pending',
                    'created_by' => $data['created_by'] ?? null,
                ]);
            }

            return $stockCount->load(['items.product', 'warehouse']);
        });
    }
}
