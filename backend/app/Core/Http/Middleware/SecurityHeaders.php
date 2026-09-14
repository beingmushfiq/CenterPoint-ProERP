<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Global Security Headers Middleware.
 *
 * Enforces defense-in-depth HTTP headers across all API and Web responses:
 * - Clickjacking protection (X-Frame-Options: SAMEORIGIN)
 * - MIME-sniffing prevention (X-Content-Type-Options: nosniff)
 * - Legacy XSS filter activation (X-XSS-Protection: 1; mode=block)
 * - Strict Referrer leakage mitigation (Referrer-Policy: strict-origin-when-cross-origin)
 * - Browser feature / hardware API access restriction (Permissions-Policy)
 * - HTTP Strict Transport Security when accessed over HTTPS
 */
class SecurityHeaders
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        // Clickjacking mitigation: Disallow embedding in hostile external iframes
        if (! $response->headers->has('X-Frame-Options')) {
            $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        }

        // MIME-type confusion mitigation
        if (! $response->headers->has('X-Content-Type-Options')) {
            $response->headers->set('X-Content-Type-Options', 'nosniff');
        }

        // Legacy browser XSS protection
        if (! $response->headers->has('X-XSS-Protection')) {
            $response->headers->set('X-XSS-Protection', '1; mode=block');
        }

        // Referrer policy to safeguard URL tokens/IDs from leaking in Referer headers
        if (! $response->headers->has('Referrer-Policy')) {
            $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        }

        // Permissions policy to restrict unnecessary browser hardware access
        if (! $response->headers->has('Permissions-Policy')) {
            $response->headers->set(
                'Permissions-Policy',
                'camera=(), microphone=(), geolocation=(), payment=(self)'
            );
        }

        // Strict Transport Security (HSTS) on secure connections or production
        if ($request->isSecure() || app()->environment('production')) {
            if (! $response->headers->has('Strict-Transport-Security')) {
                $response->headers->set(
                    'Strict-Transport-Security',
                    'max-age=31536000; includeSubDomains'
                );
            }
        }

        return $response;
    }
}
