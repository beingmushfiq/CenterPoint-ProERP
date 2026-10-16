<?php

declare(strict_types=1);

namespace App\Modules\Sales\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Sales\Actions\ApproveExchangeAction;
use App\Modules\Sales\Actions\CreateExchangeAction;
use App\Modules\Sales\Models\Exchange;
use App\Modules\Sales\Requests\StoreExchangeRequest;
use App\Modules\Sales\Resources\ExchangeResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ExchangeController extends Controller
{
    public function __construct(
        private readonly CreateExchangeAction $createExchange,
        private readonly ApproveExchangeAction $approveExchange
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = Exchange::with(['customer', 'warehouse', 'reasonCode', 'returnItems.product', 'replacementItems.product'])
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

        if ($request->filled('pos_session_id')) {
            $query->where('pos_session_id', (int) $request->query('pos_session_id'));
        }

        if ($request->filled('exchange_type')) {
            $query->where('exchange_type', (string) $request->query('exchange_type'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('exchange_date', '>=', (string) $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('exchange_date', '<=', (string) $request->query('date_to'));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where('exchange_number', 'like', "%{$search}%");
        }

        $exchanges = $query->orderByDesc('exchange_date')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return ExchangeResource::collection($exchanges);
    }

    public function store(StoreExchangeRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{exchange_date: string, warehouse_id: int, reason_code_id: int, return_items: list<array<string,mixed>>, replacement_items: list<array<string,mixed>>} $validated */
        $exchange = $this->createExchange->execute([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new ExchangeResource($exchange))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): ExchangeResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var Exchange $exchange */
        $exchange = Exchange::with([
            'customer',
            'warehouse',
            'reasonCode',
            'returnItems.product',
            'replacementItems.product',
            'originalInvoice',
            'originalOrder',
        ])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new ExchangeResource($exchange);
    }

    public function approve(int $id, Request $request): ExchangeResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var Exchange $exchange */
        $exchange = Exchange::with(['returnItems', 'replacementItems'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $approvedExchange = $this->approveExchange->execute($exchange, (int) $request->user()?->id);

        return new ExchangeResource($approvedExchange->load(['returnItems.product', 'replacementItems.product', 'customer', 'warehouse']));
    }

    public function cancel(int $id, Request $request): ExchangeResource
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var Exchange $exchange */
        $exchange = Exchange::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if ($exchange->status !== 'draft') {
            abort(422, "Only draft exchanges can be cancelled. Current status: {$exchange->status}.");
        }

        $exchange->status = 'cancelled';
        $exchange->updated_by = (int) $request->user()?->id;
        $exchange->save();

        return new ExchangeResource($exchange->load(['returnItems.product', 'replacementItems.product', 'customer', 'warehouse']));
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var Exchange $exchange */
        $exchange = Exchange::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if (! in_array($exchange->status, ['draft', 'cancelled'], true)) {
            return response()->json([
                'message' => 'Cannot delete an active or approved exchange. Cancel it first.',
            ], 422);
        }

        $exchangeNumber = $exchange->exchange_number;
        $exchange->delete();

        return response()->json([
            'success' => true,
            'message' => "Exchange {$exchangeNumber} deleted successfully.",
        ]);
    }
}
