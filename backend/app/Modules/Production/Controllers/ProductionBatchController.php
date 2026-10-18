<?php

declare(strict_types=1);

namespace App\Modules\Production\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\ProductionBatch;
use App\Models\User;
use App\Modules\Production\Actions\AnalyzeBatchYieldAction;
use App\Modules\Production\Actions\CloseProductionBatchAction;
use App\Modules\Production\Actions\CompleteProductionBatchAction;
use App\Modules\Production\Actions\CreateProductionBatchAction;
use App\Modules\Production\Actions\DeleteProductionBatchAction;
use App\Modules\Production\Actions\IssueBomMaterialsAction;
use App\Modules\Production\Actions\RecordBatchInputAction;
use App\Modules\Production\Actions\RecordBatchOutputAction;
use App\Modules\Production\Actions\StartProductionBatchAction;
use App\Modules\Production\Actions\UpdateProductionBatchAction;
use App\Modules\Production\Requests\RecordBatchInputRequest;
use App\Modules\Production\Requests\RecordBatchOutputRequest;
use App\Modules\Production\Requests\StoreProductionBatchRequest;
use App\Modules\Production\Requests\UpdateProductionBatchRequest;
use App\Modules\Production\Resources\ProductionBatchInputResource;
use App\Modules\Production\Resources\ProductionBatchResource;
use App\Modules\Production\Resources\ProductionOutputResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ProductionBatchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $allowed = ['status', 'context_completeness', 'batch_date', 'product_id', 'q', 'sort', 'page', 'per_page'];
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

        $query = ProductionBatch::query()->with(['product', 'billOfMaterial', 'outputUnit', 'inputs', 'outputs', 'supervisor']);

        foreach (['status', 'context_completeness', 'batch_date'] as $field) {
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
            $query->where('batch_number', 'like', $like);
        }

        $sortRaw = $request->input('sort', 'id');
        $sort = is_string($sortRaw) ? $sortRaw : 'id';
        foreach (explode(',', $sort) as $piece) {
            $desc = str_starts_with($piece, '-');
            $field = $desc ? substr($piece, 1) : $piece;
            if (in_array($field, ['id', 'batch_number', 'batch_date', 'status', 'planned_quantity', 'created_at'], true)) {
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
            'data' => ProductionBatchResource::collection($paginated->items()),
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

    public function show(Request $request, ProductionBatch $productionBatch): JsonResponse
    {
        if (TenantContext::isBound() && $productionBatch->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false
            );
        }

        $productionBatch->load(['product', 'billOfMaterial', 'outputUnit', 'inputs.product', 'inputs.unit', 'outputs.product', 'outputs.unit', 'outputs.targetWarehouse', 'supervisor', 'closedByUser']);

        return response()->json([
            'success' => true,
            'data' => new ProductionBatchResource($productionBatch),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function store(StoreProductionBatchRequest $request, CreateProductionBatchAction $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user, ...$request->validated()]);

        return response()->json([
            'success' => true,
            'data' => new ProductionBatchResource($result['productionBatch']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ], 201)->header('Location', '/v1/production/batches/'.$result['productionBatch']->uuid);
    }

    public function update(UpdateProductionBatchRequest $request, UpdateProductionBatchAction $action, ProductionBatch $productionBatch): JsonResponse
    {
        if (TenantContext::isBound() && $productionBatch->tenant_id !== TenantContext::current()->tenantId()) {
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
            'productionBatch' => $productionBatch,
            ...$request->validated(),
        ]);

        return response()->json([
            'success' => true,
            'data' => new ProductionBatchResource($result['productionBatch']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function start(Request $request, StartProductionBatchAction $action, ProductionBatch $productionBatch): JsonResponse
    {
        if (TenantContext::isBound() && $productionBatch->tenant_id !== TenantContext::current()->tenantId()) {
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
            'productionBatch' => $productionBatch,
        ]);

        return response()->json([
            'success' => true,
            'data' => new ProductionBatchResource($result['productionBatch']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function complete(Request $request, CompleteProductionBatchAction $action, ProductionBatch $productionBatch): JsonResponse
    {
        if (TenantContext::isBound() && $productionBatch->tenant_id !== TenantContext::current()->tenantId()) {
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
            'productionBatch' => $productionBatch,
        ]);

        return response()->json([
            'success' => true,
            'data' => new ProductionBatchResource($result['productionBatch']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function recordInput(RecordBatchInputRequest $request, RecordBatchInputAction $action, ProductionBatch $productionBatch): JsonResponse
    {
        if (TenantContext::isBound() && $productionBatch->tenant_id !== TenantContext::current()->tenantId()) {
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
            'productionBatch' => $productionBatch,
            ...$request->validated(),
        ]);

        return response()->json([
            'success' => true,
            'data' => new ProductionBatchInputResource($result['productionBatchInput']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ], 201);
    }

    public function recordOutput(RecordBatchOutputRequest $request, RecordBatchOutputAction $action, ProductionBatch $productionBatch): JsonResponse
    {
        if (TenantContext::isBound() && $productionBatch->tenant_id !== TenantContext::current()->tenantId()) {
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
            'productionBatch' => $productionBatch,
            ...$request->validated(),
        ]);

        return response()->json([
            'success' => true,
            'data' => new ProductionOutputResource($result['productionOutput']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ], 201);
    }

    public function analyze(Request $request, AnalyzeBatchYieldAction $action, ProductionBatch $productionBatch): JsonResponse
    {
        if (TenantContext::isBound() && $productionBatch->tenant_id !== TenantContext::current()->tenantId()) {
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
            'productionBatch' => $productionBatch,
        ]);

        return response()->json([
            'success' => true,
            'data' => new ProductionBatchResource($result['productionBatch']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function close(Request $request, CloseProductionBatchAction $action, ProductionBatch $productionBatch): JsonResponse
    {
        if (TenantContext::isBound() && $productionBatch->tenant_id !== TenantContext::current()->tenantId()) {
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
            'productionBatch' => $productionBatch,
        ]);

        return response()->json([
            'success' => true,
            'data' => new ProductionBatchResource($result['productionBatch']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function issueBom(Request $request, IssueBomMaterialsAction $action, ProductionBatch $productionBatch): JsonResponse
    {
        if (TenantContext::isBound() && $productionBatch->tenant_id !== TenantContext::current()->tenantId()) {
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
            'productionBatch' => $productionBatch,
        ]);

        return response()->json([
            'success' => true,
            'data' => new ProductionBatchResource($result['productionBatch']),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'issued_count' => $result['issued_count'],
                'total_issued_quantity' => $result['total_issued_quantity'],
            ],
        ]);
    }

    public function destroy(Request $request, DeleteProductionBatchAction $action, ProductionBatch $productionBatch): JsonResponse
    {
        if (TenantContext::isBound() && $productionBatch->tenant_id !== TenantContext::current()->tenantId()) {
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
            'productionBatch' => $productionBatch,
        ]);

        return response()->json([
            'success' => true,
            'data' => null,
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }
}
