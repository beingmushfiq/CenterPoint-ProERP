<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Core\Tenancy\TenantResolver;
use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveStorefrontTenant
{
    /**
     * Handle an incoming request and bind tenant context for public storefront.
     * Uses hardened TenantResolver with master domain guard and DNS label validation.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $storefront = TenantResolver::resolveStorefrontFromRequest($request);

        if (! $storefront) {
            return ErrorResponse::make(
                request: $request,
                code: 'STOREFRONT_NOT_FOUND',
                message: 'The requested storefront does not exist or has been disabled.',
                httpStatus: 404,
                retryable: false,
            );
        }

        // Verify associated tenant exists and is not suspended
        $tenant = Tenant::find($storefront->tenant_id);
        if (! $tenant || $tenant->status === 'suspended') {
            return ErrorResponse::make(
                request: $request,
                code: 'TENANT_SUSPENDED',
                message: 'This storefront is currently unavailable.',
                httpStatus: 403,
                retryable: false,
            );
        }

        // Bind tenant context
        TenantContext::bind($tenant->toArray());
        $request->attributes->set('storefront', $storefront);
        $request->attributes->set('tenant_id', $storefront->tenant_id);

        return $next($request);
    }
}
