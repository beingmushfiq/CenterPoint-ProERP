<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use App\Models\WarehouseLocation;
use App\Modules\Catalogue\Actions\CreateWarehouseAction;
use App\Modules\Catalogue\Actions\DeleteWarehouseAction;
use App\Modules\Catalogue\Actions\UpdateWarehouseAction;
use App\Modules\Catalogue\Requests\StoreWarehouseRequest;
use App\Modules\Catalogue\Requests\UpdateWarehouseRequest;
use App\Modules\Catalogue\Resources\WarehouseResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class WarehouseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $allowed = ['type', 'is_active', 'q', 'sort', 'page', 'per_page'];
        $unknown = array_diff(array_keys($request->all()), $allowed);
        if ($unknown !== []) {
            return ErrorResponse::make(request: $request, code: 'VALIDATION_FAILED', message: 'Unknown query parameter(s): '.implode(', ', $unknown), httpStatus: 422, retryable: false);
        }
        $query = Warehouse::query();
        foreach (['type'] as $field) {
            $value = $request->input($field);
            if (is_string($value)) {
                $query->where($field, $value);
            }
        }
        $active = $request->input('is_active');
        if (is_string($active)) {
            $query->where('is_active', filter_var($active, FILTER_VALIDATE_BOOLEAN));
        }
        $search = $request->input('q');
        if (is_string($search) && mb_strlen($search) >= 2) {
            $like = '%'.$search.'%';
            $query->where(fn ($q) => $q->where('code', 'like', $like)->orWhere('name', 'like', $like));
        }
        $sortRaw = $request->input('sort', 'id');
        $sort = is_string($sortRaw) ? $sortRaw : 'id';
        foreach (explode(',', $sort) as $piece) {
            $desc = str_starts_with($piece, '-');
            $field = $desc ? substr($piece, 1) : $piece;
            if (in_array($field, ['id', 'code', 'name', 'type', 'is_active', 'created_at', 'updated_at'], true)) {
                $query->orderBy($field, $desc ? 'desc' : 'asc');
            }
        }
        $query->orderBy('id');
        $perPageRaw = $request->input('per_page', 25);
        /** @phpstan-ignore cast.int */ $perPage = is_int($perPageRaw) ? $perPageRaw : (int) $perPageRaw;
        if ($perPage > 100) {
            return ErrorResponse::make(request: $request, code: 'VALIDATION_FAILED', message: 'per_page must not exceed 100.', httpStatus: 422, retryable: false);
        }
        $pageRaw = $request->input('page', 1);
        /** @phpstan-ignore cast.int */ $page = is_int($pageRaw) ? $pageRaw : (int) $pageRaw;
        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json(['success' => true, 'data' => WarehouseResource::collection($paginated->items()), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', ''), 'pagination' => ['page' => $paginated->currentPage(), 'per_page' => $paginated->perPage(), 'total' => $paginated->total(), 'total_pages' => $paginated->lastPage(), 'has_more' => $paginated->hasMorePages()], 'applied' => ['filters' => [], 'sort' => $sort, 'search' => is_string($search) ? $search : null]]]);
    }

    public function show(Request $request, Warehouse $warehouse): JsonResponse
    {
        if (TenantContext::isBound() && $warehouse->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        if ($request->query('include') === 'locations') {
            $warehouse->load('locations');
        }

        return response()->json(['success' => true, 'data' => new WarehouseResource($warehouse), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function options(Request $request): JsonResponse
    {
        $items = Warehouse::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->limit(500)
            ->get(['uuid', 'name', 'code'])
            ->map(static fn (Warehouse $warehouse) => ['id' => (string) $warehouse->uuid, 'warehouse_id' => $warehouse->id, 'label' => $warehouse->name.' ('.$warehouse->code.')'])
            ->values();

        return response()->json(['success' => true, 'data' => $items->all(), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function store(StoreWarehouseRequest $request, CreateWarehouseAction $action): JsonResponse
    {
        /** @var \App\Models\User $user */ $user = $request->user();
        $result = $action->execute(['user' => $user, ...$request->validated()]);

        return response()->json(['success' => true, 'data' => new WarehouseResource($result['warehouse']), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]], 201)->header('Location', '/v1/warehouses/'.$result['warehouse']->uuid);
    }

    public function update(UpdateWarehouseRequest $request, UpdateWarehouseAction $action, Warehouse $warehouse): JsonResponse
    {
        if (TenantContext::isBound() && $warehouse->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        /** @var \App\Models\User $user */ $user = $request->user();
        $result = $action->execute(['user' => $user, 'warehouse' => $warehouse, ...$request->validated()]);

        return response()->json(['success' => true, 'data' => new WarehouseResource($result['warehouse']), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function destroy(Request $request, DeleteWarehouseAction $action, Warehouse $warehouse): JsonResponse
    {
        if (TenantContext::isBound() && $warehouse->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        /** @var \App\Models\User $user */ $user = $request->user();
        $action->execute(['user' => $user, 'warehouse' => $warehouse]);

        return response()->json(['success' => true, 'data' => null, 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
            'rows' => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*.code' => ['nullable', 'string', 'max:32'],
            'rows.*.name' => ['required', 'string', 'max:191'],
            'rows.*.type' => ['nullable', 'string', 'max:32'],
            'rows.*.address' => ['nullable', 'string'],
            'rows.*.allows_negative_stock' => ['nullable', 'boolean'],
            'rows.*.is_default' => ['nullable', 'boolean'],
            'rows.*.is_active' => ['nullable', 'boolean'],
            'rows.*.locations' => ['nullable', 'string'],
        ]);

        $mode = $validated['mode'] ?? 'skip';
        $rows = $validated['rows'];
        $user = $request->user();
        $userId = $user ? $user->id : null;

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $existingCodes = Warehouse::query()
            ->whereNotNull('code')
            ->pluck('id', 'code')
            ->mapWithKeys(fn ($id, $code) => [strtolower((string) $code) => $id])
            ->all();

        $existingNames = Warehouse::query()
            ->pluck('id', 'name')
            ->mapWithKeys(fn ($id, $name) => [strtolower((string) $name) => $id])
            ->all();

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $mode,
                $userId,
                &$existingCodes,
                &$existingNames,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $index => $row) {
                    $rowNum = ($chunkIndex * 100) + $index + 1;
                    $code = isset($row['code']) && trim((string) $row['code']) !== '' ? trim((string) $row['code']) : null;
                    $name = trim((string) ($row['name'] ?? ''));
                    $type = ! empty($row['type']) ? strtolower(trim((string) $row['type'])) : 'general';
                    $address = isset($row['address']) && trim((string) $row['address']) !== '' ? trim((string) $row['address']) : null;
                    $allowsNeg = isset($row['allows_negative_stock']) ? (bool) $row['allows_negative_stock'] : false;
                    $isDefault = isset($row['is_default']) ? (bool) $row['is_default'] : false;
                    $isActive = isset($row['is_active']) ? (bool) $row['is_active'] : true;
                    $locationsRaw = isset($row['locations']) ? trim((string) $row['locations']) : '';

                    if ($name === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'name',
                            'value' => '',
                            'message' => 'Warehouse name is required.',
                        ];

                        continue;
                    }

                    $existingId = null;
                    if ($code && isset($existingCodes[strtolower($code)])) {
                        $existingId = $existingCodes[strtolower($code)];
                    } elseif (isset($existingNames[strtolower($name)])) {
                        $existingId = $existingNames[strtolower($name)];
                    }

                    $warehouse = null;

                    if ($existingId !== null) {
                        if ($mode === 'skip') {
                            $skipped++;
                            $warehouse = Warehouse::find($existingId);
                        } else {
                            try {
                                $warehouse = Warehouse::find($existingId);
                                if ($warehouse) {
                                    $warehouse->update([
                                        'name' => $name,
                                        'type' => $type,
                                        'address' => $address ?? $warehouse->address,
                                        'allows_negative_stock' => $allowsNeg,
                                        'is_default' => $isDefault,
                                        'is_active' => $isActive,
                                        'updated_by' => $userId,
                                    ]);
                                    $updated++;
                                } else {
                                    $skipped++;
                                }
                            } catch (Throwable $e) {
                                $errors[] = [
                                    'row' => $rowNum,
                                    'field' => 'name',
                                    'value' => $name,
                                    'message' => 'Update failed: '.$e->getMessage(),
                                ];

                                continue;
                            }
                        }
                    } else {
                        // Generate code if missing
                        if (! $code) {
                            $code = 'WH-'.str_pad((string) random_int(100, 99999), 5, '0', STR_PAD_LEFT);
                        }

                        try {
                            $warehouse = Warehouse::create([
                                'uuid' => (string) Str::uuid(),
                                'code' => $code,
                                'name' => $name,
                                'type' => $type,
                                'address' => $address,
                                'allows_negative_stock' => $allowsNeg,
                                'is_default' => $isDefault,
                                'is_active' => $isActive,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);

                            $existingCodes[strtolower($code)] = $warehouse->id;
                            $existingNames[strtolower($name)] = $warehouse->id;
                            $imported++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'code',
                                'value' => $code,
                                'message' => 'Creation failed: '.$e->getMessage(),
                            ];

                            continue;
                        }
                    }

                    // Auto-seed initial locations/bins if provided
                    if ($warehouse && $locationsRaw !== '') {
                        $locNames = array_filter(array_map('trim', explode(',', $locationsRaw)));
                        foreach ($locNames as $locName) {
                            if ($locName === '') {
                                continue;
                            }
                            $locCode = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', $locName)) ?: 'BIN';

                            $locExists = WarehouseLocation::query()
                                ->where('warehouse_id', $warehouse->id)
                                ->where(fn ($q) => $q->where('code', $locCode)->orWhere('name', $locName))
                                ->exists();

                            if (! $locExists) {
                                WarehouseLocation::create([
                                    'uuid' => (string) Str::uuid(),
                                    'warehouse_id' => $warehouse->id,
                                    'parent_id' => null,
                                    'code' => $locCode,
                                    'name' => $locName,
                                    'type' => 'bin',
                                    'is_active' => true,
                                    'created_by' => $userId,
                                    'updated_by' => $userId,
                                ]);
                            }
                        }
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
