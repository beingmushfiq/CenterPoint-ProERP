<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Core\Tenancy\Exceptions\TenantSuspended;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces tenant lifecycle status before any business logic runs
 * (ARCHITECTURE §3.2, §5.1, API_CONTRACT §3.1).
 *
 * Status rules (from the `tenants.status` column, DATABASE_DESIGN §2):
 *
 *   active    → pass through unrestricted.
 *   trial     → pass through unrestricted (trial is an active state).
 *   past_due  → pass through as READ-ONLY. TenantContext::isReadOnly() returns
 *               true. Actions that perform writes check this flag and throw
 *               a domain exception before touching the database. This gives the
 *               tenant access to read their data while billing is resolved.
 *   suspended → throw TenantSuspended → 402 TENANT_INACTIVE.
 *   cancelled → throw TenantSuspended → 402 TENANT_INACTIVE.
 *
 * This middleware MUST run after ResolveTenant (which builds TenantContext).
 * Running it before ResolveTenant would throw a RuntimeException from
 * TenantContext::current().
 */
final class EnsureTenantActive
{
    /** Statuses that allow full read-write access. */
    private const ACTIVE_STATUSES = ['active', 'trial', 'trialing'];

    /** Statuses that allow read-only access (writes blocked in Actions). */
    private const READ_ONLY_STATUSES = ['past_due'];

    /**
     * @throws TenantSuspended When tenant status is `suspended` or `cancelled`.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $context = TenantContext::current();
        $status = $context->tenantStatus();
        $tenantId = $context->tenantId();

        // 1. Direct status check: suspended, cancelled, archived are blocked entirely
        if (in_array($status, ['suspended', 'cancelled', 'archived'], true)) {
            throw new TenantSuspended($context->tenantSlug(), $status);
        }

        // 2. Real-time subscription & grace period check
        /** @var Tenant|null $tenant */
        $tenant = Tenant::find($tenantId);
        if ($tenant !== null) {
            if ($tenant->isSubscriptionExpiredPastGrace()) {
                $tenant->syncSuspensionStateIfNeeded();
                throw new TenantSuspended($context->tenantSlug(), 'suspended');
            }

            if ($tenant->status === 'past_due' || $status === 'past_due') {
                return $next($request);
            }
        }

        if (in_array($status, self::ACTIVE_STATUSES, true)) {
            return $next($request);
        }

        if (in_array($status, self::READ_ONLY_STATUSES, true)) {
            // Pass through but let downstream (Actions, Controllers) know this
            // tenant is read-only. TenantContext::isReadOnly() returns true.
            return $next($request);
        }

        // suspended | cancelled — blocked entirely.
        throw new TenantSuspended($context->tenantSlug(), $status);
    }
}
