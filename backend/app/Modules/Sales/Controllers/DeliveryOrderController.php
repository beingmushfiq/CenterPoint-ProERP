<?php

declare(strict_types=1);

namespace App\Modules\Sales\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Sales\Actions\CreateDeliveryOrderAction;
use App\Modules\Sales\Actions\DispatchDeliveryOrderAction;
use App\Modules\Sales\Models\DeliveryOrder;
use App\Modules\Sales\Requests\StoreDeliveryOrderRequest;
use App\Modules\Sales\Resources\DeliveryOrderResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class DeliveryOrderController extends Controller
{
    public function __construct(
        private readonly CreateDeliveryOrderAction $createDelivery,
        private readonly DispatchDeliveryOrderAction $dispatchDelivery
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = DeliveryOrder::with(['salesOrder', 'warehouse', 'party', 'items.product'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('sales_order_id')) {
            $query->where('sales_order_id', (int) $request->query('sales_order_id'));
        }

        $deliveries = $query->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate((int) $request->query('per_page', 25));

        return DeliveryOrderResource::collection($deliveries);
    }

    public function store(StoreDeliveryOrderRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{sales_order_id: int, warehouse_id: int, recipient_name: string, recipient_phone: string, items: list<array{product_id: int, quantity: string, unit_id: int}>} $validated */
        $delivery = $this->createDelivery->execute([
            ...$validated,
            'tenant_id'  => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new DeliveryOrderResource($delivery))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): DeliveryOrderResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $delivery = DeliveryOrder::with(['salesOrder', 'warehouse', 'party', 'items.product'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new DeliveryOrderResource($delivery);
    }

    public function dispatch(int $id, Request $request): DeliveryOrderResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $delivery = DeliveryOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $dispatched = $this->dispatchDelivery->execute(
            $delivery,
            (int) $request->user()?->id
        );

        return new DeliveryOrderResource($dispatched);
    }

    public function deliver(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $delivery = DeliveryOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $delivery->update([
            'status' => 'delivered',
            'delivered_at' => now(),
            'cod_collected_amount' => $delivery->cod_amount ?? '0.00',
            'cod_status' => 'collected',
            'updated_by' => (int) $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Delivery marked as completed.',
            'data' => new DeliveryOrderResource($delivery->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $delivery = DeliveryOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'recipient_name' => 'nullable|string|max:191',
            'recipient_phone' => 'nullable|string|max:50',
            'special_instructions' => 'nullable|string',
            'status' => 'nullable|string|in:pending,in_transit,delivered,cancelled',
            'delivery_type' => 'nullable|string',
            'scheduled_date' => 'nullable|date',
        ]);

        $delivery->update([
            ...$validated,
            'updated_by' => (int) $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Delivery order updated.',
            'data' => new DeliveryOrderResource($delivery->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $delivery = DeliveryOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $delivery->delete();

        return response()->json([
            'success' => true,
            'message' => 'Delivery order deleted.',
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }
}
