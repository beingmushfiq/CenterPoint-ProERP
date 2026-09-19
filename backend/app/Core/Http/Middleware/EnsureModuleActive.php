<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Core\Capabilities\TenantCapabilityManifest;
use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Models\TenantModule;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces dynamic tenant module and plan entitlement gating.
 * Verifies that the tenant's active subscription and module settings allow access to the requested subsystem.
 */
final class EnsureModuleActive
{
    public function handle(Request $request, Closure $next, string $moduleKey): Response
    {
        if (! TenantContext::isBound()) {
            return $next($request);
        }

        $tenantId = TenantContext::current()->tenantId();

        $moduleState = Cache::remember("t{$tenantId}:module:{$moduleKey}", 120, static function () use ($tenantId, $moduleKey): array {
            /** @var TenantModule|null $mod */
            $mod = TenantModule::where('tenant_id', $tenantId)
                ->where('module_key', $moduleKey)
                ->first();

            if ($mod !== null) {
                return [
                    'enabled' => (bool) $mod->enabled,
                    'plan_allowed' => (bool) $mod->plan_allowed,
                ];
            }

            // Fallback to default capability definition
            $meta = TenantCapabilityManifest::ALL_MODULE_KEYS[$moduleKey] ?? null;
            return [
                'enabled' => $meta['default'] ?? true,
                'plan_allowed' => true,
            ];
        });

        if (! $moduleState['plan_allowed']) {
            return ErrorResponse::make(
                request: $request,
                code: 'MODULE_NOT_IN_PLAN',
                message: sprintf("The '%s' module is not included in your organization's subscription plan. Please upgrade to access this module.", ucfirst($moduleKey)),
                httpStatus: 403,
                retryable: false,
                details: [
                    'module' => $moduleKey,
                    'upgrade_url' => '/platform/plans',
                ]
            );
        }

        if (! $moduleState['enabled']) {
            return ErrorResponse::make(
                request: $request,
                code: 'MODULE_DISABLED',
                message: sprintf("The '%s' module has been disabled by your administrator.", ucfirst($moduleKey)),
                httpStatus: 403,
                retryable: false,
                details: [
                    'module' => $moduleKey,
                    'settings_url' => '/settings/modules',
                ]
            );
        }

        return $next($request);
    }
}
