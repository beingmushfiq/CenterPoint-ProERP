<?php

declare(strict_types=1);

namespace App\Core\Tenancy;

use App\Models\Storefront;
use App\Models\Tenant;
use App\Models\TenantDomain;
use Illuminate\Http\Request;

final class TenantResolver
{
    /**
     * Regex matching valid RFC-1123 DNS subdomains.
     */
    private const SUBDOMAIN_REGEX = '/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/';

    /**
     * Resolve the tenant from the incoming HTTP request safely.
     * Master domain is strictly protected.
     * Headers are only accepted in local/testing environments.
     */
    public static function resolveFromRequest(Request $request): ?Tenant
    {
        $host = self::extractHost($request);
        $masterDomain = strtolower((string) config('platform.master_domain', 'proerp.devcenterpoint.com'));

        // Master domain guard: Control plane / Super Admin host is NEVER a tenant
        if ($host === $masterDomain) {
            return null;
        }

        // In local and testing environments, allow override headers or query params
        if (app()->environment('local', 'testing')) {
            $override = $request->header('X-Tenant-Subdomain')
                ?: $request->header('X-Storefront-Subdomain')
                ?: $request->query('subdomain');

            if ($override && self::isValidSubdomain((string) $override)) {
                return Tenant::where('slug', strtolower((string) $override))
                    ->where('status', '!=', 'suspended')
                    ->first();
            }
        }

        $baseDomain = strtolower((string) config('platform.tenant_base_domain', 'devcenterpoint.com'));

        // Check if request is on a subdomain of tenant base domain
        if (str_ends_with($host, '.' . $baseDomain)) {
            $subdomain = substr($host, 0, -(strlen($baseDomain) + 1));

            if (! self::isValidSubdomain($subdomain) || self::isReservedSubdomain($subdomain)) {
                return null;
            }

            return Tenant::where('slug', $subdomain)
                ->where('status', '!=', 'suspended')
                ->first();
        }

        // Check verified custom domain
        $tenantDomain = TenantDomain::withoutTenantScope()
            ->where('domain', $host)
            ->where('verification_status', 'verified')
            ->first();

        if ($tenantDomain) {
            return Tenant::where('id', $tenantDomain->tenant_id)
                ->where('status', '!=', 'suspended')
                ->first();
        }

        return null;
    }

    /**
     * Resolve the active Storefront entity for the request.
     */
    public static function resolveStorefrontFromRequest(Request $request): ?Storefront
    {
        // 1. Explicit Storefront Subdomain header
        $subHeader = $request->header('X-Storefront-Subdomain');
        if ($subHeader && self::isValidSubdomain((string) $subHeader) && ! self::isReservedSubdomain((string) $subHeader)) {
            $normalizedSub = strtolower((string) $subHeader);
            $storefront = Storefront::withoutTenantScope()
                ->where('subdomain', $normalizedSub)
                ->where('status', '!=', 'suspended')
                ->first();

            if ($storefront) {
                return $storefront;
            }

            $tenant = Tenant::where('slug', $normalizedSub)
                ->where('status', '!=', 'suspended')
                ->first();

            if ($tenant) {
                return Storefront::withoutTenantScope()
                    ->where('tenant_id', $tenant->id)
                    ->where('status', '!=', 'suspended')
                    ->first();
            }
        }

        // 2. Explicit Storefront Domain header
        $domainHeader = $request->header('X-Storefront-Domain');
        if ($domainHeader) {
            $storefront = Storefront::withoutTenantScope()
                ->where('domain', strtolower((string) $domainHeader))
                ->where('status', '!=', 'suspended')
                ->first();

            if ($storefront) {
                return $storefront;
            }

            $tenantDomain = TenantDomain::withoutTenantScope()
                ->where('domain', strtolower((string) $domainHeader))
                ->where('verification_status', 'verified')
                ->first();

            if ($tenantDomain) {
                return Storefront::withoutTenantScope()
                    ->where('tenant_id', $tenantDomain->tenant_id)
                    ->where('status', '!=', 'suspended')
                    ->first();
            }
        }

        // 3. Fallback for path-based storefront lookup e.g. /store/{subdomain}
        $pathSubdomain = self::extractSubdomainFromPath($request->path());
        if ($pathSubdomain && self::isValidSubdomain($pathSubdomain)) {
            $storefront = Storefront::withoutTenantScope()
                ->where('subdomain', $pathSubdomain)
                ->where('status', '!=', 'suspended')
                ->first();

            if ($storefront) {
                return $storefront;
            }

            $tenant = Tenant::where('slug', $pathSubdomain)
                ->where('status', '!=', 'suspended')
                ->first();

            if ($tenant) {
                return Storefront::withoutTenantScope()
                    ->where('tenant_id', $tenant->id)
                    ->where('status', '!=', 'suspended')
                    ->first();
            }
        }

        // 4. Resolve from host / tenant context
        $tenant = self::resolveFromRequest($request);

        if ($tenant) {
            return Storefront::withoutTenantScope()
                ->where('tenant_id', $tenant->id)
                ->where('status', '!=', 'suspended')
                ->first();
        }

        // 5. In local/testing ONLY: allow default storefront if no explicit subdomain/domain was requested
        $hasExplicitRequest = $request->hasHeader('X-Tenant-Subdomain')
            || $request->hasHeader('X-Storefront-Subdomain')
            || $request->has('subdomain')
            || (bool) $pathSubdomain;

        if (! $hasExplicitRequest && app()->environment('local', 'testing')) {
            return Storefront::withoutTenantScope()
                ->where('status', '!=', 'suspended')
                ->first();
        }

        return null;
    }

    /**
     * Extract normalized hostname without port.
     */
    public static function extractHost(Request $request): string
    {
        $rawHost = $request->getHost();

        // In local/testing, allow X-Storefront-Domain or X-Forwarded-Host if present
        if (app()->environment('local', 'testing')) {
            $rawHost = $request->header('X-Storefront-Domain') ?: $rawHost;
        }

        return preg_replace('/:\d+$/', '', strtolower(trim($rawHost)));
    }

    /**
     * Validate RFC-1123 DNS subdomain label format.
     */
    public static function isValidSubdomain(string $subdomain): bool
    {
        return (bool) preg_match(self::SUBDOMAIN_REGEX, strtolower($subdomain));
    }

    /**
     * Check whether a subdomain is in the platform's reserved list.
     */
    public static function isReservedSubdomain(string $subdomain): bool
    {
        $reserved = config('platform.reserved_subdomains', []);
        return in_array(strtolower($subdomain), $reserved, true);
    }

    /**
     * Extract subdomain from /store/{subdomain} URI paths.
     */
    private static function extractSubdomainFromPath(string $path): ?string
    {
        if (preg_match('#^/?store/([^/]+)#i', $path, $matches)) {
            return strtolower($matches[1]);
        }
        return null;
    }
}
