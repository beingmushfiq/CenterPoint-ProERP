<?php

declare(strict_types=1);

namespace App\Modules\Pricing\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\PriceList;
use App\Modules\Pricing\Actions\CreatePriceListAction;
use App\Modules\Pricing\Actions\DeletePriceListAction;
use App\Modules\Pricing\Actions\UpdatePriceListAction;
use App\Modules\Pricing\Requests\StorePriceListRequest;
use App\Modules\Pricing\Requests\UpdatePriceListRequest;
use App\Modules\Pricing\Resources\PriceListResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

final class PriceListController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $allowed = ['applies_to', 'channel', 'is_active', 'q', 'sort', 'page', 'per_page'];
        $unknown = array_diff(array_keys($request->all()), $allowed);
        if ($unknown !== []) {
            return ErrorResponse::make(request: $request, code: 'VALIDATION_FAILED', message: 'Unknown query parameter(s): '.implode(', ', $unknown), httpStatus: 422, retryable: false);
        }
        $query = PriceList::query();
        foreach (['applies_to', 'channel'] as $field) {
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
            if (in_array($field, ['id', 'code', 'name', 'priority', 'is_active', 'created_at', 'updated_at'], true)) {
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
        foreach (['applies_to', 'channel', 'is_active', 'q'] as $filter) {
            if ($request->filled($filter)) {
                $filters[$filter] = $request->input($filter);
            }
        }

        return response()->json(['success' => true, 'data' => PriceListResource::collection($paginated->items()), 'meta' => [
            'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            'pagination' => ['page' => $paginated->currentPage(), 'per_page' => $paginated->perPage(), 'total' => $paginated->total(), 'total_pages' => $paginated->lastPage(), 'has_more' => $paginated->hasMorePages()],
            'applied' => ['filters' => $filters, 'sort' => $sort, 'search' => is_string($search) ? $search : null],
        ]]);
    }

    public function show(Request $request, PriceList $priceList): JsonResponse
    {
        if (TenantContext::isBound() && $priceList->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        $includeRaw = $request->query('include', '');
        $include = is_string($includeRaw) ? explode(',', $includeRaw) : [];
        if (in_array('items', $include, true)) {
            $priceList->load('items.product', 'items.variant');
        }

        return response()->json(['success' => true, 'data' => new PriceListResource($priceList), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function options(Request $request): JsonResponse
    {
        $items = PriceList::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->limit(500)
            ->get(['uuid', 'name', 'code'])
            ->map(static fn (PriceList $priceList) => ['id' => (string) $priceList->uuid, 'label' => $priceList->name.' ('.$priceList->code.')'])
            ->values();

        /** @var Collection<int, array{id: string, label: string}> $items */
        return response()->json(['success' => true, 'data' => $items->all(), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function store(StorePriceListRequest $request, CreatePriceListAction $action): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user, ...$request->validated()]);

        return response()->json(['success' => true, 'data' => new PriceListResource($result['priceList']), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]], 201)->header('Location', '/v1/price-lists/'.$result['priceList']->uuid);
    }

    public function update(UpdatePriceListRequest $request, UpdatePriceListAction $action, PriceList $priceList): JsonResponse
    {
        if (TenantContext::isBound() && $priceList->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        /** @var \App\Models\User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user, 'priceList' => $priceList, ...$request->validated()]);

        return response()->json(['success' => true, 'data' => new PriceListResource($result['priceList']), 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function destroy(Request $request, DeletePriceListAction $action, PriceList $priceList): JsonResponse
    {
        if (TenantContext::isBound() && $priceList->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(request: $request, code: 'NOT_FOUND', message: 'The requested resource was not found.', httpStatus: 404, retryable: false);
        }
        /** @var \App\Models\User $user */
        $user = $request->user();
        $action->execute(['user' => $user, 'priceList' => $priceList]);

        return response()->json(['success' => true, 'data' => null, 'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')]]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

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
        $productSkuMap = \App\Models\Product::query()
            ->where('tenant_id', $tenantId)
            ->get()
            ->keyBy(fn ($p) => strtolower((string) $p->sku));

        // Preload price lists for tenant
        $priceLists = PriceList::query()
            ->where('tenant_id', $tenantId)
            ->get();
        $priceListMap = [];
        foreach ($priceLists as $pl) {
            $priceListMap[strtolower((string) $pl->code)] = $pl;
        }

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            \Illuminate\Support\Facades\DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $mode,
                $productSkuMap,
                &$priceListMap,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $i => $row) {
                    $rowNum = ($chunkIndex * 100) + $i + 1;

                    $sku = trim((string) ($row['product_sku'] ?? ''));
                    if ($sku === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'product_sku',
                            'message' => 'Product SKU is required.',
                        ];

                        continue;
                    }

                    $lowerSku = strtolower($sku);
                    if (! isset($productSkuMap[$lowerSku])) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'product_sku',
                            'message' => "Product with SKU '{$sku}' not found.",
                        ];

                        continue;
                    }
                    $product = $productSkuMap[$lowerSku];

                    $priceListCode = trim((string) ($row['price_list_code'] ?? 'DEFAULT'));
                    if ($priceListCode === '') {
                        $priceListCode = 'DEFAULT';
                    }
                    $lowerPlCode = strtolower($priceListCode);

                    // Auto-resolve or create Price List
                    if (! isset($priceListMap[$lowerPlCode])) {
                        $plName = ! empty($row['price_list_name'])
                            ? trim((string) $row['price_list_name'])
                            : ucfirst(strtolower($priceListCode)).' Price List';

                        $newPl = new PriceList;
                        $newPl->uuid = (string) \Illuminate\Support\Str::uuid();
                        $newPl->tenant_id = $tenantId;
                        $newPl->code = strtoupper($priceListCode);
                        $newPl->name = $plName;
                        $newPl->currency_code = ! empty($row['currency_code']) ? strtoupper(trim((string) $row['currency_code'])) : 'BDT';
                        $newPl->applies_to = 'all';
                        $newPl->is_active = true;
                        $newPl->save();

                        $priceListMap[$lowerPlCode] = $newPl;
                    }
                    $priceList = $priceListMap[$lowerPlCode];

                    $unitPriceRaw = $row['unit_price'] ?? null;
                    if ($unitPriceRaw === null || ! is_numeric($unitPriceRaw) || (float) $unitPriceRaw < 0) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'unit_price',
                            'message' => 'Unit price must be a valid non-negative number.',
                        ];

                        continue;
                    }
                    $unitPrice = number_format((float) $unitPriceRaw, 4, '.', '');

                    $minQtyRaw = $row['min_quantity'] ?? 1;
                    $minQuantity = (is_numeric($minQtyRaw) && (float) $minQtyRaw > 0)
                        ? number_format((float) $minQtyRaw, 4, '.', '')
                        : '1.0000';

                    $discountPctRaw = $row['discount_percentage'] ?? 0;
                    $discountPct = (is_numeric($discountPctRaw) && (float) $discountPctRaw >= 0)
                        ? number_format((float) $discountPctRaw, 4, '.', '')
                        : '0.0000';

                    // Check existing price list item
                    $existingItem = \App\Models\PriceListItem::query()
                        ->where('tenant_id', $tenantId)
                        ->where('price_list_id', $priceList->id)
                        ->where('product_id', $product->id)
                        ->where('min_quantity', $minQuantity)
                        ->first();

                    if ($existingItem) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        // Upsert
                        $existingItem->update([
                            'unit_price' => $unitPrice,
                            'discount_percentage' => $discountPct,
                        ]);
                        $updated++;

                        continue;
                    }

                    // Insert
                    $newItem = new \App\Models\PriceListItem([
                        'price_list_id' => $priceList->id,
                        'product_id' => $product->id,
                        'variant_id' => null,
                        'min_quantity' => $minQuantity,
                        'unit_price' => $unitPrice,
                        'discount_percentage' => $discountPct,
                    ]);
                    $newItem->tenant_id = $tenantId;
                    $newItem->save();

                    $imported++;
                }
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'total_processed' => $imported + $updated + $skipped,
                'errors' => $errors,
            ],
            'message' => sprintf(
                'Bulk import completed: %d imported, %d updated, %d skipped.',
                $imported,
                $updated,
                $skipped
            ),
        ]);
    }
}
