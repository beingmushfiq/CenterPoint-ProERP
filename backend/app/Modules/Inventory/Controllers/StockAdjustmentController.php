<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Inventory\Actions\ApproveStockAdjustmentAction;
use App\Modules\Inventory\Actions\CreateStockAdjustmentAction;
use App\Modules\Inventory\Models\StockAdjustment;
use App\Modules\Inventory\Requests\StoreStockAdjustmentRequest;
use App\Modules\Inventory\Resources\StockAdjustmentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class StockAdjustmentController extends Controller
{
    public function __construct(
        private readonly CreateStockAdjustmentAction $createAdjustment,
        private readonly ApproveStockAdjustmentAction $approveAdjustment
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = StockAdjustment::with(['warehouse', 'reasonCode', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', (int) $request->query('warehouse_id'));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where('adjustment_number', 'like', "%{$search}%");
        }

        $adjustments = $query->orderByDesc('adjustment_date')
            ->orderByDesc('id')
            ->paginate((int) ($request->query('per_page') ?? 25));

        return StockAdjustmentResource::collection($adjustments);
    }

    public function store(StoreStockAdjustmentRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{warehouse_id: int, adjustment_date: string, reason_code_id: int, adjustment_number?: string, notes?: string|null, items: list<array{product_id: int, direction: 'in'|'out', quantity: string, unit_id: int, variant_id?: int|null, warehouse_location_id?: int|null, batch_code?: string|null, unit_cost?: string}>} $validated */
        $adjustment = $this->createAdjustment->execute([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new StockAdjustmentResource($adjustment))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): StockAdjustmentResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockAdjustment $adjustment */
        $adjustment = StockAdjustment::with(['warehouse', 'reasonCode', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new StockAdjustmentResource($adjustment);
    }

    public function approve(int $id, Request $request): StockAdjustmentResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockAdjustment $adjustment */
        $adjustment = StockAdjustment::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $approved = $this->approveAdjustment->execute(
            $adjustment,
            (int) $request->user()?->id
        );

        return new StockAdjustmentResource($approved);
    }

    public function update(int $id, Request $request): StockAdjustmentResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockAdjustment $adjustment */
        $adjustment = StockAdjustment::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $fillable = ['status', 'notes', 'adjustment_date', 'warehouse_id', 'reason_code_id', 'total_value_impact'];
        $adjustment->update($request->only($fillable));

        return new StockAdjustmentResource($adjustment->load(['warehouse', 'reasonCode', 'items.product', 'items.unit']));
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockAdjustment $adjustment */
        $adjustment = StockAdjustment::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $adjustment->delete();

        return response()->json(['message' => 'Stock adjustment deleted successfully.']);
    }
}
