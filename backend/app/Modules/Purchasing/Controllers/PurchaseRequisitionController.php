<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Purchasing\Actions\ApprovePurchaseRequisitionAction;
use App\Modules\Purchasing\Actions\CreatePurchaseRequisitionAction;
use App\Modules\Purchasing\Models\PurchaseRequisition;
use App\Modules\Purchasing\Requests\StorePurchaseRequisitionRequest;
use App\Modules\Purchasing\Resources\PurchaseRequisitionResource;
use App\Core\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PurchaseRequisitionController extends Controller
{
    public function __construct(
        private readonly CreatePurchaseRequisitionAction $createRequisition,
        private readonly ApprovePurchaseRequisitionAction $approveRequisition
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = PurchaseRequisition::with(['warehouse', 'items.product', 'items.unit', 'requester'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', (int) $request->query('warehouse_id'));
        }

        if ($request->filled('branch_id')) {
            $query->where('branch_id', (int) $request->query('branch_id'));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where('requisition_number', 'like', "%{$search}%");
        }

        $requisitions = $query->orderByDesc('required_by_date')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return PurchaseRequisitionResource::collection($requisitions);
    }

    public function store(StorePurchaseRequisitionRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();
        $requisitionDate = is_string($validated['requisition_date'] ?? null) ? $validated['requisition_date'] : now()->toDateString();

        /** @var array{warehouse_id: int, requisition_date?: string, requisition_number?: string, required_by_date?: string|null, department?: string|null, notes?: string|null, items: list<array{product_id: int, quantity: string, unit_id: int, variant_id?: int|null, estimated_unit_cost?: string, reason?: string|null}>} $validated */
        $requisition = $this->createRequisition->execute([
            ...$validated,
            'requisition_date' => $requisitionDate,
            'tenant_id' => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new PurchaseRequisitionResource($requisition))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): PurchaseRequisitionResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $requisition = PurchaseRequisition::with(['warehouse', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new PurchaseRequisitionResource($requisition);
    }

    public function approve(int $id, Request $request): PurchaseRequisitionResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $requisition = PurchaseRequisition::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $approved = $this->approveRequisition->execute(
            $requisition,
            (int) $request->user()?->id
        );

        return new PurchaseRequisitionResource($approved);
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseRequisition $requisition */
        $requisition = PurchaseRequisition::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if ($requisition->status === 'converted') {
            return response()->json([
                'message' => 'Cannot delete a requisition that has already been converted to a purchase order.',
            ], 422);
        }

        $prNumber = $requisition->requisition_number ?? "#{$requisition->id}";
        $requisition->delete();

        return response()->json([
            'success' => true,
            'message' => "Purchase Requisition {$prNumber} moved to Data Bin successfully.",
        ]);
    }
}

