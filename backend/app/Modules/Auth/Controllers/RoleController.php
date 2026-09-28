<?php

declare(strict_types=1);

namespace App\Modules\Auth\Controllers;

use App\Core\Audit\AuditLogger;
use App\Core\Auth\PermissionCatalogue;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class RoleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $roles = Role::query()
            ->where(function ($query) use ($tenantId): void {
                if ($tenantId) {
                    $query->where('tenant_id', $tenantId)
                        ->orWhereNull('tenant_id');
                } else {
                    $query->whereNull('tenant_id');
                }
            })
            ->withCount(['users', 'permissions'])
            ->with(['permissions:id,name,module,resource,action,description'])
            ->orderBy('is_system', 'desc')
            ->orderBy('name', 'asc')
            ->get();

        return response()->json([
            'data' => $roles,
        ]);
    }

    public function permissions(): JsonResponse
    {
        $permissions = Permission::query()
            ->orderBy('module')
            ->orderBy('resource')
            ->orderBy('action')
            ->get();

        // Group permissions by module and resource for frontend matrix rendering
        $grouped = [];
        foreach ($permissions as $perm) {
            $mod = $perm->module ?: 'General';
            $res = $perm->resource ?: 'Global';

            if (! isset($grouped[$mod])) {
                $grouped[$mod] = [
                    'module' => $mod,
                    'resources' => [],
                ];
            }

            if (! isset($grouped[$mod]['resources'][$res])) {
                $grouped[$mod]['resources'][$res] = [
                    'resource' => $res,
                    'permissions' => [],
                ];
            }

            $grouped[$mod]['resources'][$res]['permissions'][] = [
                'id' => $perm->id,
                'name' => $perm->name,
                'module' => $perm->module,
                'resource' => $perm->resource,
                'action' => $perm->action,
                'description' => $perm->description,
            ];
        }

        // Convert associative arrays to lists
        $groupedList = array_values(array_map(function ($modData) {
            $modData['resources'] = array_values($modData['resources']);

            return $modData;
        }, $grouped));

        return response()->json([
            'data' => [
                'raw' => $permissions,
                'grouped' => $groupedList,
            ],
        ]);
    }

    public function show(int $id, Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $role = Role::query()
            ->where(function ($query) use ($tenantId): void {
                if ($tenantId) {
                    $query->where('tenant_id', $tenantId)
                        ->orWhereNull('tenant_id');
                } else {
                    $query->whereNull('tenant_id');
                }
            })
            ->with(['permissions:id,name,module,resource,action,description'])
            ->withCount('users')
            ->findOrFail($id);

        return response()->json([
            'data' => $role,
        ]);
    }

    public function store(Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'designation' => 'nullable|string|max:191',
            'slug' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:255',
            'permission_ids' => 'nullable|array',
            'permission_ids.*' => 'integer|exists:permissions,id',
        ]);

        if (! empty($validated['permission_ids'])) {
            $catalogueNames = PermissionCatalogue::ALL_PERMISSIONS;
            $invalidIds = Permission::whereIn('id', $validated['permission_ids'])
                ->whereNotIn('name', $catalogueNames)
                ->pluck('id');

            if ($invalidIds->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'permission_ids' => ['One or more permission IDs are not valid system permissions.'],
                ]);
            }
        }

        $slug = ! empty($validated['slug'])
            ? Str::slug($validated['slug'], '_')
            : Str::slug($validated['name'], '_');

        // Ensure unique slug for this tenant
        $existing = Role::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->where('slug', $slug)
            ->first();

        if ($existing) {
            $slug .= '_'.Str::lower(Str::random(4));
        }

        $role = DB::transaction(function () use ($tenantId, $validated, $slug, $auditLogger, $request) {
            $role = Role::create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'name' => $validated['name'],
                'designation' => $validated['designation'] ?? null,
                'slug' => $slug,
                'description' => $validated['description'] ?? null,
                'is_system' => false,
            ]);

            if (! empty($validated['permission_ids'])) {
                $role->permissions()->sync($validated['permission_ids']);
            }

            $auditLogger->record(
                action: \App\Core\Audit\AuditAction::Created,
                auditable: $role,
                before: null,
                after: [
                    'name' => $role->name,
                    'designation' => $role->designation,
                    'slug' => $role->slug,
                    'permission_ids' => $validated['permission_ids'] ?? [],
                ],
                actor: $request->user(),
                context: ['tenant_id' => $tenantId],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );

            return $role;
        });

        $role->load(['permissions:id,name,module,resource,action,description']);

        return response()->json([
            'message' => 'Custom role created successfully.',
            'data' => $role,
        ], Response::HTTP_CREATED);
    }

    public function update(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $role = Role::query()
            ->where(function ($query) use ($tenantId): void {
                if ($tenantId) {
                    $query->where('tenant_id', $tenantId)
                        ->orWhereNull('tenant_id');
                } else {
                    $query->whereNull('tenant_id');
                }
            })
            ->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'designation' => 'nullable|string|max:191',
            'slug' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:255',
            'permission_ids' => 'nullable|array',
            'permission_ids.*' => 'integer|exists:permissions,id',
        ]);

        if (! empty($validated['permission_ids'])) {
            $catalogueNames = PermissionCatalogue::ALL_PERMISSIONS;
            $invalidIds = Permission::whereIn('id', $validated['permission_ids'])
                ->whereNotIn('name', $catalogueNames)
                ->pluck('id');

            if ($invalidIds->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'permission_ids' => ['One or more permission IDs are not valid system permissions.'],
                ]);
            }
        }

        $beforeState = [
            'name' => $role->name,
            'designation' => $role->designation,
            'description' => $role->description,
            'permission_ids' => $role->permissions()->pluck('permissions.id')->toArray(),
        ];

        DB::transaction(function () use ($role, $validated, $beforeState, $auditLogger, $tenantId, $request): void {
            // Update metadata for tenant-created and system roles
            if ($tenantId === null || $role->tenant_id === $tenantId) {
                $role->fill(array_filter([
                    'name' => $validated['name'] ?? null,
                    'designation' => array_key_exists('designation', $validated) ? $validated['designation'] : null,
                    'slug' => (! empty($validated['slug']) && ! $role->is_system) ? Str::slug($validated['slug'], '_') : null,
                    'description' => array_key_exists('description', $validated) ? $validated['description'] : null,
                ], fn ($val) => $val !== null));
                $role->save();
            }

            if (isset($validated['permission_ids'])) {
                $role->permissions()->sync($validated['permission_ids']);
            }

            $afterState = [
                'name' => $role->name,
                'designation' => $role->designation,
                'description' => $role->description,
                'permission_ids' => $validated['permission_ids'] ?? $beforeState['permission_ids'],
            ];

            $auditLogger->record(
                action: \App\Core\Audit\AuditAction::Updated,
                auditable: $role,
                before: $beforeState,
                after: $afterState,
                actor: $request->user(),
                context: ['tenant_id' => $tenantId],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );
        });

        $role->load(['permissions:id,name,module,resource,action,description']);

        return response()->json([
            'message' => 'Role updated successfully.',
            'data' => $role,
        ]);
    }

    public function destroy(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $role = Role::query()
            ->where(function ($query) use ($tenantId): void {
                if ($tenantId) {
                    $query->where('tenant_id', $tenantId);
                } else {
                    $query->whereNull('tenant_id');
                }
            })
            ->withCount('users')
            ->findOrFail($id);

        if ($role->is_system) {
            return response()->json([
                'message' => 'System roles cannot be deleted.',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($role->users_count > 0) {
            return response()->json([
                'message' => "Cannot delete role while {$role->users_count} user(s) are assigned to it.",
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        DB::transaction(function () use ($role, $auditLogger, $tenantId, $request): void {
            $role->permissions()->detach();
            $role->delete();

            $auditLogger->record(
                action: \App\Core\Audit\AuditAction::Deleted,
                auditable: $role,
                before: [
                    'name' => $role->name,
                    'slug' => $role->slug,
                ],
                after: null,
                actor: $request->user(),
                context: ['tenant_id' => $tenantId],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );
        });

        return response()->json([
            'message' => 'Role deleted successfully.',
        ]);
    }

    /**
     * List all users holding this role.
     */
    public function users(int $id, Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $role = Role::query()
            ->where(function ($query) use ($tenantId): void {
                if ($tenantId) {
                    $query->where('tenant_id', $tenantId)
                        ->orWhereNull('tenant_id');
                } else {
                    $query->whereNull('tenant_id');
                }
            })
            ->findOrFail($id);

        $query = $role->users()
            ->when($tenantId, fn ($q) => $q->where('users.tenant_id', $tenantId))
            ->with([
                'employee:id,uuid,employee_code,first_name,last_name,display_name,department_id,designation_id,user_id',
                'employee.department:id,name',
                'employee.designation:id,name',
            ]);

        if ($request->filled('search')) {
            $search = '%'.$request->query('search').'%';
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'like', $search)
                    ->orWhere('email', 'like', $search);
            });
        }

        $users = $query->orderBy('name')->paginate($request->integer('per_page', 50));

        $formatted = $users->through(function (User $user) {
            return [
                'id' => $user->id,
                'uuid' => $user->uuid,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'status' => $user->status ?? 'active',
                'is_active' => $user->is_active,
                'last_login_at' => $user->last_login_at?->toISOString(),
                'employee' => $user->employee ? [
                    'id' => $user->employee->id,
                    'employee_code' => $user->employee->employee_code,
                    'display_name' => $user->employee->display_name,
                    'department' => $user->employee->department?->name,
                    'designation' => $user->employee->designation?->name,
                ] : null,
            ];
        });

        return response()->json([
            'data' => $formatted->items(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * Assign a user to this role.
     */
    public function assignUser(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $role = Role::query()
            ->where(function ($query) use ($tenantId): void {
                if ($tenantId) {
                    $query->where('tenant_id', $tenantId)
                        ->orWhereNull('tenant_id');
                } else {
                    $query->whereNull('tenant_id');
                }
            })
            ->findOrFail($id);

        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $user = User::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->findOrFail($validated['user_id']);

        if ($user->roles()->where('roles.id', $role->id)->exists()) {
            return response()->json([
                'message' => "User '{$user->name}' is already assigned to the '{$role->name}' role.",
            ], Response::HTTP_CONFLICT);
        }

        DB::transaction(function () use ($role, $user, $tenantId, $auditLogger, $request): void {
            $user->roles()->attach($role->id, ['tenant_id' => $tenantId]);
            $user->perm_version = ($user->perm_version ?? 1) + 1;
            $user->save();

            $auditLogger->record(
                action: \App\Core\Audit\AuditAction::Updated,
                auditable: $role,
                before: null,
                after: [
                    'action' => 'user_assigned_to_role',
                    'user_id' => $user->id,
                    'user_name' => $user->name,
                    'role_name' => $role->name,
                ],
                actor: $request->user(),
                context: ['tenant_id' => $tenantId],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );
        });

        return response()->json([
            'message' => "User '{$user->name}' successfully assigned to '{$role->name}' role.",
            'data' => [
                'role_id' => $role->id,
                'user_id' => $user->id,
            ],
        ], Response::HTTP_CREATED);
    }

    /**
     * Remove a user from this role.
     */
    public function removeUser(int $id, int $userId, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $role = Role::query()
            ->where(function ($query) use ($tenantId): void {
                if ($tenantId) {
                    $query->where('tenant_id', $tenantId)
                        ->orWhereNull('tenant_id');
                } else {
                    $query->whereNull('tenant_id');
                }
            })
            ->findOrFail($id);

        $user = User::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->findOrFail($userId);

        DB::transaction(function () use ($role, $user, $tenantId, $auditLogger, $request): void {
            $user->roles()->detach($role->id);
            $user->perm_version = ($user->perm_version ?? 1) + 1;
            $user->save();

            $auditLogger->record(
                action: \App\Core\Audit\AuditAction::Updated,
                auditable: $role,
                before: null,
                after: [
                    'action' => 'user_removed_from_role',
                    'user_id' => $user->id,
                    'user_name' => $user->name,
                    'role_name' => $role->name,
                ],
                actor: $request->user(),
                context: ['tenant_id' => $tenantId],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );
        });

        return response()->json([
            'message' => "User '{$user->name}' removed from '{$role->name}' role.",
        ]);
    }

    private function resolveTenantId(Request $request): ?int
    {
        if (TenantContext::isBound()) {
            return TenantContext::current()->tenantId();
        }

        $user = $request->user();
        if ($user && $user->tenant_id) {
            return (int) $user->tenant_id;
        }

        $attr = $request->attributes->get('tenant_id');
        if ($attr) {
            return (int) $attr;
        }

        return null;
    }
}
