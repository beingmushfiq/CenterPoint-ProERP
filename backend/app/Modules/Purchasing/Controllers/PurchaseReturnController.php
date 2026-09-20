<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Purchasing\Actions\CreatePurchaseReturnAction;
use App\Modules\Purchasing\Models\PurchaseReturn;
use App\Modules\Purchasing\Requests\StorePurchaseReturnRequest;
use App\Modules\Purchasing\Resources\PurchaseReturnResource;
use App\Core\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PurchaseReturnController extends Controller
{
    public function __construct(
        private readonly CreatePurchaseReturnAction $createReturn
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = PurchaseReturn::with(['supplier', 'warehouse', 'purchaseOrder', 'goodsReceipt', 'items.product', 'items.unit'])
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
            $query->where('return_number', 'like', "%{$search}%");
        }

        $returns = $query->orderByDesc('return_date')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return PurchaseReturnResource::collection($returns);
    }

    public function store(StorePurchaseReturnRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{party_id: int, warehouse_id: int, return_date: string, return_number?: string, purchase_order_id?: int|null, goods_receipt_id?: int|null, purchase_bill_id?: int|null, currency_code?: string, reason?: string|null, notes?: string|null, items: list<array{product_id: int, quantity: string, unit_id: int, unit_price: string, purchase_order_item_id?: int|null, goods_receipt_item_id?: int|null, variant_id?: int|null, warehouse_location_id?: int|null, batch_code?: string|null, tax_amount?: string, reason_code_id?: int|null}>} $validated */
        $return = $this->createReturn->execute([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new PurchaseReturnResource($return))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): PurchaseReturnResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $return = PurchaseReturn::with(['supplier', 'warehouse', 'purchaseOrder', 'goodsReceipt', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new PurchaseReturnResource($return);
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseReturn $return */
        $return = PurchaseReturn::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if (in_array($return->status, ['completed', 'settled'], true)) {
            return response()->json([
                'message' => 'Cannot delete a settled or completed purchase return. Void or cancel it first.',
            ], 422);
        }

        $returnNumber = $return->return_number ?? "#{$return->id}";
        $return->delete();

        return response()->json([
            'success' => true,
            'message' => "Purchase Return {$returnNumber} moved to Data Bin successfully.",
        ]);
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseReturn $return */
        $return = PurchaseReturn::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if (in_array($return->status, ['completed', 'settled'], true)) {
            return response()->json([
                'message' => 'Cannot update a completed or settled purchase return.',
            ], 422);
        }

        $validated = $request->validate([
            'notes' => 'nullable|string',
            'reason_code_id' => 'nullable|integer',
            'return_date' => 'nullable|date',
        ]);

        $return->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Purchase return updated.',
            'data' => new PurchaseReturnResource($return->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function complete(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseReturn $return */
        $return = PurchaseReturn::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $return->update([
            'status' => 'completed',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Purchase return marked as completed.',
            'data' => new PurchaseReturnResource($return->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }
}

