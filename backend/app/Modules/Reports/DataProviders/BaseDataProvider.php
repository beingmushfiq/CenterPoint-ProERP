<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use App\Core\Tenancy\TenantContext;

abstract class BaseDataProvider
{
    /**
     * Resolve the active tenant ID strictly from TenantContext or authenticated user.
     * Never trusts user-supplied tenant_id from query parameters (IDOR prevention).
     */
    protected function getTenantId(): int
    {
        if (TenantContext::isBound()) {
            return TenantContext::current()->tenantId();
        }

        $userTenantId = auth()->user()?->tenant_id;
        if ($userTenantId !== null) {
            return (int) $userTenantId;
        }

        return (int) config('app.default_tenant_id', 1);
    }
}
