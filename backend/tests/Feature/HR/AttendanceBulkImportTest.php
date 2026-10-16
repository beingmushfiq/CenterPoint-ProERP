<?php

declare(strict_types=1);

namespace Tests\Feature\HR;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\HR\Models\Employee;
use App\Modules\HR\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AttendanceBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Employee $employee1;

    private Employee $employee2;

    private Shift $shift;

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
            'name' => 'SliceMart HR Test',
            'slug' => 'slicemart-hr',
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
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'HR Manager',
            'email' => 'hrmanager@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role = Role::create([
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

        DB::table('companies')->insert([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'SliceMart Apparels Ltd',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'GENERAL',
            'name' => 'General Day Shift',
            'start_time' => '09:00:00',
            'end_time' => '17:00:00',
            'grace_in_minutes' => 15,
            'break_minutes' => 60,
            'is_active' => 1,
        ]);

        $this->employee1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => 1,
            'uuid' => (string) Str::uuid(),
            'employee_code' => 'EMP-00101',
            'first_name' => 'Karim',
            'last_name' => 'Uddin',
            'display_name' => 'Karim Uddin',
            'phone' => '01711000001',
            'email' => 'karim@slicemart.com',
            'date_of_joining' => '2025-01-01',
            'default_shift_id' => $this->shift->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'is_active' => 1,
        ]);

        $this->employee2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => 1,
            'uuid' => (string) Str::uuid(),
            'employee_code' => 'EMP-00102',
            'first_name' => 'Rahim',
            'last_name' => 'Mia',
            'display_name' => 'Rahim Mia',
            'phone' => '01711000002',
            'email' => 'rahim@slicemart.com',
            'date_of_joining' => '2025-01-01',
            'default_shift_id' => $this->shift->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'is_active' => 1,
        ]);
    }

    public function test_can_bulk_import_attendance_records(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'EMP-00101',
                    'attendance_date' => '2026-09-01',
                    'check_in_at' => '08:55:00',
                    'check_out_at' => '17:05:00',
                    'shift_code' => 'GENERAL',
                    'remarks' => 'Biometric Device 1',
                ],
                [
                    'employee_code' => 'EMP-00102',
                    'attendance_date' => '2026-09-01',
                    'check_in_at' => '09:30:00',
                    'check_out_at' => '17:00:00',
                    'shift_code' => 'GENERAL',
                    'remarks' => 'Biometric Device 1',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/hr/attendances/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'imported' => 2,
                    'updated' => 0,
                    'skipped' => 0,
                    'failed' => 0,
                ],
            ]);

        // Employee 1: checked in before 09:15 -> present
        $this->assertDatabaseHas('attendances', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'attendance_date' => '2026-09-01',
            'status' => 'present',
            'worked_minutes' => 490,
            'late_minutes' => 0,
        ]);

        // Employee 2: checked in at 09:30 -> late by 30 mins
        $this->assertDatabaseHas('attendances', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee2->id,
            'attendance_date' => '2026-09-01',
            'status' => 'late',
            'late_minutes' => 30,
        ]);
    }

    public function test_attendance_skip_and_upsert_mode(): void
    {
        $initial = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'EMP-00101',
                    'attendance_date' => '2026-09-02',
                    'check_in_at' => '09:00:00',
                    'check_out_at' => '17:00:00',
                ],
            ],
        ];

        $this->postJson('/api/v1/hr/attendances/bulk-import', $initial, $this->authHeaders())
            ->assertStatus(200)
            ->assertJsonPath('data.imported', 1);

        // Skip mode -> should skip
        $skip = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'EMP-00101',
                    'attendance_date' => '2026-09-02',
                    'check_in_at' => '08:30:00',
                    'check_out_at' => '18:00:00',
                ],
            ],
        ];

        $this->postJson('/api/v1/hr/attendances/bulk-import', $skip, $this->authHeaders())
            ->assertStatus(200)
            ->assertJsonPath('data.skipped', 1);

        $this->assertDatabaseHas('attendances', [
            'employee_id' => $this->employee1->id,
            'attendance_date' => '2026-09-02',
            'worked_minutes' => 480,
        ]);

        // Upsert mode -> should update
        $upsert = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'employee_code' => 'EMP-00101',
                    'attendance_date' => '2026-09-02',
                    'check_in_at' => '08:30:00',
                    'check_out_at' => '18:00:00',
                ],
            ],
        ];

        $this->postJson('/api/v1/hr/attendances/bulk-import', $upsert, $this->authHeaders())
            ->assertStatus(200)
            ->assertJsonPath('data.updated', 1);

        $this->assertDatabaseHas('attendances', [
            'employee_id' => $this->employee1->id,
            'attendance_date' => '2026-09-02',
            'worked_minutes' => 570,
            'overtime_minutes' => 90,
        ]);
    }

    private function authHeaders(): array
    {
        return [
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
            'Accept' => 'application/json',
        ];
    }
}
