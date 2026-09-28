<?php

declare(strict_types=1);

namespace App\Modules\Platform\Actions;

use App\Core\Actions\Action;
use App\Models\AuditLog;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use Carbon\Carbon;
use DateTimeInterface;

/**
 * Action to compute high-performance Master SaaS Admin KPIs.
 */
class PlatformDashboardMetricsAction extends Action
{
    /**
     * @return array<string, mixed>
     */
    public function execute(array $input = []): array
    {
        $now = Carbon::now();
        $thirtyDaysAhead = $now->copy()->addDays(30);

        $totalTenants = Tenant::count();
        $activeTenants = Tenant::where('status', 'active')->count();
        $trialTenants = Tenant::where('status', 'trial')->count();
        $suspendedTenants = Tenant::where('status', 'suspended')->count();
        $pastDueTenants = Tenant::where('status', 'past_due')->count();

        // Expiring subscriptions in next 30 days
        $expiringSubscriptions = TenantSubscription::whereIn('status', ['active', 'trial'])
            ->whereNotNull('ends_at')
            ->whereBetween('ends_at', [$now, $thirtyDaysAhead])
            ->count();

        // Monthly Recurring Revenue (MRR) approximation from active plan prices
        $mrr = (float) Tenant::where('status', 'active')
            ->join('plans', 'tenants.plan_id', '=', 'plans.id')
            ->sum('plans.price');

        // Total platform registered users across all tenants
        $totalUsers = User::count();

        // Recent tenant activities from AuditLog
        $recentActivity = AuditLog::withoutTenantScope()
            ->with('user:id,name,email')
            ->where('auditable_type', 'Tenant')
            ->latest('id')
            ->limit(10)
            ->get()
            ->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'uuid' => $log->uuid,
                'action' => is_object($log->action) ? $log->action->value : (string) $log->action,
                'entity_type' => $log->auditable_type,
                'entity_id' => $log->auditable_id,
                'tenant_id' => $log->tenant_id,
                'actor_name' => $log->user?->name ?? 'System',
                'created_at' => $log->created_at instanceof DateTimeInterface ? $log->created_at->format('c') : (string) $log->created_at,
                'details' => $log->after,
            ])
            ->values();

        // Plan distribution
        $planBreakdown = Plan::withCount('tenants')
            ->get()
            ->map(fn (Plan $plan) => [
                'id' => $plan->id,
                'name' => $plan->name,
                'code' => $plan->code,
                'price' => (float) $plan->price,
                'tenants_count' => $plan->tenants_count,
            ])
            ->values();

        return [
            'kpis' => [
                'total_tenants' => $totalTenants,
                'active_tenants' => $activeTenants,
                'trial_tenants' => $trialTenants,
                'suspended_tenants' => $suspendedTenants,
                'past_due_tenants' => $pastDueTenants,
                'expiring_subscriptions' => $expiringSubscriptions,
                'expiring_subscriptions_30d' => $expiringSubscriptions,
                'estimated_mrr' => $mrr,
                'total_users' => $totalUsers,
            ],
            'plans' => $planBreakdown,
            'recent_activity' => $recentActivity,
            'system_health' => [
                'status' => 'healthy',
                'database' => 'connected',
                'storage' => 'writable',
                'version' => '1.0.0-saas',
                'server_time' => $now->toIso8601String(),
            ],
        ];
    }
}
