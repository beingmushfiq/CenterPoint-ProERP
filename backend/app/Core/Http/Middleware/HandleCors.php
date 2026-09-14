<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Models\TenantDomain;
use Closure;
use Illuminate\Http\Middleware\HandleCors as BaseHandleCors;
use Illuminate\Support\Facades\Cache;
use Throwable;

class HandleCors extends BaseHandleCors
{
    /**
     * Handle an incoming request.
     *
     * Dynamically verifies whether custom storefront domains (e.g. brand.com)
     * configured and verified in tenant_domains should be granted CORS access.
     */
    public function handle($request, Closure $next)
    {
        $origin = $request->headers->get('Origin');

        if (is_string($origin) && $origin !== '' && ! $this->isConfiguredOrigin($origin)) {
            $host = parse_url($origin, PHP_URL_HOST);
            if (is_string($host) && $this->isVerifiedTenantDomain($host)) {
                $allowed = config('cors.allowed_origins', []);
                $allowedList = is_array($allowed) ? array_filter($allowed, 'is_string') : [];
                $allowedList[] = $origin;
                config(['cors.allowed_origins' => array_values(array_unique($allowedList))]);
            }
        }

        return parent::handle($request, $next);
    }

    /**
     * Check if the origin matches pre-configured allowed origins or patterns.
     */
    protected function isConfiguredOrigin(string $origin): bool
    {
        $allowedOrigins = config('cors.allowed_origins', []);
        if (is_array($allowedOrigins)) {
            if (in_array('*', $allowedOrigins, true) || in_array($origin, $allowedOrigins, true)) {
                return true;
            }
        }

        $patterns = config('cors.allowed_origins_patterns', []);
        if (is_iterable($patterns)) {
            foreach ($patterns as $pattern) {
                if (is_string($pattern) && preg_match($pattern, $origin) === 1) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if the host is a verified tenant domain with caching.
     */
    protected function isVerifiedTenantDomain(string $host): bool
    {
        try {
            $normalizedHost = strtolower(trim($host));

            return (bool) Cache::remember("cors_tenant_domain:{$normalizedHost}", 300, function () use ($normalizedHost): bool {
                return TenantDomain::withoutTenantScope()
                    ->where('domain', $normalizedHost)
                    ->where('verification_status', 'verified')
                    ->exists();
            });
        } catch (Throwable) {
            return false;
        }
    }
}
