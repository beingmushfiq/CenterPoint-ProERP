<?php

declare(strict_types=1);

namespace App\Modules\Production\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\ProductionPlan;
use App\Models\User;
use App\Modules\Production\Actions\ApproveProductionPlanAction;
use App\Modules\Production\Actions\CreateProductionPlanAction;
use App\Modules\Production\Actions\DeleteProductionPlanAction;
use App\Modules\Production\Actions\UpdateProductionPlanAction;
use App\Modules\Production\Requests\StoreProductionPlanRequest;
use App\Modules\Production\Requests\UpdateProductionPlanRequest;
use App\Modules\Production\Resources\ProductionPlanResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProductionPlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $allowed = ['status', 'source', 'plan_date', 'period_start', 'period_end', 'q', 'sort', 'page', 'per_page'];
        $unknown = array_diff(array_keys($request->all()), $allowed);
        if ($unknown !== []) {
            return ErrorResponse::make(
                request: $request,
                code: 'VALIDATION_FAILED',
                message: 'Unknown query parameter(s): '.implode(', ', $unknown),
                httpStatus: 422,
                retryable: false
            );
        }

        $query = ProductionPlan::query()->with(['items.product', 'items.billOfMaterial', 'items.unit', 'approver']);

        foreach (['status', 'source', 'plan_date'] as $field) {
            $value = $request->input($field);
            if (is_string($value)) {
                $query->where($field, $value);
            }
        }

        $search = $request->input('q');
        if (is_string($search) && mb_strlen($search) >= 2) {
            $like = '%'.$search.'%';
            $query->where(fn ($q) => $q->where('plan_number', 'like', $like)->orWhere('notes', 'like', $like));
        }

        $sortRaw = $request->input('sort', 'id');
        $sort = is_string($sortRaw) ? $sortRaw : 'id';
        foreach (explode(',', $sort) as $piece) {
            $desc = str_starts_with($piece, '-');
            $field = $desc ? substr($piece, 1) : $piece;
            if (in_array($field, ['id', 'plan_number', 'plan_date', 'period_start', 'period_end', 'status', 'created_at'], true)) {
                $query->orderBy($field, $desc ? 'desc' : 'asc');
            }
        }
        $query->orderBy('id');

        $perPageRaw = $request->input('per_page', 25);
        /** @phpstan-ignore cast.int */
        $perPage = is_int($perPageRaw) ? $perPageRaw : (int) $perPageRaw;
        if ($perPage > 100) {
            return ErrorResponse::make(
                request: $request,
                code: 'VALIDATION_FAILED',
                message: 'per_page must not exceed 100.',
                httpStatus: 422,
                retryable: false
            );
        }

        $pageRaw = $request->input('page', 1);
        /** @phpstan-ignore cast.int */
        $page = is_int($pageRaw) ? $pageRaw : (int) $pageRaw;
        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => ProductionPlanResource::collection($paginated->items()),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'pagination' => [
                    'page' => $paginated->currentPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'total_pages' => $paginated->lastPage(),
                    'has_more' => $paginated->hasMorePages(),
                ],
                'applied' => [
                    'filters' => [],
                    'sort' => $sort,
                    'search' => is_string($search) ? $search : null,
                ],
            ],
        ]);
    }

    public function show(Request $request, ProductionPlan $productionPlan): JsonResponse
    {
        if (TenantContext::isBound() && $productionPlan->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false
            );
        }

        $productionPlan->load(['items.product', 'items.billOfMaterial', 'items.unit', 'approver']);

        return response()->json([
            'success' => true,
            'data' => new ProductionPlanResource($productionPlan),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function store(StoreProductionPlanRequest $request, CreateProductionPlanAction $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user, ...$request->validated()]);

        return response()->json([
            'success' => true,
            'data' => new ProductionPlanResource($result['productionPlan']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ], 201)->header('Location', '/v1/production/plans/'.$result['productionPlan']->uuid);
    }

    public function update(UpdateProductionPlanRequest $request, UpdateProductionPlanAction $action, ProductionPlan $productionPlan): JsonResponse
    {
        if (TenantContext::isBound() && $productionPlan->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false
            );
        }

        /** @var User $user */
        $user = $request->user();
        $result = $action->execute([
            'user' => $user,
            'productionPlan' => $productionPlan,
            ...$request->validated(),
        ]);

        return response()->json([
            'success' => true,
            'data' => new ProductionPlanResource($result['productionPlan']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function approve(Request $request, ApproveProductionPlanAction $action, ProductionPlan $productionPlan): JsonResponse
    {
        if (TenantContext::isBound() && $productionPlan->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false
            );
        }

        /** @var User $user */
        $user = $request->user();
        $result = $action->execute([
            'user' => $user,
            'productionPlan' => $productionPlan,
        ]);

        return response()->json([
            'success' => true,
            'data' => new ProductionPlanResource($result['productionPlan']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function destroy(Request $request, DeleteProductionPlanAction $action, ProductionPlan $productionPlan): JsonResponse
    {
        if (TenantContext::isBound() && $productionPlan->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false
            );
        }

        /** @var User $user */
        $user = $request->user();
        $action->execute([
            'user' => $user,
            'productionPlan' => $productionPlan,
        ]);

        return response()->json([
            'success' => true,
            'data' => null,
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rows' => 'required|array|min:1',
            'mode' => 'nullable|string|in:skip,upsert',
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id() ?? 1;

        // Resolve default company
        $defaultCompanyId = DB::table('companies')
            ->where('tenant_id', $tenantId)
            ->value('id') ?? 1;

        // Resolve default factory, or create standard factory
        $factory = DB::table('factories')
            ->where('tenant_id', $tenantId)
            ->first();

        if (! $factory) {
            $factoryId = DB::table('factories')->insertGetId([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'company_id' => $defaultCompanyId,
                'code' => 'F01',
                'name' => 'Main Production Factory',
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            $factoryId = $factory->id;
        }

        // Preload products for quick matching
        $products = \App\Models\Product::where('tenant_id', $tenantId)->get();
        $productMap = [];
        foreach ($products as $prod) {
            $productMap[strtolower(trim((string) $prod->sku))] = $prod;
            $productMap[strtolower(trim((string) $prod->name))] = $prod;
            $productMap[(string) $prod->id] = $prod;
        }

        // Preload BOMs for matching
        $boms = \App\Models\BillOfMaterial::where('tenant_id', $tenantId)->get();
        $bomMap = [];
        foreach ($boms as $bom) {
            $bomMap[$bom->product_id] = $bom;
            $bomMap[strtolower(trim((string) $bom->code))] = $bom;
        }

        // Preload Units
        $units = \App\Models\Unit::where('tenant_id', $tenantId)->get();
        $unitMap = [];
        foreach ($units as $unit) {
            $unitMap[strtolower(trim((string) $unit->code))] = $unit;
            $unitMap[strtolower(trim((string) $unit->name))] = $unit;
            $unitMap[(string) $unit->id] = $unit;
        }
        $defaultUnit = $units->first();

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Group rows by plan_number
        $groupedPlans = [];
        foreach ($rows as $index => $row) {
            $rowNum = $index + 1;
            $planNumber = trim((string) ($row['plan_number'] ?? $row['plan_code'] ?? $row['code'] ?? ''));
            if ($planNumber === '') {
                $planNumber = 'PLAN-'.date('Ymd').'-'.str_pad((string) $rowNum, 4, '0', STR_PAD_LEFT);
            }
            $groupedPlans[$planNumber][] = [
                'row_num' => $rowNum,
                'data' => $row,
            ];
        }

        $chunks = array_chunk($groupedPlans, 100, true);

        foreach ($chunks as $chunk) {
            DB::transaction(function () use (
                $chunk,
                $tenantId,
                $userId,
                $defaultCompanyId,
                $factoryId,
                $productMap,
                $bomMap,
                $unitMap,
                $defaultUnit,
                $mode,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $planNumber => $planRows) {
                    $firstRow = $planRows[0]['data'];
                    $planDate = ! empty($firstRow['plan_date']) ? (string) $firstRow['plan_date'] : now()->format('Y-m-d');
                    $periodStart = ! empty($firstRow['period_start']) ? (string) $firstRow['period_start'] : $planDate;
                    $periodEnd = ! empty($firstRow['period_end']) ? (string) $firstRow['period_end'] : date('Y-m-d', strtotime('+30 days', strtotime($periodStart)));
                    $notes = $firstRow['notes'] ?? $firstRow['description'] ?? null;
                    $status = $firstRow['status'] ?? 'draft';

                    $existing = ProductionPlan::withoutGlobalScope('tenant')
                        ->where('tenant_id', $tenantId)
                        ->where('plan_number', $planNumber)
                        ->first();

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped += count($planRows);

                            continue;
                        }

                        // Upsert plan header
                        $existing->update([
                            'plan_date' => $planDate,
                            'period_start' => $periodStart,
                            'period_end' => $periodEnd,
                            'notes' => $notes,
                            'status' => $status,
                            'updated_by' => $userId,
                        ]);

                        // Sync or add items
                        $existing->items()->delete();
                        $plan = $existing;
                        $updated++;
                    } else {
                        $plan = ProductionPlan::create([
                            'uuid' => (string) Str::uuid(),
                            'company_id' => $defaultCompanyId,
                            'factory_id' => $factoryId,
                            'plan_number' => $planNumber,
                            'plan_date' => $planDate,
                            'period_start' => $periodStart,
                            'period_end' => $periodEnd,
                            'source' => 'manual',
                            'status' => $status,
                            'notes' => $notes,
                            'created_by' => $userId,
                        ]);
                        $imported++;
                    }

                    // Insert plan items
                    foreach ($planRows as $itemIndex => $itemEntry) {
                        $itemData = $itemEntry['data'];
                        $rowNum = $itemEntry['row_num'];

                        $productKey = strtolower(trim((string) ($itemData['product_sku'] ?? $itemData['sku'] ?? $itemData['product_code'] ?? $itemData['product_name'] ?? '')));
                        $product = $productMap[$productKey] ?? null;

                        if (! $product) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'product_sku',
                                'message' => "Product '{$productKey}' not found.",
                            ];

                            continue;
                        }

                        $qty = isset($itemData['planned_quantity']) ? (float) $itemData['planned_quantity'] : (isset($itemData['quantity']) ? (float) $itemData['quantity'] : 1.0);
                        if ($qty <= 0) {
                            $qty = 1.0;
                        }

                        // Resolve BOM
                        $bom = $bomMap[$product->id] ?? null;
                        if (! $bom) {
                            // Find or create minimal BOM for this product
                            $bom = \App\Models\BillOfMaterial::firstOrCreate(
                                ['tenant_id' => $tenantId, 'product_id' => $product->id],
                                [
                                    'uuid' => (string) Str::uuid(),
                                    'code' => 'BOM-'.($product->sku ?: str_pad((string) $product->id, 4, '0', STR_PAD_LEFT)),
                                    'name' => 'Standard BOM - '.$product->name,
                                    'version' => '1.0',
                                    'output_quantity' => '1.0000',
                                    'output_unit_id' => $product->base_unit_id ?? ($defaultUnit ? $defaultUnit->id : 1),
                                    'expected_yield_percentage' => '100.0000',
                                    'is_active' => true,
                                    'created_by' => $userId,
                                ]
                            );
                            $bomMap[$product->id] = $bom;
                        }

                        // Resolve Unit
                        $unitKey = strtolower(trim((string) ($itemData['unit_code'] ?? $itemData['unit'] ?? '')));
                        $unit = ($unitKey !== '' ? ($unitMap[$unitKey] ?? null) : null) ?? ($product->unit_id ? ($unitMap[(string) $product->unit_id] ?? null) : $defaultUnit);

                        \App\Models\ProductionPlanItem::create([
                            'uuid' => (string) Str::uuid(),
                            'production_plan_id' => $plan->id,
                            'product_id' => $product->id,
                            'bill_of_material_id' => $bom->id,
                            'planned_quantity' => number_format($qty, 4, '.', ''),
                            'unit_id' => $unit ? $unit->id : 1,
                            'scheduled_date' => $itemData['scheduled_date'] ?? $periodStart,
                            'produced_quantity' => '0.0000',
                            'status' => 'draft',
                            'sort_order' => $itemIndex,
                            'created_by' => $userId,
                        ]);
                    }
                }
            });
        }

        return response()->json([
            'success' => true,
            'message' => "Bulk import completed. {$imported} plan(s) imported, {$updated} updated, {$skipped} skipped.",
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'failed' => count($errors),
            'errors' => $errors,
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'failed_count' => count($errors),
                'errors' => $errors,
            ],
        ]);
    }
}
