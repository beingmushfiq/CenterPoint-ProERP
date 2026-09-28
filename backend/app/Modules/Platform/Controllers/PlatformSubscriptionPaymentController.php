<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PlatformSubscriptionPayment;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Modules\Platform\Traits\ResolvesPlatformTenant;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlatformSubscriptionPaymentController extends Controller
{
    use ResolvesPlatformTenant;

    /**
     * List all platform subscription payments cross-tenant with search and filters.
     */
    public function all(Request $request): JsonResponse
    {
        $query = PlatformSubscriptionPayment::with(['tenant:id,name,slug', 'creator:id,name,email']);

        if ($request->filled('tenant_id')) {
            $query->where('tenant_id', (int) $request->input('tenant_id'));
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('payment_method') && $request->input('payment_method') !== 'all') {
            $query->where('payment_method', (string) $request->input('payment_method'));
        }

        if ($request->filled('search')) {
            $search = '%'.trim((string) $request->input('search')).'%';
            $query->where(function ($q) use ($search): void {
                $q->where('invoice_reference', 'like', $search)
                    ->orWhere('transaction_reference', 'like', $search)
                    ->orWhereHas('tenant', function ($tq) use ($search): void {
                        $tq->where('name', 'like', $search)
                            ->orWhere('slug', 'like', $search);
                    });
            });
        }

        if ($request->filled('from_date')) {
            $query->whereDate('payment_date', '>=', (string) $request->input('from_date'));
        }

        if ($request->filled('to_date')) {
            $query->whereDate('payment_date', '<=', (string) $request->input('to_date'));
        }

        $perPage = min(max((int) $request->input('per_page', 25), 1), 100);
        $paginator = $query->latest('payment_date')->latest('id')->paginate($perPage);

        $totalRevenue = (float) PlatformSubscriptionPayment::where('status', 'paid')->sum('amount');

        return response()->json([
            'success' => true,
            'data' => $paginator->items(),
            'meta' => [
                'pagination' => [
                    'total' => $paginator->total(),
                    'page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total_pages' => $paginator->lastPage(),
                ],
                'summary' => [
                    'total_paid_revenue' => $totalRevenue,
                ],
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * List subscription payments for a specific tenant.
     */
    public function index(Request $request, int|string $tenantId): JsonResponse
    {
        $tenant = $this->resolvePlatformTenant($tenantId);

        $payments = PlatformSubscriptionPayment::where('tenant_id', $tenant->id)
            ->with(['subscription.plan:id,name,code', 'creator:id,name,email'])
            ->latest('payment_date')
            ->latest('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $payments,
            'meta' => [
                'tenant' => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                ],
                'total_paid' => (float) $payments->where('status', 'paid')->sum('amount'),
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Record a new manual or automated subscription payment.
     */
    public function store(Request $request, int|string $tenantId): JsonResponse
    {
        $tenant = $this->resolvePlatformTenant($tenantId);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'currency_code' => 'nullable|string|size:3',
            'payment_date' => 'required|date',
            'payment_method' => 'required|string|max:64',
            'transaction_reference' => 'nullable|string|max:191',
            'invoice_reference' => 'nullable|string|max:64|unique:platform_subscription_payments,invoice_reference',
            'subscription_id' => 'nullable|integer|exists:tenant_subscriptions,id',
            'billing_period_start' => 'nullable|date',
            'billing_period_end' => 'nullable|date',
            'status' => 'nullable|string|in:paid,pending,failed,refunded',
            'notes' => 'nullable|string',
        ]);

        $invoiceRef = $validated['invoice_reference'] ?? ('INV-'.Carbon::now()->format('Ym').'-'.strtoupper(Str::random(6)));

        // Resolve subscription
        $subscriptionId = $validated['subscription_id'] ?? null;
        if (! $subscriptionId) {
            $activeSub = TenantSubscription::where('tenant_id', $tenant->id)->latest('id')->first();
            $subscriptionId = $activeSub?->id;
        }

        $payment = PlatformSubscriptionPayment::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'subscription_id' => $subscriptionId,
            'invoice_reference' => $invoiceRef,
            'amount' => $validated['amount'],
            'currency_code' => strtoupper($validated['currency_code'] ?? 'BDT'),
            'payment_method' => $validated['payment_method'],
            'transaction_reference' => $validated['transaction_reference'] ?? null,
            'payment_date' => Carbon::parse($validated['payment_date'])->toDateString(),
            'billing_period_start' => isset($validated['billing_period_start']) ? Carbon::parse($validated['billing_period_start'])->toDateString() : null,
            'billing_period_end' => isset($validated['billing_period_end']) ? Carbon::parse($validated['billing_period_end'])->toDateString() : null,
            'status' => $validated['status'] ?? 'paid',
            'notes' => $validated['notes'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        // Audit log
        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Created,
            'auditable_type' => 'PlatformSubscriptionPayment',
            'auditable_id' => $payment->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => [
                'tenant_id' => $tenant->id,
                'invoice_reference' => $payment->invoice_reference,
                'amount' => (float) $payment->amount,
                'status' => $payment->status,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Payment {$payment->invoice_reference} recorded successfully.",
            'data' => $payment->load(['tenant:id,name,slug', 'creator:id,name,email']),
        ], 201);
    }

    /**
     * Show details of a specific payment.
     */
    public function show(int $id): JsonResponse
    {
        $payment = PlatformSubscriptionPayment::with([
            'tenant:id,name,slug',
            'subscription.plan:id,name,code',
            'creator:id,name,email',
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $payment,
        ]);
    }

    /**
     * Update an existing payment status or reference.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $payment = PlatformSubscriptionPayment::findOrFail($id);

        $validated = $request->validate([
            'status' => 'nullable|string|in:paid,pending,failed,refunded',
            'transaction_reference' => 'nullable|string|max:191',
            'notes' => 'nullable|string',
        ]);

        $oldStatus = $payment->status;
        $payment->update(array_filter($validated, fn ($v) => $v !== null));

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Updated,
            'auditable_type' => 'PlatformSubscriptionPayment',
            'auditable_id' => $payment->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'before' => ['status' => $oldStatus],
            'after' => ['status' => $payment->status, 'notes' => $payment->notes],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Payment record updated.',
            'data' => $payment->fresh(),
        ]);
    }
}
