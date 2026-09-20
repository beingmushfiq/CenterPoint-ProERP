<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Purchasing\Actions\ApprovePurchaseOrderAction;
use App\Modules\Purchasing\Actions\CreatePurchaseOrderAction;
use App\Modules\Purchasing\Models\PurchaseOrder;
use App\Modules\Purchasing\Requests\StorePurchaseOrderRequest;
use App\Modules\Purchasing\Resources\PurchaseOrderResource;
use App\Core\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PurchaseOrderController extends Controller
{
    public function __construct(
        private readonly CreatePurchaseOrderAction $createOrder,
        private readonly ApprovePurchaseOrderAction $approveOrder
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = PurchaseOrder::with(['supplier', 'warehouse', 'items.product', 'items.unit'])
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
            $query->where('po_number', 'like', "%{$search}%");
        }

        $orders = $query->orderByDesc('order_date')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return PurchaseOrderResource::collection($orders);
    }

    public function store(StorePurchaseOrderRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{party_id: int, warehouse_id: int, order_date: string, po_number?: string, expected_delivery_date?: string|null, currency_code?: string, exchange_rate?: string, notes?: string|null, terms_and_conditions?: string|null, items: list<array{product_id: int, quantity: string, unit_id: int, unit_price: string, variant_id?: int|null, discount_amount?: string, tax_profile_id?: int|null, tax_rate?: string, expected_date?: string|null, notes?: string|null}>} $validated */
        $order = $this->createOrder->execute([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new PurchaseOrderResource($order))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): PurchaseOrderResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $order = PurchaseOrder::with(['supplier', 'warehouse', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new PurchaseOrderResource($order);
    }

    public function approve(int $id, Request $request): PurchaseOrderResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $order = PurchaseOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $approved = $this->approveOrder->execute(
            $order,
            (int) $request->user()?->id
        );

        return new PurchaseOrderResource($approved);
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseOrder $order */
        $order = PurchaseOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if (in_array($order->status, ['completed', 'received'], true)) {
            return response()->json([
                'message' => 'Cannot delete an order that has already been fulfilled or received. Cancel it first.',
            ], 422);
        }

        $poNumber = $order->po_number ?? "#{$order->id}";
        $order->delete();

        return response()->json([
            'success' => true,
            'message' => "Purchase Order {$poNumber} moved to Data Bin successfully.",
        ]);
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseOrder $order */
        $order = PurchaseOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if (in_array($order->status, ['completed', 'received', 'cancelled'], true)) {
            return response()->json([
                'message' => 'Cannot update an order that is already completed or cancelled.',
            ], 422);
        }

        $validated = $request->validate([
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'supplier_reference' => 'nullable|string',
        ]);

        $order->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Purchase order updated.',
            'data' => new PurchaseOrderResource($order->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function cancel(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseOrder $order */
        $order = PurchaseOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if (in_array($order->status, ['completed', 'received'], true)) {
            return response()->json([
                'message' => 'Cannot cancel an order that has already been fulfilled.',
            ], 422);
        }

        $order->update([
            'status' => 'cancelled',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Purchase order cancelled.',
            'data' => new PurchaseOrderResource($order->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }
}

