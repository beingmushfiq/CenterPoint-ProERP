<?php

declare(strict_types=1);

namespace App\Modules\Sales\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Sales\Actions\ApproveSalesReturnAction;
use App\Modules\Sales\Actions\CreateSalesReturnAction;
use App\Modules\Sales\Models\SalesReturn;
use App\Modules\Sales\Requests\StoreSalesReturnRequest;
use App\Modules\Sales\Resources\SalesReturnResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class SalesReturnController extends Controller
{
    public function __construct(
        private readonly CreateSalesReturnAction $createReturn,
        private readonly ApproveSalesReturnAction $approveReturn
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = SalesReturn::with(['customer', 'warehouse', 'items.product', 'reasonCode', 'invoice'])
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

        $returns = $query->orderByDesc('return_date')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return SalesReturnResource::collection($returns);
    }

    public function store(StoreSalesReturnRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{return_date: string, warehouse_id: int, reason_code_id: int, items: list<array{product_id: int, quantity: string, unit_id: int, unit_price: string}>} $validated */
        $salesReturn = $this->createReturn->execute([
            ...$validated,
            'tenant_id'  => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new SalesReturnResource($salesReturn))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): SalesReturnResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $return = SalesReturn::with(['customer', 'warehouse', 'items.product', 'reasonCode', 'invoice'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new SalesReturnResource($return);
    }

    public function approve(int $id, Request $request): SalesReturnResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $return = SalesReturn::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $approved = $this->approveReturn->execute(
            $return,
            (int) $request->user()?->id
        );

        return new SalesReturnResource($approved);
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var SalesReturn $return */
        $return = SalesReturn::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if ($return->status === 'approved' || $return->status === 'completed') {
            return response()->json([
                'message' => 'Cannot delete an approved sales return with stock and refund impact. Void or cancel it first.',
            ], 422);
        }

        $returnNumber = $return->return_number ?? "#{$return->id}";
        $return->delete();

        return response()->json([
            'success' => true,
            'message' => "Sales Return {$returnNumber} moved to Data Bin successfully.",
        ]);
    }
}