<?php

declare(strict_types=1);

namespace App\Modules\HR\Controllers;

use App\Core\Audit\AuditAction;
use App\Core\Audit\AuditLogger;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\HR\Actions\CreateEmployeeAction;
use App\Modules\HR\Models\Department;
use App\Modules\HR\Models\Designation;
use App\Modules\HR\Models\Employee;
use App\Modules\HR\Models\EmployeeDocument;
use App\Modules\HR\Models\Shift;
use App\Modules\HR\Models\ShiftAssignment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Throwable;

class EmployeeController extends Controller
{
    public function __construct(
        private readonly CreateEmployeeAction $createEmployeeAction
    ) {}

    public function departments(Request $request): JsonResponse
    {
        $departments = Department::query()
            ->when($request->boolean('active_only', false), fn ($q) => $q->where('is_active', true))
            ->withCount('employees')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $departments,
        ]);
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:32',
            'name' => 'required|string|max:100',
            'company_id' => 'nullable|integer',
            'head_employee_id' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $department = Department::create([
            'code' => strtoupper($validated['code']),
            'name' => $validated['name'],
            'company_id' => $validated['company_id'] ?? 1,
            'head_employee_id' => $validated['head_employee_id'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);

        return response()->json([
            'data' => $department,
            'message' => 'Department created successfully.',
        ], 201);
    }

    public function updateDepartment(int $id, Request $request): JsonResponse
    {
        $department = Department::findOrFail($id);

        $validated = $request->validate([
            'code' => 'nullable|string|max:32',
            'name' => 'nullable|string|max:100',
            'is_active' => 'nullable|boolean',
        ]);

        $department->update([
            ...$validated,
            'updated_by' => (int) ($request->user()?->id ?? 1),
        ]);

        return response()->json([
            'data' => $department,
            'message' => 'Department updated successfully.',
        ]);
    }

    public function designations(Request $request): JsonResponse
    {
        $designations = Designation::query()
            ->when($request->boolean('active_only', false), fn ($q) => $q->where('is_active', true))
            ->withCount('employees')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $designations,
        ]);
    }

    public function storeDesignation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:32',
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $designation = Designation::create([
            'code' => strtoupper($validated['code']),
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);

        return response()->json([
            'data' => $designation,
            'message' => 'Designation created successfully.',
        ], 201);
    }

    public function updateDesignation(int $id, Request $request): JsonResponse
    {
        $designation = Designation::findOrFail($id);

        $validated = $request->validate([
            'code' => 'nullable|string|max:32',
            'name' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $designation->update([
            ...$validated,
            'updated_by' => (int) ($request->user()?->id ?? 1),
        ]);

        return response()->json([
            'data' => $designation,
            'message' => 'Designation updated successfully.',
        ]);
    }

    public function shifts(Request $request): JsonResponse
    {
        $shifts = Shift::query()
            ->when($request->boolean('active_only', false), fn ($q) => $q->where('is_active', true))
            ->withCount('employees')
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'data' => $shifts,
        ]);
    }

    public function storeShift(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:32',
            'name' => 'required|string|max:100',
            'start_time' => 'required|string',
            'end_time' => 'required|string',
            'break_minutes' => 'nullable|integer|min:0',
            'grace_in_minutes' => 'nullable|integer|min:0',
            'grace_out_minutes' => 'nullable|integer|min:0',
            'crosses_midnight' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $shift = Shift::create([
            'code' => strtoupper($validated['code']),
            'name' => $validated['name'],
            'start_time' => $validated['start_time'],
            'end_time' => $validated['end_time'],
            'break_minutes' => $validated['break_minutes'] ?? 45,
            'grace_in_minutes' => $validated['grace_in_minutes'] ?? 15,
            'grace_out_minutes' => $validated['grace_out_minutes'] ?? 15,
            'half_day_threshold_minutes' => 240,
            'crosses_midnight' => $validated['crosses_midnight'] ?? false,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);

        return response()->json([
            'data' => $shift,
            'message' => 'Shift schedule created successfully.',
        ], 201);
    }

    public function updateShift(int $id, Request $request): JsonResponse
    {
        $shift = Shift::findOrFail($id);

        $validated = $request->validate([
            'code' => 'nullable|string|max:32',
            'name' => 'nullable|string|max:100',
            'start_time' => 'nullable|string',
            'end_time' => 'nullable|string',
            'grace_in_minutes' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $shift->update([
            ...$validated,
            'updated_by' => (int) ($request->user()?->id ?? 1),
        ]);

        return response()->json([
            'data' => $shift,
            'message' => 'Shift schedule updated successfully.',
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Employee::query()->with([
            'department:id,name,code',
            'designation:id,name,code',
            'defaultShift:id,name,code',
            'branch:id,name,code',
            'user:id,name,email,status',
            'user.roles:id,name,slug',
        ]);

        if ($request->filled('search')) {
            $search = '%'.$request->query('search').'%';
            $query->where(function ($q) use ($search): void {
                $q->where('first_name', 'like', $search)
                    ->orWhere('last_name', 'like', $search)
                    ->orWhere('display_name', 'like', $search)
                    ->orWhere('employee_code', 'like', $search)
                    ->orWhere('email', 'like', $search);
            });
        }

        if ($request->filled('employment_type')) {
            $query->where('employment_type', $request->query('employment_type'));
        }

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->query('department_id'));
        }

        if ($request->filled('employment_status')) {
            $query->where('employment_status', $request->query('employment_status'));
        }

        $employees = $query->orderBy('display_name')->get()->map(function ($emp) {
            return [
                'id' => $emp->id,
                'uuid' => $emp->uuid,
                'employee_code' => $emp->employee_code,
                'user_id' => $emp->user_id,
                'has_user_account' => ! is_null($emp->user_id),
                'first_name' => $emp->first_name,
                'last_name' => $emp->last_name ?? '',
                'full_name' => $emp->display_name ?: trim("{$emp->first_name} {$emp->last_name}"),
                'display_name' => $emp->display_name ?: trim("{$emp->first_name} {$emp->last_name}"),
                'email' => $emp->email,
                'phone' => $emp->phone,
                'employment_type' => $emp->employment_type,
                'designation' => $emp->designation?->name,
                'department' => $emp->department?->name,
                'department_id' => $emp->department_id,
                'shift' => $emp->defaultShift?->name,
                'status' => $emp->employment_status ?? 'active',
                'date_of_joining' => $emp->date_of_joining,
                'bank_name' => $emp->bank_name,
                'bank_account_number' => $emp->bank_account_number,
                'mobile_wallet_number' => $emp->mobile_wallet_number,
                'national_id' => $emp->national_id,
                'user' => $emp->user ? [
                    'id' => $emp->user->id,
                    'name' => $emp->user->name,
                    'email' => $emp->user->email,
                    'status' => $emp->user->status ?? 'active',
                ] : null,
                'roles' => $emp->user ? $emp->user->roles->map(fn ($r) => [
                    'id' => $r->id,
                    'name' => $r->name,
                    'slug' => $r->slug,
                ]) : [],
                'primary_role' => $emp->user?->roles->first()?->name,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $employees,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'nullable|integer',
            'branch_id' => 'nullable|integer',
            'factory_id' => 'nullable|integer',
            'department_id' => 'nullable|integer',
            'designation_id' => 'nullable|integer',
            'first_name' => 'required|string|max:100',
            'last_name' => 'nullable|string|max:100',
            'phone' => 'required|string|max:32',
            'email' => 'nullable|email|max:191',
            'employment_type' => 'nullable|string|in:permanent,contract,daily_wage,piece_rate,probation',
            'employment_status' => 'nullable|string|in:active,on_leave,suspended,resigned,terminated',
            'default_shift_id' => 'nullable|integer',
            'salary_structure_id' => 'nullable|integer',
            'date_of_joining' => 'nullable|date',
            'national_id' => 'nullable|string|max:64',
            'bank_name' => 'nullable|string|max:100',
            'bank_account_number' => 'nullable|string|max:64',
            'mobile_wallet_number' => 'nullable|string|max:32',
            'grant_user_access' => 'nullable|boolean',
            'user_password' => 'nullable|string|min:8',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'integer|exists:roles,id',
            'user_id' => 'nullable|integer|exists:users,id',
        ]);

        $validated['company_id'] = $validated['company_id'] ?? 1;
        $validated['tenant_id'] = $request->user()?->tenant_id ?? 1;

        $userId = (int) ($request->user()?->id ?? 1);
        $employee = $this->createEmployeeAction->execute($validated, $userId);

        return response()->json([
            'data' => $employee->load(['department', 'designation', 'defaultShift', 'branch', 'user.roles']),
            'message' => 'Employee onboarded successfully.',
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $employee = Employee::with([
            'department',
            'designation',
            'defaultShift',
            'branch',
            'user.roles',
            'salaryStructure.components.component',
        ])->findOrFail($id);

        return response()->json([
            'data' => $employee,
        ]);
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $employee = Employee::findOrFail($id);

        $validated = $request->validate([
            'first_name' => 'nullable|string|max:100',
            'last_name' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:32',
            'email' => 'nullable|email|max:191',
            'department_id' => 'nullable|integer',
            'designation_id' => 'nullable|integer',
            'default_shift_id' => 'nullable|integer',
            'salary_structure_id' => 'nullable|integer',
            'employment_type' => 'nullable|string|in:permanent,contract,daily_wage,piece_rate,probation',
            'employment_status' => 'nullable|string|in:active,on_leave,suspended,resigned,terminated',
            'bank_name' => 'nullable|string|max:100',
            'bank_account_number' => 'nullable|string|max:64',
            'mobile_wallet_number' => 'nullable|string|max:32',
            'national_id' => 'nullable|string|max:64',
            'user_id' => 'nullable|integer|exists:users,id',
        ]);

        $employee->update([
            ...$validated,
            'updated_by' => (int) ($request->user()?->id ?? 1),
        ]);

        return response()->json([
            'data' => $employee->load(['department', 'designation', 'defaultShift', 'branch', 'user.roles']),
            'message' => 'Employee profile updated successfully.',
        ]);
    }

    public function toggleStatus(int $id): JsonResponse
    {
        $employee = Employee::with('user')->findOrFail($id);
        $newStatus = ($employee->employment_status === 'active') ? 'terminated' : 'active';
        $employee->update([
            'employment_status' => $newStatus,
            'is_active' => ($newStatus === 'active') ? 1 : 0,
            'updated_by' => Auth::id() ?? 1,
        ]);

        // Security cascade: if employee is terminated, suspend user login and invalidate sessions immediately
        if ($employee->user) {
            $userStatus = ($newStatus === 'active') ? 'active' : 'suspended';
            $employee->user->update([
                'status' => $userStatus,
                'token_version' => ($employee->user->token_version ?? 1) + 1,
            ]);
        }

        return response()->json([
            'data' => $employee->load(['user.roles']),
            'message' => "Employee status changed to {$newStatus}.",
        ]);
    }

    /**
     * Provision a user login account and assign roles for an existing employee.
     */
    public function provisionUser(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $employee = Employee::with('user')->findOrFail($id);

        if ($employee->user_id || $employee->user) {
            return response()->json([
                'message' => 'Employee already has a system user account.',
            ], 422);
        }

        $validated = $request->validate([
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role_ids' => 'required|array',
            'role_ids.*' => 'integer|exists:roles,id',
        ]);

        $tenantId = $employee->tenant_id ?? (int) ($request->user()?->tenant_id ?? 1);

        $user = DB::transaction(function () use ($employee, $validated, $tenantId, $auditLogger, $request) {
            $user = User::create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'name' => $employee->display_name ?: trim("{$employee->first_name} {$employee->last_name}"),
                'email' => strtolower(trim($validated['email'])),
                'password' => Hash::make($validated['password']),
                'phone' => $employee->phone,
                'status' => 'active',
                'token_version' => 1,
                'perm_version' => 1,
                'default_company_id' => $employee->company_id ?? 1,
                'default_branch_id' => $employee->branch_id,
                'default_factory_id' => $employee->factory_id,
            ]);

            $pivotData = [];
            foreach ($validated['role_ids'] as $roleId) {
                $pivotData[$roleId] = ['tenant_id' => $tenantId];
            }
            $user->roles()->sync($pivotData);

            $employee->update([
                'user_id' => $user->id,
                'email' => $user->email,
                'updated_by' => (int) ($request->user()?->id ?? 1),
            ]);

            $auditLogger->record(
                action: AuditAction::Created,
                auditable: $user,
                before: null,
                after: [
                    'action' => 'provisioned_for_employee',
                    'employee_id' => $employee->id,
                    'roles' => $validated['role_ids'],
                ],
                actor: $request->user(),
                context: ['tenant_id' => $tenantId],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );

            return $user;
        });

        return response()->json([
            'message' => "User account provisioned and roles assigned for '{$employee->display_name}'.",
            'data' => $employee->load(['user.roles', 'department', 'designation']),
        ], 201);
    }

    /**
     * Update the assigned roles for an employee's user account.
     */
    public function updateRoles(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $employee = Employee::with('user')->findOrFail($id);

        if (! $employee->user) {
            return response()->json([
                'message' => 'Employee does not have an active system user account.',
            ], 422);
        }

        $validated = $request->validate([
            'role_ids' => 'required|array',
            'role_ids.*' => 'integer|exists:roles,id',
        ]);

        $tenantId = $employee->tenant_id ?? (int) ($request->user()?->tenant_id ?? 1);

        DB::transaction(function () use ($employee, $validated, $tenantId, $auditLogger, $request): void {
            $pivotData = [];
            foreach ($validated['role_ids'] as $roleId) {
                $pivotData[$roleId] = ['tenant_id' => $tenantId];
            }
            $employee->user->roles()->sync($pivotData);
            $employee->user->perm_version = ($employee->user->perm_version ?? 1) + 1;
            $employee->user->save();

            $auditLogger->record(
                action: AuditAction::Updated,
                auditable: $employee->user,
                before: null,
                after: [
                    'action' => 'employee_roles_updated',
                    'employee_id' => $employee->id,
                    'roles' => $validated['role_ids'],
                ],
                actor: $request->user(),
                context: ['tenant_id' => $tenantId],
                ip: $request->ip(),
                userAgent: $request->userAgent()
            );
        });

        return response()->json([
            'message' => "Roles updated for '{$employee->display_name}'.",
            'data' => $employee->load(['user.roles']),
        ]);
    }

    /**
     * Link an existing user account to this employee.
     */
    public function linkUser(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $employee = Employee::findOrFail($id);

        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $tenantId = $employee->tenant_id ?? (int) ($request->user()?->tenant_id ?? 1);
        $user = User::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->findOrFail($validated['user_id']);

        $employee->update([
            'user_id' => $user->id,
            'updated_by' => (int) ($request->user()?->id ?? 1),
        ]);

        $auditLogger->record(
            action: AuditAction::Updated,
            auditable: $employee,
            before: null,
            after: [
                'action' => 'linked_user_account',
                'user_id' => $user->id,
            ],
            actor: $request->user(),
            context: ['tenant_id' => $tenantId],
            ip: $request->ip(),
            userAgent: $request->userAgent()
        );

        return response()->json([
            'message' => "User account '{$user->name}' linked to '{$employee->display_name}'.",
            'data' => $employee->load(['user.roles', 'department', 'designation']),
        ]);
    }

    /**
     * Unlink user account from this employee.
     */
    public function unlinkUser(int $id, Request $request, AuditLogger $auditLogger): JsonResponse
    {
        $employee = Employee::findOrFail($id);

        $prevUserId = $employee->user_id;
        $employee->update([
            'user_id' => null,
            'updated_by' => (int) ($request->user()?->id ?? 1),
        ]);

        $auditLogger->record(
            action: AuditAction::Updated,
            auditable: $employee,
            before: ['user_id' => $prevUserId],
            after: ['user_id' => null],
            actor: $request->user(),
            context: ['tenant_id' => $employee->tenant_id],
            ip: $request->ip(),
            userAgent: $request->userAgent()
        );

        return response()->json([
            'message' => "User account unlinked from '{$employee->display_name}'.",
            'data' => $employee->load(['department', 'designation']),
        ]);
    }

    public function documents(int $id): JsonResponse
    {
        $documents = EmployeeDocument::where('employee_id', $id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $documents,
        ]);
    }

    public function storeDocument(int $id, Request $request): JsonResponse
    {
        $employee = Employee::findOrFail($id);

        $validated = $request->validate([
            'document_type' => 'required|string|in:nid,contract,certificate,photo,health_pass,other',
            'notes' => 'nullable|string',
            'issued_on' => 'nullable|date',
            'expires_on' => 'nullable|date',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $doc = EmployeeDocument::create([
            'employee_id' => $employee->id,
            'document_type' => $validated['document_type'],
            'attachment_id' => 1, // Fallback/default attachment link
            'issued_on' => $validated['issued_on'] ?? null,
            'expires_on' => $validated['expires_on'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);

        return response()->json([
            'data' => $doc,
            'message' => 'Document registered to employee profile.',
        ], 201);
    }

    public function destroy(int $id): JsonResponse
    {
        $employee = Employee::with('user')->findOrFail($id);

        DB::transaction(function () use ($employee): void {
            if ($employee->user) {
                $employee->user->update(['status' => 'suspended']);
            }
            $employee->delete();
        });

        return response()->json([
            'success' => true,
            'message' => "Employee '{$employee->display_name}' deleted successfully.",
        ]);
    }

    public function bulkDelete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
        ]);

        $ids = array_map('intval', $validated['ids']);
        $count = 0;

        DB::transaction(function () use ($ids, &$count): void {
            $employees = Employee::with('user')->whereIn('id', $ids)->get();
            foreach ($employees as $employee) {
                /** @var Employee $employee */
                if ($employee->user) {
                    $employee->user->update(['status' => 'suspended']);
                }
                $employee->delete();
                $count++;
            }
        });

        return response()->json([
            'success' => true,
            'message' => "Successfully deleted {$count} employee records.",
        ]);
    }

    public function bulkStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
            'status' => 'required|string|in:active,terminated,on_leave,suspended,resigned',
        ]);

        $ids = array_map('intval', $validated['ids']);
        $status = (string) $validated['status'];
        $isActive = ($status === 'active') ? 1 : 0;
        $userId = is_numeric(Auth::id()) ? (int) Auth::id() : 1;

        DB::transaction(function () use ($ids, $status, $isActive, $userId): void {
            Employee::whereIn('id', $ids)->update([
                'employment_status' => $status,
                'is_active' => $isActive,
                'updated_by' => $userId,
            ]);

            if ($status !== 'active') {
                $userIds = Employee::whereIn('id', $ids)->whereNotNull('user_id')->pluck('user_id');
                User::whereIn('id', $userIds)->update(['status' => 'suspended']);
            }
        });

        return response()->json([
            'success' => true,
            'message' => "Status updated to '{$status}' for ".count($ids).' employees.',
        ]);
    }

    public function destroyDepartment(int $id): JsonResponse
    {
        $department = Department::withCount('employees')->findOrFail($id);
        if ($department->employees_count > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete department '{$department->name}' because it has {$department->employees_count} assigned employees.",
            ], 422);
        }

        $department->delete();

        return response()->json([
            'success' => true,
            'message' => "Department '{$department->name}' deleted successfully.",
        ]);
    }

    public function bulkDeleteDepartments(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
        ]);

        $ids = array_map('intval', $validated['ids']);
        $departments = Department::withCount('employees')->whereIn('id', $ids)->get();
        $deleted = 0;

        foreach ($departments as $dept) {
            /** @var Department $dept */
            if ($dept->employees_count === 0) {
                $dept->delete();
                $deleted++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Deleted {$deleted} departments.",
        ]);
    }

    public function destroyDesignation(int $id): JsonResponse
    {
        $designation = Designation::withCount('employees')->findOrFail($id);
        if ($designation->employees_count > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete designation '{$designation->name}' because it has {$designation->employees_count} assigned employees.",
            ], 422);
        }

        $designation->delete();

        return response()->json([
            'success' => true,
            'message' => "Designation '{$designation->name}' deleted successfully.",
        ]);
    }

    public function bulkDeleteDesignations(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
        ]);

        $ids = array_map('intval', $validated['ids']);
        $designations = Designation::withCount('employees')->whereIn('id', $ids)->get();
        $deleted = 0;

        foreach ($designations as $des) {
            /** @var Designation $des */
            if ($des->employees_count === 0) {
                $des->delete();
                $deleted++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Deleted {$deleted} designations.",
        ]);
    }

    public function destroyShift(int $id): JsonResponse
    {
        $shift = Shift::findOrFail($id);
        $shift->delete();

        return response()->json([
            'success' => true,
            'message' => "Shift '{$shift->name}' deleted successfully.",
        ]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mode' => 'nullable|string|in:skip,upsert',
            'rows' => 'required|array|min:1|max:5000',
            'rows.*.employee_code' => 'nullable|string|max:64',
            'rows.*.first_name' => 'required|string|max:100',
            'rows.*.last_name' => 'nullable|string|max:100',
            'rows.*.phone' => 'required|string|max:32',
            'rows.*.email' => 'nullable|string|max:191',
            'rows.*.department' => 'nullable|string|max:100',
            'rows.*.designation' => 'nullable|string|max:100',
            'rows.*.shift' => 'nullable|string|max:100',
            'rows.*.employment_type' => 'nullable|string|max:32',
            'rows.*.employment_status' => 'nullable|string|max:32',
            'rows.*.date_of_joining' => 'nullable|string|max:32',
            'rows.*.national_id' => 'nullable|string|max:64',
            'rows.*.bank_name' => 'nullable|string|max:100',
            'rows.*.bank_account_number' => 'nullable|string|max:64',
            'rows.*.mobile_wallet_number' => 'nullable|string|max:64',
        ]);

        $mode = $validated['mode'] ?? 'skip';
        $rows = $validated['rows'];
        $tenantId = (int) ($request->user()?->tenant_id ?? 1);
        $userId = (int) ($request->user()?->id ?? 1);

        // Preload reference maps for tenant
        $departments = Department::where('is_active', true)->get();
        $deptMap = [];
        foreach ($departments as $d) {
            $deptMap[strtolower(trim($d->name))] = $d->id;
            $deptMap[strtolower(trim($d->code))] = $d->id;
        }

        $designations = Designation::where('is_active', true)->get();
        $desigMap = [];
        foreach ($designations as $ds) {
            $desigMap[strtolower(trim($ds->name))] = $ds->id;
            $desigMap[strtolower(trim($ds->code))] = $ds->id;
        }

        $shifts = Shift::where('is_active', true)->get();
        $shiftMap = [];
        foreach ($shifts as $s) {
            $shiftMap[strtolower(trim($s->name))] = $s->id;
            $shiftMap[strtolower(trim($s->code))] = $s->id;
        }

        // Cache existing employees by code, email, phone
        $existingEmployees = Employee::all();
        $empCodeMap = [];
        $empPhoneMap = [];
        $empEmailMap = [];
        foreach ($existingEmployees as $e) {
            if ($e->employee_code) {
                $empCodeMap[strtolower(trim($e->employee_code))] = $e;
            }
            if ($e->phone) {
                $empPhoneMap[preg_replace('/[^0-9]/', '', $e->phone)] = $e;
            }
            if ($e->email) {
                $empEmailMap[strtolower(trim($e->email))] = $e;
            }
        }

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Process in chunks inside transactions
        foreach (array_chunk($rows, 100) as $chunkIdx => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIdx,
                $mode,
                $tenantId,
                $userId,
                &$deptMap,
                &$desigMap,
                &$shiftMap,
                &$empCodeMap,
                &$empPhoneMap,
                &$empEmailMap,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $relIdx => $row) {
                    $rowNum = ($chunkIdx * 100) + $relIdx + 2;
                    $code = ! empty($row['employee_code']) ? trim((string) $row['employee_code']) : null;
                    $phone = trim((string) $row['phone']);
                    $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
                    $email = ! empty($row['email']) ? strtolower(trim((string) $row['email'])) : null;

                    // Check if employee already exists
                    $existing = null;
                    if ($code && isset($empCodeMap[strtolower($code)])) {
                        $existing = $empCodeMap[strtolower($code)];
                    } elseif ($cleanPhone && isset($empPhoneMap[$cleanPhone])) {
                        $existing = $empPhoneMap[$cleanPhone];
                    } elseif ($email && isset($empEmailMap[$email])) {
                        $existing = $empEmailMap[$email];
                    }

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        // Mode is upsert
                        try {
                            $updateData = [
                                'first_name' => $row['first_name'],
                                'last_name' => $row['last_name'] ?? $existing->last_name,
                                'display_name' => trim($row['first_name'].' '.($row['last_name'] ?? '')),
                                'updated_by' => $userId,
                            ];
                            if (! empty($row['employment_type'])) {
                                $updateData['employment_type'] = $row['employment_type'];
                            }
                            if (! empty($row['employment_status'])) {
                                $updateData['employment_status'] = $row['employment_status'];
                            }
                            if (! empty($row['national_id'])) {
                                $updateData['national_id'] = $row['national_id'];
                            }
                            if (! empty($row['bank_name'])) {
                                $updateData['bank_name'] = $row['bank_name'];
                            }
                            if (! empty($row['bank_account_number'])) {
                                $updateData['bank_account_number'] = $row['bank_account_number'];
                            }
                            if (! empty($row['mobile_wallet_number'])) {
                                $updateData['mobile_wallet_number'] = $row['mobile_wallet_number'];
                            }

                            $existing->update($updateData);
                            $updated++;

                            continue;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'employee_code',
                                'value' => $code,
                                'message' => 'Update failed: '.$e->getMessage(),
                            ];

                            continue;
                        }
                    }

                    // Resolve Department
                    $deptId = null;
                    if (! empty($row['department'])) {
                        $deptKey = strtolower(trim((string) $row['department']));
                        if (isset($deptMap[$deptKey])) {
                            $deptId = $deptMap[$deptKey];
                        } else {
                            // Auto-create department
                            $newDept = Department::create([
                                'tenant_id' => $tenantId,
                                'code' => strtoupper(substr((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $row['department']), 0, 10)) ?: 'DEPT',
                                'name' => trim((string) $row['department']),
                                'company_id' => 1,
                                'is_active' => true,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $deptId = $newDept->id;
                            $deptMap[$deptKey] = $deptId;
                            $deptMap[strtolower($newDept->code)] = $deptId;
                        }
                    }

                    // Resolve Designation
                    $desigId = null;
                    if (! empty($row['designation'])) {
                        $desigKey = strtolower(trim((string) $row['designation']));
                        if (isset($desigMap[$desigKey])) {
                            $desigId = $desigMap[$desigKey];
                        } else {
                            // Auto-create designation
                            $newDesig = Designation::create([
                                'tenant_id' => $tenantId,
                                'code' => strtoupper(substr((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $row['designation']), 0, 10)) ?: 'DESIG',
                                'name' => trim((string) $row['designation']),
                                'company_id' => 1,
                                'is_active' => true,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $desigId = $newDesig->id;
                            $desigMap[$desigKey] = $desigId;
                            $desigMap[strtolower($newDesig->code)] = $desigId;
                        }
                    }

                    // Resolve Shift
                    $shiftId = null;
                    if (! empty($row['shift'])) {
                        $shiftKey = strtolower(trim((string) $row['shift']));
                        if (isset($shiftMap[$shiftKey])) {
                            $shiftId = $shiftMap[$shiftKey];
                        }
                    }

                    // Generate employee code if missing
                    if (! $code) {
                        $code = 'EMP-'.str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT);
                    }

                    try {
                        $newEmp = Employee::create([
                            'tenant_id' => $tenantId,
                            'employee_code' => $code,
                            'company_id' => 1,
                            'department_id' => $deptId,
                            'designation_id' => $desigId,
                            'default_shift_id' => $shiftId,
                            'first_name' => $row['first_name'],
                            'last_name' => $row['last_name'] ?? null,
                            'display_name' => trim($row['first_name'].' '.($row['last_name'] ?? '')),
                            'phone' => $phone,
                            'email' => $email,
                            'employment_type' => $row['employment_type'] ?? 'permanent',
                            'employment_status' => $row['employment_status'] ?? 'active',
                            'date_of_joining' => $row['date_of_joining'] ?? date('Y-m-d'),
                            'national_id' => $row['national_id'] ?? null,
                            'bank_name' => $row['bank_name'] ?? null,
                            'bank_account_number' => $row['bank_account_number'] ?? null,
                            'mobile_wallet_number' => $row['mobile_wallet_number'] ?? null,
                            'is_active' => ($row['employment_status'] ?? 'active') === 'active',
                            'created_by' => $userId,
                            'updated_by' => $userId,
                        ]);

                        $empCodeMap[strtolower($code)] = $newEmp;
                        if ($cleanPhone) {
                            $empPhoneMap[$cleanPhone] = $newEmp;
                        }
                        if ($email) {
                            $empEmailMap[$email] = $newEmp;
                        }

                        $imported++;
                    } catch (Throwable $e) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'employee_code',
                            'value' => $code,
                            'message' => 'Creation failed: '.$e->getMessage(),
                        ];
                    }
                }
            });
        }

        return response()->json([
            'success' => count($errors) === 0 || $imported > 0 || $updated > 0,
            'total' => count($rows),
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'failed' => count($errors),
            'errors' => $errors,
            'message' => "Import completed: {$imported} added, {$updated} updated, {$skipped} skipped, ".count($errors).' failed.',
        ]);
    }

    public function bulkImportDepartments(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id() ? (int) Auth::id() : 1;

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['required', 'array'],
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $existingDepts = Department::query()->where('tenant_id', $tenantId)->get();
        $codeMap = [];
        $nameMap = [];
        foreach ($existingDepts as $d) {
            $codeMap[strtolower((string) $d->code)] = $d;
            $nameMap[strtolower((string) $d->name)] = $d;
        }

        $chunks = array_chunk($rows, 100);
        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use ($chunk, $chunkIndex, $tenantId, $userId, $mode, &$codeMap, &$nameMap, &$imported, &$updated, &$skipped, &$errors): void {
                foreach ($chunk as $index => $row) {
                    $rowNum = ($chunkIndex * 100) + $index + 1;
                    $name = trim((string) ($row['name'] ?? $row['department_name'] ?? ''));
                    $code = trim((string) ($row['code'] ?? $row['department_code'] ?? ''));
                    $costCenter = isset($row['cost_center_code']) && trim((string) $row['cost_center_code']) !== '' ? trim((string) $row['cost_center_code']) : null;
                    $isActive = isset($row['is_active']) ? (bool) $row['is_active'] : true;

                    if ($name === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'name',
                            'value' => '',
                            'message' => 'Department name is required.',
                        ];

                        continue;
                    }

                    if ($code === '') {
                        $code = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 10)) ?: 'DEPT';
                    }

                    $existing = $codeMap[strtolower($code)] ?? ($nameMap[strtolower($name)] ?? null);

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        try {
                            $existing->update([
                                'name' => $name,
                                'cost_center_code' => $costCenter ?? $existing->cost_center_code,
                                'is_active' => $isActive,
                                'updated_by' => $userId,
                            ]);
                            $updated++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'name',
                                'value' => $name,
                                'message' => 'Update failed: '.$e->getMessage(),
                            ];
                        }
                    } else {
                        try {
                            $dept = Department::create([
                                'tenant_id' => $tenantId,
                                'company_id' => 1,
                                'uuid' => (string) Str::uuid(),
                                'code' => strtoupper($code),
                                'name' => $name,
                                'cost_center_code' => $costCenter,
                                'is_active' => $isActive,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $codeMap[strtolower($dept->code)] = $dept;
                            $nameMap[strtolower($dept->name)] = $dept;
                            $imported++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'name',
                                'value' => $name,
                                'message' => 'Creation failed: '.$e->getMessage(),
                            ];
                        }
                    }
                }
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'imported' => $imported,
                'updated' => $updated,
                'skipped' => $skipped,
                'failed' => count($errors),
                'errors' => $errors,
            ],
        ]);
    }

    public function bulkImportDesignations(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id() ? (int) Auth::id() : 1;

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['required', 'array'],
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $existing = Designation::query()->where('tenant_id', $tenantId)->get();
        $codeMap = [];
        $nameMap = [];
        foreach ($existing as $d) {
            $codeMap[strtolower((string) $d->code)] = $d;
            $nameMap[strtolower((string) $d->name)] = $d;
        }

        $chunks = array_chunk($rows, 100);
        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use ($chunk, $chunkIndex, $tenantId, $userId, $mode, &$codeMap, &$nameMap, &$imported, &$updated, &$skipped, &$errors): void {
                foreach ($chunk as $index => $row) {
                    $rowNum = ($chunkIndex * 100) + $index + 1;
                    $name = trim((string) ($row['name'] ?? $row['designation_name'] ?? ''));
                    $code = trim((string) ($row['code'] ?? $row['designation_code'] ?? ''));
                    $grade = isset($row['grade']) && trim((string) $row['grade']) !== '' ? trim((string) $row['grade']) : null;
                    $isActive = isset($row['is_active']) ? (bool) $row['is_active'] : true;

                    if ($name === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'name',
                            'value' => '',
                            'message' => 'Designation name is required.',
                        ];

                        continue;
                    }

                    if ($code === '') {
                        $code = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 10)) ?: 'DESIG';
                    }

                    $desig = $codeMap[strtolower($code)] ?? ($nameMap[strtolower($name)] ?? null);

                    if ($desig) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        try {
                            $desig->update([
                                'name' => $name,
                                'grade' => $grade ?? $desig->grade,
                                'is_active' => $isActive,
                                'updated_by' => $userId,
                            ]);
                            $updated++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'name',
                                'value' => $name,
                                'message' => 'Update failed: '.$e->getMessage(),
                            ];
                        }
                    } else {
                        try {
                            $newDes = Designation::create([
                                'tenant_id' => $tenantId,
                                'uuid' => (string) Str::uuid(),
                                'code' => strtoupper($code),
                                'name' => $name,
                                'grade' => $grade,
                                'is_active' => $isActive,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $codeMap[strtolower($newDes->code)] = $newDes;
                            $nameMap[strtolower($newDes->name)] = $newDes;
                            $imported++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'name',
                                'value' => $name,
                                'message' => 'Creation failed: '.$e->getMessage(),
                            ];
                        }
                    }
                }
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'imported' => $imported,
                'updated' => $updated,
                'skipped' => $skipped,
                'failed' => count($errors),
                'errors' => $errors,
            ],
        ]);
    }

    public function bulkImportShifts(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id() ? (int) Auth::id() : 1;

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['required', 'array'],
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $existing = Shift::query()->where('tenant_id', $tenantId)->get();
        $codeMap = [];
        $nameMap = [];
        foreach ($existing as $s) {
            $codeMap[strtolower((string) $s->code)] = $s;
            $nameMap[strtolower((string) $s->name)] = $s;
        }

        $chunks = array_chunk($rows, 100);
        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use ($chunk, $chunkIndex, $tenantId, $userId, $mode, &$codeMap, &$nameMap, &$imported, &$updated, &$skipped, &$errors): void {
                foreach ($chunk as $index => $row) {
                    $rowNum = ($chunkIndex * 100) + $index + 1;
                    $code = trim((string) ($row['code'] ?? $row['shift_code'] ?? ''));
                    $name = trim((string) ($row['name'] ?? $row['shift_name'] ?? ''));
                    $startTime = trim((string) ($row['start_time'] ?? $row['start'] ?? ''));
                    $endTime = trim((string) ($row['end_time'] ?? $row['end'] ?? ''));
                    $breakMin = isset($row['break_minutes']) ? (int) $row['break_minutes'] : 45;
                    $graceIn = isset($row['grace_in_minutes']) ? (int) $row['grace_in_minutes'] : 15;
                    $crossesMidnight = isset($row['crosses_midnight']) ? (bool) $row['crosses_midnight'] : false;
                    $isActive = isset($row['is_active']) ? (bool) $row['is_active'] : true;

                    if ($name === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'name',
                            'value' => '',
                            'message' => 'Shift name is required.',
                        ];

                        continue;
                    }

                    if ($startTime === '' || $endTime === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'start_time',
                            'value' => "{$startTime} - {$endTime}",
                            'message' => 'Shift start and end times are required.',
                        ];

                        continue;
                    }

                    if ($code === '') {
                        $code = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 10)) ?: 'SHIFT';
                    }

                    $shift = $codeMap[strtolower($code)] ?? ($nameMap[strtolower($name)] ?? null);

                    if ($shift) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        try {
                            $shift->update([
                                'name' => $name,
                                'start_time' => $startTime,
                                'end_time' => $endTime,
                                'break_minutes' => $breakMin,
                                'grace_in_minutes' => $graceIn,
                                'crosses_midnight' => $crossesMidnight,
                                'is_active' => $isActive,
                                'updated_by' => $userId,
                            ]);
                            $updated++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'code',
                                'value' => $code,
                                'message' => 'Update failed: '.$e->getMessage(),
                            ];
                        }
                    } else {
                        try {
                            $newShift = Shift::create([
                                'tenant_id' => $tenantId,
                                'uuid' => (string) Str::uuid(),
                                'code' => strtoupper($code),
                                'name' => $name,
                                'start_time' => $startTime,
                                'end_time' => $endTime,
                                'break_minutes' => $breakMin,
                                'grace_in_minutes' => $graceIn,
                                'crosses_midnight' => $crossesMidnight,
                                'is_active' => $isActive,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $codeMap[strtolower($newShift->code)] = $newShift;
                            $nameMap[strtolower($newShift->name)] = $newShift;
                            $imported++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'code',
                                'value' => $code,
                                'message' => 'Creation failed: '.$e->getMessage(),
                            ];
                        }
                    }
                }
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'imported' => $imported,
                'updated' => $updated,
                'skipped' => $skipped,
                'failed' => count($errors),
                'errors' => $errors,
            ],
        ]);
    }

    public function bulkImportRosters(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id() ? (int) Auth::id() : 1;

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['required', 'array'],
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $employees = Employee::query()->where('tenant_id', $tenantId)->get();
        $empMap = [];
        foreach ($employees as $e) {
            if ($e->employee_code) {
                $empMap[strtolower((string) $e->employee_code)] = $e;
            }
            if ($e->email) {
                $empMap[strtolower((string) $e->email)] = $e;
            }
        }

        $shifts = Shift::query()->where('tenant_id', $tenantId)->get();
        $shiftMap = [];
        foreach ($shifts as $s) {
            if ($s->code) {
                $shiftMap[strtolower((string) $s->code)] = $s;
            }
            if ($s->name) {
                $shiftMap[strtolower((string) $s->name)] = $s;
            }
        }

        $chunks = array_chunk($rows, 100);
        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use ($chunk, $chunkIndex, $tenantId, $userId, $mode, $empMap, $shiftMap, &$imported, &$updated, &$skipped, &$errors): void {
                foreach ($chunk as $index => $row) {
                    $rowNum = ($chunkIndex * 100) + $index + 1;
                    $empCode = trim((string) ($row['employee_code'] ?? $row['code'] ?? ''));
                    $shiftCode = trim((string) ($row['shift_code'] ?? $row['shift'] ?? ''));
                    $effectiveFrom = trim((string) ($row['effective_from'] ?? $row['date'] ?? ''));
                    $effectiveTo = isset($row['effective_to']) && trim((string) $row['effective_to']) !== '' ? trim((string) $row['effective_to']) : null;

                    if ($empCode === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'employee_code',
                            'value' => '',
                            'message' => 'Employee code is required.',
                        ];

                        continue;
                    }

                    if ($shiftCode === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'shift_code',
                            'value' => '',
                            'message' => 'Shift code is required.',
                        ];

                        continue;
                    }

                    if ($effectiveFrom === '') {
                        $effectiveFrom = date('Y-m-d');
                    }

                    $employee = $empMap[strtolower($empCode)] ?? null;
                    if (! $employee) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'employee_code',
                            'value' => $empCode,
                            'message' => "Employee '{$empCode}' not found.",
                        ];

                        continue;
                    }

                    $shift = $shiftMap[strtolower($shiftCode)] ?? null;
                    if (! $shift) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'shift_code',
                            'value' => $shiftCode,
                            'message' => "Shift '{$shiftCode}' not found.",
                        ];

                        continue;
                    }

                    $existing = ShiftAssignment::query()
                        ->where('tenant_id', $tenantId)
                        ->where('employee_id', $employee->id)
                        ->where('effective_from', $effectiveFrom)
                        ->first();

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        try {
                            $existing->update([
                                'shift_id' => $shift->id,
                                'effective_to' => $effectiveTo,
                                'updated_by' => $userId,
                            ]);
                            $employee->update(['default_shift_id' => $shift->id]);
                            $updated++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'employee_code',
                                'value' => $empCode,
                                'message' => 'Update failed: '.$e->getMessage(),
                            ];
                        }
                    } else {
                        try {
                            ShiftAssignment::create([
                                'tenant_id' => $tenantId,
                                'uuid' => (string) Str::uuid(),
                                'employee_id' => $employee->id,
                                'shift_id' => $shift->id,
                                'effective_from' => $effectiveFrom,
                                'effective_to' => $effectiveTo,
                                'assigned_by' => $userId,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $employee->update(['default_shift_id' => $shift->id]);
                            $imported++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'employee_code',
                                'value' => $empCode,
                                'message' => 'Creation failed: '.$e->getMessage(),
                            ];
                        }
                    }
                }
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'imported' => $imported,
                'updated' => $updated,
                'skipped' => $skipped,
                'failed' => count($errors),
                'errors' => $errors,
            ],
        ]);
    }
}
