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

class ShiftAndRosterBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Employee $employee;

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
            'name' => 'SliceMart Factory Operations',
            'slug' => 'slicemart-factory',
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
            'name' => 'Shift Planner',
            'email' => 'planner@slicemart.com',
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
            'name' => 'SliceMart Factory Unit 1',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => 1,
            'uuid' => (string) Str::uuid(),
            'employee_code' => 'EMP-00101',
            'first_name' => 'Monir',
            'last_name' => 'Hossain',
            'display_name' => 'Monir Hossain',
            'phone' => '01711223344',
            'email' => 'monir@slicemart.com',
            'date_of_joining' => '2025-01-01',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'is_active' => 1,
        ]);
    }

    public function test_shifts_bulk_import_skip_and_upsert_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'code' => 'MORN-01',
                    'name' => 'Morning Factory Shift',
                    'start_time' => '06:00:00',
                    'end_time' => '14:00:00',
                    'break_minutes' => 45,
                    'grace_in_minutes' => 15,
                    'crosses_midnight' => false,
                    'is_active' => true,
                ],
                [
                    'code' => 'EVE-02',
                    'name' => 'Evening Factory Shift',
                    'start_time' => '14:00:00',
                    'end_time' => '22:00:00',
                    'break_minutes' => 45,
                    'grace_in_minutes' => 15,
                    'crosses_midnight' => false,
                    'is_active' => true,
                ],
            ],
        ];

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->postJson('/api/v1/hr/shifts/bulk-import', $payload);

        $res->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.imported', 2)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('shifts', [
            'tenant_id' => 1,
            'code' => 'MORN-01',
            'name' => 'Morning Factory Shift',
        ]);

        // Upsert mode
        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'code' => 'MORN-01',
                    'name' => 'Morning Production Shift A',
                    'start_time' => '06:30:00',
                    'end_time' => '14:30:00',
                    'break_minutes' => 50,
                    'grace_in_minutes' => 10,
                ],
            ],
        ];

        $resUpsert = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->postJson('/api/v1/hr/shifts/bulk-import', $upsertPayload);

        $resUpsert->assertOk()
            ->assertJsonPath('data.updated', 1)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('shifts', [
            'tenant_id' => 1,
            'code' => 'MORN-01',
            'name' => 'Morning Production Shift A',
            'grace_in_minutes' => 10,
        ]);
    }

    public function test_shift_rosters_bulk_import(): void
    {
        $shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'GENERAL',
            'name' => 'General Day Shift',
            'start_time' => '09:00:00',
            'end_time' => '17:00:00',
            'is_active' => 1,
        ]);

        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'EMP-00101',
                    'shift_code' => 'GENERAL',
                    'effective_from' => '2026-09-01',
                    'effective_to' => '2026-09-30',
                ],
            ],
        ];

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->postJson('/api/v1/hr/shifts/roster/bulk-import', $payload);

        $res->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.imported', 1)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('shift_assignments', [
            'tenant_id' => 1,
            'employee_id' => $this->employee->id,
            'shift_id' => $shift->id,
            'effective_from' => '2026-09-01',
        ]);
    }
}
