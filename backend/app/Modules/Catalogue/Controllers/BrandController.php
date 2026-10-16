<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Modules\Catalogue\Actions\CreateBrandAction;
use App\Modules\Catalogue\Actions\DeleteBrandAction;
use App\Modules\Catalogue\Actions\UpdateBrandAction;
use App\Modules\Catalogue\Requests\StoreBrandRequest;
use App\Modules\Catalogue\Requests\UpdateBrandRequest;
use App\Modules\Catalogue\Resources\BrandResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class BrandController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $allowed = ['is_active', 'q', 'sort', 'page', 'per_page'];
        $unknown = array_diff(array_keys($request->all()), $allowed);
        if ($unknown !== []) {
            return ErrorResponse::make(request: $request, code: 'VALIDATION_FAILED', message: 'Unknown query parameter(s): '.implode(', ', $unknown), httpStatus: 422, retryable: false);
        }
        $query = Brand::query();
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
            if (in_array($field, ['id', 'code', 'name', 'is_active', 'created_at', 'updated_at'], true)) {
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
        $filters = [];
        foreach (['is_active', 'q'] as $filter) {
            if ($request->filled($filter)) {
                $filters[$filter] = $request->input($filter);
            }
        }

        return response()->json(['success' => true, 'data' => BrandResource::collection($paginated->items()), 'meta' => [
            'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            'pagination' => ['page' => $paginated->currentPage(), 'per_page' => $paginated->perPage(), 'total' => $paginated->total(), 'total_pages' => $paginated->lastPage(), 'has_more' => $paginated->hasMorePages()],
            'applied' => ['filters' => $filters, 'sort' => $sort, 'search' => is_string($search) ? $search : null],
        ]]);
    }

    public function show(Request $request, Brand $brand): JsonResponse
    {
        if (TenantContext::isBound() && $brand->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }

        return response()->json(['success' => true, 'data' => new BrandResource($brand), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function options(Request $request): JsonResponse
    {
        $items = Brand::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->limit(500)
            ->get(['uuid', 'name', 'code'])
            ->map(static fn (Brand $brand) => ['id' => (string) $brand->uuid, 'label' => $brand->name.' ('.$brand->code.')'])
            ->values();

        /** @var Collection<int, array{id: string, label: string}> $items */
        return response()->json(['success' => true, 'data' => $items->all(), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function store(StoreBrandRequest $request, CreateBrandAction $action): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $validated = $request->validated();
        $result = $action->execute(['user' => $user, 'code' => is_string($validated['code'] ?? null) ? $validated['code'] : '', 'name' => is_string($validated['name'] ?? null) ? $validated['name'] : '', 'logo_path' => is_string($validated['logo_path'] ?? null) ? $validated['logo_path'] : null, 'is_active' => isset($validated['is_active']) ? (bool) $validated['is_active'] : true]);

        return response()->json(['success' => true, 'data' => new BrandResource($result['brand']), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]], 201)->header('Location', '/v1/brands/'.$result['brand']->uuid);
    }

    public function update(UpdateBrandRequest $request, UpdateBrandAction $action, Brand $brand): JsonResponse
    {
        if (TenantContext::isBound() && $brand->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        /** @var \App\Models\User $user */
        $user = $request->user();
        $validated = $request->validated();
        /** @var array{user: \App\Models\User, brand: Brand, code?: string, name?: string, logo_path?: string|null, is_active?: bool} $payload */
        $payload = ['user' => $user, 'brand' => $brand];
        foreach (['code', 'name'] as $key) {
            if (array_key_exists($key, $validated)) {
                $payload[$key] = is_string($validated[$key]) ? $validated[$key] : '';
            }
        }
        if (array_key_exists('logo_path', $validated)) {
            $payload['logo_path'] = is_string($validated['logo_path']) ? $validated['logo_path'] : null;
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        $result = $action->execute($payload);

        return response()->json(['success' => true, 'data' => new BrandResource($result['brand']), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function destroy(Request $request, DeleteBrandAction $action, Brand $brand): JsonResponse
    {
        if (TenantContext::isBound() && $brand->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        /** @var \App\Models\User $user */
        $user = $request->user();
        $action->execute(['user' => $user, 'brand' => $brand]);

        return response()->json(['success' => true, 'data' => null, 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
            'rows' => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*.code' => ['nullable', 'string', 'max:32'],
            'rows.*.name' => ['required', 'string', 'max:191'],
            'rows.*.logo_path' => ['nullable', 'string', 'max:255'],
            'rows.*.is_active' => ['nullable', 'boolean'],
        ]);

        $mode = $validated['mode'] ?? 'skip';
        $rows = $validated['rows'];
        $user = $request->user();
        $userId = $user ? $user->id : null;

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Preload existing brands for fast lookup
        $existingCodes = Brand::query()
            ->whereNotNull('code')
            ->pluck('id', 'code')
            ->mapWithKeys(fn ($id, $code) => [strtolower((string) $code) => $id])
            ->all();

        $existingNames = Brand::query()
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
                    $logoPath = isset($row['logo_path']) && trim((string) $row['logo_path']) !== '' ? trim((string) $row['logo_path']) : null;
                    $isActive = isset($row['is_active']) ? (bool) $row['is_active'] : true;

                    if ($name === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'name',
                            'value' => '',
                            'message' => 'Brand name is required.',
                        ];

                        continue;
                    }

                    $existingId = null;
                    if ($code && isset($existingCodes[strtolower($code)])) {
                        $existingId = $existingCodes[strtolower($code)];
                    } elseif (isset($existingNames[strtolower($name)])) {
                        $existingId = $existingNames[strtolower($name)];
                    }

                    if ($existingId !== null) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        // Upsert
                        try {
                            $brand = Brand::find($existingId);
                            if ($brand) {
                                $brand->update([
                                    'name' => $name,
                                    'logo_path' => $logoPath ?? $brand->logo_path,
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
                                'field' => 'name',
                                'value' => $name,
                                'message' => 'Update failed: '.$e->getMessage(),
                            ];

                            continue;
                        }
                    }

                    // Generate code if missing
                    if (! $code) {
                        $code = 'BRD-'.str_pad((string) random_int(100, 99999), 5, '0', STR_PAD_LEFT);
                    }

                    try {
                        $newBrand = Brand::create([
                            'uuid' => (string) Str::uuid(),
                            'code' => $code,
                            'name' => $name,
                            'logo_path' => $logoPath,
                            'is_active' => $isActive,
                            'created_by' => $userId,
                            'updated_by' => $userId,
                        ]);

                        $existingCodes[strtolower($code)] = $newBrand->id;
                        $existingNames[strtolower($name)] = $newBrand->id;
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
