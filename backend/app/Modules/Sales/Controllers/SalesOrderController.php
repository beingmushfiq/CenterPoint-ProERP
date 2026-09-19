<?php

declare(strict_types=1);

namespace App\Modules\Sales\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Sales\Actions\ApproveSalesOrderAction;
use App\Modules\Sales\Actions\CancelSalesOrderAction;
use App\Modules\Sales\Actions\CreateSalesOrderAction;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Requests\StoreSalesOrderRequest;
use App\Modules\Sales\Resources\SalesOrderResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class SalesOrderController extends Controller
{
    public function __construct(
        private readonly CreateSalesOrderAction $createOrder,
        private readonly ApproveSalesOrderAction $approveOrder,
        private readonly CancelSalesOrderAction $cancelOrder
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = SalesOrder::with(['customer', 'warehouse', 'items.product', 'items.unit', 'lead'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', (string) $request->query('payment_status'));
        }

        if ($request->filled('channel')) {
            $query->where('channel', (string) $request->query('channel'));
        }

        if ($request->filled('party_id')) {
            $query->where('party_id', (int) $request->query('party_id'));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where('order_number', 'like', "%{$search}%");
        }

        $orders = $query->orderByDesc('order_date')
            ->orderByDesc('id')
            ->paginate((int) $request->query('per_page', 25));

        return SalesOrderResource::collection($orders);
    }

    public function store(StoreSalesOrderRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{order_date: string, items: list<array{product_id: int, quantity: string, unit_id: int, unit_price: string}>} $validated */
        $order = $this->createOrder->execute([
            ...$validated,
            'tenant_id'  => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new SalesOrderResource($order))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): SalesOrderResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $order = SalesOrder::with(['customer', 'warehouse', 'items.product', 'items.unit', 'lead'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new SalesOrderResource($order);
    }

    public function approve(int $id, Request $request): SalesOrderResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $order = SalesOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $approved = $this->approveOrder->execute(
            $order,
            (int) $request->user()?->id
        );

        return new SalesOrderResource($approved->fresh(['customer', 'warehouse', 'items.product', 'items.unit', 'lead']));
    }

    public function updateStatus(int $id, Request $request): SalesOrderResource
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validate([
            'status' => 'required|string|in:draft,pending,confirmed,allocated,picking,packed,dispatched,delivered,cancelled',
            'notes'  => 'nullable|string',
        ]);

        $order = SalesOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if ($validated['status'] === 'cancelled') {
            $cancelled = $this->cancelOrder->execute(
                $order,
                (int) $request->user()?->id,
                $validated['notes'] ?? null
            );

            return new SalesOrderResource($cancelled->fresh(['customer', 'warehouse', 'items.product', 'items.unit', 'lead']));
        }

        $order->status = $validated['status'];
        if ($validated['status'] === 'confirmed' && empty($order->confirmed_at)) {
            $order->confirmed_at = now();
            $order->confirmed_by = (int) $request->user()?->id;
        }
        if (!empty($validated['notes'])) {
            $order->internal_notes = $validated['notes'];
        }
        $order->save();

        // If status moved to confirmed or delivered, ensure linked lead is verified as sold
        if (in_array($validated['status'], ['confirmed', 'delivered'], true) && $order->lead_id) {
            $lead = \App\Modules\Sales\Models\CrmLead::where('tenant_id', $tenantId)->find($order->lead_id);
            if ($lead && (empty($lead->validated_at) || $lead->stage !== 'won')) {
                $lead->is_fake = false;
                $lead->stage = 'won';
                $lead->validated_at = now();
                $lead->validated_by = (int) $request->user()?->id;
                $lead->validation_notes = "Sale verified upon order {$order->order_number} status change to {$validated['status']}.";
                if ($order->party_id) {
                    $lead->converted_party_id = $order->party_id;
                    $lead->converted_at = now();
                }
                $lead->save();
            }
        }

        return new SalesOrderResource($order->fresh(['customer', 'warehouse', 'items.product', 'items.unit', 'lead']));
    }

    public function recordPayment(int $id, Request $request): SalesOrderResource
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validate([
            'payment_status' => 'required|string|in:paid,partially_paid,pending,failed,unpaid',
            'paid_amount'    => 'nullable|numeric',
        ]);

        $order = SalesOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $order->payment_status = $validated['payment_status'];
        if (isset($validated['paid_amount'])) {
            $order->paid_amount = (string) $validated['paid_amount'];
            $order->due_amount = (string) max(0, (float) $order->total_amount - (float) $validated['paid_amount']);
        } elseif ($validated['payment_status'] === 'paid') {
            $order->paid_amount = $order->total_amount;
            $order->due_amount = '0.0000';
        } elseif ($validated['payment_status'] === 'unpaid') {
            $order->paid_amount = '0.0000';
            $order->due_amount = $order->total_amount;
        }
        $order->save();

        return new SalesOrderResource($order->fresh(['customer', 'warehouse', 'items.product', 'items.unit']));
    }

    public function generateInvoice(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $order = SalesOrder::with(['items'])->where('tenant_id', $tenantId)->where('id', $id)->firstOrFail();

        // Check if invoice already exists
        $existing = \App\Modules\Sales\Models\Invoice::where('tenant_id', $tenantId)->where('sales_order_id', $order->id)->first();
        if ($existing) {
            return response()->json([
                'message' => 'Invoice already exists for this order',
                'data'    => new \App\Modules\Sales\Resources\InvoiceResource($existing),
            ]);
        }

        $items = [];
        foreach ($order->items as $item) {
            $items[] = [
                'product_id'          => $item->product_id,
                'sales_order_item_id' => $item->id,
                'quantity'            => (string) $item->quantity,
                'unit_id'             => $item->unit_id,
                'unit_price'          => (string) $item->unit_price,
                'discount_amount'     => (string) ($item->line_discount ?? '0.0000'),
                'tax_amount'          => (string) ($item->tax_amount ?? '0.0000'),
            ];
        }

        $invoice = app(\App\Modules\Sales\Actions\CreateInvoiceAction::class)->execute([
            'tenant_id'      => $tenantId,
            'sales_order_id' => $order->id,
            'company_id'     => $order->company_id,
            'branch_id'      => $order->branch_id,
            'party_id'       => $order->party_id,
            'invoice_date'   => now()->toDateString(),
            'due_date'       => now()->addDays(7)->toDateString(),
            'created_by'     => (int) $request->user()?->id,
            'items'          => $items,
        ]);

        return response()->json([
            'message' => 'Invoice created successfully',
            'data'    => new \App\Modules\Sales\Resources\InvoiceResource($invoice),
        ], 201);
    }

    public function cancel(int $id, Request $request): SalesOrderResource
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validate([
            'reason' => 'nullable|string',
        ]);

        $order = SalesOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $cancelled = $this->cancelOrder->execute(
            $order,
            (int) $request->user()?->id,
            $validated['reason'] ?? null
        );

        return new SalesOrderResource($cancelled->fresh(['customer', 'warehouse', 'items.product', 'items.unit', 'lead']));
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $order = SalesOrder::where('tenant_id', $tenantId)->where('id', $id)->firstOrFail();

        // If order has an active commercial invoice, check status before deleting
        $hasInvoice = \App\Modules\Sales\Models\Invoice::where('tenant_id', $tenantId)
            ->where('sales_order_id', $order->id)
            ->whereNull('deleted_at')
            ->exists();

        if ($hasInvoice && !in_array($order->status, ['cancelled', 'draft'], true)) {
            return response()->json([
                'message' => 'Cannot delete an active order with an associated commercial invoice. Void or cancel the invoice first.',
            ], 422);
        }

        $orderNumber = $order->order_number;
        $order->delete();

        return response()->json([
            'success' => true,
            'message' => "Sales order {$orderNumber} deleted successfully.",
        ]);
    }
}
