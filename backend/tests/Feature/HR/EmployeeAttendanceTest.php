<?php

declare(strict_types=1);

namespace Tests\Feature\HR;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\HR\Models\Employee;
use App\Modules\HR\Models\LeaveType;
use App\Modules\HR\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class EmployeeAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Company $company;

    private Branch $branch;

    private Shift $shift;

    private LeaveType $leaveType;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'ENTERPRISE',
            'name' => 'Enterprise',
            'price' => '10000.0000',
            'billing_period' => 'monthly',
            'limits' => json_encode(['max_users' => 100]),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->tenant = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'SliceMart BD',
            'slug' => 'slicemart-bd',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'email' => 'admin@slicemart.com',
            'password' => Hash::make('password123'),
            'name' => 'Admin User',
            'is_active' => true,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $role = \App\Models\Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Super Administrator',
            'slug' => 'super-administrator',
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role);

        $this->token = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: 1,
            tokenVersion: 1
        );

        $this->company = Company::create([
            'tenant_id' => 1,
            'name' => 'SliceMart Test Co',
            'is_active' => true,
        ]);

        $this->branch = Branch::create([
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'code' => 'MAIN-01',
            'name' => 'Main Hub',
            'type' => 'retail',
            'is_default' => true,
            'is_active' => true,
        ]);

        $this->shift = Shift::create([
            'tenant_id' => 1,
            'code' => 'MORNING',
            'name' => 'Morning Shift (09:00 - 17:00)',
            'start_time' => '09:00:00',
            'end_time' => '17:00:00',
            'grace_in_minutes' => 15,
            'is_active' => true,
        ]);

        $this->leaveType = LeaveType::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'CASUAL',
            'name' => 'Casual Leave',
            'annual_quota_days' => '14.0000',
            'is_paid' => true,
            'is_active' => true,
        ]);
    }

    public function test_can_onboard_employee_record_attendance_and_apply_leave(): void
    {
        // 1. Onboard Employee
        $empRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/hr/employees', [
                'company_id' => $this->company->id,
                'branch_id' => $this->branch->id,
                'first_name' => 'Rahim',
                'last_name' => 'Uddin',
                'phone' => '+8801722222222',
                'employment_type' => 'permanent',
                'default_shift_id' => $this->shift->id,
                'date_of_joining' => '2026-01-01',
            ]);

        $empRes->assertStatus(201);
        $employeeId = $empRes->json('data.id');

        // 2. Record Attendance (Check-in 09:10, Check-out 17:10 = 480 mins worked)
        $attRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/hr/attendances', [
                'employee_id' => $employeeId,
                'attendance_date' => '2026-08-28',
                'check_in_at' => '2026-08-28 09:10:00',
                'check_out_at' => '2026-08-28 17:10:00',
                'shift_id' => $this->shift->id,
            ]);

        $attRes->assertStatus(201);
        $attRes->assertJsonPath('data.worked_minutes', 480);
        $attRes->assertJsonPath('data.late_minutes', 0); // Within 15-min grace period
        $attRes->assertJsonPath('data.status', 'present');

        // 3. Apply Leave
        $leaveRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/hr/leaves', [
                'employee_id' => $employeeId,
                'leave_type_id' => $this->leaveType->id,
                'start_date' => '2026-09-01',
                'end_date' => '2026-09-02',
                'total_days' => 2.0,
                'reason' => 'Family occasion',
            ]);

        $leaveRes->assertStatus(201);
        $leaveRes->assertJsonPath('data.status', 'approved');
    }
}
