<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class EmployeesTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenantId = 1;
        $companyId = DB::table('companies')->where('tenant_id', $tenantId)->value('id') ?? 1;
        $branchId = DB::table('branches')->where('tenant_id', $tenantId)->value('id') ?? 1;
        $factoryId = DB::table('factories')->where('tenant_id', $tenantId)->value('id') ?? 1;
        $adminUserId = DB::table('users')->where('tenant_id', $tenantId)->value('id');

        // Check if employees or shifts already seeded
        if (DB::table('shifts')->where('tenant_id', $tenantId)->exists()) {
            return;
        }

        // 1. Shifts
        $shifts = [
            ['code' => 'SHIFT-MORN', 'name' => 'Morning Shift', 'start_time' => '08:00:00', 'end_time' => '16:30:00'],
            ['code' => 'SHIFT-EVE', 'name' => 'Evening Shift', 'start_time' => '16:30:00', 'end_time' => '00:30:00'],
            ['code' => 'SHIFT-NGT', 'name' => 'Night Shift', 'start_time' => '00:30:00', 'end_time' => '08:00:00'],
        ];

        $shiftIds = [];
        foreach ($shifts as $s) {
            $existing = DB::table('shifts')->where('tenant_id', $tenantId)->where('code', $s['code'])->first();
            if ($existing) {
                $shiftIds[$s['code']] = $existing->id;
            } else {
                $id = DB::table('shifts')->insertGetId([
                    'tenant_id' => $tenantId,
                    'uuid' => (string) Str::uuid(),
                    'code' => $s['code'],
                    'name' => $s['name'],
                    'start_time' => $s['start_time'],
                    'end_time' => $s['end_time'],
                    'crosses_midnight' => $s['code'] === 'SHIFT-NGT' ? 1 : 0,
                    'break_minutes' => 60,
                    'is_active' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $shiftIds[$s['code']] = $id;
            }
        }

        // 2. Departments
        $departments = [
            ['code' => 'DEPT-PROD', 'name' => 'Appliance Production & Assembly'],
            ['code' => 'DEPT-QA', 'name' => 'Quality Assurance & Testing'],
        ];

        $deptIds = [];
        foreach ($departments as $d) {
            $existing = DB::table('departments')->where('tenant_id', $tenantId)->where('code', $d['code'])->first();
            if ($existing) {
                $deptIds[$d['code']] = $existing->id;
            } else {
                $id = DB::table('departments')->insertGetId([
                    'tenant_id' => $tenantId,
                    'uuid' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'code' => $d['code'],
                    'name' => $d['name'],
                    'is_active' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $deptIds[$d['code']] = $id;
            }
        }

        // 3. Designations
        $designations = [
            ['code' => 'DESG-TECH', 'name' => 'Assembly Line Technician'],
            ['code' => 'DESG-QA', 'name' => 'QC & Hi-Pot Testing Inspector'],
            ['code' => 'DESG-PKG', 'name' => 'Packaging & Buffering Operator'],
        ];

        $desgIds = [];
        foreach ($designations as $ds) {
            $existing = DB::table('designations')->where('tenant_id', $tenantId)->where('code', $ds['code'])->first();
            if ($existing) {
                $desgIds[$ds['code']] = $existing->id;
            } else {
                $id = DB::table('designations')->insertGetId([
                    'tenant_id' => $tenantId,
                    'uuid' => (string) Str::uuid(),
                    'code' => $ds['code'],
                    'name' => $ds['name'],
                    'is_active' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $desgIds[$ds['code']] = $id;
            }
        }

        // 4. Employees
        $userMap = DB::table('users')->where('tenant_id', $tenantId)->pluck('id', 'email')->toArray();

        $employees = [
            [
                'code' => 'EMP-001',
                'first_name' => 'Karim',
                'last_name' => 'Hasan',
                'phone' => '+8801711000101',
                'email' => 'karim.hasan@slicemart.internal',
                'dept' => 'DEPT-PROD',
                'desg' => 'DESG-TECH',
                'shift' => 'SHIFT-MORN',
                'employment_type' => 'piece_rate',
                'user_email' => 'production@dcp.com',
            ],
            [
                'code' => 'EMP-002',
                'first_name' => 'Rahim',
                'last_name' => 'Uddin',
                'phone' => '+8801711000102',
                'email' => 'rahim.uddin@slicemart.internal',
                'dept' => 'DEPT-PROD',
                'desg' => 'DESG-TECH',
                'shift' => 'SHIFT-MORN',
                'employment_type' => 'piece_rate',
                'user_email' => null,
            ],
            [
                'code' => 'EMP-003',
                'first_name' => 'Salma',
                'last_name' => 'Akter',
                'phone' => '+8801711000103',
                'email' => 'salma.akter@slicemart.internal',
                'dept' => 'DEPT-QA',
                'desg' => 'DESG-QA',
                'shift' => 'SHIFT-MORN',
                'employment_type' => 'piece_rate',
                'user_email' => 'qc@dcp.com',
            ],
            [
                'code' => 'EMP-004',
                'first_name' => 'Tariq',
                'last_name' => 'Islam',
                'phone' => '+8801711000104',
                'email' => 'tariq.islam@slicemart.internal',
                'dept' => 'DEPT-PROD',
                'desg' => 'DESG-PKG',
                'shift' => 'SHIFT-EVE',
                'employment_type' => 'hourly',
                'user_email' => 'store@slicemart.test',
            ],
            [
                'code' => 'EMP-005',
                'first_name' => 'Kamal',
                'last_name' => 'Hossain',
                'phone' => '+8801711000105',
                'email' => 'kamal.hossain@slicemart.internal',
                'dept' => 'DEPT-PROD',
                'desg' => 'DESG-PKG',
                'shift' => 'SHIFT-MORN',
                'employment_type' => 'monthly_salary',
                'user_email' => 'sales@slicemart.test',
            ],
        ];

        foreach ($employees as $emp) {
            $userId = ! empty($emp['user_email']) ? ($userMap[$emp['user_email']] ?? null) : null;
            $existing = DB::table('employees')->where('tenant_id', $tenantId)->where('employee_code', $emp['code'])->first();
            if (! $existing) {
                DB::table('employees')->insert([
                    'tenant_id' => $tenantId,
                    'uuid' => (string) Str::uuid(),
                    'employee_code' => $emp['code'],
                    'user_id' => $userId,
                    'company_id' => $companyId,
                    'branch_id' => $branchId,
                    'factory_id' => $factoryId,
                    'department_id' => $deptIds[$emp['dept']] ?? null,
                    'designation_id' => $desgIds[$emp['desg']] ?? null,
                    'default_shift_id' => $shiftIds[$emp['shift']] ?? null,
                    'first_name' => $emp['first_name'],
                    'last_name' => $emp['last_name'],
                    'display_name' => "{$emp['first_name']} {$emp['last_name']}",
                    'gender' => 'male',
                    'phone' => $emp['phone'],
                    'email' => $emp['email'],
                    'date_of_joining' => '2026-01-01',
                    'employment_type' => $emp['employment_type'],
                    'employment_status' => 'active',
                    'is_active' => 1,
                    'created_by' => $adminUserId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('employees')->where('id', $existing->id)->update([
                    'user_id' => $userId ?? $existing->user_id,
                    'updated_at' => now(),
                ]);
            }
        }
    }
}
