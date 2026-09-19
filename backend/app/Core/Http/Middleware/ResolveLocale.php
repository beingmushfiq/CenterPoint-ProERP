<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Core\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the application locale for the current request.
 *
 * Priority order:
 *  1. Header 'X-App-Locale' (e.g. 'bn' or 'en')
 *  2. Authenticated user's locale preference ($user->locale)
 *  3. Tenant's default locale from TenantContext
 *  4. Accept-Language header fallback or default 'en'
 */
final class ResolveLocale
{
    private const SUPPORTED = ['en', 'bn'];

    public function handle(Request $request, Closure $next): Response
    {
        $locale = $this->resolveLocale($request);

        app()->setLocale($locale);

        $response = $next($request);

        $response->headers->set('Content-Language', $locale);

        return $response;
    }

    private function resolveLocale(Request $request): string
    {
        // 1. Explicit request header from frontend
        $headerLocale = $request->header('X-App-Locale');
        if ($headerLocale && in_array($headerLocale, self::SUPPORTED, true)) {
            return $headerLocale;
        }

        // 2. Authenticated user preference
        $user = $request->user();
        if ($user && !empty($user->locale) && in_array($user->locale, self::SUPPORTED, true)) {
            return (string) $user->locale;
        }

        // 3. Bound tenant default locale
        if (TenantContext::isBound()) {
            try {
                $tenant = TenantContext::current()->tenant();
                $tenantLocale = $tenant['locale'] ?? null;
                if ($tenantLocale && in_array($tenantLocale, self::SUPPORTED, true)) {
                    return (string) $tenantLocale;
                }
            } catch (\Throwable) {
                // Ignore if context read fails
            }
        }

        // 4. Accept-Language header fallback
        $preferred = $request->getPreferredLanguage(self::SUPPORTED);
        if ($preferred && in_array($preferred, self::SUPPORTED, true)) {
            return $preferred;
        }

        return 'en';
    }
}
