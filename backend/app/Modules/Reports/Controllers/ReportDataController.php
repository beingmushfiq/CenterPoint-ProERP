<?php

declare(strict_types=1);

namespace App\Modules\Reports\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Reports\Actions\RunReportQueryAction;
use App\Modules\Reports\Models\ReportDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportDataController extends Controller
{
    protected function authorizeReportAccess(Request $request, string $code): ReportDefinition
    {
        $user = $request->user();
        $tenantId = $user?->tenant_id ?? (TenantContext::isBound() ? TenantContext::current()->tenantId() : 1);

        $definition = ReportDefinition::withoutTenantScope()
            ->where('code', $code)
            ->where(function ($q) use ($tenantId) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $tenantId);
            })
            ->firstOrFail();

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
                    if (!empty($definition->required_permission)) {
                        $prefix = explode('.', $definition->required_permission)[0];
                        $allowed = $user->hasPermission($definition->required_permission)
                            || $user->hasPermission('reports.report.view')
                            || $user->hasPermission('reports.view')
                            || $user->hasPermission("{$prefix}.view")
                            || $user->hasPermission("{$prefix}.order.view")
                            || $user->hasPermission("{$prefix}.stock.view")
                            || $user->hasPermission("{$prefix}.run.view")
                            || $user->hasPermission("{$prefix}.lead.view")
                            || $user->hasPermission("{$prefix}.invoice.view");
                        if (!$allowed) {
                            abort(403, 'Unauthorized to access this report.');
                        }
                    }
                }
            }
        }

        return $definition;
    }

    public function schema(string $code, Request $request): JsonResponse
    {
        $definition = $this->authorizeReportAccess($request, $code);

        return response()->json([
            'data' => [
                'code' => $definition->code,
                'name' => $definition->name,
                'module' => $definition->module,
                'category' => $definition->category,
                'description' => $definition->description,
                'default_filters' => $definition->default_filters,
                'available_columns' => $definition->available_columns,
                'supports_export' => $definition->supports_export,
                'tier' => $definition->tier,
            ],
        ]);
    }

    public function data(string $code, Request $request, RunReportQueryAction $action): JsonResponse
    {
        $this->authorizeReportAccess($request, $code);

        $page = $request->integer('page', 1);
        $perPage = $request->integer('per_page', 25);
        $filters = $request->all();

        $result = $action->execute($code, $filters, $page, $perPage);

        return response()->json([
            'data' => $result,
        ]);
    }
}
