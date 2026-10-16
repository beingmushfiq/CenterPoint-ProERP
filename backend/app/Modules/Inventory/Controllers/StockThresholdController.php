<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Warehouse;
use App\Modules\Inventory\Models\ProductWarehouseMinStock;
use App\Modules\Inventory\Models\StockBalance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class StockThresholdController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $products = Product::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->where('is_stock_tracked', true)
            ->with(['category:id,name', 'baseUnit:id,name,code'])
            ->get();

        $warehouses = Warehouse::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get();

        $thresholds = ProductWarehouseMinStock::where('tenant_id', $tenantId)->get();
        $thresholdMap = [];
        foreach ($thresholds as $t) {
            $thresholdMap[$t->product_id.'_'.$t->warehouse_id] = $t;
        }

        // Sum current stock by product and warehouse
        $balances = StockBalance::where('tenant_id', $tenantId)
            ->where('stock_state', 'available')
            ->selectRaw('product_id, warehouse_id, SUM(quantity) as available_qty')
            ->groupBy('product_id', 'warehouse_id')
            ->get();

        $balanceMap = [];
        foreach ($balances as $b) {
            $balanceMap[$b->product_id.'_'.$b->warehouse_id] = (float) $b->available_qty;
        }

        $items = [];
        foreach ($products as $p) {
            foreach ($warehouses as $w) {
                $key = $p->id.'_'.$w->id;
                $threshold = $thresholdMap[$key] ?? null;
                $currentStock = $balanceMap[$key] ?? 0.0;
                $minAlert = $threshold ? (float) $threshold->min_stock_alert : (float) ($p->reorder_level ?? 10.0);
                $reorderQty = $threshold ? (float) $threshold->reorder_quantity : (float) ($p->reorder_quantity ?? 50.0);
                $maxLevel = $threshold ? (float) $threshold->max_stock_level : 500.0;

                $items[] = [
                    'product_id' => $p->id,
                    'product_name' => $p->name,
                    'sku' => $p->sku,
                    'category_name' => $p->category?->name ?? 'General',
                    'unit_code' => $p->baseUnit?->code ?? 'PCS',
                    'warehouse_id' => $w->id,
                    'warehouse_name' => $w->name,
                    'current_stock' => $currentStock,
                    'min_stock_alert' => $minAlert,
                    'reorder_quantity' => $reorderQty,
                    'max_stock_level' => $maxLevel,
                    'is_low_stock' => $currentStock <= $minAlert,
                    'deficit' => $currentStock < $minAlert ? ($minAlert - $currentStock) : 0.0,
                ];
            }
        }

        return response()->json([
            'data' => $items,
            'summary' => [
                'total_monitored' => count($items),
                'low_stock_count' => count(array_filter($items, fn ($i) => $i['is_low_stock'])),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $validated = $request->validate([
            'product_id' => ['required', 'integer'],
            'warehouse_id' => ['required', 'integer'],
            'min_stock_alert' => ['required', 'numeric', 'min:0'],
            'reorder_quantity' => ['required', 'numeric', 'min:0'],
            'max_stock_level' => ['nullable', 'numeric', 'min:0'],
        ]);

        $threshold = ProductWarehouseMinStock::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'product_id' => $validated['product_id'],
                'warehouse_id' => $validated['warehouse_id'],
            ],
            [
                'min_stock_alert' => (string) $validated['min_stock_alert'],
                'reorder_quantity' => (string) $validated['reorder_quantity'],
                'max_stock_level' => (string) ($validated['max_stock_level'] ?? '1000.0000'),
            ]
        );

        return response()->json([
            'data' => $threshold,
            'message' => 'Minimum stock alert threshold saved successfully',
        ]);
    }

    public function alerts(): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        // Get all alerts where stock <= min_stock_alert
        $thresholds = ProductWarehouseMinStock::where('tenant_id', $tenantId)
            ->with(['product:id,name,sku', 'warehouse:id,name'])
            ->get();

        $alerts = [];
        foreach ($thresholds as $t) {
            $stock = (float) StockBalance::where('tenant_id', $tenantId)
                ->where('product_id', $t->product_id)
                ->where('warehouse_id', $t->warehouse_id)
                ->where('stock_state', 'available')
                ->sum('quantity');

            $min = (float) $t->min_stock_alert;
            if ($stock <= $min) {
                $alerts[] = [
                    'product_id' => $t->product_id,
                    'product_name' => $t->product?->name ?? 'Unknown',
                    'sku' => $t->product?->sku ?? '',
                    'warehouse_id' => $t->warehouse_id,
                    'warehouse_name' => $t->warehouse?->name ?? '',
                    'current_stock' => $stock,
                    'min_stock_alert' => $min,
                    'deficit' => $min - $stock,
                ];
            }
        }

        return response()->json([
            'data' => $alerts,
            'count' => count($alerts),
        ]);
    }
}
