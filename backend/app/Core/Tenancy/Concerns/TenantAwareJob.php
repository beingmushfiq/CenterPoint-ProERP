<?php

declare(strict_types=1);

namespace App\Core\Tenancy\Concerns;

use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use RuntimeException;

/**
 * Trait for queued jobs executing within a specific tenant context.
 *
 * Automatically captures the current tenant ID on dispatch, serializes it,
 * and re-establishes TenantContext in the queue worker process before job execution.
 */
trait TenantAwareJob
{
    /**
     * The tenant ID this job belongs to.
     */
    public ?int $tenantId = null;

    /**
     * Initialize tenant context for the job. Can be called in job constructor.
     */
    public function initializeTenantContext(?int $tenantId = null): self
    {
        if ($tenantId !== null) {
            $this->tenantId = $tenantId;
        } elseif (TenantContext::isBound()) {
            $this->tenantId = TenantContext::current()->tenantId();
        }

        return $this;
    }

    /**
     * Manually bind tenant context if middleware pipeline is bypassed.
     */
    public function bindTenantContext(): void
    {
        if ($this->tenantId === null) {
            throw new RuntimeException('Cannot execute TenantAwareJob without a valid tenantId.');
        }

        $tenant = Tenant::find($this->tenantId);
        if (! $tenant) {
            throw new RuntimeException("Tenant #{$this->tenantId} not found for queued job.");
        }

        TenantContext::bind($tenant->toArray());
    }

    /**
     * Job middleware ensuring TenantContext is bound before job execution
     * and cleanly flushed after completion or failure.
     *
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [
            new class($this->tenantId)
            {
                public function __construct(private readonly ?int $tenantId) {}

                public function handle(object $job, callable $next): mixed
                {
                    if ($this->tenantId === null) {
                        throw new RuntimeException('Cannot execute TenantAwareJob without a valid tenantId.');
                    }

                    $tenant = Tenant::find($this->tenantId);
                    if (! $tenant) {
                        throw new RuntimeException("Tenant #{$this->tenantId} not found for queued job.");
                    }

                    TenantContext::bind($tenant->toArray());

                    try {
                        return $next($job);
                    } finally {
                        TenantContext::flush();
                    }
                }
            },
        ];
    }
}
