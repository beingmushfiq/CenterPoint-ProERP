<?php

declare(strict_types=1);

namespace App\Modules\HR\Actions;

use App\Modules\HR\Models\Employee;
use Illuminate\Support\Facades\DB;

class CreateEmployeeAction
{
    /**
     * @param array{
     *     company_id: int,
     *     branch_id?: int,
     *     factory_id?: int,
     *     department_id?: int,
     *     designation_id?: int,
     *     first_name: string,
     *     last_name?: string,
     *     phone: string,
     *     email?: string,
     *     employment_type?: string,
     *     employment_status?: string,
     *     default_shift_id?: int,
     *     salary_structure_id?: int,
     *     date_of_joining?: string,
     *     bank_name?: string,
     *     bank_account_number?: string,
     *     mobile_wallet_number?: string,
     * } $data
     */
    public function execute(array $data, int $userId): Employee
    {
        return DB::transaction(function () use ($data, $userId): Employee {
            $code = 'EMP-'.str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT);
            $displayName = trim($data['first_name'].' '.($data['last_name'] ?? ''));

            $assignedUserId = $data['user_id'] ?? null;

            if (! empty($data['grant_user_access']) && ! empty($data['email']) && ! empty($data['user_password'])) {
                $tenantId = $data['tenant_id'] ?? null;
                $user = \App\Models\User::create([
                    'uuid' => (string) \Illuminate\Support\Str::uuid(),
                    'tenant_id' => $tenantId,
                    'name' => $displayName,
                    'email' => strtolower(trim($data['email'])),
                    'password' => \Illuminate\Support\Facades\Hash::make($data['user_password']),
                    'phone' => $data['phone'] ?? null,
                    'status' => 'active',
                    'token_version' => 1,
                    'perm_version' => 1,
                    'default_company_id' => $data['company_id'] ?? 1,
                    'default_branch_id' => $data['branch_id'] ?? null,
                    'default_factory_id' => $data['factory_id'] ?? null,
                ]);

                if (! empty($data['role_ids'])) {
                    $pivotData = [];
                    foreach ($data['role_ids'] as $rId) {
                        $pivotData[$rId] = ['tenant_id' => $tenantId];
                    }
                    $user->roles()->sync($pivotData);
                }

                $assignedUserId = $user->id;
            }

            return Employee::create([
                'employee_code' => $code,
                'user_id' => $assignedUserId,
                'company_id' => $data['company_id'],
                'branch_id' => $data['branch_id'] ?? null,
                'factory_id' => $data['factory_id'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'designation_id' => $data['designation_id'] ?? null,
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'] ?? null,
                'display_name' => $displayName,
                'phone' => $data['phone'],
                'email' => $data['email'] ?? null,
                'employment_type' => $data['employment_type'] ?? 'permanent',
                'employment_status' => $data['employment_status'] ?? 'active',
                'default_shift_id' => $data['default_shift_id'] ?? null,
                'salary_structure_id' => $data['salary_structure_id'] ?? null,
                'date_of_joining' => $data['date_of_joining'] ?? date('Y-m-d'),
                'bank_name' => $data['bank_name'] ?? null,
                'bank_account_number' => $data['bank_account_number'] ?? null,
                'mobile_wallet_number' => $data['mobile_wallet_number'] ?? null,
                'is_active' => true,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);
        });
    }
}
