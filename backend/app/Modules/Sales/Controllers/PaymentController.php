<?php

declare(strict_types=1);

namespace App\Modules\Sales\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Sales\Actions\RecordPaymentAction;
use App\Modules\Sales\Models\Payment;
use App\Modules\Sales\Requests\StorePaymentRequest;
use App\Modules\Sales\Resources\PaymentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PaymentController extends Controller
{
    public function __construct(
        private readonly RecordPaymentAction $recordPayment
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = Payment::with(['party', 'allocations'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('direction')) {
            $query->where('direction', (string) $request->query('direction'));
        }

        if ($request->filled('party_id')) {
            $query->where('party_id', (int) $request->query('party_id'));
        }

        if ($request->filled('method')) {
            $query->where('method', (string) $request->query('method'));
        }

        $payments = $query->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->paginate((int) $request->input('per_page', 25));

        return PaymentResource::collection($payments);
    }

    public function store(StorePaymentRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{direction: string, payment_date: string, method: string, amount: string} $validated */
        $payment = $this->recordPayment->execute([
            ...$validated,
            'tenant_id'   => $tenantId,
            'received_by' => (int) $request->user()?->id,
            'created_by'  => (int) $request->user()?->id,
        ]);

        return (new PaymentResource($payment))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): PaymentResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $payment = Payment::with(['party', 'allocations'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new PaymentResource($payment);
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var Payment $payment */
        $payment = Payment::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $payment->delete();

        return response()->json([
            'success' => true,
            'message' => 'Payment moved to Data Bin.',
        ]);
    }
}
