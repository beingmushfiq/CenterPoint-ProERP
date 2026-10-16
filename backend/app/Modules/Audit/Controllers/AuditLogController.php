<?php

declare(strict_types=1);

namespace App\Modules\Audit\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditLogController extends Controller
{
    /**
     * List all audit logs with multi-parameter filtering and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with('user:id,name,email')
            ->orderBy('created_at', 'desc');

        if ($request->filled('action')) {
            $action = (string) $request->query('action');
            $query->where(function ($q) use ($action): void {
                $q->where('action', $action)
                    ->orWhere('action', 'like', "{$action}%");
            });
        }

        if ($request->filled('auditable_type')) {
            $type = (string) $request->query('auditable_type');
            $query->where(function ($q) use ($type): void {
                $q->where('auditable_type', $type)
                    ->orWhere('auditable_type', 'like', "%{$type}%");
            });
        }

        if ($request->filled('auditable_id')) {
            $query->where('auditable_id', $request->query('auditable_id'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->query('user_id'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->query('end_date'));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where(function ($q) use ($search): void {
                $q->where('action', 'like', "%{$search}%")
                    ->orWhere('auditable_type', 'like', "%{$search}%")
                    ->orWhere('correlation_id', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search): void {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $logs = $query->paginate($request->integer('per_page', 25));

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'meta' => [
                'total' => $logs->total(),
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }

    /**
     * Get a single audit log entry by ID with full details.
     */
    public function show(int $id): JsonResponse
    {
        $log = AuditLog::with('user:id,name,email')->find($id);

        if (! $log) {
            return response()->json([
                'success' => false,
                'message' => 'Audit log record not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'success' => true,
            'data' => $log,
        ]);
    }

    /**
     * Retrieve complete version history and edit timeline for a specific entity.
     */
    public function entityHistory(string $type, int|string $id): JsonResponse
    {
        $logs = AuditLog::with('user:id,name,email')
            ->where(function ($q) use ($type): void {
                $q->where('auditable_type', $type)
                    ->orWhere('auditable_type', 'like', "%{$type}%");
            })
            ->where('auditable_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }
}
