<?php

declare(strict_types=1);

namespace App\Modules\Auth\Controllers;

use App\Core\Audit\AuditAction;
use App\Core\Audit\AuditLogger;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Modules\HR\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class UserController extends Controller
{
    /**
     * List all users for the current tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $query = User::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->with([
                'roles:id,uuid,name,designation,slug,is_system',
                'employee:id,uuid,employee_code,first_name,last_name,display_name,department_id,designation_id,phone,email,employment_status,user_id',
                'employee.department:id,name,code',
                'employee.designation:id,name,code',
                'scopes',
            ]);

        if ($request->filled('search')) {
            $search = '%'.$request->query('search').'%';
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'like', $search)
                    ->orWhere('email', 'like', $search)
                    ->orWhere('phone', 'like', $search)
                    ->orWhereHas('employee', function ($eq) use ($search): void {
                        $eq->where('display_name', 'like', $search)
                            ->orWhere('employee_code', 'like', $search);
                    });
            });
        }

        if ($request->filled('role_id')) {
            $roleId = (int) $request->query('role_id');
            $query->whereHas('roles', fn ($rq) => $rq->where('roles.id', $roleId));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->has('has_employee')) {
            $hasEmployee = $request->boolean('has_employee');
            if ($hasEmployee) {
                $query->has('employee');
            } else {
                $query->doesntHave('employee');
            }
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
                'is_platform_admin' => $user->is_platform_admin,
                'last_login_at' => $user->last_login_at?->toISOString(),
                'last_login_ip' => $user->last_login_ip,
                'roles' => $user->roles->map(fn (Role $r) => [
                    'id' => $r->id,
                    'uuid' => $r->uuid,
                    'name' => $r->name,
                    'designation' => $r->designation,
                    'slug' => $r->slug,
                    'is_system' => (bool) $r->is_system,
                ]),
                'employee' => $user->employee ? [
                    'id' => $user->employee->id,
                    'uuid' => $user->employee->uuid,
                    'employee_code' => $user->employee->employee_code,
                    'display_name' => $user->employee->display_name,
                    'department' => $user->employee->department?->name,
                    'designation' => $user->employee->designation?->name,
                    'employment_status' => $user->employee->employment_status,
                ] : null,
                'default_company_id' => $user->default_company_id,
                'default_branch_id' => $user->default_branch_id,
                'default_factory_id' => $user->default_factory_id,
                'default_warehouse_id' => $user->default_warehouse_id,
                'created_at' => $user->created_at?->toISOString(),
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
     * Store a newly created tenant user.
     */
    public function store(Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $validated = $request->validate([
            'name' => 'required|string|max:191',
            'email' => [
                'required',
                'email',
                'max:191',
                Rule::unique('users')->where(function ($query) use ($tenantId) {
                    return $tenantId ? $query->where('tenant_id', $tenantId) : $query->whereNull('tenant_id');
                }),
            ],
            'password' => 'required|string|min:8',
            'phone' => 'nullable|string|max:32',
            'status' => 'nullable|string|in:active,suspended',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'integer|exists:roles,id',
            'employee_id' => 'nullable|integer|exists:employees,id',
            'default_company_id' => 'nullable|integer',
            'default_branch_id' => 'nullable|integer',
            'default_factory_id' => 'nullable|integer',
            'default_warehouse_id' => 'nullable|integer',
        ]);

        $user = DB::transaction(function () use ($validated, $tenantId, $request, $auditLogger) {
            $user = User::create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'name' => $validated['name'],
                'email' => strtolower(trim($validated['email'])),
                'password' => Hash::make($validated['password']),
                'phone' => $validated['phone'] ?? null,
                'status' => $validated['status'] ?? 'active',
                'token_version' => 1,
                'perm_version' => 1,
                'default_company_id' => $validated['default_company_id'] ?? 1,
                'default_branch_id' => $validated['default_branch_id'] ?? null,
                'default_factory_id' => $validated['default_factory_id'] ?? null,
                'default_warehouse_id' => $validated['default_warehouse_id'] ?? null,
            ]);

            // Attach Roles with tenant_id in pivot
            if (! empty($validated['role_ids'])) {
                $pivotData = [];
                foreach ($validated['role_ids'] as $roleId) {
                    $pivotData[$roleId] = ['tenant_id' => $tenantId];
                }
                $user->roles()->sync($pivotData);
            }

            // Link Employee if specified
            if (! empty($validated['employee_id'])) {
                $employee = Employee::query()
                    ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                    ->findOrFail($validated['employee_id']);

                $employee->update([
                    'user_id' => $user->id,
                    'updated_by' => $request->user()?->id ?? $user->id,
                ]);
            }

            $auditLogger->record(
                action: AuditAction::Created,
                auditable: $user,
                before: null,
                after: [
                    'name' => $user->name,
                    'email' => $user->email,
                    'roles' => $validated['role_ids'] ?? [],
                    'employee_id' => $validated['employee_id'] ?? null,
                ],
                actor: $request->user(),
                context: ['tenant_id' => $tenantId],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );

            return $user;
        });

        $user->load([
            'roles:id,uuid,name,designation,slug,is_system',
            'employee:id,uuid,employee_code,first_name,last_name,display_name,department_id,designation_id',
            'employee.department:id,name',
            'employee.designation:id,name',
        ]);

        return response()->json([
            'message' => "User account for '{$user->name}' created successfully.",
            'data' => $user,
        ], Response::HTTP_CREATED);
    }

    /**
     * Show a specific user profile and role details.
     */
    public function show(int $id, Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $user = User::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->with([
                'roles:id,uuid,name,designation,slug,is_system,description',
                'roles.permissions:id,name,module,resource,action',
                'employee',
                'employee.department',
                'employee.designation',
                'scopes',
            ])
            ->findOrFail($id);

        return response()->json([
            'data' => [
                'id' => $user->id,
                'uuid' => $user->uuid,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'status' => $user->status ?? 'active',
                'is_active' => $user->is_active,
                'is_platform_admin' => $user->is_platform_admin,
                'last_login_at' => $user->last_login_at?->toISOString(),
                'last_login_ip' => $user->last_login_ip,
                'token_version' => $user->token_version,
                'perm_version' => $user->perm_version,
                'roles' => $user->roles,
                'effective_permissions' => $user->getEffectivePermissions(),
                'employee' => $user->employee,
                'default_company_id' => $user->default_company_id,
                'default_branch_id' => $user->default_branch_id,
                'default_factory_id' => $user->default_factory_id,
                'default_warehouse_id' => $user->default_warehouse_id,
                'created_at' => $user->created_at?->toISOString(),
            ],
        ]);
    }

    /**
     * Update user details and role assignments.
     */
    public function update(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $user = User::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:191',
            'email' => [
                'sometimes',
                'required',
                'email',
                'max:191',
                Rule::unique('users')->where(function ($query) use ($tenantId) {
                    return $tenantId ? $query->where('tenant_id', $tenantId) : $query->whereNull('tenant_id');
                })->ignore($user->id),
            ],
            'phone' => 'nullable|string|max:32',
            'status' => 'nullable|string|in:active,suspended',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'integer|exists:roles,id',
            'employee_id' => 'nullable|integer',
            'default_company_id' => 'nullable|integer',
            'default_branch_id' => 'nullable|integer',
            'default_factory_id' => 'nullable|integer',
            'default_warehouse_id' => 'nullable|integer',
        ]);

        $beforeState = [
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'roles' => $user->roles()->pluck('roles.id')->toArray(),
            'employee_id' => $user->employee?->id,
        ];

        DB::transaction(function () use ($user, $validated, $tenantId, $beforeState, $auditLogger, $request): void {
            $user->fill(array_filter([
                'name' => $validated['name'] ?? null,
                'email' => ! empty($validated['email']) ? strtolower(trim($validated['email'])) : null,
                'phone' => array_key_exists('phone', $validated) ? $validated['phone'] : null,
                'status' => $validated['status'] ?? null,
                'default_company_id' => $validated['default_company_id'] ?? null,
                'default_branch_id' => $validated['default_branch_id'] ?? null,
                'default_factory_id' => $validated['default_factory_id'] ?? null,
                'default_warehouse_id' => $validated['default_warehouse_id'] ?? null,
            ], fn ($v) => $v !== null));

            if (isset($validated['role_ids'])) {
                $pivotData = [];
                foreach ($validated['role_ids'] as $roleId) {
                    $pivotData[$roleId] = ['tenant_id' => $tenantId];
                }
                $user->roles()->sync($pivotData);
                $user->perm_version = ($user->perm_version ?? 1) + 1;
            }

            if (isset($validated['status']) && $validated['status'] === 'suspended') {
                $user->token_version = ($user->token_version ?? 1) + 1;
            }

            $user->save();

            // Link or unlink Employee
            if (array_key_exists('employee_id', $validated)) {
                $newEmpId = $validated['employee_id'];
                // Unlink current if changed
                if ($user->employee && $user->employee->id !== $newEmpId) {
                    $user->employee->update(['user_id' => null]);
                }
                if ($newEmpId) {
                    Employee::query()
                        ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                        ->where('id', $newEmpId)
                        ->update(['user_id' => $user->id]);
                }
            }

            $auditLogger->record(
                action: AuditAction::Updated,
                auditable: $user,
                before: $beforeState,
                after: [
                    'name' => $user->name,
                    'email' => $user->email,
                    'status' => $user->status,
                    'roles' => $validated['role_ids'] ?? $beforeState['roles'],
                    'employee_id' => $validated['employee_id'] ?? $beforeState['employee_id'],
                ],
                actor: $request->user(),
                context: ['tenant_id' => $tenantId],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );
        });

        $user->load([
            'roles:id,uuid,name,slug,is_system',
            'employee:id,uuid,employee_code,first_name,last_name,display_name,department_id,designation_id',
            'employee.department:id,name',
            'employee.designation:id,name',
        ]);

        return response()->json([
            'message' => "User '{$user->name}' updated successfully.",
            'data' => $user,
        ]);
    }

    /**
     * Assign or sync roles for a user.
     */
    public function assignRoles(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $user = User::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->findOrFail($id);

        $validated = $request->validate([
            'role_ids' => 'required|array',
            'role_ids.*' => 'integer|exists:roles,id',
        ]);

        $beforeRoles = $user->roles()->pluck('roles.id')->toArray();

        DB::transaction(function () use ($user, $validated, $tenantId, $beforeRoles, $auditLogger, $request): void {
            $pivotData = [];
            foreach ($validated['role_ids'] as $roleId) {
                $pivotData[$roleId] = ['tenant_id' => $tenantId];
            }
            $user->roles()->sync($pivotData);
            $user->perm_version = ($user->perm_version ?? 1) + 1;
            $user->save();

            $auditLogger->record(
                action: AuditAction::Updated,
                auditable: $user,
                before: ['roles' => $beforeRoles],
                after: ['roles' => $validated['role_ids']],
                actor: $request->user(),
                context: ['tenant_id' => $tenantId, 'action' => 'assign_roles'],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );
        });

        $user->load(['roles:id,uuid,name,slug,is_system']);

        return response()->json([
            'message' => 'User roles updated successfully.',
            'data' => [
                'user_id' => $user->id,
                'roles' => $user->roles,
            ],
        ]);
    }

    /**
     * Toggle active/suspended status of user.
     */
    public function toggleStatus(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $user = User::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->findOrFail($id);

        // Cannot suspend self
        if ($request->user() && $request->user()->id === $user->id) {
            throw ValidationException::withMessages([
                'status' => ['You cannot suspend your own account.'],
            ]);
        }

        $newStatus = ($user->status === 'active') ? 'suspended' : 'active';

        $user->status = $newStatus;
        if ($newStatus === 'suspended') {
            $user->token_version = ($user->token_version ?? 1) + 1;
        }
        $user->save();

        $auditLogger->record(
            action: AuditAction::Updated,
            auditable: $user,
            before: ['status' => ($newStatus === 'active') ? 'suspended' : 'active'],
            after: ['status' => $newStatus],
            actor: $request->user(),
            context: ['tenant_id' => $tenantId, 'action' => 'toggle_status'],
            ip: $request->ip(),
            userAgent: $request->userAgent()
        );

        return response()->json([
            'message' => "User status changed to {$newStatus}.",
            'data' => [
                'id' => $user->id,
                'status' => $user->status,
                'is_active' => $user->is_active,
            ],
        ]);
    }

    /**
     * Reset user password by administrator.
     */
    public function resetPassword(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $user = User::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->findOrFail($id);

        $validated = $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user->password = Hash::make($validated['password']);
        $user->token_version = ($user->token_version ?? 1) + 1;
        $user->save();

        $auditLogger->record(
            action: AuditAction::Updated,
            auditable: $user,
            before: null,
            after: ['action' => 'password_reset_by_admin'],
            actor: $request->user(),
            context: ['tenant_id' => $tenantId],
            ip: $request->ip(),
            userAgent: $request->userAgent()
        );

        return response()->json([
            'message' => "Password for '{$user->name}' reset successfully.",
        ]);
    }

    /**
     * Remove / soft-delete a user account within the current tenant.
     */
    public function destroy(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        $user = User::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->findOrFail($id);

        // Cannot delete self
        if ($request->user() && $request->user()->id === $user->id) {
            throw ValidationException::withMessages([
                'user' => ['You cannot delete your own user account.'],
            ]);
        }

        // Cannot delete platform admin
        if ($user->is_platform_admin || $user->is_platform_user) {
            throw ValidationException::withMessages([
                'user' => ['Platform super administrator accounts cannot be deleted here.'],
            ]);
        }

        $userName = $user->name;
        $userEmail = $user->email;

        DB::transaction(function () use ($user, $tenantId, $request, $auditLogger, $userName, $userEmail): void {
            // Unlink from employee if linked
            if ($user->employee) {
                $user->employee->update(['user_id' => null]);
            }

            // Invalidate all tokens and sessions
            $user->refreshTokens()->delete();
            $user->token_version = ($user->token_version ?? 1) + 1;
            $user->status = 'suspended';
            $user->save();

            // Soft-delete user row
            $user->delete();

            $auditLogger->record(
                action: AuditAction::Deleted,
                auditable: $user,
                before: ['name' => $userName, 'email' => $userEmail, 'status' => $user->status],
                after: ['deleted_at' => \Carbon\Carbon::now()->toIso8601String()],
                actor: $request->user(),
                context: ['tenant_id' => $tenantId, 'action' => 'delete_user'],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );
        });

        return response()->json([
            'message' => "User '{$userName}' has been deleted successfully.",
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
