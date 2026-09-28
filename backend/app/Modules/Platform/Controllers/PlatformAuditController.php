<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use BackedEnum;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for Master SaaS Admin Platform-Wide Audit Logs.
 */
class PlatformAuditController extends Controller
{
    /**
     * List all platform audit entries.
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::withoutTenantScope()->with(['user:id,name,email', 'tenant:id,name,slug']);

        if ($request->filled('action')) {
            $action = (string) $request->input('action');
            if ($action !== 'all') {
                $query->where('action', $action);
            }
        }

        if ($request->filled('tenant_id')) {
            $query->where('tenant_id', (int) $request->input('tenant_id'));
        }

        if ($request->filled('entity_type')) {
            $entityType = (string) $request->input('entity_type');
            if ($entityType !== 'all') {
                $query->where('auditable_type', 'like', "%{$entityType}%");
            }
        } elseif ($request->filled('auditable_type')) {
            $query->where('auditable_type', (string) $request->input('auditable_type'));
        }

        $perPage = min(max((int) $request->input('per_page', 25), 1), 100);
        $paginator = $query->latest('id')->paginate($perPage);

        $data = $paginator->getCollection()->map(fn (AuditLog $log) => [
            'id' => $log->id,
            'uuid' => $log->uuid,
            'tenant_id' => $log->tenant_id,
            'tenant' => $log->tenant ? [
                'id' => $log->tenant->id,
                'name' => $log->tenant->name,
                'slug' => $log->tenant->slug,
            ] : null,
            'tenant_name' => $log->tenant?->name,
            'tenant_slug' => $log->tenant?->slug,
            'user_id' => $log->user_id,
            'actor_id' => $log->user_id,
            'user' => $log->user ? [
                'id' => $log->user->id,
                'name' => $log->user->name,
                'email' => $log->user->email,
            ] : null,
            'actor_name' => $log->user?->name ?? 'System',
            'actor_email' => $log->user?->email,
            'action' => $log->action instanceof BackedEnum ? $log->action->value : (string) $log->action,
            'auditable_type' => $log->auditable_type,
            'auditable_id' => $log->auditable_id,
            'entity_type' => $log->auditable_type,
            'entity_id' => $log->auditable_id,
            'ip' => $log->ip,
            'ip_address' => $log->ip,
            'user_agent' => $log->user_agent,
            'before' => $log->before,
            'after' => $log->after,
            'context' => $log->context,
            'changed_fields' => $log->changed_fields,
            'correlation_id' => $log->correlation_id,
            'created_at' => $log->created_at?->toIso8601String(),
        ])->values();

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'pagination' => [
                    'total' => $paginator->total(),
                    'page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total_pages' => $paginator->lastPage(),
                ],
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }
}
