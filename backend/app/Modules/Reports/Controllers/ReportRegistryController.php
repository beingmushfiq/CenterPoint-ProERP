<?php

declare(strict_types=1);

namespace App\Modules\Reports\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Reports\Models\ReportDefinition;
use App\Core\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportRegistryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user?->tenant_id ?? (TenantContext::isBound() ? TenantContext::current()->tenantId() : 1);
        $query = ReportDefinition::withoutTenantScope()
            ->where(function ($q) use ($tenantId) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $tenantId);
            })
            ->where('is_active', true);

        if ($request->filled('module')) {
            $query->where('module', $request->query('module'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        $definitions = $query->orderBy('name')->get();

        // Filter definitions by user permissions if authenticated with RBAC
        if ($user && method_exists($user, 'hasPermission')) {
            $isSuperAdmin = !empty($user->is_platform_admin)
                || $user->hasRole('Super Administrator')
                || $user->hasRole('super_admin')
                || $user->hasRole('Administrator')
                || $user->hasRole('System Administrator')
                || $user->hasRole('admin');
            if (!$isSuperAdmin) {
                $effective = method_exists($user, 'getEffectivePermissions') ? $user->getEffectivePermissions() : [];
                if (!empty($effective) && !in_array('*', $effective, true)) {
                    $definitions = $definitions->filter(function ($def) use ($user) {
                        if (empty($def->required_permission)) {
                            return true;
                        }
                        $prefix = explode('.', $def->required_permission)[0];
                        return $user->hasPermission($def->required_permission)
                            || $user->hasPermission('reports.report.view')
                            || $user->hasPermission('reports.view')
                            || $user->hasPermission("{$prefix}.view")
                            || $user->hasPermission("{$prefix}.order.view")
                            || $user->hasPermission("{$prefix}.stock.view")
                            || $user->hasPermission("{$prefix}.run.view")
                            || $user->hasPermission("{$prefix}.lead.view")
                            || $user->hasPermission("{$prefix}.invoice.view");
                    })->values();
                }
            }
        }

        return response()->json([
            'data' => $definitions,
            'meta' => [
                'count' => $definitions->count(),
            ],
        ]);
    }
}
