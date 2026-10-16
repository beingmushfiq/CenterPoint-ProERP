<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Unit;
use App\Modules\Catalogue\Actions\CreateUnitAction;
use App\Modules\Catalogue\Actions\DeleteUnitAction;
use App\Modules\Catalogue\Actions\UpdateUnitAction;
use App\Modules\Catalogue\Enums\UnitType;
use App\Modules\Catalogue\Requests\StoreUnitRequest;
use App\Modules\Catalogue\Requests\UpdateUnitRequest;
use App\Modules\Catalogue\Resources\UnitResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class UnitController extends Controller
{
    /**
     * GET /v1/units
     */
    public function index(Request $request): JsonResponse
    {
        // §5.6 — reject unknown query params
        $allowed = ['type', 'is_active', 'is_base', 'q', 'sort', 'page', 'per_page'];
        $unknown = array_diff(array_keys($request->all()), $allowed);
        if ($unknown !== []) {
            return ErrorResponse::make(
                request: $request,
                code: 'VALIDATION_FAILED',
                message: 'Unknown query parameter(s): '.implode(', ', $unknown),
                httpStatus: 422,
                retryable: false,
            );
        }

        $query = Unit::query();

        // Whitelisted filters
        $typeVal = $request->input('type');
        if (is_string($typeVal)) {
            $query->where('type', $typeVal);
        }
        $activeVal = $request->input('is_active');
        if (is_string($activeVal)) {
            $query->where('is_active', filter_var($activeVal, FILTER_VALIDATE_BOOLEAN));
        }
        $baseVal = $request->input('is_base');
        if (is_string($baseVal)) {
            $query->where('is_base', filter_var($baseVal, FILTER_VALIDATE_BOOLEAN));
        }

        // Search: q param, min 2 chars, searches code and name
        $qParam = $request->input('q');
        if (is_string($qParam) && mb_strlen($qParam) >= 2) {
            $search = '%'.$qParam.'%';
            $query->where(fn ($qr) => $qr->where('code', 'like', $search)->orWhere('name', 'like', $search));
        }

        // Sort: comma-separated, -prefix for desc, whitelist, id tiebreaker
        $sortRaw = $request->input('sort', 'id');
        $sortParam = is_string($sortRaw) ? $sortRaw : 'id';
        $sortAllowed = ['id', 'code', 'name', 'type', 'is_base', 'is_active', 'created_at', 'updated_at'];
        foreach (explode(',', $sortParam) as $piece) {
            $desc = str_starts_with($piece, '-');
            $field = $desc ? substr($piece, 1) : $piece;
            if (in_array($field, $sortAllowed, true)) {
                $query->orderBy($field, $desc ? 'desc' : 'asc');
            }
        }
        $query->orderBy('id', 'asc'); // deterministic tiebreaker

        // Pagination
        $perPageRaw = $request->input('per_page', 25);
        /** @phpstan-ignore cast.int */
        $perPage = is_int($perPageRaw) ? $perPageRaw : (int) $perPageRaw;
        if ($perPage > 100) {
            return ErrorResponse::make(
                request: $request,
                code: 'VALIDATION_FAILED',
                message: 'per_page must not exceed 100.',
                httpStatus: 422,
                retryable: false,
            );
        }
        $pageRaw = $request->input('page', 1);
        /** @phpstan-ignore cast.int */
        $page = is_int($pageRaw) ? $pageRaw : (int) $pageRaw;

        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        /** @var array<string, mixed> $filters */
        $filters = [];
        foreach (['type', 'is_active', 'is_base', 'q'] as $f) {
            if ($request->filled($f)) {
                $filters[$f] = $request->input($f);
            }
        }

        $searchApplied = $request->input('q');

        return response()->json([
            'success' => true,
            'data' => UnitResource::collection($paginated->items()),
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
                    'filters' => $filters,
                    'sort' => $sortParam,
                    'search' => is_string($searchApplied) ? $searchApplied : null,
                ],
            ],
        ]);
    }

    /**
     * GET /v1/units/{unit}
     */
    public function show(Request $request, Unit $unit): JsonResponse
    {
        // Tenant isolation: route model binding doesn't use the global scope
        // (tenant.resolve runs after SubstituteBindings), so verify here.
        if (TenantContext::isBound() && $unit->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false,
            );
        }

        return response()->json([
            'success' => true,
            'data' => new UnitResource($unit),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    /**
     * GET /v1/units/options
     */
    public function options(Request $request): JsonResponse
    {
        $query = Unit::query()->where('is_active', true)->orderBy('name');

        $typeVal = $request->input('type');
        if (is_string($typeVal)) {
            $query->where('type', $typeVal);
        }

        /** @var Collection<int, array{id: string, label: string}> $items */
        $items = $query->limit(500)->get(['uuid', 'name', 'code'])->map(static fn (Unit $u) => [
            'id' => (string) $u->uuid,
            'label' => ((string) $u->name).' ('.((string) $u->code).')',
        ])->values();

        return response()->json([
            'success' => true,
            'data' => $items->all(),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    /**
     * POST /v1/units
     */
    public function store(StoreUnitRequest $request, CreateUnitAction $action): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $validated = $request->validated();

        /** @var array{unit: Unit} $result */
        $result = $action->execute([
            'user' => $user,
            /** @phpstan-ignore cast.string */
            'code' => (string) ($validated['code'] ?? ''),
            /** @phpstan-ignore cast.string */
            'name' => (string) ($validated['name'] ?? ''),
            /** @phpstan-ignore cast.string */
            'type' => (string) ($validated['type'] ?? ''),
            'is_base' => (bool) ($validated['is_base'] ?? false),
            /** @phpstan-ignore cast.int */
            'precision' => (int) ($validated['precision'] ?? 2),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        $unit = $result['unit'];

        return response()->json([
            'success' => true,
            'data' => new UnitResource($unit),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ], 201)->header('Location', '/v1/units/'.$unit->uuid);
    }

    /**
     * PATCH /v1/units/{unit}
     */
    public function update(UpdateUnitRequest $request, UpdateUnitAction $action, Unit $unit): JsonResponse
    {
        // Tenant isolation guard.
        if (TenantContext::isBound() && $unit->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false,
            );
        }

        /** @var \App\Models\User $user */
        $user = $request->user();

        $validated = $request->validated();
        /** @var array{user: \App\Models\User, unit: Unit, code?: string, name?: string, type?: string, is_base?: bool, precision?: int, is_active?: bool} $payload */
        $payload = ['user' => $user, 'unit' => $unit];
        foreach (['code', 'name', 'type'] as $stringKey) {
            if (array_key_exists($stringKey, $validated)) {
                /** @phpstan-ignore cast.string */
                $payload[$stringKey] = (string) $validated[$stringKey];
            }
        }
        foreach (['is_base', 'is_active'] as $boolKey) {
            if (array_key_exists($boolKey, $validated)) {
                $payload[$boolKey] = (bool) $validated[$boolKey];
            }
        }
        if (array_key_exists('precision', $validated)) {
            /** @phpstan-ignore cast.int */
            $payload['precision'] = (int) $validated['precision'];
        }

        /** @var array{unit: Unit} $result */
        $result = $action->execute($payload);

        return response()->json([
            'success' => true,
            'data' => new UnitResource($result['unit']),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    /**
     * DELETE /v1/units/{unit}
     */
    public function destroy(Request $request, DeleteUnitAction $action, Unit $unit): JsonResponse
    {
        // Tenant isolation guard.
        if (TenantContext::isBound() && $unit->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false,
            );
        }

        /** @var \App\Models\User $user */
        $user = $request->user();

        $action->execute([
            'user' => $user,
            'unit' => $unit,
        ]);

        return response()->json([
            'success' => true,
            'data' => null,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
            'rows' => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*.code' => ['required', 'string', 'max:32'],
            'rows.*.name' => ['required', 'string', 'max:191'],
            'rows.*.type' => ['nullable', 'string'],
            'rows.*.is_base' => ['nullable', 'boolean'],
            'rows.*.precision' => ['nullable', 'integer', 'min:0', 'max:9'],
            'rows.*.is_active' => ['nullable', 'boolean'],
        ]);

        $mode = $validated['mode'] ?? 'skip';
        $rows = $validated['rows'];
        $user = $request->user();
        $userId = $user ? $user->id : null;

        $validTypes = UnitType::values();

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $existingUnits = Unit::query()
            ->pluck('id', 'code')
            ->mapWithKeys(fn ($id, $code) => [strtolower((string) $code) => $id])
            ->all();

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $mode,
                $userId,
                $validTypes,
                &$existingUnits,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $index => $row) {
                    $rowNum = ($chunkIndex * 100) + $index + 1;
                    $code = trim((string) ($row['code'] ?? ''));
                    $name = trim((string) ($row['name'] ?? ''));
                    $type = strtolower(trim((string) ($row['type'] ?? 'piece')));
                    if (! in_array($type, $validTypes, true)) {
                        $type = 'piece';
                    }
                    $isBase = isset($row['is_base']) ? (bool) $row['is_base'] : false;
                    $precision = isset($row['precision']) ? (int) $row['precision'] : 0;
                    if ($precision < 0 || $precision > 9) {
                        $precision = 0;
                    }
                    $isActive = isset($row['is_active']) ? (bool) $row['is_active'] : true;

                    if ($code === '' || $name === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => $code === '' ? 'code' : 'name',
                            'value' => $code === '' ? $code : $name,
                            'message' => 'Unit code and name are required.',
                        ];

                        continue;
                    }

                    $existingId = $existingUnits[strtolower($code)] ?? null;

                    if ($existingId !== null) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        // Upsert
                        try {
                            $unit = Unit::find($existingId);
                            if ($unit) {
                                $unit->update([
                                    'name' => $name,
                                    'type' => $type,
                                    'is_base' => $isBase,
                                    'precision' => $precision,
                                    'is_active' => $isActive,
                                    'updated_by' => $userId,
                                ]);
                                $updated++;
                            } else {
                                $skipped++;
                            }

                            continue;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'code',
                                'value' => $code,
                                'message' => 'Update failed: '.$e->getMessage(),
                            ];

                            continue;
                        }
                    }

                    try {
                        $newUnit = Unit::create([
                            'uuid' => (string) Str::uuid(),
                            'code' => $code,
                            'name' => $name,
                            'type' => $type,
                            'is_base' => $isBase,
                            'precision' => $precision,
                            'is_active' => $isActive,
                            'created_by' => $userId,
                            'updated_by' => $userId,
                        ]);

                        $existingUnits[strtolower($code)] = $newUnit->id;
                        $imported++;
                    } catch (Throwable $e) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'code',
                            'value' => $code,
                            'message' => 'Creation failed: '.$e->getMessage(),
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
