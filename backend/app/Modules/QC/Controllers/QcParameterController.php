<?php

declare(strict_types=1);

namespace App\Modules\QC\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\QcParameter;
use App\Models\User;
use App\Modules\QC\Actions\CreateQcParameterAction;
use App\Modules\QC\Actions\DeleteQcParameterAction;
use App\Modules\QC\Actions\UpdateQcParameterAction;
use App\Modules\QC\Requests\StoreQcParameterRequest;
use App\Modules\QC\Requests\UpdateQcParameterRequest;
use App\Modules\QC\Resources\QcParameterResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class QcParameterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $allowed = ['product_id', 'type', 'is_mandatory', 'q', 'sort', 'page', 'per_page'];
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

        $query = QcParameter::query()->with(['product', 'unit']);

        $productUuid = $request->input('product_id');
        if (is_string($productUuid)) {
            $query->whereHas('product', fn ($prod) => $prod->where('products.uuid', $productUuid));
        }

        $type = $request->input('type');
        if (is_string($type)) {
            $query->where('type', $type);
        }

        if ($request->has('is_mandatory')) {
            $query->where('is_mandatory', $request->boolean('is_mandatory') ? 1 : 0);
        }

        $search = $request->input('q');
        if (is_string($search) && mb_strlen($search) >= 2) {
            $query->where('name', 'like', '%'.$search.'%');
        }

        $sortRaw = $request->input('sort', 'sort_order');
        $sort = is_string($sortRaw) ? $sortRaw : 'sort_order';
        foreach (explode(',', $sort) as $piece) {
            $desc = str_starts_with($piece, '-');
            $field = $desc ? substr($piece, 1) : $piece;
            if (in_array($field, ['id', 'name', 'type', 'sort_order', 'created_at'], true)) {
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
            'data' => QcParameterResource::collection($paginated->items()),
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
                ],
            ],
        ]);
    }

    public function show(Request $request, QcParameter $qcParameter): JsonResponse
    {
        if (TenantContext::isBound() && $qcParameter->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false
            );
        }

        $qcParameter->load(['product', 'unit']);

        return response()->json([
            'success' => true,
            'data' => new QcParameterResource($qcParameter),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function store(StoreQcParameterRequest $request, CreateQcParameterAction $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user, ...$request->validated()]);

        return response()->json([
            'success' => true,
            'data' => new QcParameterResource($result['qcParameter']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ], 201)->header('Location', '/v1/qc/parameters/'.$result['qcParameter']->uuid);
    }

    public function update(UpdateQcParameterRequest $request, UpdateQcParameterAction $action, QcParameter $qcParameter): JsonResponse
    {
        if (TenantContext::isBound() && $qcParameter->tenant_id !== TenantContext::current()->tenantId()) {
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
            'qcParameter' => $qcParameter,
            ...$request->validated(),
        ]);

        return response()->json([
            'success' => true,
            'data' => new QcParameterResource($result['qcParameter']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function destroy(Request $request, DeleteQcParameterAction $action, QcParameter $qcParameter): JsonResponse
    {
        if (TenantContext::isBound() && $qcParameter->tenant_id !== TenantContext::current()->tenantId()) {
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
            'qcParameter' => $qcParameter,
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

        // Preload products
        $products = \App\Models\Product::where('tenant_id', $tenantId)->get();
        $productMap = [];
        foreach ($products as $prod) {
            $productMap[strtolower(trim((string) $prod->sku))] = $prod;
            $productMap[strtolower(trim((string) $prod->name))] = $prod;
            $productMap[(string) $prod->id] = $prod;
        }

        // Preload units
        $units = \App\Models\Unit::where('tenant_id', $tenantId)->get();
        $unitMap = [];
        foreach ($units as $unit) {
            $unitMap[strtolower(trim((string) $unit->code))] = $unit;
            $unitMap[strtolower(trim((string) $unit->name))] = $unit;
            $unitMap[(string) $unit->id] = $unit;
        }

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $userId,
                $productMap,
                $unitMap,
                $mode,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $i => $row) {
                    $rowNum = ($chunkIndex * 100) + $i + 1;

                    $name = trim((string) ($row['name'] ?? $row['parameter_name'] ?? ''));
                    if ($name === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'name',
                            'message' => 'Parameter name is required.',
                        ];

                        continue;
                    }

                    // Resolve Product (optional)
                    $productId = null;
                    $prodKey = strtolower(trim((string) ($row['product_sku'] ?? $row['sku'] ?? $row['product_code'] ?? $row['product'] ?? '')));
                    if ($prodKey !== '') {
                        $product = $productMap[$prodKey] ?? null;
                        if (! $product) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'product_sku',
                                'message' => "Product '{$prodKey}' not found.",
                            ];

                            continue;
                        }
                        $productId = $product->id;
                    }

                    // Resolve Unit (optional)
                    $unitId = null;
                    $unitKey = strtolower(trim((string) ($row['unit_code'] ?? $row['unit'] ?? '')));
                    if ($unitKey !== '') {
                        $unit = $unitMap[$unitKey] ?? null;
                        if ($unit) {
                            $unitId = $unit->id;
                        }
                    }

                    $type = ! empty($row['type']) ? strtolower((string) $row['type']) : 'numeric';
                    if (! in_array($type, ['numeric', 'boolean', 'select', 'text'], true)) {
                        $type = 'numeric';
                    }

                    $minValue = isset($row['min_value']) && is_numeric($row['min_value']) ? number_format((float) $row['min_value'], 4, '.', '') : null;
                    $maxValue = isset($row['max_value']) && is_numeric($row['max_value']) ? number_format((float) $row['max_value'], 4, '.', '') : null;
                    $isMandatory = isset($row['is_mandatory']) ? filter_var($row['is_mandatory'], FILTER_VALIDATE_BOOLEAN) : true;
                    $sortOrder = isset($row['sort_order']) && is_numeric($row['sort_order']) ? (int) $row['sort_order'] : 0;

                    // Query existing parameter
                    $query = QcParameter::withoutGlobalScope('tenant')
                        ->where('tenant_id', $tenantId)
                        ->where('name', $name);

                    if ($productId !== null) {
                        $query->where('product_id', $productId);
                    } else {
                        $query->whereNull('product_id');
                    }

                    $existing = $query->first();

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        // Upsert
                        $existing->update([
                            'type' => $type,
                            'unit_id' => $unitId ?? $existing->unit_id,
                            'min_value' => $minValue ?? $existing->min_value,
                            'max_value' => $maxValue ?? $existing->max_value,
                            'is_mandatory' => $isMandatory ? 1 : 0,
                            'sort_order' => $sortOrder,
                            'updated_by' => $userId,
                        ]);

                        $updated++;

                        continue;
                    }

                    // Insert
                    QcParameter::create([
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' => $tenantId,
                        'product_id' => $productId,
                        'name' => $name,
                        'type' => $type,
                        'unit_id' => $unitId,
                        'min_value' => $minValue,
                        'max_value' => $maxValue,
                        'is_mandatory' => $isMandatory ? 1 : 0,
                        'sort_order' => $sortOrder,
                        'created_by' => $userId,
                    ]);

                    $imported++;
                }
            });
        }

        return response()->json([
            'success' => true,
            'message' => "Bulk import completed. {$imported} QC parameter(s) imported, {$updated} updated, {$skipped} skipped.",
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
