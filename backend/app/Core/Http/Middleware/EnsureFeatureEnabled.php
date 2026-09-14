<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Models\FeatureFlag;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces feature flag gating on tenant routes.
 * Blocks access with a 403 FEATURE_DISABLED response if a feature flag is explicitly disabled.
 */
final class EnsureFeatureEnabled
{
    public function handle(Request $request, Closure $next, string $featureKey): Response
    {
        if (! TenantContext::isBound()) {
            return $next($request);
        }

        $tenantId = TenantContext::current()->tenantId();

        $isEnabled = Cache::remember("t{$tenantId}:feature:{$featureKey}", 120, static function () use ($tenantId, $featureKey): bool {
            // 1. Tenant-specific override takes precedence
            /** @var FeatureFlag|null $tenantFlag */
            $tenantFlag = FeatureFlag::where('tenant_id', $tenantId)
                ->where('key', $featureKey)
                ->first();

            if ($tenantFlag !== null) {
                return (bool) $tenantFlag->enabled;
            }

            // 2. Fall back to global flag (tenant_id IS NULL)
            /** @var FeatureFlag|null $globalFlag */
            $globalFlag = FeatureFlag::whereNull('tenant_id')
                ->where('key', $featureKey)
                ->first();

            if ($globalFlag !== null) {
                return (bool) $globalFlag->enabled;
            }

            // 3. Permissive default if no flag is configured
            return true;
        });

        if (! $isEnabled) {
            return ErrorResponse::make(
                request: $request,
                code: 'FEATURE_DISABLED',
                message: sprintf("The feature '%s' is not enabled for your organization.", $featureKey),
                httpStatus: 403,
                retryable: false,
                details: [
                    'feature' => $featureKey,
                    'tenant_id' => $tenantId,
                    'upgrade_url' => '/platform/plans',
                ]
            );
        }

        return $next($request);
    }
}
