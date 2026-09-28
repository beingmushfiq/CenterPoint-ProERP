<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Purchasing\Actions\CreatePurchaseBillAction;
use App\Modules\Purchasing\Models\PurchaseBill;
use App\Modules\Purchasing\Requests\StorePurchaseBillRequest;
use App\Modules\Purchasing\Resources\PurchaseBillResource;
use App\Modules\Sales\Actions\RecordPaymentAction;
use App\Core\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PurchaseBillController extends Controller
{
    public function __construct(
        private readonly CreatePurchaseBillAction $createBill,
        private readonly RecordPaymentAction $recordPayment,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = PurchaseBill::with(['supplier', 'purchaseOrder', 'goodsReceipt', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('party_id')) {
            $query->where('party_id', (int) $request->query('party_id'));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where(function ($q) use ($search): void {
                $q->where('bill_number', 'like', "%{$search}%")
                    ->orWhere('supplier_bill_number', 'like', "%{$search}%");
            });
        }

        $perPage = $request->integer('per_page', 25);
        $bills = $query->orderByDesc('bill_date')
            ->orderByDesc('id')
            ->paginate($perPage);

        return PurchaseBillResource::collection($bills);
    }

    public function store(StorePurchaseBillRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{party_id: int, bill_date: string, due_date?: string|null, supplier_bill_number?: string|null, currency_code?: string|null, notes?: string|null, goods_receipt_id?: int|null, purchase_order_id?: int|null, discount_amount?: string|null, tax_amount?: string|null, shipping_amount?: string|null, items: list<array{product_id: int, quantity: string, unit_price: string, unit_id: int, discount_amount?: string|null, tax_amount?: string|null, description?: string|null, variant_id?: int|null, purchase_order_item_id?: int|null, goods_receipt_item_id?: int|null}>} $validated */
        $bill = $this->createBill->execute([
            ...$validated,
            'tenant_id' => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new PurchaseBillResource($bill))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): PurchaseBillResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $bill = PurchaseBill::with(['supplier', 'items.product', 'items.unit'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new PurchaseBillResource($bill);
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseBill $bill */
        $bill = PurchaseBill::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if (in_array($bill->status, ['paid', 'approved'], true)) {
            return response()->json([
                'message' => 'Cannot update an approved or paid bill.',
            ], 422);
        }

        $validated = $request->validate([
            'due_date' => 'nullable|date',
            'supplier_invoice_number' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $bill->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Purchase bill updated.',
            'data' => new PurchaseBillResource($bill->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function approve(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseBill $bill */
        $bill = PurchaseBill::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $bill->update([
            'status' => 'approved',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Purchase bill approved.',
            'data' => new PurchaseBillResource($bill->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function pay(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseBill $bill */
        $bill = PurchaseBill::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'method' => ['required', 'string', 'in:cash,bank_transfer,mobile_banking,cheque,card,split'],
            'payment_date' => ['nullable', 'date'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'splits' => ['nullable', 'array', 'min:1'],
            'splits.*.method' => ['required_with:splits', 'string', 'in:cash,bank_transfer,mobile_banking,cheque,card'],
            'splits.*.amount' => ['required_with:splits', 'numeric', 'min:0.01'],
            'splits.*.bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'splits.*.mobile_provider' => ['nullable', 'string', 'max:50'],
            'splits.*.mobile_number' => ['nullable', 'string', 'max:30'],
            'splits.*.transaction_ref' => ['nullable', 'string', 'max:100'],
            'splits.*.cheque_number' => ['nullable', 'string', 'max:100'],
            'splits.*.cheque_date' => ['nullable', 'date'],
            'splits.*.card_last4' => ['nullable', 'string', 'max:4'],
            'splits.*.notes' => ['nullable', 'string', 'max:255'],
        ]);

        /** @var numeric-string $paymentAmount */
        $paymentAmount = (string) $validated['amount'];
        $currentPaid = (string) ($bill->paid_amount ?? '0');
        /** @var numeric-string $newPaid */
        $newPaid = bcadd($currentPaid, $paymentAmount, 4);
        /** @var numeric-string $totalAmount */
        $totalAmount = (string) $bill->total_amount;

        $newStatus = bccomp($newPaid, $totalAmount, 4) >= 0 ? 'paid' : 'partial';

        $payment = $this->recordPayment->execute([
            'tenant_id' => $tenantId,
            'direction' => 'out',
            'party_id' => $bill->party_id,
            'payment_date' => $validated['payment_date'] ?? date('Y-m-d'),
            'method' => $validated['method'],
            'bank_account_id' => isset($validated['bank_account_id']) ? (int) $validated['bank_account_id'] : null,
            'reference_number' => $validated['reference_number'] ?? null,
            'amount' => $paymentAmount,
            'currency_code' => $bill->currency_code ?? 'BDT',
            'notes' => $validated['notes'] ?? ("Payment for bill " . $bill->bill_number),
            'created_by' => (int) $request->user()?->id,
            'allocations' => [
                [
                    'allocatable_type' => 'purchase_bill',
                    'allocatable_id' => $bill->id,
                    'amount' => $paymentAmount,
                ]
            ],
            'splits' => $validated['splits'] ?? null,
        ]);

        $bill->update([
            'status' => $newStatus,
            'paid_amount' => $newPaid,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Purchase bill payment recorded.',
            'data' => new PurchaseBillResource($bill->fresh(['supplier', 'items.product'])),
            'payment' => $payment,
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var PurchaseBill $bill */
        $bill = PurchaseBill::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if (in_array($bill->status, ['paid', 'approved'], true)) {
            return response()->json([
                'message' => 'Cannot delete an approved or paid bill.',
            ], 422);
        }

        $bill->delete();

        return response()->json([
            'success' => true,
            'message' => 'Purchase bill deleted.',
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }
}
