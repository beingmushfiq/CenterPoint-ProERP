<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Warehouse;
use App\Modules\Inventory\Actions\RecordStockMovementAction;
use App\Modules\Inventory\Models\StockBalance;
use Illuminate\Database\Seeder;

final class StockTableSeeder extends Seeder
{
    public function run(): void
    {
        // Allow negative stock on retail/counter warehouses to ensure POS checkout never locks up
        Warehouse::where('tenant_id', 1)->update(['allows_negative_stock' => true]);

        $recordStockMovement = app(RecordStockMovementAction::class);
        $products = Product::where('tenant_id', 1)->get();
        $warehouses = Warehouse::where('tenant_id', 1)->get();

        foreach ($warehouses as $warehouse) {
            foreach ($products as $product) {
                $existing = StockBalance::where('tenant_id', 1)
                    ->where('product_id', $product->id)
                    ->where('warehouse_id', $warehouse->id)
                    ->where('stock_state', 'available')
                    ->first();

                if ($existing && bccomp((string) $existing->quantity, '0.0000', 4) > 0) {
                    continue;
                }

                $cost = is_numeric($product->standard_cost) && bccomp((string) $product->standard_cost, '0.0000', 4) > 0
                    ? (string) $product->standard_cost
                    : '150.0000';

                $recordStockMovement->execute([
                    'tenant_id' => 1,
                    'product_id' => $product->id,
                    'warehouse_id' => $warehouse->id,
                    'movement_type' => 'opening_balance',
                    'direction' => 'in',
                    'quantity' => '500.0000',
                    'unit_id' => $product->base_unit_id,
                    'unit_cost' => $cost,
                    'stock_state' => 'available',
                    'moved_at' => now()->toIso8601String(),
                    'created_by' => 1,
                ]);
            }
        }
    }
}
