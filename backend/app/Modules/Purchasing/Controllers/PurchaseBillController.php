<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Purchasing\Actions\CreatePurchaseBillAction;
use App\Modules\Purchasing\Models\PurchaseBill;
use App\Modules\Purchasing\Requests\StorePurchaseBillRequest;
use App\Modules\Purchasing\Resources\PurchaseBillResource;
use App\Core\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PurchaseBillController extends Controller
{
    public function __construct(
        private readonly CreatePurchaseBillAction $createBill
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

        $bill->update([
            'status' => 'paid',
            'paid_amount' => $bill->total_amount,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Purchase bill payment recorded.',
            'data' => new PurchaseBillResource($bill->fresh()),
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
