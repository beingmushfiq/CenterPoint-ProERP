<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PlatformRole;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class PlatformAdminController extends Controller
{
    /**
     * List all platform administrators.
     */
    public function index(Request $request): JsonResponse
    {
        $admins = User::withoutTenantScope()
            ->where('is_platform_user', true)
            ->with('platformRoles')
            ->orderByDesc('id')
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'uuid' => $u->uuid,
                'name' => $u->name,
                'email' => $u->email,
                'status' => $u->status ?? ($u->is_active ? 'active' : 'inactive'),
                'is_active' => (bool) $u->is_active,
                'last_login_at' => $u->last_login_at?->toIso8601String(),
                'created_at' => $u->created_at?->toIso8601String(),
                'roles' => $u->platformRoles->map(fn (PlatformRole $r) => [
                    'id' => $r->id,
                    'name' => $r->name,
                    'slug' => $r->slug,
                ]),
            ]);

        return response()->json([
            'success' => true,
            'data' => $admins,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Create a new platform administrator.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191',
            'email' => 'required|email|max:191|unique:users,email',
            'password' => 'required|string|min:8',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'integer|exists:platform_roles,id',
        ]);

        $admin = User::create([
            'uuid' => (string) Str::uuid(),
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make($validated['password']),
            'is_platform_user' => true,
            'is_active' => true,
            'status' => 'active',
            'token_version' => 1,
            'locale' => 'en',
            'theme' => 'system',
            'density' => 'comfortable',
            'landing_page' => 'platform',
        ]);

        if (! empty($validated['role_ids'])) {
            $admin->platformRoles()->syncWithPivotValues(
                $validated['role_ids'],
                ['granted_by' => $request->user()?->id, 'granted_at' => Carbon::now()]
            );
        }

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Created,
            'auditable_type' => 'User',
            'auditable_id' => $admin->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => ['admin_email' => $admin->email, 'name' => $admin->name],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Platform administrator '{$admin->name}' created successfully.",
            'data' => $admin->load('platformRoles'),
        ], 201);
    }

    /**
     * Update an administrator's profile, status, or roles.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $admin = User::withoutTenantScope()->where('is_platform_user', true)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'nullable|string|max:191',
            'status' => 'nullable|string|in:active,inactive,suspended',
            'is_active' => 'nullable|boolean',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'integer|exists:platform_roles,id',
        ]);

        $updates = [];
        if (isset($validated['name'])) $updates['name'] = $validated['name'];
        if (isset($validated['status'])) {
            $updates['status'] = $validated['status'];
            $updates['is_active'] = $validated['status'] === 'active';
        } elseif (isset($validated['is_active'])) {
            $updates['is_active'] = $validated['is_active'];
            $updates['status'] = $validated['is_active'] ? 'active' : 'inactive';
        }

        if (! empty($updates)) {
            $admin->update($updates);
        }

        if (isset($validated['role_ids'])) {
            $admin->platformRoles()->syncWithPivotValues(
                $validated['role_ids'],
                ['granted_by' => $request->user()?->id, 'granted_at' => Carbon::now()]
            );
        }

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Updated,
            'auditable_type' => 'User',
            'auditable_id' => $admin->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => ['admin_id' => $admin->id, 'updates' => $updates],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Administrator '{$admin->name}' updated.",
            'data' => $admin->fresh()->load('platformRoles'),
        ]);
    }

    /**
     * Reset an administrator's password.
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $admin = User::withoutTenantScope()->where('is_platform_user', true)->findOrFail($id);

        $validated = $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $admin->password = Hash::make($validated['password']);
        $admin->token_version = ($admin->token_version ?? 1) + 1; // Invalidate current tokens
        $admin->save();

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Updated,
            'auditable_type' => 'User',
            'auditable_id' => $admin->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => ['action' => 'password_reset', 'admin_id' => $admin->id],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Password reset successfully for '{$admin->name}'. All active sessions invalidated.",
        ]);
    }

    /**
     * Delete or deactivate an administrator.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $admin = User::withoutTenantScope()->where('is_platform_user', true)->findOrFail($id);

        if ($request->user()?->id === $admin->id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot deactivate or delete your own administrator account.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $admin->is_active = false;
        $admin->status = 'inactive';
        $admin->save();

        return response()->json([
            'success' => true,
            'message' => "Administrator '{$admin->name}' deactivated.",
        ]);
    }

    /**
     * Update an administrator's status.
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $admin = User::withoutTenantScope()->where('is_platform_user', true)->findOrFail($id);

        if ($request->user()?->id === $admin->id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot change the status of your own administrator account.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $validated = $request->validate([
            'status' => 'required|string|in:active,inactive,suspended',
        ]);

        $status = $validated['status'];
        $isActive = $status === 'active';

        $admin->update([
            'status' => $status,
            'is_active' => $isActive,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Administrator status updated to '{$status}'.",
            'data' => $admin->fresh()->load('platformRoles'),
        ]);
    }
}
