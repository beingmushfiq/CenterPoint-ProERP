<?php

declare(strict_types=1);

namespace App\Core\Tenancy;

use RuntimeException;

/**
 * Request-scoped singleton that carries the resolved tenant and the current
 * user's company/branch scope set (DATABASE_DESIGN §15, ARCHITECTURE §3.2).
 *
 * Rules:
 * - Built exclusively by ResolveTenant middleware via TenantContext::bind().
 * - Downstream code reads it via TenantContext::current().
 * - Nothing reads a request field to discover the tenant.
 * - A queue job must re-bind the context before any tenant-scoped work;
 *   calling current() without a prior bind() throws immediately.
 *
 * The instance is stored on the IoC container as a scoped singleton so that
 * each HTTP request / queue job gets its own context:
 *
 *     $app->instance(TenantContext::class, $context);
 */
final class TenantContext
{
    /** @var self|null The context bound to the current request/job. */
    private static ?self $current = null;

    /**
     * @param  array<string, mixed>  $tenant  The raw tenant row from the `tenants` table.
     * @param  array<int, array<string, mixed>>  $scopes  The rows from `user_scopes` for the
     *                                                    authenticated user in this tenant. An empty array
     *                                                    means whole-tenant access (DATABASE_DESIGN §15).
     */
    private function __construct(
        private readonly array $tenant,
        private readonly array $scopes,
    ) {}

    // -------------------------------------------------------------------------
    // Factory — called only by ResolveTenant
    // -------------------------------------------------------------------------

    /**
     * Build a context from a raw tenant row and the user's scope rows, then
     * bind it as the current context for this request/job.
     *
     * @param  array<string, mixed>  $tenant
     * @param  array<int, array<string, mixed>>  $scopes
     */
    public static function bind(array $tenant, array $scopes = []): self
    {
        $instance = new self($tenant, $scopes);
        self::$current = $instance;

        return $instance;
    }

    /**
     * Clear the bound context. Called in test tearDown and at the start of
     * each queue job before the new context is bound.
     */
    public static function flush(): void
    {
        self::$current = null;
    }

    // -------------------------------------------------------------------------
    // Accessor — used everywhere downstream
    // -------------------------------------------------------------------------

    /**
     * Return the context bound to the current request/job.
     *
     * Throws if called before ResolveTenant has run — this is intentional:
     * a queue job without a bound context must fail immediately rather than
     * silently reading another tenant's data (ARCHITECTURE §3.2).
     *
     * @throws RuntimeException If no context has been bound.
     */
    public static function current(): self
    {
        if (self::$current === null) {
            throw new RuntimeException(
                'TenantContext::current() called before a context was bound. '
                .'A queue job must serialise and re-establish the tenant context '
                .'before performing any tenant-scoped work (ARCHITECTURE §3.2).'
            );
        }

        return self::$current;
    }

    /**
     * Return true if a context is currently bound (useful in middleware that
     * must behave differently for platform-scope vs tenant-scope routes).
     */
    public static function isBound(): bool
    {
        return self::$current !== null;
    }

    // -------------------------------------------------------------------------
    // Tenant data accessors
    // -------------------------------------------------------------------------

    /**
     * The auto-increment tenant id (used for DB queries).
     * Never exposed in URLs — use tenantUuid() for public identifiers.
     */
    public function tenantId(): int
    {
        return (int) ($this->tenant['id'] ?? 0);
    }

    /**
     * The public UUID (used in API responses and URLs, API_CONTRACT §1.3).
     */
    public function tenantUuid(): string
    {
        return (string) ($this->tenant['uuid'] ?? '');
    }

    /**
     * The tenant slug (globally unique, resolves the subdomain, ARCHITECTURE §3.2).
     */
    public function tenantSlug(): string
    {
        return (string) ($this->tenant['slug'] ?? '');
    }

    /**
     * Raw tenant array representation.
     *
     * @return array<string, mixed>
     */
    public function tenant(): array
    {
        return $this->tenant;
    }

    /**
     * Tenant status: trial | active | past_due | suspended | cancelled.
     */
    public function tenantStatus(): string
    {
        return (string) ($this->tenant['status'] ?? 'active');
    }

    /**
     * True if the tenant is in a read-only state (past_due).
     * Suspended/cancelled tenants are blocked entirely (ARCHITECTURE §3.2).
     */
    public function isReadOnly(): bool
    {
        return $this->tenant['status'] === 'past_due';
    }

    /**
     * Business types configured for the tenant.
     *
     * @return list<string>
     */
    public function businessTypes(): array
    {
        $raw = $this->tenant['business_type_keys'] ?? null;
        if (is_string($raw)) {
            return (array) json_decode($raw, true);
        }
        return is_array($raw) ? $raw : ['manufacturing'];
    }

    /**
     * Industry profile key configured for the tenant.
     */
    public function industryProfileKey(): ?string
    {
        return $this->tenant['industry_profile_key'] ?? null;
    }

    /**
     * Terminology dictionary configured for the tenant.
     *
     * @return array<string, string>
     */
    public function terminology(): array
    {
        $raw = $this->tenant['terminology'] ?? null;
        if (is_string($raw)) {
            return (array) json_decode($raw, true);
        }
        return is_array($raw) ? $raw : [];
    }

    // -------------------------------------------------------------------------
    // Scope accessors
    // -------------------------------------------------------------------------

    /**
     * All user_scopes rows for this user in this tenant.
     *
     * An empty array means whole-tenant access — the table restricts visibility,
     * never grants it (DATABASE_DESIGN §15, ARCHITECTURE §3.3).
     *
     * @return array<int, array<string, mixed>>
     */
    public function scopes(): array
    {
        return $this->scopes;
    }

    /**
     * True when the user has no scope restrictions (whole-tenant access).
     */
    public function hasUnrestrictedAccess(): bool
    {
        return $this->scopes === [];
    }

    /**
     * True when the user has a scope row matching the given type and id.
     *
     * @param  string  $scopeType  e.g. 'branch', 'factory', 'warehouse'
     */
    public function isInScope(string $scopeType, int $scopeId): bool
    {
        if ($this->hasUnrestrictedAccess()) {
            return true;
        }

        foreach ($this->scopes as $scope) {
            $rawScopeId = $scope['scope_id'] ?? null;

            if (($scope['scope_type'] ?? '') === $scopeType && is_numeric($rawScopeId) && (int) $rawScopeId === $scopeId) {
                return true;
            }
        }

        return false;
    }
}
