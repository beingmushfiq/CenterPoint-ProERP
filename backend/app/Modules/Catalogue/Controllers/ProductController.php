<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Modules\Catalogue\Actions\CreateProductAction;
use App\Modules\Catalogue\Actions\DeleteProductAction;
use App\Modules\Catalogue\Actions\UpdateProductAction;
use App\Modules\Catalogue\Requests\StoreProductRequest;
use App\Modules\Catalogue\Requests\UpdateProductRequest;
use App\Modules\Catalogue\Resources\ProductResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $allowed = ['type', 'status', 'category_id', 'brand_id', 'is_online', 'is_purchased', 'is_produced', 'is_sold', 'q', 'sort', 'page', 'per_page', 'include'];
        $unknown = array_diff(array_keys($request->all()), $allowed);
        if ($unknown !== []) {
            return ErrorResponse::make(request: $request, code: 'VALIDATION_FAILED', message: 'Unknown query parameter(s): '.implode(', ', $unknown), httpStatus: 422, retryable: false);
        }
        $tenantId = TenantContext::current()->tenantId();
        $query = Product::query();
        foreach (['type', 'status'] as $field) {
            $value = $request->input($field);
            if (is_string($value)) {
                $query->where($field, $value);
            }
        }
        foreach (['category_id', 'brand_id'] as $field) {
            $value = $request->input($field);
            if (is_string($value)) {
                $query->where($field, function ($subquery) use ($field, $value, $tenantId): void {
                    $relation = $field === 'category_id' ? 'categories' : 'brands';
                    $subquery->from($relation)->select('id')->where($relation.'.tenant_id', $tenantId)->where($relation.'.uuid', $value);
                });
            }
        }
        foreach (['is_online', 'is_purchased', 'is_produced', 'is_sold'] as $flag) {
            $val = $request->input($flag);
            if ($val !== null && $val !== '') {
                $query->where($flag, filter_var($val, FILTER_VALIDATE_BOOLEAN));
            }
        }
        $search = $request->input('q');
        if (is_string($search) && mb_strlen($search) >= 2) {
            $like = '%'.$search.'%';
            $query->where(fn ($q) => $q->where('sku', 'like', $like)->orWhere('name', 'like', $like)->orWhere('barcode', 'like', $like));
        }
        $sortRaw = $request->input('sort', 'id');
        $sort = is_string($sortRaw) ? $sortRaw : 'id';
        foreach (explode(',', $sort) as $piece) {
            $desc = str_starts_with($piece, '-');
            $field = $desc ? substr($piece, 1) : $piece;
            if (in_array($field, ['id', 'sku', 'name', 'type', 'status', 'created_at', 'updated_at'], true)) {
                $query->orderBy($field, $desc ? 'desc' : 'asc');
            }
        }
        $query->orderBy('id');
        $query->withSum([
            'stockBalances as stock_quantity' => function ($subquery) use ($tenantId): void {
                $subquery->where('tenant_id', $tenantId)
                    ->where('stock_state', 'available');
            },
        ], 'quantity');
        $include = $request->input('include');
        if (is_string($include)) {
            $relations = array_intersect(explode(',', $include), ['category', 'brand', 'baseUnit', 'purchaseUnit', 'salesUnit', 'taxProfile', 'images']);
            if ($relations !== []) {
                $query->with(array_values($relations));
            }
        }
        $perPageRaw = $request->input('per_page', 25);
        /** @phpstan-ignore cast.int */
        $perPage = is_int($perPageRaw) ? $perPageRaw : (int) $perPageRaw;
        if ($perPage > 100) {
            return ErrorResponse::make(request: $request, code: 'VALIDATION_FAILED', message: 'per_page must not exceed 100.', httpStatus: 422, retryable: false);
        }
        $pageRaw = $request->input('page', 1);
        /** @phpstan-ignore cast.int */
        $page = is_int($pageRaw) ? $pageRaw : (int) $pageRaw;
        $paginated = $query->paginate($perPage, ['*'], 'page', $page);
        $filters = [];
        foreach (['type', 'status', 'category_id', 'brand_id', 'is_online', 'is_purchased', 'is_produced', 'is_sold', 'q'] as $field) {
            if ($request->filled($field)) {
                $filters[$field] = $request->input($field);
            }
        }

        return response()->json(['success' => true, 'data' => ProductResource::collection($paginated->items()), 'meta' => [
            'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            'pagination' => ['page' => $paginated->currentPage(), 'per_page' => $paginated->perPage(), 'total' => $paginated->total(), 'total_pages' => $paginated->lastPage(), 'has_more' => $paginated->hasMorePages()],
            'applied' => ['filters' => $filters, 'sort' => $sort, 'search' => is_string($search) ? $search : null],
        ]]);
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        if (TenantContext::isBound() && $product->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        $product->loadMissing('images');
        $includeRaw = $request->query('include', '');
        if (is_string($includeRaw)) {
            $relations = array_intersect(explode(',', $includeRaw), ['category', 'brand', 'baseUnit', 'purchaseUnit', 'salesUnit', 'taxProfile', 'images']);
            if ($relations !== []) {
                $product->load(array_values($relations));
            }
        }
        $tenantId = TenantContext::isBound() ? TenantContext::current()->tenantId() : $product->tenant_id;
        $product->loadSum([
            'stockBalances as stock_quantity' => function ($subquery) use ($tenantId): void {
                $subquery->where('tenant_id', $tenantId)
                    ->where('stock_state', 'available');
            },
        ], 'quantity');

        return response()->json(['success' => true, 'data' => new ProductResource($product), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function options(Request $request): JsonResponse
    {
        $items = Product::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->limit(500)
            ->get(['uuid', 'name', 'sku'])
            ->map(static fn (Product $product) => ['id' => (string) $product->uuid, 'label' => $product->name.' ('.$product->sku.')'])
            ->values();

        return response()->json(['success' => true, 'data' => $items->all(), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function store(StoreProductRequest $request, CreateProductAction $action): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user, ...$request->validated()]);

        return response()->json(['success' => true, 'data' => new ProductResource($result['product']), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]], 201)->header('Location', '/v1/products/'.$result['product']->uuid);
    }

    public function update(UpdateProductRequest $request, UpdateProductAction $action, Product $product): JsonResponse
    {
        if (TenantContext::isBound() && $product->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        /** @var \App\Models\User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user, 'product' => $product, ...$request->validated()]);

        return response()->json(['success' => true, 'data' => new ProductResource($result['product']), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function destroy(Request $request, DeleteProductAction $action, Product $product): JsonResponse
    {
        if (TenantContext::isBound() && $product->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        /** @var \App\Models\User $user */
        $user = $request->user();
        $action->execute(['user' => $user, 'product' => $product]);

        return response()->json(['success' => true, 'data' => null, 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mode' => 'nullable|string|in:skip,upsert',
            'rows' => 'required|array|min:1|max:5000',
            'rows.*.sku' => 'nullable|string|max:100',
            'rows.*.name' => 'required|string|max:191',
            'rows.*.type' => 'nullable|string|max:32',
            'rows.*.category' => 'nullable|string|max:100',
            'rows.*.brand' => 'nullable|string|max:100',
            'rows.*.unit' => 'nullable|string|max:32',
            'rows.*.cost_price' => 'nullable|numeric|min:0',
            'rows.*.standard_cost' => 'nullable|numeric|min:0',
            'rows.*.selling_price' => 'nullable|numeric|min:0',
            'rows.*.default_sale_price' => 'nullable|numeric|min:0',
            'rows.*.barcode' => 'nullable|string|max:100',
            'rows.*.opening_stock' => 'nullable|numeric|min:0',
            'rows.*.reorder_level' => 'nullable|numeric|min:0',
            'rows.*.status' => 'nullable|string|max:32',
            'rows.*.description' => 'nullable|string',
        ]);

        $mode = $validated['mode'] ?? 'skip';
        $rows = $validated['rows'];
        $tenantId = TenantContext::isBound() ? TenantContext::current()->tenantId() : (int) ($request->user()?->tenant_id ?? 1);
        $userId = (int) ($request->user()?->id ?? 1);

        // Preload reference maps
        $categories = Category::all();
        $catMap = [];
        foreach ($categories as $c) {
            $catMap[strtolower(trim($c->name))] = $c->id;
            $catMap[strtolower(trim($c->code))] = $c->id;
        }

        $brands = Brand::all();
        $brandMap = [];
        foreach ($brands as $b) {
            $brandMap[strtolower(trim($b->name))] = $b->id;
            $brandMap[strtolower(trim($b->code))] = $b->id;
        }

        $units = Unit::all();
        $unitMap = [];
        foreach ($units as $u) {
            $unitMap[strtolower(trim($u->name))] = $u->id;
            $unitMap[strtolower(trim($u->code))] = $u->id;
        }

        // Ensure at least one unit exists for tenant
        $defaultUnit = Unit::where('is_base', true)->first() ?? Unit::first();
        if (!$defaultUnit) {
            $defaultUnit = Unit::create([
                'uuid' => (string) Str::uuid(),
                'code' => 'PCS',
                'name' => 'Pieces',
                'type' => 'piece',
                'precision' => 0,
                'is_base' => true,
                'is_active' => true,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);
        }
        $defaultUnitId = $defaultUnit->id;
        $unitMap['pcs'] = $defaultUnitId;
        $unitMap['piece'] = $defaultUnitId;
        $unitMap['pieces'] = $defaultUnitId;

        // Default warehouse for opening stock
        $defaultWarehouse = Warehouse::where('is_active', true)->first();

        // Cache existing products by SKU & Barcode
        $existingProducts = Product::all();
        $prodSkuMap = [];
        $prodBarcodeMap = [];
        foreach ($existingProducts as $p) {
            if ($p->sku) {
                $prodSkuMap[strtolower(trim($p->sku))] = $p;
            }
            if ($p->barcode) {
                $prodBarcodeMap[strtolower(trim($p->barcode))] = $p;
            }
        }

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Valid product types
        $validTypes = ['raw_material', 'semi_finished', 'finished', 'packaging', 'consumable', 'service', 'asset_part'];

        foreach (array_chunk($rows, 100) as $chunkIdx => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIdx,
                $mode,
                $tenantId,
                $userId,
                $defaultUnitId,
                $defaultWarehouse,
                $validTypes,
                &$catMap,
                &$brandMap,
                &$unitMap,
                &$prodSkuMap,
                &$prodBarcodeMap,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ) {
                foreach ($chunk as $relIdx => $row) {
                    $rowNum = ($chunkIdx * 100) + $relIdx + 2;
                    $sku = !empty($row['sku']) ? trim((string) $row['sku']) : null;
                    $barcode = !empty($row['barcode']) ? trim((string) $row['barcode']) : null;

                    // Match existing product
                    $existing = null;
                    if ($sku && isset($prodSkuMap[strtolower($sku)])) {
                        $existing = $prodSkuMap[strtolower($sku)];
                    } elseif ($barcode && isset($prodBarcodeMap[strtolower($barcode)])) {
                        $existing = $prodBarcodeMap[strtolower($barcode)];
                    }

                    $cost = (float) ($row['standard_cost'] ?? $row['cost_price'] ?? 0);
                    $salePrice = (float) ($row['default_sale_price'] ?? $row['selling_price'] ?? 0);

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;
                            continue;
                        }

                        // Mode is upsert
                        try {
                            $updateData = [
                                'name' => $row['name'],
                                'standard_cost' => $cost,
                                'default_sale_price' => $salePrice,
                                'updated_by' => $userId,
                            ];
                            if ($barcode) {
                                $updateData['barcode'] = $barcode;
                            }
                            if (!empty($row['reorder_level'])) {
                                $updateData['reorder_level'] = (float) $row['reorder_level'];
                            }
                            if (!empty($row['status'])) {
                                $updateData['status'] = strtolower(trim((string) $row['status']));
                            }
                            if (isset($row['description'])) {
                                $updateData['description'] = $row['description'];
                            }

                            $existing->update($updateData);
                            $updated++;
                            continue;
                        } catch (\Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'sku',
                                'value' => $sku,
                                'message' => 'Update failed: ' . $e->getMessage(),
                            ];
                            continue;
                        }
                    }

                    // Resolve category
                    $categoryId = null;
                    if (!empty($row['category'])) {
                        $catKey = strtolower(trim((string) $row['category']));
                        if (isset($catMap[$catKey])) {
                            $categoryId = $catMap[$catKey];
                        } else {
                            $newCat = Category::create([
                                'uuid' => (string) Str::uuid(),
                                'code' => strtoupper(substr((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $row['category']), 0, 10)) ?: 'CAT',
                                'name' => trim((string) $row['category']),
                                'is_active' => true,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $categoryId = $newCat->id;
                            $catMap[$catKey] = $categoryId;
                            $catMap[strtolower($newCat->code)] = $categoryId;
                        }
                    }

                    // Resolve brand
                    $brandId = null;
                    if (!empty($row['brand'])) {
                        $brandKey = strtolower(trim((string) $row['brand']));
                        if (isset($brandMap[$brandKey])) {
                            $brandId = $brandMap[$brandKey];
                        } else {
                            $newBrand = Brand::create([
                                'uuid' => (string) Str::uuid(),
                                'code' => strtoupper(substr((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $row['brand']), 0, 10)) ?: 'BRAND',
                                'name' => trim((string) $row['brand']),
                                'is_active' => true,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $brandId = $newBrand->id;
                            $brandMap[$brandKey] = $brandId;
                            $brandMap[strtolower($newBrand->code)] = $brandId;
                        }
                    }

                    // Resolve unit
                    $unitId = $defaultUnitId;
                    if (!empty($row['unit'])) {
                        $uKey = strtolower(trim((string) $row['unit']));
                        if (isset($unitMap[$uKey])) {
                            $unitId = $unitMap[$uKey];
                        } else {
                            $newUnit = Unit::create([
                                'uuid' => (string) Str::uuid(),
                                'code' => strtoupper(substr((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $row['unit']), 0, 8)) ?: 'UNIT',
                                'name' => trim((string) $row['unit']),
                                'type' => 'piece',
                                'precision' => 0,
                                'is_base' => false,
                                'is_active' => true,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $unitId = $newUnit->id;
                            $unitMap[$uKey] = $unitId;
                            $unitMap[strtolower($newUnit->code)] = $unitId;
                        }
                    }

                    // Resolve type
                    $rawType = strtolower(trim((string) ($row['type'] ?? 'finished')));
                    if ($rawType === 'standard') $rawType = 'finished';
                    $type = in_array($rawType, $validTypes, true) ? $rawType : 'finished';

                    // Generate SKU if missing
                    if (!$sku) {
                        $sku = 'SKU-' . str_pad((string) random_int(10000, 999999), 6, '0', STR_PAD_LEFT);
                    }

                    // Status
                    $status = !empty($row['status']) ? strtolower(trim((string) $row['status'])) : 'active';
                    if (!in_array($status, ['active', 'draft', 'discontinued', 'archived'], true)) {
                        $status = 'active';
                    }

                    try {
                        $newProduct = Product::create([
                            'uuid' => (string) Str::uuid(),
                            'sku' => $sku,
                            'name' => $row['name'],
                            'barcode' => $barcode,
                            'description' => $row['description'] ?? null,
                            'type' => $type,
                            'category_id' => $categoryId,
                            'brand_id' => $brandId,
                            'base_unit_id' => $unitId,
                            'purchase_unit_id' => $unitId,
                            'sales_unit_id' => $unitId,
                            'is_stock_tracked' => 1,
                            'is_sold' => 1,
                            'is_purchased' => 1,
                            'standard_cost' => $cost,
                            'default_sale_price' => $salePrice,
                            'reorder_level' => !empty($row['reorder_level']) ? (float) $row['reorder_level'] : null,
                            'status' => $status,
                            'created_by' => $userId,
                            'updated_by' => $userId,
                        ]);

                        // Handle opening stock
                        $openingStock = (float) ($row['opening_stock'] ?? 0);
                        if ($openingStock > 0 && $defaultWarehouse) {
                            $totalVal = $openingStock * $cost;
                            $movNumber = 'MOV-OPN-' . strtoupper(Str::random(8));

                            $movId = DB::table('stock_movements')->insertGetId([
                                'tenant_id' => $tenantId,
                                'uuid' => (string) Str::uuid(),
                                'movement_number' => $movNumber,
                                'product_id' => $newProduct->id,
                                'warehouse_id' => $defaultWarehouse->id,
                                'movement_type' => 'opening_balance',
                                'direction' => 'in',
                                'stock_state' => 'available',
                                'quantity' => $openingStock,
                                'unit_id' => $unitId,
                                'unit_cost' => $cost,
                                'total_cost' => $totalVal,
                                'balance_after' => $openingStock,
                                'reference_type' => 'product_initial_stock',
                                'reference_id' => $newProduct->id,
                                'moved_at' => now(),
                                'created_by' => $userId,
                                'created_at' => now(),
                            ]);

                            DB::table('stock_balances')->insert([
                                'tenant_id' => $tenantId,
                                'uuid' => (string) Str::uuid(),
                                'product_id' => $newProduct->id,
                                'warehouse_id' => $defaultWarehouse->id,
                                'stock_state' => 'available',
                                'quantity' => $openingStock,
                                'average_cost' => $cost,
                                'total_value' => $totalVal,
                                'last_movement_id' => $movId,
                                'last_movement_at' => now(),
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                        }

                        $prodSkuMap[strtolower($sku)] = $newProduct;
                        if ($barcode) {
                            $prodBarcodeMap[strtolower($barcode)] = $newProduct;
                        }

                        $imported++;
                    } catch (\Throwable $e) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'sku',
                            'value' => $sku,
                            'message' => 'Creation failed: ' . $e->getMessage(),
                        ];
                    }
                }
            });
        }

        return response()->json([
            'success' => count($errors) === 0,
            'total' => count($rows),
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'failed' => count($errors),
            'errors' => $errors,
            'message' => sprintf(
                'Import completed: %d added, %d updated, %d skipped, %d failed.',
                $imported,
                $updated,
                $skipped,
                count($errors)
            ),
        ]);
    }
}

