<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Inventory\Models\StockBalance;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Inventory\Resources\StockBalanceResource;
use App\Modules\Inventory\Resources\StockMovementResource;
use App\Core\Tenancy\TenantContext;
use App\Models\Product;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Models\WarehouseLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class StockMovementController extends Controller
{
    public function bulkImport(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id();

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['required', 'array'],
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Preload products for tenant
        $productSkuMap = Product::query()
            ->where('tenant_id', $tenantId)
            ->get()
            ->keyBy(fn ($p) => strtolower((string) $p->sku));

        // Preload warehouses for tenant
        $warehouses = Warehouse::query()
            ->where('tenant_id', $tenantId)
            ->get();

        $warehouseMap = [];
        foreach ($warehouses as $wh) {
            if ($wh->code) {
                $warehouseMap[strtolower((string) $wh->code)] = $wh;
            }
            $warehouseMap[strtolower((string) $wh->name)] = $wh;
        }

        // Preload warehouse locations
        $locations = WarehouseLocation::query()
            ->where('tenant_id', $tenantId)
            ->get();

        $locationMap = [];
        foreach ($locations as $loc) {
            $key = $loc->warehouse_id . ':' . strtolower((string) $loc->code);
            $locationMap[$key] = $loc;
        }

        // Preload default unit
        $defaultUnit = Unit::query()->where('tenant_id', $tenantId)->first();
        $defaultUnitId = $defaultUnit ? $defaultUnit->id : 1;

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $userId,
                $mode,
                $productSkuMap,
                $warehouseMap,
                &$locationMap,
                $defaultUnitId,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ) {
                foreach ($chunk as $index => $row) {
                    $rowNum = ($chunkIndex * 100) + $index + 1;
                    $sku = trim((string) ($row['sku'] ?? $row['product_sku'] ?? ''));
                    $whCode = trim((string) ($row['warehouse_code'] ?? $row['warehouse'] ?? ''));
                    $locCode = isset($row['location_code']) && trim((string) $row['location_code']) !== '' ? trim((string) $row['location_code']) : (isset($row['bin']) && trim((string) $row['bin']) !== '' ? trim((string) $row['bin']) : null);
                    $batchCode = isset($row['batch_code']) && trim((string) $row['batch_code']) !== '' ? trim((string) $row['batch_code']) : (isset($row['batch_number']) && trim((string) $row['batch_number']) !== '' ? trim((string) $row['batch_number']) : null);
                    $expiryDate = isset($row['expiry_date']) && trim((string) $row['expiry_date']) !== '' ? trim((string) $row['expiry_date']) : null;
                    $stockState = isset($row['stock_state']) && in_array(strtolower(trim((string) $row['stock_state'])), ['available', 'reserved', 'quarantine', 'damaged', 'in_transit'], true)
                        ? strtolower(trim((string) $row['stock_state']))
                        : 'available';
                    $quantity = isset($row['quantity']) ? (float) $row['quantity'] : (isset($row['opening_stock']) ? (float) $row['opening_stock'] : 0.0);
                    $unitCost = isset($row['unit_cost']) ? (float) $row['unit_cost'] : (isset($row['cost']) ? (float) $row['cost'] : 0.0);

                    if ($sku === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'sku',
                            'value' => '',
                            'message' => 'Product SKU is required.',
                        ];
                        continue;
                    }

                    if ($whCode === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'warehouse_code',
                            'value' => '',
                            'message' => 'Warehouse code or name is required.',
                        ];
                        continue;
                    }

                    if ($quantity <= 0) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'quantity',
                            'value' => (string) $quantity,
                            'message' => 'Quantity must be greater than zero.',
                        ];
                        continue;
                    }

                    $product = $productSkuMap[strtolower($sku)] ?? null;
                    if (!$product) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'sku',
                            'value' => $sku,
                            'message' => "Product with SKU '{$sku}' does not exist.",
                        ];
                        continue;
                    }

                    $warehouse = $warehouseMap[strtolower($whCode)] ?? null;
                    if (!$warehouse) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'warehouse_code',
                            'value' => $whCode,
                            'message' => "Warehouse '{$whCode}' does not exist.",
                        ];
                        continue;
                    }

                    $locationId = null;
                    if ($locCode !== null) {
                        $locKey = $warehouse->id . ':' . strtolower($locCode);
                        if (isset($locationMap[$locKey])) {
                            $locationId = $locationMap[$locKey]->id;
                        } else {
                            $newLoc = new WarehouseLocation();
                            $newLoc->tenant_id = $tenantId;
                            $newLoc->uuid = (string) Str::uuid();
                            $newLoc->warehouse_id = $warehouse->id;
                            $newLoc->code = $locCode;
                            $newLoc->name = $locCode;
                            $newLoc->type = 'shelf';
                            $newLoc->is_active = true;
                            $newLoc->created_by = $userId;
                            $newLoc->save();

                            $locationMap[$locKey] = $newLoc;
                            $locationId = $newLoc->id;
                        }
                    }

                    $unitId = $product->base_unit_id ?? $defaultUnitId;

                    // Query existing StockBalance
                    $balanceQuery = StockBalance::query()
                        ->where('tenant_id', $tenantId)
                        ->where('product_id', $product->id)
                        ->where('warehouse_id', $warehouse->id)
                        ->where('stock_state', $stockState);

                    if ($locationId !== null) {
                        $balanceQuery->where('warehouse_location_id', $locationId);
                    } else {
                        $balanceQuery->whereNull('warehouse_location_id');
                    }

                    if ($batchCode !== null) {
                        $balanceQuery->where('batch_code', $batchCode);
                    } else {
                        $balanceQuery->whereNull('batch_code');
                    }

                    $existingBalance = $balanceQuery->first();

                    if ($existingBalance) {
                        if ($mode === 'skip') {
                            $skipped++;
                            continue;
                        }

                        // Upsert mode: calculate diff and adjust
                        try {
                            $diff = $quantity - (float) $existingBalance->quantity;
                            $movNumber = 'MOV-' . date('YmdHis') . '-' . strtoupper(Str::random(6));

                            $movId = null;
                            if (abs($diff) > 0.0001) {
                                $movId = DB::table('stock_movements')->insertGetId([
                                    'tenant_id' => $tenantId,
                                    'uuid' => (string) Str::uuid(),
                                    'movement_number' => $movNumber,
                                    'product_id' => $product->id,
                                    'warehouse_id' => $warehouse->id,
                                    'warehouse_location_id' => $locationId,
                                    'batch_code' => $batchCode,
                                    'expiry_date' => $expiryDate,
                                    'movement_type' => 'opening_balance',
                                    'direction' => $diff > 0 ? 'in' : 'out',
                                    'stock_state' => $stockState,
                                    'quantity' => abs($diff),
                                    'unit_id' => $unitId,
                                    'unit_cost' => $unitCost > 0 ? $unitCost : (float) $existingBalance->average_cost,
                                    'total_cost' => abs($diff) * ($unitCost > 0 ? $unitCost : (float) $existingBalance->average_cost),
                                    'balance_after' => $quantity,
                                    'reference_type' => 'bulk_opening_update',
                                    'moved_at' => now(),
                                    'created_by' => $userId,
                                    'created_at' => now(),
                                ]);
                            }

                            $finalCost = $unitCost > 0 ? $unitCost : (float) $existingBalance->average_cost;
                            $updateData = [
                                'quantity' => $quantity,
                                'average_cost' => $finalCost,
                                'total_value' => $quantity * $finalCost,
                                'updated_at' => now(),
                            ];
                            if ($movId !== null) {
                                $updateData['last_movement_id'] = $movId;
                                $updateData['last_movement_at'] = now();
                            }

                            DB::table('stock_balances')
                                ->where('id', $existingBalance->id)
                                ->update($updateData);

                            $updated++;
                        } catch (\Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'sku',
                                'value' => $sku,
                                'message' => 'Balance update failed: ' . $e->getMessage(),
                            ];
                        }
                    } else {
                        // Insert new StockMovement and StockBalance
                        try {
                            $movNumber = 'MOV-OPN-' . date('YmdHis') . '-' . strtoupper(Str::random(6));

                            $movId = DB::table('stock_movements')->insertGetId([
                                'tenant_id' => $tenantId,
                                'uuid' => (string) Str::uuid(),
                                'movement_number' => $movNumber,
                                'product_id' => $product->id,
                                'warehouse_id' => $warehouse->id,
                                'warehouse_location_id' => $locationId,
                                'batch_code' => $batchCode,
                                'expiry_date' => $expiryDate,
                                'movement_type' => 'opening_balance',
                                'direction' => 'in',
                                'stock_state' => $stockState,
                                'quantity' => $quantity,
                                'unit_id' => $unitId,
                                'unit_cost' => $unitCost,
                                'total_cost' => $unitCost * $quantity,
                                'balance_after' => $quantity,
                                'reference_type' => 'bulk_opening_import',
                                'moved_at' => now(),
                                'created_by' => $userId,
                                'created_at' => now(),
                            ]);

                            DB::table('stock_balances')->insert([
                                'tenant_id' => $tenantId,
                                'uuid' => (string) Str::uuid(),
                                'product_id' => $product->id,
                                'warehouse_id' => $warehouse->id,
                                'warehouse_location_id' => $locationId,
                                'batch_code' => $batchCode,
                                'stock_state' => $stockState,
                                'quantity' => $quantity,
                                'average_cost' => $unitCost,
                                'total_value' => $unitCost * $quantity,
                                'last_movement_id' => $movId,
                                'last_movement_at' => now(),
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);

                            $imported++;
                        } catch (\Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'sku',
                                'value' => $sku,
                                'message' => 'Balance creation failed: ' . $e->getMessage(),
                            ];
                        }
                    }
                }
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'imported' => $imported,
                'updated' => $updated,
                'skipped' => $skipped,
                'failed' => count($errors),
                'errors' => $errors,
            ],
        ]);
    }
    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = StockMovement::with(['product', 'warehouse', 'unit', 'reasonCode'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('product_id')) {
            $query->where('product_id', (int) $request->query('product_id'));
        }

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', (int) $request->query('warehouse_id'));
        }

        if ($request->filled('movement_type')) {
            $query->where('movement_type', (string) $request->query('movement_type'));
        }

        if ($request->filled('direction')) {
            $query->where('direction', (string) $request->query('direction'));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where(function ($q) use ($search): void {
                $q->where('movement_number', 'like', "%{$search}%")
                    ->orWhere('batch_code', 'like', "%{$search}%");
            });
        }

        $movements = $query->orderByDesc('moved_at')
            ->orderByDesc('id')
            ->paginate((int) ($request->query('per_page') ?? 25));

        return StockMovementResource::collection($movements);
    }

    public function show(int $id): StockMovementResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $movement = StockMovement::with(['product', 'warehouse', 'unit', 'reasonCode'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new StockMovementResource($movement);
    }

    public function balances(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = StockBalance::with(['product', 'warehouse'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('product_id')) {
            $query->where('product_id', (int) $request->query('product_id'));
        }

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', (int) $request->query('warehouse_id'));
        }

        if ($request->filled('stock_state')) {
            $query->where('stock_state', (string) $request->query('stock_state'));
        }

        $balances = $query->orderBy('warehouse_id')
            ->orderBy('product_id')
            ->paginate((int) ($request->query('per_page') ?? 50));

        return StockBalanceResource::collection($balances);
    }

    public function destroyBalance(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id();

        /** @var StockBalance $balance */
        $balance = StockBalance::with(['product', 'warehouse'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        DB::transaction(function () use ($balance, $tenantId, $userId) {
            $qty = (float) $balance->quantity;
            if ($qty > 0) {
                $unitId = Unit::query()->where('tenant_id', $tenantId)->value('id') ?? 1;
                $movNumber = 'MOV-DEL-' . date('YmdHis') . '-' . strtoupper(Str::random(6));

                DB::table('stock_movements')->insert([
                    'tenant_id' => $tenantId,
                    'uuid' => (string) Str::uuid(),
                    'movement_number' => $movNumber,
                    'product_id' => $balance->product_id,
                    'warehouse_id' => $balance->warehouse_id,
                    'warehouse_location_id' => $balance->warehouse_location_id,
                    'batch_code' => $balance->batch_code,
                    'movement_type' => 'waste_spoilage',
                    'direction' => 'out',
                    'stock_state' => $balance->stock_state,
                    'quantity' => $qty,
                    'unit_id' => $unitId,
                    'unit_cost' => (float) $balance->average_cost,
                    'total_cost' => $qty * (float) $balance->average_cost,
                    'balance_after' => 0,
                    'reference_type' => 'stock_position_deletion',
                    'moved_at' => now(),
                    'created_by' => $userId,
                    'created_at' => now(),
                ]);
            }

            $balance->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'Stock balance position deleted successfully.',
        ]);
    }

    public function bulkDestroyBalances(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id();

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer'],
        ]);

        $ids = $validated['ids'];

        /** @var \Illuminate\Database\Eloquent\Collection<int, StockBalance> $balances */
        $balances = StockBalance::with(['product', 'warehouse'])
            ->where('tenant_id', $tenantId)
            ->whereIn('id', $ids)
            ->get();

        $deletedCount = 0;

        DB::transaction(function () use ($balances, $tenantId, $userId, &$deletedCount) {
            $unitId = Unit::query()->where('tenant_id', $tenantId)->value('id') ?? 1;

            /** @var StockBalance $balance */
            foreach ($balances as $balance) {
                $qty = (float) $balance->quantity;
                if ($qty > 0) {
                    $movNumber = 'MOV-DEL-' . date('YmdHis') . '-' . strtoupper(Str::random(6));

                    DB::table('stock_movements')->insert([
                        'tenant_id' => $tenantId,
                        'uuid' => (string) Str::uuid(),
                        'movement_number' => $movNumber,
                        'product_id' => $balance->product_id,
                        'warehouse_id' => $balance->warehouse_id,
                        'warehouse_location_id' => $balance->warehouse_location_id,
                        'batch_code' => $balance->batch_code,
                        'movement_type' => 'waste_spoilage',
                        'direction' => 'out',
                        'stock_state' => $balance->stock_state,
                        'quantity' => $qty,
                        'unit_id' => $unitId,
                        'unit_cost' => (float) $balance->average_cost,
                        'total_cost' => $qty * (float) $balance->average_cost,
                        'balance_after' => 0,
                        'reference_type' => 'stock_position_bulk_deletion',
                        'moved_at' => now(),
                        'created_by' => $userId,
                        'created_at' => now(),
                    ]);
                }

                $balance->delete();
                $deletedCount++;
            }
        });

        return response()->json([
            'success' => true,
            'message' => "Successfully deleted {$deletedCount} stock balance position(s).",
            'deleted_count' => $deletedCount,
        ]);
    }
}
