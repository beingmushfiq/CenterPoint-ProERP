<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\BillOfMaterial;
use App\Models\BillOfMaterialItem;
use App\Models\Product;
use App\Models\Unit;
use App\Modules\Catalogue\Actions\CreateBillOfMaterialAction;
use App\Modules\Catalogue\Actions\DeleteBillOfMaterialAction;
use App\Modules\Catalogue\Actions\UpdateBillOfMaterialAction;
use App\Modules\Catalogue\Requests\StoreBillOfMaterialRequest;
use App\Modules\Catalogue\Requests\UpdateBillOfMaterialRequest;
use App\Modules\Catalogue\Resources\BillOfMaterialResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class BillOfMaterialController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $allowed = ['product_id', 'status', 'effective_from', 'q', 'sort', 'page', 'per_page'];
        $unknown = array_diff(array_keys($request->all()), $allowed);
        if ($unknown !== []) {
            return ErrorResponse::make(request: $request, code: 'VALIDATION_FAILED', message: 'Unknown query parameter(s): '.implode(', ', $unknown), httpStatus: 422, retryable: false);
        }
        $query = BillOfMaterial::query()->with(['product', 'outputUnit', 'items.product', 'items.unit']);
        foreach (['status', 'effective_from'] as $field) {
            $value = $request->input($field);
            if (is_string($value)) {
                $query->where($field, $value);
            }
        }
        $productUuid = $request->input('product_id');
        if (is_string($productUuid)) {
            $query->whereHas('product', fn ($product) => $product->where('products.uuid', $productUuid));
        }
        $search = $request->input('q');
        if (is_string($search) && mb_strlen($search) >= 2) {
            $like = '%'.$search.'%';
            $query->where(fn ($q) => $q->where('version', 'like', $like)->orWhere('name', 'like', $like));
        }
        $sortRaw = $request->input('sort', 'id');
        $sort = is_string($sortRaw) ? $sortRaw : 'id';
        foreach (explode(',', $sort) as $piece) {
            $desc = str_starts_with($piece, '-');
            $field = $desc ? substr($piece, 1) : $piece;
            if (in_array($field, ['id', 'version', 'name', 'status', 'effective_from', 'created_at', 'updated_at'], true)) {
                $query->orderBy($field, $desc ? 'desc' : 'asc');
            }
        }
        $query->orderBy('id');
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

        return response()->json(['success' => true, 'data' => BillOfMaterialResource::collection($paginated->items()), 'meta' => [
            'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            'pagination' => ['page' => $paginated->currentPage(), 'per_page' => $paginated->perPage(), 'total' => $paginated->total(), 'total_pages' => $paginated->lastPage(), 'has_more' => $paginated->hasMorePages()],
            'applied' => ['filters' => [], 'sort' => $sort, 'search' => is_string($search) ? $search : null],
        ]]);
    }

    public function show(Request $request, BillOfMaterial $billOfMaterial): JsonResponse
    {
        if (TenantContext::isBound() && $billOfMaterial->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        $billOfMaterial->load(['product', 'outputUnit', 'items.product', 'items.unit']);

        return response()->json(['success' => true, 'data' => new BillOfMaterialResource($billOfMaterial), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function store(StoreBillOfMaterialRequest $request, CreateBillOfMaterialAction $action): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user, ...$request->validated()]);

        return response()->json(['success' => true, 'data' => new BillOfMaterialResource($result['billOfMaterial']), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]], 201)->header('Location', '/v1/bill-of-materials/'.$result['billOfMaterial']->uuid);
    }

    public function update(UpdateBillOfMaterialRequest $request, UpdateBillOfMaterialAction $action, BillOfMaterial $billOfMaterial): JsonResponse
    {
        if (TenantContext::isBound() && $billOfMaterial->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        /** @var \App\Models\User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user, 'billOfMaterial' => $billOfMaterial, ...$request->validated()]);

        return response()->json(['success' => true, 'data' => new BillOfMaterialResource($result['billOfMaterial']), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function destroy(Request $request, DeleteBillOfMaterialAction $action, BillOfMaterial $billOfMaterial): JsonResponse
    {
        if (TenantContext::isBound() && $billOfMaterial->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        /** @var \App\Models\User $user */
        $user = $request->user();
        $action->execute(['user' => $user, 'billOfMaterial' => $billOfMaterial]);

        return response()->json(['success' => true, 'data' => null, 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
            'rows' => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*.finished_sku' => ['required', 'string', 'max:64'],
            'rows.*.bom_name' => ['nullable', 'string', 'max:191'],
            'rows.*.version' => ['nullable', 'string', 'max:32'],
            'rows.*.output_quantity' => ['nullable', 'numeric', 'gt:0'],
            'rows.*.output_unit' => ['nullable', 'string'],
            'rows.*.status' => ['nullable', 'string'],
            'rows.*.component_sku' => ['required', 'string', 'max:64'],
            'rows.*.component_quantity' => ['required', 'numeric', 'gt:0'],
            'rows.*.component_unit' => ['nullable', 'string'],
            'rows.*.scrap_percentage' => ['nullable', 'numeric', 'gte:0', 'lte:100'],
            'rows.*.is_optional' => ['nullable', 'boolean'],
        ]);

        $mode = $validated['mode'] ?? 'skip';
        $rows = $validated['rows'];
        $user = $request->user();
        $userId = $user ? $user->id : null;

        $prodSkuMap = Product::query()
            ->whereNotNull('sku')
            ->pluck('id', 'sku')
            ->mapWithKeys(fn ($id, $sku) => [strtolower((string) $sku) => $id])
            ->all();

        $prodUnitMap = Product::query()
            ->pluck('base_unit_id', 'id')
            ->all();

        $unitCodeMap = Unit::query()
            ->pluck('id', 'code')
            ->mapWithKeys(fn ($id, $code) => [strtolower((string) $code) => $id])
            ->all();

        $grouped = [];
        $errors = [];

        foreach ($rows as $index => $row) {
            $rowNum = $index + 1;
            $fSku = trim((string) ($row['finished_sku'] ?? ''));
            $cSku = trim((string) ($row['component_sku'] ?? ''));

            if ($fSku === '' || $cSku === '') {
                $errors[] = [
                    'row' => $rowNum,
                    'field' => $fSku === '' ? 'finished_sku' : 'component_sku',
                    'value' => $fSku === '' ? $fSku : $cSku,
                    'message' => 'Both Finished SKU and Component SKU are required.',
                ];

                continue;
            }

            $version = trim((string) ($row['version'] ?? 'v1.0'));
            if ($version === '') {
                $version = 'v1.0';
            }

            $groupKey = strtolower($fSku).'::'.strtolower($version);

            if (! isset($grouped[$groupKey])) {
                $grouped[$groupKey] = [
                    'finished_sku' => $fSku,
                    'version' => $version,
                    'bom_name' => trim((string) ($row['bom_name'] ?? '')) ?: "BOM for {$fSku} ({$version})",
                    'output_quantity' => (float) ($row['output_quantity'] ?? 1),
                    'output_unit' => isset($row['output_unit']) ? trim((string) $row['output_unit']) : null,
                    'status' => ! empty($row['status']) ? strtolower(trim((string) $row['status'])) : 'active',
                    'first_row' => $rowNum,
                    'items' => [],
                ];
            }

            $grouped[$groupKey]['items'][] = [
                'component_sku' => $cSku,
                'quantity' => (float) ($row['component_quantity'] ?? 1),
                'unit' => isset($row['component_unit']) ? trim((string) $row['component_unit']) : null,
                'scrap_percentage' => (float) ($row['scrap_percentage'] ?? 0),
                'is_optional' => (bool) ($row['is_optional'] ?? false),
                'row_num' => $rowNum,
            ];
        }

        $imported = 0;
        $updated = 0;
        $skipped = 0;

        foreach ($grouped as $bomDef) {
            $fSkuKey = strtolower($bomDef['finished_sku']);
            if (! isset($prodSkuMap[$fSkuKey])) {
                $errors[] = [
                    'row' => $bomDef['first_row'],
                    'field' => 'finished_sku',
                    'value' => $bomDef['finished_sku'],
                    'message' => "Finished product SKU '{$bomDef['finished_sku']}' does not exist.",
                ];

                continue;
            }

            $finishedProdId = $prodSkuMap[$fSkuKey];

            $outputUnitId = null;
            if ($bomDef['output_unit'] && isset($unitCodeMap[strtolower($bomDef['output_unit'])])) {
                $outputUnitId = $unitCodeMap[strtolower($bomDef['output_unit'])];
            } else {
                $outputUnitId = $prodUnitMap[$finishedProdId] ?? null;
            }

            if (! $outputUnitId) {
                $errors[] = [
                    'row' => $bomDef['first_row'],
                    'field' => 'output_unit',
                    'value' => (string) $bomDef['output_unit'],
                    'message' => 'Could not resolve valid output unit for finished product.',
                ];

                continue;
            }

            $existingBom = BillOfMaterial::query()
                ->where('product_id', $finishedProdId)
                ->where('version', $bomDef['version'])
                ->first();

            if ($existingBom) {
                if ($mode === 'skip') {
                    $skipped++;

                    continue;
                }

                try {
                    DB::transaction(function () use ($existingBom, $bomDef, $outputUnitId, $userId, $prodSkuMap, $unitCodeMap, $prodUnitMap, &$errors): void {
                        $existingBom->update([
                            'name' => $bomDef['bom_name'],
                            'output_quantity' => $bomDef['output_quantity'],
                            'output_unit_id' => $outputUnitId,
                            'status' => in_array($bomDef['status'], ['draft', 'active', 'archived'], true) ? $bomDef['status'] : 'active',
                            'updated_by' => $userId,
                        ]);

                        $existingBom->items()->delete();

                        foreach ($bomDef['items'] as $itemIdx => $cItem) {
                            $cSkuKey = strtolower($cItem['component_sku']);
                            if (! isset($prodSkuMap[$cSkuKey])) {
                                continue;
                            }
                            $cProdId = $prodSkuMap[$cSkuKey];
                            $cUnitId = null;
                            if ($cItem['unit'] && isset($unitCodeMap[strtolower($cItem['unit'])])) {
                                $cUnitId = $unitCodeMap[strtolower($cItem['unit'])];
                            } else {
                                $cUnitId = $prodUnitMap[$cProdId] ?? null;
                            }
                            if (! $cUnitId) {
                                continue;
                            }

                            BillOfMaterialItem::create([
                                'bill_of_material_id' => $existingBom->id,
                                'product_id' => $cProdId,
                                'quantity' => $cItem['quantity'],
                                'unit_id' => $cUnitId,
                                'wastage_allowance_percentage' => $cItem['scrap_percentage'],
                                'is_optional' => $cItem['is_optional'],
                                'sort_order' => $itemIdx,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                        }
                    });
                    $updated++;
                } catch (Throwable $e) {
                    $errors[] = [
                        'row' => $bomDef['first_row'],
                        'field' => 'finished_sku',
                        'value' => $bomDef['finished_sku'],
                        'message' => 'BOM update failed: '.$e->getMessage(),
                    ];
                }

                continue;
            }

            try {
                DB::transaction(function () use ($finishedProdId, $bomDef, $outputUnitId, $userId, $prodSkuMap, $unitCodeMap, $prodUnitMap, &$errors): void {
                    $newBom = BillOfMaterial::create([
                        'uuid' => (string) Str::uuid(),
                        'product_id' => $finishedProdId,
                        'version' => $bomDef['version'],
                        'name' => $bomDef['bom_name'],
                        'output_quantity' => $bomDef['output_quantity'],
                        'output_unit_id' => $outputUnitId,
                        'expected_yield_percentage' => '100.0000',
                        'status' => in_array($bomDef['status'], ['draft', 'active', 'archived'], true) ? $bomDef['status'] : 'active',
                        'created_by' => $userId,
                        'updated_by' => $userId,
                    ]);

                    foreach ($bomDef['items'] as $itemIdx => $cItem) {
                        $cSkuKey = strtolower($cItem['component_sku']);
                        if (! isset($prodSkuMap[$cSkuKey])) {
                            continue;
                        }
                        $cProdId = $prodSkuMap[$cSkuKey];
                        $cUnitId = null;
                        if ($cItem['unit'] && isset($unitCodeMap[strtolower($cItem['unit'])])) {
                            $cUnitId = $unitCodeMap[strtolower($cItem['unit'])];
                        } else {
                            $cUnitId = $prodUnitMap[$cProdId] ?? null;
                        }
                        if (! $cUnitId) {
                            continue;
                        }

                        BillOfMaterialItem::create([
                            'bill_of_material_id' => $newBom->id,
                            'product_id' => $cProdId,
                            'quantity' => $cItem['quantity'],
                            'unit_id' => $cUnitId,
                            'wastage_allowance_percentage' => $cItem['scrap_percentage'],
                            'is_optional' => $cItem['is_optional'],
                            'sort_order' => $itemIdx,
                            'created_by' => $userId,
                            'updated_by' => $userId,
                        ]);
                    }
                });
                $imported++;
            } catch (Throwable $e) {
                $errors[] = [
                    'row' => $bomDef['first_row'],
                    'field' => 'finished_sku',
                    'value' => $bomDef['finished_sku'],
                    'message' => 'BOM creation failed: '.$e->getMessage(),
                ];
            }
        }

        return response()->json([
            'success' => count($errors) === 0,
            'total' => count($grouped),
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'failed' => count($errors),
            'errors' => $errors,
            'message' => sprintf(
                'Import completed: %d recipes created, %d updated, %d skipped, %d failed.',
                $imported,
                $updated,
                $skipped,
                count($errors)
            ),
        ]);
    }
}
