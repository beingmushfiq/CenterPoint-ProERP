<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PlatformErrorLog;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlatformErrorLogController extends Controller
{
    /**
     * List all platform errors with search, status, and severity filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PlatformErrorLog::with(['tenant:id,name,slug', 'resolver:id,name,email']);

        if ($request->filled('tenant_id')) {
            $query->where('tenant_id', (int) $request->input('tenant_id'));
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('severity') && $request->input('severity') !== 'all') {
            $query->where('severity', (string) $request->input('severity'));
        }

        if ($request->filled('search')) {
            $search = '%'.trim((string) $request->input('search')).'%';
            $query->where(function ($q) use ($search): void {
                $q->where('message', 'like', $search)
                    ->orWhere('error_type', 'like', $search)
                    ->orWhere('route', 'like', $search)
                    ->orWhere('module', 'like', $search)
                    ->orWhere('fingerprint', 'like', $search);
            });
        }

        $perPage = min(max((int) $request->input('per_page', 25), 1), 100);
        $paginator = $query->latest('last_seen_at')->paginate($perPage);

        // Summary metrics
        $stats = [
            'total' => PlatformErrorLog::count(),
            'open' => PlatformErrorLog::where('status', 'open')->count(),
            'investigating' => PlatformErrorLog::where('status', 'investigating')->count(),
            'resolved' => PlatformErrorLog::where('status', 'resolved')->count(),
            'critical' => PlatformErrorLog::where('severity', 'critical')->where('status', 'open')->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $paginator->items(),
            'meta' => [
                'pagination' => [
                    'total' => $paginator->total(),
                    'page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total_pages' => $paginator->lastPage(),
                ],
                'stats' => $stats,
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Ingest runtime or frontend client errors into the telemetry database.
     */
    public function ingest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'error_type' => 'required|string|max:128',
            'message' => 'required|string',
            'stack_trace' => 'nullable|string',
            'severity' => 'nullable|string|in:info,warning,error,critical',
            'module' => 'nullable|string|max:64',
            'route' => 'nullable|string|max:255',
            'tenant_id' => 'nullable|integer',
            'correlation_id' => 'nullable|uuid',
            'browser' => 'nullable|string|max:128',
        ]);

        $errorType = $validated['error_type'];
        $message = $validated['message'];
        $route = $validated['route'] ?? '';
        $tenantId = $validated['tenant_id'] ?? null;

        // Deduplication signature fingerprint
        $fingerprint = hash('sha256', "{$errorType}|{$route}|".substr($message, 0, 100).'|'.($tenantId ?? '0'));

        $existing = PlatformErrorLog::where('fingerprint', $fingerprint)->first();

        if ($existing) {
            $existing->increment('occurrence_count');
            $existing->last_seen_at = Carbon::now();
            if ($existing->status === 'resolved') {
                $existing->status = 'open'; // Re-open on recurrence
            }
            if ($validated['stack_trace'] && ! $existing->stack_trace) {
                $existing->stack_trace = $validated['stack_trace'];
            }
            $existing->save();

            return response()->json([
                'success' => true,
                'action' => 'incremented',
                'id' => $existing->id,
                'occurrences' => $existing->occurrence_count,
            ]);
        }

        $log = PlatformErrorLog::create([
            'uuid' => (string) Str::uuid(),
            'fingerprint' => $fingerprint,
            'tenant_id' => $tenantId,
            'user_id' => $request->user()?->id,
            'error_type' => $errorType,
            'message' => $message,
            'stack_trace' => $validated['stack_trace'] ?? null,
            'severity' => $validated['severity'] ?? 'error',
            'module' => $validated['module'] ?? null,
            'route' => $route ?: null,
            'correlation_id' => $validated['correlation_id'] ?? null,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'browser' => $validated['browser'] ?? null,
            'environment' => app()->environment(),
            'status' => 'open',
            'occurrence_count' => 1,
            'first_seen_at' => Carbon::now(),
            'last_seen_at' => Carbon::now(),
            'created_at' => Carbon::now(),
        ]);

        return response()->json([
            'success' => true,
            'action' => 'created',
            'id' => $log->id,
        ], 201);
    }

    /**
     * Show detailed diagnostic view of a specific error entry.
     */
    public function show(int $id): JsonResponse
    {
        $log = PlatformErrorLog::with(['tenant:id,name,slug', 'user:id,name,email', 'resolver:id,name,email'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $log,
        ]);
    }

    /**
     * Update error status (open, investigating, resolved, ignored) or attach note.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $log = PlatformErrorLog::findOrFail($id);

        $validated = $request->validate([
            'status' => 'nullable|string|in:open,investigating,resolved,ignored',
            'resolution_note' => 'nullable|string',
        ]);

        if (isset($validated['status'])) {
            $log->status = $validated['status'];
            if ($validated['status'] === 'resolved') {
                $log->resolved_by = $request->user()?->id;
                $log->resolved_at = Carbon::now();
            } elseif ($validated['status'] === 'open') {
                $log->resolved_by = null;
                $log->resolved_at = null;
            }
        }

        if (isset($validated['resolution_note'])) {
            $log->resolution_note = $validated['resolution_note'];
        }

        $log->save();

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Updated,
            'auditable_type' => 'PlatformErrorLog',
            'auditable_id' => $log->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => ['status' => $log->status, 'note' => $log->resolution_note],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Error diagnostic entry marked as {$log->status}.",
            'data' => $log->fresh()->load('resolver:id,name,email'),
        ]);
    }
}
