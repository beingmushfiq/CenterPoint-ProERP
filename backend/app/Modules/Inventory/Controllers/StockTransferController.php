<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Inventory\Actions\CreateStockTransferAction;
use App\Modules\Inventory\Actions\DispatchStockTransferAction;
use App\Modules\Inventory\Actions\ReceiveStockTransferAction;
use App\Modules\Inventory\Models\StockTransfer;
use App\Modules\Inventory\Requests\ReceiveStockTransferRequest;
use App\Modules\Inventory\Requests\StoreStockTransferRequest;
use App\Modules\Inventory\Resources\StockTransferResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class StockTransferController extends Controller
{
    public function __construct(
        private readonly CreateStockTransferAction $createTransfer,
        private readonly DispatchStockTransferAction $dispatchTransfer,
        private readonly ReceiveStockTransferAction $receiveTransfer
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = StockTransfer::with(['fromWarehouse', 'toWarehouse', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('from_warehouse_id')) {
            $query->where('from_warehouse_id', (int) $request->query('from_warehouse_id'));
        }

        if ($request->filled('to_warehouse_id')) {
            $query->where('to_warehouse_id', (int) $request->query('to_warehouse_id'));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where('transfer_number', 'like', "%{$search}%");
        }

        $transfers = $query->orderByDesc('transfer_date')
            ->orderByDesc('id')
            ->paginate((int) ($request->query('per_page') ?? 25));

        return StockTransferResource::collection($transfers);
    }

    public function store(StoreStockTransferRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{from_warehouse_id: int, to_warehouse_id: int, transfer_date: string, transfer_number?: string, notes?: string|null, items: list<array{product_id: int, sent_quantity: string, unit_id: int, variant_id?: int|null, batch_code?: string|null}>} $validated */
        $transfer = $this->createTransfer->execute([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new StockTransferResource($transfer))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): StockTransferResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockTransfer $transfer */
        $transfer = StockTransfer::with(['fromWarehouse', 'toWarehouse', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new StockTransferResource($transfer);
    }

    public function dispatch(int $id, Request $request): StockTransferResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockTransfer $transfer */
        $transfer = StockTransfer::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $dispatched = $this->dispatchTransfer->execute(
            $transfer,
            (int) $request->user()?->id
        );

        return new StockTransferResource($dispatched);
    }

    public function receive(int $id, ReceiveStockTransferRequest $request): StockTransferResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockTransfer $transfer */
        $transfer = StockTransfer::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validated();

        /** @var array{items: list<array{item_id: int, received_quantity: string, damaged_quantity?: string}>} $validated */
        $received = $this->receiveTransfer->execute(
            $transfer,
            $validated['items'],
            (int) $request->user()?->id
        );

        return new StockTransferResource($received);
    }

    public function update(int $id, Request $request): StockTransferResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockTransfer $transfer */
        $transfer = StockTransfer::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $fillable = ['status', 'notes', 'transfer_date', 'from_warehouse_id', 'to_warehouse_id'];
        $transfer->update($request->only($fillable));

        return new StockTransferResource($transfer->load(['fromWarehouse', 'toWarehouse', 'items.product', 'items.unit']));
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var StockTransfer $transfer */
        $transfer = StockTransfer::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $transfer->delete();

        return response()->json(['message' => 'Stock transfer deleted successfully.']);
    }
}
