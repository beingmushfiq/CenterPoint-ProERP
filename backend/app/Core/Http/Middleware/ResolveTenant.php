<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Core\Tenancy\Exceptions\TenantMismatch;
use App\Core\Tenancy\TenantContext;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the tenant from the authenticated JWT claim and binds a
 * TenantContext instance into the request lifecycle (ARCHITECTURE §3.2).
 *
 * Resolution chain (API_CONTRACT §9.1):
 *
 *   JWT claim `tenant_id`
 *     → load tenant row from `tenants` (401 if not found)
 *     → load user's user_scopes rows for this tenant
 *     → bind TenantContext::bind(tenant, scopes)
 *
 * Security rules enforced here:
 *   - tenant_id is ALWAYS taken from the JWT claim, never from the request.
 *   - A client-supplied `tenant_id` in the body that DISAGREES with the claim
 *     throws TenantMismatch (403) and is logged as a security event.
 *   - A client-supplied `tenant_id` that agrees with the claim is silently ignored.
 *
 * This middleware runs AFTER Authenticate so Auth::id() is available.
 * It runs BEFORE EnsureTenantActive so the context exists when status is checked.
 *
 * Platform-scope routes skip this middleware entirely — they use their own
 * platform-only auth group (ARCHITECTURE §3.2).
 */
final class ResolveTenant
{
    /**
     * Resolve the tenant and bind the context for downstream use.
     *
     * @throws AuthenticationException If no tenant_id in the JWT or the tenant row is missing.
     * @throws TenantMismatch If the request body contains a disagreeing tenant_id.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // The JWT `tenant_id` claim is the authoritative source (API_CONTRACT §9.1).
        // Until the JWT auth module ships (post-Wave 5) this middleware reads the
        // claim from the authenticated Eloquent model via getAttribute() so PHPStan
        // does not try to resolve the property against the User class definition.
        $user = $request->user();

        if ($user === null) {
            throw new AuthenticationException('Unauthenticated — no authenticated user for tenant resolution.');
        }

        // getAttribute() returns mixed; we narrow it to int|null below.
        $rawTenantId = $user->getAttribute('tenant_id');
        $tenantId = is_numeric($rawTenantId) ? (int) $rawTenantId : null;

        if ($tenantId === null) {
            throw new AuthenticationException(
                'Unauthenticated — authenticated user has no tenant_id claim. '
                .'Platform users may not access tenant-scope routes.'
            );
        }

        // Check for a disagreeing body tenant_id (security event).
        $this->detectBodyTenantMismatch($request, $tenantId);

        // Load the tenant row with caching (5 min TTL).
        $tenantCacheKey = "t{$tenantId}:tenant:profile";
        $tenantData = Cache::remember($tenantCacheKey, 300, static function () use ($tenantId): ?array {
            $row = DB::table('tenants')->where('id', $tenantId)->first();
            return $row !== null ? (array) $row : null;
        });

        if ($tenantData === null) {
            Cache::forget($tenantCacheKey);
            throw new AuthenticationException(
                "Unauthenticated — tenant [{$tenantId}] from JWT claim was not found."
            );
        }

        // Load the user's scope rows for this tenant with caching (5 min TTL). Empty = whole-tenant access.
        $rawUserId = $user->getAttribute('id');
        $userId = is_numeric($rawUserId) ? (int) $rawUserId : null;

        /** @var array<int, array<string, mixed>> $scopes */
        $scopes = $userId !== null
            ? Cache::remember("t{$tenantId}:user:{$userId}:scopes", 300, static function () use ($tenantId, $userId): array {
                return DB::table('user_scopes')
                    ->where('tenant_id', $tenantId)
                    ->where('user_id', $userId)
                    ->get()
                    ->map(static fn (object $row): array => (array) $row)
                    ->all();
            })
            : [];

        // Bind the context. TenantContext::bind() stores it statically so
        // downstream code can call TenantContext::current() without DI.
        TenantContext::bind($tenantData, $scopes);

        return $next($request);
    }

    /**
     * If the request body contains a `tenant_id` that disagrees with the JWT
     * claim, throw TenantMismatch and log it as a security event.
     *
     * A body tenant_id that agrees is silently ignored — the JWT claim wins
     * regardless (API_CONTRACT §1.6, ADR-004).
     *
     * @throws TenantMismatch
     */
    private function detectBodyTenantMismatch(Request $request, int $jwtTenantId): void
    {
        $bodyTenantId = $request->input('tenant_id');

        if ($bodyTenantId === null) {
            return;
        }

        // Narrow mixed → int via an explicit type check before casting.
        if (! is_string($bodyTenantId) && ! is_int($bodyTenantId)) {
            return;
        }

        $bodyTenantIdInt = (int) $bodyTenantId;

        if ($bodyTenantIdInt === $jwtTenantId) {
            // Agrees — ignore silently.
            return;
        }

        // Disagrees — log as a security event and throw.
        Log::warning('Security event: client-supplied body tenant_id disagrees with JWT claim.', [
            'jwt_tenant_id' => $jwtTenantId,
            'body_tenant_id' => $bodyTenantIdInt,
            'user_id' => $request->user()?->getAttribute('id'),
            'ip' => $request->ip(),
            'path' => $request->path(),
            'correlation_id' => $request->attributes->get('correlation_id'),
        ]);

        throw new TenantMismatch($jwtTenantId, $bodyTenantIdInt);
    }
}
