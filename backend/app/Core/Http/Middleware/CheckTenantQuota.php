<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces resource quota limits based on the tenant's subscribed plan and custom overrides.
 * Blocks write requests that would exceed allocated resource capacities.
 */
final class CheckTenantQuota
{
    /**
     * Map of resource key to human label and limit config key.
     *
     * @var array<string, string>
     */
    private const RESOURCE_LIMIT_KEYS = [
        'products' => 'max_products',
        'users' => 'max_users',
        'warehouses' => 'max_warehouses',
        'branches' => 'max_branches',
    ];

    public function handle(Request $request, Closure $next, string $resource): Response
    {
        // Only enforce quota barriers on record creation operations
        if (! $request->isMethod('post')) {
            return $next($request);
        }

        if (! TenantContext::isBound()) {
            return $next($request);
        }

        $context = TenantContext::current();
        $tenantId = $context->tenantId();

        /** @var Tenant|null $tenant */
        $tenant = Cache::remember("t{$tenantId}:quota:tenant_plan", 120, static function () use ($tenantId): ?Tenant {
            return Tenant::with('plan')->find($tenantId);
        });

        if (! $tenant) {
            return $next($request);
        }

        $limitKey = self::RESOURCE_LIMIT_KEYS[$resource] ?? null;
        if (! $limitKey) {
            return $next($request);
        }

        // Custom limits take precedence over plan limits
        $settings = $tenant->settings;
        $customLimits = (is_array($settings) && isset($settings['custom_limits']) && is_array($settings['custom_limits']))
            ? $settings['custom_limits']
            : [];

        $plan = $tenant->plan;
        $planLimits = ($plan !== null && is_array($plan->limits))
            ? $plan->limits
            : [];

        $rawLimit = $customLimits[$limitKey] ?? $planLimits[$limitKey] ?? null;

        if ($rawLimit === null || ! is_numeric($rawLimit)) {
            return $next($request);
        }

        $limit = (int) $rawLimit;

        // If limit is set to -1, resource allocation is unlimited
        if ($limit === -1) {
            return $next($request);
        }

        $currentCount = $this->getCurrentResourceCount($resource, $tenant->id);

        if ($currentCount >= $limit) {
            return ErrorResponse::make(
                request: $request,
                code: 'BUSINESS_RULE_VIOLATED',
                message: sprintf(
                    'Plan quota limit reached: maximum %d %s allowed (current: %d). Please upgrade your subscription to add more.',
                    $limit,
                    $resource,
                    $currentCount
                ),
                httpStatus: 422,
                retryable: false,
                details: [
                    'quota' => [
                        'resource' => $resource,
                        'limit' => $limit,
                        'current' => $currentCount,
                        'upgrade_url' => '/platform/plans',
                    ],
                ]
            );
        }

        $response = $next($request);

        // If creation was successful, immediately invalidate resource count cache
        if ($response->isSuccessful()) {
            Cache::forget("t{$tenantId}:quota:{$resource}");
        }

        return $response;
    }

    /**
     * Count active records belonging to this tenant for the quota resource.
     */
    private function getCurrentResourceCount(string $resource, int $tenantId): int
    {
        return Cache::remember("t{$tenantId}:quota:{$resource}", 60, static function () use ($resource, $tenantId): int {
            return match ($resource) {
                'products' => Product::where('tenant_id', $tenantId)->count(),
                'users' => User::where('tenant_id', $tenantId)->where('is_platform_user', false)->count(),
                'warehouses' => Warehouse::where('tenant_id', $tenantId)->count(),
                'branches' => \App\Models\Branch::where('tenant_id', $tenantId)->count(),
                default => 0,
            };
        });
    }
}
