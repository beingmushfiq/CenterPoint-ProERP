<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Purchasing\Actions\CreateGoodsReceiptAction;
use App\Modules\Purchasing\Models\GoodsReceipt;
use App\Modules\Purchasing\Requests\StoreGoodsReceiptRequest;
use App\Modules\Purchasing\Resources\GoodsReceiptResource;
use App\Core\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class GoodsReceiptController extends Controller
{
    public function __construct(
        private readonly CreateGoodsReceiptAction $createReceipt
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = GoodsReceipt::with(['supplier', 'warehouse', 'purchaseOrder', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('party_id')) {
            $query->where('party_id', (int) $request->query('party_id'));
        }

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', (int) $request->query('warehouse_id'));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where('grn_number', 'like', "%{$search}%");
        }

        $perPage = $request->integer('per_page', 25);
        $receipts = $query->orderByDesc('receipt_date')
            ->orderByDesc('id')
            ->paginate($perPage);

        return GoodsReceiptResource::collection($receipts);
    }

    public function store(StoreGoodsReceiptRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{party_id: int, warehouse_id: int, receipt_date: string, grn_number?: string, purchase_order_id?: int|null, supplier_document_number?: string|null, notes?: string|null, items: list<array{product_id: int, received_quantity: string, accepted_quantity: string, unit_id: int, unit_cost: string, purchase_order_item_id?: int|null, rejected_quantity?: string, variant_id?: int|null, warehouse_location_id?: int|null, batch_code?: string|null, serial_number?: string|null, expiry_date?: string|null}>} $validated */
        $receipt = $this->createReceipt->execute([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new GoodsReceiptResource($receipt))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): GoodsReceiptResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $receipt = GoodsReceipt::with(['supplier', 'warehouse', 'items.product', 'items.unit', 'items.warehouseLocation'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new GoodsReceiptResource($receipt);
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var GoodsReceipt $receipt */
        $receipt = GoodsReceipt::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if ($receipt->status === 'completed') {
            return response()->json([
                'message' => 'Cannot update a completed goods receipt.',
            ], 422);
        }

        $validated = $request->validate([
            'notes' => 'nullable|string',
            'supplier_document_number' => 'nullable|string',
        ]);

        $receipt->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Goods receipt updated.',
            'data' => new GoodsReceiptResource($receipt->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function complete(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var GoodsReceipt $receipt */
        $receipt = GoodsReceipt::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $receipt->update([
            'status' => 'completed',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Goods receipt marked as completed.',
            'data' => new GoodsReceiptResource($receipt->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var GoodsReceipt $receipt */
        $receipt = GoodsReceipt::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if ($receipt->status === 'completed') {
            return response()->json([
                'message' => 'Cannot delete a completed goods receipt note.',
            ], 422);
        }

        $receipt->delete();

        return response()->json([
            'success' => true,
            'message' => 'Goods receipt deleted.',
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }
}
