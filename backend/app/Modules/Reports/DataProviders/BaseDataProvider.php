<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use App\Core\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use RuntimeException;

abstract class BaseDataProvider
{
    /**
     * Resolve the active tenant ID strictly from TenantContext or authenticated user.
     * Never trusts user-supplied tenant_id from query parameters (IDOR prevention).
     *
     * @throws RuntimeException If called without an active TenantContext or authenticated user.
     */
    protected function getTenantId(): int
    {
        if (TenantContext::isBound()) {
            return TenantContext::current()->tenantId();
        }

        $userTenantId = Auth::user()?->tenant_id;
        if ($userTenantId !== null) {
            return (int) $userTenantId;
        }

        throw new RuntimeException(
            'BaseDataProvider::getTenantId() called without an active TenantContext or authenticated user. '
            .'A queue job must bind TenantContext before invoking any DataProvider.'
        );
    }

    /**
     * Start a query builder pre-scoped to the active tenant to prevent query omission regressions.
     *
     * Example: $this->tenantTable('sales_orders', 'so')
     * Produces: DB::table('sales_orders as so')->where('so.tenant_id', $this->getTenantId())
     */
    protected function tenantTable(string $table, ?string $alias = null): Builder
    {
        $tenantId = $this->getTenantId();
        $tableExpression = $alias !== null ? "{$table} as {$alias}" : $table;
        $column = $alias !== null ? "{$alias}.tenant_id" : "{$table}.tenant_id";

        return DB::table($tableExpression)->where($column, $tenantId);
    }
}
