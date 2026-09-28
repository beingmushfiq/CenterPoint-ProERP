<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PlatformAnnouncement;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlatformAnnouncementController extends Controller
{
    /**
     * List all platform announcements with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PlatformAnnouncement::with('creator:id,name,email')->latest('id');

        if ($request->filled('severity') && $request->input('severity') !== 'all') {
            $query->where('severity', (string) $request->input('severity'));
        }

        if ($request->filled('target_type') && $request->input('target_type') !== 'all') {
            $query->where('target_type', (string) $request->input('target_type'));
        }

        if ($request->boolean('active_only')) {
            $now = Carbon::now();
            $query->where('is_active', true)
                ->where(function ($q) use ($now): void {
                    $q->whereNull('publish_at')->orWhere('publish_at', '<=', $now);
                })
                ->where(function ($q) use ($now): void {
                    $q->whereNull('expires_at')->orWhere('expires_at', '>=', $now);
                });
        }

        $announcements = $query->get();

        return response()->json([
            'success' => true,
            'data' => $announcements,
            'meta' => [
                'total' => $announcements->count(),
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Create a new announcement broadcast.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string',
            'target_type' => 'required|string|in:all,plan,tenant',
            'target_ids' => 'nullable|array',
            'severity' => 'nullable|string|in:info,warning,critical',
            'publish_at' => 'nullable|date',
            'expires_at' => 'nullable|date',
            'is_active' => 'nullable|boolean',
        ]);

        $announcement = PlatformAnnouncement::create([
            'uuid' => (string) Str::uuid(),
            'title' => $validated['title'],
            'body' => $validated['body'],
            'target_type' => $validated['target_type'],
            'target_ids' => $validated['target_ids'] ?? null,
            'severity' => $validated['severity'] ?? 'info',
            'publish_at' => isset($validated['publish_at']) ? Carbon::parse($validated['publish_at']) : Carbon::now(),
            'expires_at' => isset($validated['expires_at']) ? Carbon::parse($validated['expires_at']) : null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $request->user()?->id,
        ]);

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Created,
            'auditable_type' => 'PlatformAnnouncement',
            'auditable_id' => $announcement->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => ['title' => $announcement->title, 'target_type' => $announcement->target_type],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Announcement '{$announcement->title}' published.",
            'data' => $announcement->load('creator:id,name,email'),
        ], 201);
    }

    /**
     * Update an existing announcement.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $announcement = PlatformAnnouncement::findOrFail($id);

        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'body' => 'nullable|string',
            'target_type' => 'nullable|string|in:all,plan,tenant',
            'target_ids' => 'nullable|array',
            'severity' => 'nullable|string|in:info,warning,critical',
            'publish_at' => 'nullable|date',
            'expires_at' => 'nullable|date',
            'is_active' => 'nullable|boolean',
        ]);

        $announcement->update(array_filter($validated, fn ($v) => $v !== null));

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Updated,
            'auditable_type' => 'PlatformAnnouncement',
            'auditable_id' => $announcement->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => ['title' => $announcement->title, 'is_active' => $announcement->is_active],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Announcement updated.',
            'data' => $announcement->fresh()->load('creator:id,name,email'),
        ]);
    }

    /**
     * Soft delete an announcement.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $announcement = PlatformAnnouncement::findOrFail($id);
        $title = $announcement->title;
        $announcement->delete();

        return response()->json([
            'success' => true,
            'message' => "Announcement '{$title}' removed.",
        ]);
    }
}
