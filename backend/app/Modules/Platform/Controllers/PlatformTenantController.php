<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\TenantSubscription;
use App\Models\TenantUsageCounter;
use App\Models\User;
use App\Modules\Platform\Actions\ManageSubscriptionAction;
use App\Modules\Platform\Actions\RegisterTenantAction;
use App\Modules\Platform\Actions\UpdateTenantStatusAction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Controller for Master SaaS Admin Tenant Lifecycle & Management.
 */
class PlatformTenantController extends Controller
{
    /**
     * List all tenants with filtering, search, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Tenant::with([
            'plan',
            'users' => fn ($q) => $q->where('is_platform_user', false),
        ]);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('plan_id')) {
            $query->where('plan_id', (int) $request->input('plan_id'));
        }

        if ($request->filled('q') || $request->filled('search')) {
            $search = (string) ($request->input('q') ?? $request->input('search'));
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('slug', 'like', "%{$search}%"));
        }

        $sort = (string) $request->input('sort', '-created_at');
        $desc = str_starts_with($sort, '-');
        $field = $desc ? substr($sort, 1) : $sort;
        if (in_array($field, ['id', 'name', 'slug', 'status', 'created_at'], true)) {
            $query->orderBy($field, $desc ? 'desc' : 'asc');
        } else {
            $query->latest('id');
        }

        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $paginator = $query->paginate($perPage);

        $data = $paginator->getCollection()->map(function (Tenant $tenant) {
            $sub = TenantSubscription::where('tenant_id', $tenant->id)->latest('id')->first();

            return [
                'id' => $tenant->id,
                'uuid' => $tenant->uuid,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'status' => $tenant->status,
                'plan_id' => $tenant->plan_id,
                'plan' => $tenant->plan !== null ? [
                    'id' => $tenant->plan->id,
                    'uuid' => $tenant->plan->uuid,
                    'name' => $tenant->plan->name,
                    'code' => $tenant->plan->code,
                    'price' => (float) $tenant->plan->price,
                    'billing_period' => $tenant->plan->billing_period,
                ] : null,
                'currency_code' => $tenant->currency_code,
                'timezone' => $tenant->timezone,
                'users_count' => $tenant->users->count(),
                'trial_ends_at' => $tenant->trial_ends_at?->toIso8601String(),
                'activated_at' => $tenant->activated_at?->toIso8601String(),
                'suspended_at' => $tenant->suspended_at?->toIso8601String(),
                'created_at' => $tenant->created_at?->toIso8601String(),
                'subscription' => $sub !== null ? [
                    'status' => $sub->status,
                    'amount' => (float) $sub->amount,
                    'starts_at' => $sub->starts_at?->toIso8601String(),
                    'ends_at' => $sub->ends_at?->toIso8601String(),
                ] : null,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'pagination' => [
                    'total' => $paginator->total(),
                    'page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total_pages' => $paginator->lastPage(),
                ],
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Provision a new tenant.
     */
    public function store(Request $request, RegisterTenantAction $action): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191',
            'slug' => 'required|string|max:64',
            'plan_id' => 'required|integer|exists:plans,id',
            'owner_name' => 'required|string|max:191',
            'owner_email' => 'required|email|max:191',
            'password' => 'required|string|min:8',
            'currency_code' => 'nullable|string|size:3',
            'timezone' => 'nullable|string|max:64',
            'locale' => 'nullable|string|max:10',
            'is_trial' => 'nullable|boolean',
            'trial_days' => 'nullable|integer|min:1|max:90',
            'settings' => 'nullable|array',
            'branding' => 'nullable|array',
        ]);

        try {
            $result = $action->execute($validated);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Tenant provisioning failed: ' . $e->getMessage(), [
                'exception' => $e,
                'input' => array_diff_key($validated, ['password' => '']),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Tenant provisioning failed: ' . $e->getMessage(),
                'error' => [
                    'message' => $e->getMessage(),
                    'code' => 'TENANT_PROVISIONING_FAILED',
                ],
                'meta' => [
                    'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                    'timestamp' => Carbon::now()->toIso8601String(),
                ],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'data' => $result,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * Show full tenant profile and subscription history.
     */
    public function show(int $id, Request $request): JsonResponse
    {
        $tenant = Tenant::with([
            'plan',
            'modules',
            'users' => fn ($q) => $q->where('is_platform_user', false),
        ])->findOrFail($id);

        $subscriptions = TenantSubscription::where('tenant_id', $tenant->id)
            ->with(['plan:id,name,code', 'renewedBy:id,name,email'])
            ->latest('id')
            ->get();
        $usageCounters = TenantUsageCounter::where('tenant_id', $tenant->id)->get();
        $recentAudit = AuditLog::withoutTenantScope()
            ->with('user:id,name,email')
            ->where('tenant_id', $tenant->id)
            ->latest('id')
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'tenant' => $this->formatTenantProfile($tenant, $subscriptions->first()),
                'users' => $this->formatTenantUsers($tenant->users),
                'subscriptions' => $this->formatTenantSubscriptions($subscriptions),
                'usage_counters' => $this->formatTenantUsageCounters($usageCounters),
                'recent_audit' => $this->formatTenantAuditLogs($recentAudit),
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Update tenant metadata, settings, or branding.
     */
    public function update(int $id, Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        $validated = $request->validate([
            'name' => 'nullable|string|max:191',
            'timezone' => 'nullable|string|max:64',
            'locale' => 'nullable|string|max:10',
            'currency_code' => 'nullable|string|size:3',
            'settings' => 'nullable|array',
            'branding' => 'nullable|array',
        ]);

        $tenant->update(array_filter($validated, fn ($val) => $val !== null));

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $tenant->id,
                'uuid' => $tenant->uuid,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'status' => $tenant->status,
                'timezone' => $tenant->timezone,
                'currency_code' => $tenant->currency_code,
                'settings' => $tenant->settings,
                'branding' => $tenant->branding,
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Update tenant status (active, suspended, past_due, etc.).
     */
    public function updateStatus(int $id, Request $request, UpdateTenantStatusAction $action): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|string|in:active,trial,past_due,suspended,cancelled',
            'reason' => 'nullable|string|max:500',
        ]);

        $result = $action->execute([
            'tenant_id' => $id,
            'status' => $validated['status'],
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'data' => $result,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Extend subscription validity or switch plan.
     */
    public function manageSubscription(int $id, Request $request, ManageSubscriptionAction $action): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|string|in:extend,change_plan,renew,set_expiry,set_grace_period',
            'days' => 'nullable|integer|min:1|max:3650',
            'plan_id' => 'nullable|integer|exists:plans,id',
            'ends_at' => 'nullable|date',
            'grace_period_days' => 'nullable|integer|min:0|max:180',
            'notes' => 'nullable|string|max:1000',
            'billing_cycle' => 'nullable|string|in:monthly,yearly',
            'amount' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|string|in:none,percentage,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'currency_code' => 'nullable|string|max:10',
        ]);

        $result = $action->execute(array_merge($validated, ['tenant_id' => $id]));

        return response()->json([
            'success' => true,
            'data' => $result,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Master Authority Override: Force-enable/disable modules and feature flags for a tenant.
     */
    public function overrideCapabilities(int $id, Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        $validated = $request->validate([
            'modules' => 'nullable|array',
            'feature_flags' => 'nullable|array',
        ]);

        if (isset($validated['modules'])) {
            foreach ($validated['modules'] as $moduleKey => $cfg) {
                TenantModule::updateOrCreate(
                    ['tenant_id' => $tenant->id, 'module_key' => $moduleKey],
                    [
                        'enabled' => (bool) ($cfg['enabled'] ?? true),
                        'plan_allowed' => (bool) ($cfg['plan_allowed'] ?? true),
                        'config' => $cfg['config'] ?? null,
                    ]
                );
            }
        }

        if (isset($validated['feature_flags'])) {
            $settings = $tenant->settings ?? [];
            $settings['feature_flags'] = array_merge($settings['feature_flags'] ?? [], $validated['feature_flags']);
            $tenant->settings = $settings;
            $tenant->save();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'tenant_id' => $tenant->id,
                'modules' => TenantModule::where('tenant_id', $tenant->id)->get(),
                'feature_flags' => $tenant->settings['feature_flags'] ?? [],
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Master Authority Override: Set custom quota and resource limits for a tenant.
     */
    public function overrideQuotas(int $id, Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        $validated = $request->validate([
            'custom_limits' => 'required|array',
        ]);

        $settings = $tenant->settings ?? [];
        $settings['custom_limits'] = $validated['custom_limits'];
        $tenant->settings = $settings;
        $tenant->save();

        return response()->json([
            'success' => true,
            'data' => [
                'tenant_id' => $tenant->id,
                'custom_limits' => $tenant->settings['custom_limits'],
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Master Authority Override: Reset the password of a tenant's owner account.
     */
    public function resetOwnerPassword(int $id, Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        $validated = $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $owner = User::where('tenant_id', $tenant->id)
            ->where('is_platform_user', false)
            ->orderBy('id', 'asc')
            ->firstOrFail();

        $owner->password = Hash::make($validated['password']);
        $owner->token_version = ($owner->token_version ?? 0) + 1;
        $owner->save();

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $owner->id,
                'email' => $owner->email,
                'message' => "Password successfully reset for owner {$owner->name} ({$owner->email}).",
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Soft delete a tenant from platform control plane.
     */
    public function destroy(int $id, Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);
        $name = $tenant->name;
        $slug = $tenant->slug;

        // Soft delete tenant
        $tenant->status = 'cancelled';
        $tenant->save();
        $tenant->delete();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $id,
                'name' => $name,
                'slug' => $slug,
                'deleted' => true,
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Format tenant details for profile response.
     *
     * @return array<string, mixed>
     */
    private function formatTenantProfile(Tenant $tenant, ?TenantSubscription $activeSub = null): array
    {
        $now = Carbon::now();
        $endsAt = $activeSub?->ends_at;
        $graceEndsAt = $activeSub?->grace_period_ends_at;

        $daysRemaining = null;
        $daysOverdue = null;
        $isInGracePeriod = false;

        if ($endsAt !== null) {
            if ($endsAt->isFuture()) {
                $daysRemaining = (int) $now->diffInDays($endsAt, false);
            } else {
                $daysRemaining = 0;
                $daysOverdue = (int) $now->diffInDays($endsAt, true);

                if ($graceEndsAt !== null && $graceEndsAt->isFuture()) {
                    $isInGracePeriod = true;
                }
            }
        }

        // Compute effective status
        $effectiveStatus = $tenant->status;
        if ($tenant->status === 'active' || $tenant->status === 'trial') {
            if ($isInGracePeriod) {
                $effectiveStatus = 'grace_period';
            } elseif ($daysRemaining !== null && $daysRemaining === 0 && $endsAt !== null && $endsAt->isPast()) {
                $effectiveStatus = 'expired';
            } elseif ($daysRemaining !== null && $daysRemaining <= 7) {
                $effectiveStatus = 'expiring_soon';
            }
        }

        return [
            'id' => $tenant->id,
            'uuid' => $tenant->uuid,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
            'status' => $tenant->status,
            'effective_status' => $effectiveStatus,
            'days_remaining' => $daysRemaining,
            'days_overdue' => $daysOverdue,
            'is_in_grace_period' => $isInGracePeriod,
            'plan_id' => $tenant->plan_id,
            'plan' => $tenant->plan !== null ? [
                'id' => $tenant->plan->id,
                'uuid' => $tenant->plan->uuid,
                'name' => $tenant->plan->name,
                'code' => $tenant->plan->code,
                'price' => (float) $tenant->plan->price,
                'billing_period' => $tenant->plan->billing_period,
                'limits' => $tenant->plan->limits,
                'features' => $tenant->plan->features,
            ] : null,
            'currency_code' => $tenant->currency_code,
            'timezone' => $tenant->timezone,
            'locale' => $tenant->locale,
            'settings' => $tenant->settings,
            'custom_limits' => $tenant->settings['custom_limits'] ?? null,
            'branding' => $tenant->branding,
            'trial_ends_at' => $tenant->trial_ends_at?->toIso8601String(),
            'subscription_ends_at' => $endsAt?->toIso8601String(),
            'grace_period_ends_at' => $graceEndsAt?->toIso8601String(),
            'grace_period_days' => $activeSub?->grace_period_days ?? 7,
            'activated_at' => $tenant->activated_at?->toIso8601String(),
            'suspended_at' => $tenant->suspended_at?->toIso8601String(),
            'archived_at' => $tenant->archived_at?->toIso8601String(),
            'created_at' => $tenant->created_at?->toIso8601String(),
            'modules' => $tenant->modules->map(fn (TenantModule $m): array => [
                'id' => $m->id,
                'module_key' => $m->module_key,
                'enabled' => (bool) $m->enabled,
                'plan_allowed' => (bool) $m->plan_allowed,
                'config' => $m->config,
            ]),
        ];
    }

    /**
     * @param  \Illuminate\Support\Collection<int, User>  $users
     * @return array<int, array<string, mixed>>
     */
    private function formatTenantUsers($users): array
    {
        return $users->map(fn (User $u): array => [
            'id' => $u->id,
            'uuid' => $u->uuid,
            'name' => $u->name,
            'email' => $u->email,
            'status' => $u->status,
            'last_login_at' => $u->last_login_at?->toIso8601String(),
        ])->all();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, TenantSubscription>  $subscriptions
     * @return array<int, array<string, mixed>>
     */
    private function formatTenantSubscriptions($subscriptions): array
    {
        return $subscriptions->map(fn (TenantSubscription $s): array => [
            'id' => $s->id,
            'uuid' => $s->uuid,
            'plan_id' => $s->plan_id,
            'plan_name' => $s->plan?->name,
            'plan_code' => $s->plan?->code,
            'status' => $s->status,
            'amount' => (float) $s->amount,
            'currency_code' => $s->currency_code ?? 'BDT',
            'billing_cycle' => $s->billing_cycle ?? 'monthly',
            'grace_period_days' => $s->grace_period_days ?? 7,
            'grace_period_ends_at' => $s->grace_period_ends_at?->toIso8601String(),
            'auto_renew' => (bool) $s->auto_renew,
            'discount_type' => $s->discount_type ?? 'none',
            'discount_value' => (float) ($s->discount_value ?? 0),
            'notes' => $s->notes,
            'renewed_by_name' => $s->renewedBy?->name,
            'starts_at' => $s->starts_at?->toIso8601String(),
            'ends_at' => $s->ends_at?->toIso8601String(),
        ])->all();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, TenantUsageCounter>  $usageCounters
     * @return array<int, array<string, mixed>>
     */
    private function formatTenantUsageCounters($usageCounters): array
    {
        return $usageCounters->map(fn (TenantUsageCounter $u): array => [
            'metric' => $u->metric,
            'period' => $u->period,
            'value' => $u->value,
        ])->all();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, AuditLog>  $recentAudit
     * @return array<int, array<string, mixed>>
     */
    private function formatTenantAuditLogs($recentAudit): array
    {
        return $recentAudit->map(fn (AuditLog $a): array => [
            'id' => $a->id,
            'action' => $a->action instanceof \BackedEnum ? $a->action->value : (string) $a->action,
            'actor_name' => $a->user?->name ?? 'System',
            'actor_email' => $a->user?->email,
            'created_at' => $a->created_at?->toIso8601String(),
            'details' => $a->after,
        ])->all();
    }
}
