<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Inventory\Actions\CreateStockCountAction;
use App\Modules\Inventory\Actions\ReconcileStockCountAction;
use App\Modules\Inventory\Models\StockCount;
use App\Modules\Inventory\Requests\ReconcileStockCountRequest;
use App\Modules\Inventory\Requests\StoreStockCountRequest;
use App\Modules\Inventory\Resources\StockCountResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class StockCountController extends Controller
{
    public function __construct(
        private readonly CreateStockCountAction $createCount,
        private readonly ReconcileStockCountAction $reconcileCount
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = StockCount::with(['warehouse', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', (int) $request->query('warehouse_id'));
        }

        if ($request->filled('type') || $request->filled('count_type')) {
            $type = (string) ($request->query('type') ?? $request->query('count_type'));
            $query->where('type', $type);
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where('count_number', 'like', "%{$search}%");
        }

        $counts = $query->orderByDesc('count_date')
            ->orderByDesc('id')
            ->paginate((int) ($request->query('per_page') ?? 25));

        return StockCountResource::collection($counts);
    }

    public function store(StoreStockCountRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{warehouse_id: int, count_date: string, count_type: 'full'|'cycle'|'spot', count_number?: string, notes?: string|null, product_ids?: list<int>} $validated */
        $count = $this->createCount->execute([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new StockCountResource($count))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): StockCountResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockCount $count */
        $count = StockCount::with(['warehouse', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new StockCountResource($count);
    }

    public function reconcile(int $id, ReconcileStockCountRequest $request): StockCountResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockCount $count */
        $count = StockCount::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validated();

        /** @var list<array{item_id: int, counted_quantity: string, reason_code_id?: int|null}> $items */
        $items = isset($validated['items']) && is_array($validated['items'])
            ? $validated['items']
            : (isset($validated['counts']) && is_array($validated['counts']) ? $validated['counts'] : []);

        $reconciled = $this->reconcileCount->execute(
            $count,
            $items,
            (int) $request->user()?->id
        );

        return new StockCountResource($reconciled);
    }

    public function update(int $id, Request $request): StockCountResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockCount $count */
        $count = StockCount::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $fillable = ['status', 'notes', 'count_date', 'warehouse_id', 'type'];
        $count->update($request->only($fillable));

        return new StockCountResource($count->load(['warehouse', 'items.product', 'items.unit']));
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockCount $count */
        $count = StockCount::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $count->delete();

        return response()->json(['message' => 'Stock count deleted successfully.']);
    }
}
