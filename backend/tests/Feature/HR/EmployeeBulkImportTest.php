<?php

declare(strict_types=1);

namespace Tests\Feature\HR;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\HR\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class EmployeeBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

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
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'HR Director',
            'email' => 'hr@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
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
    }

    public function test_can_bulk_import_employees_and_auto_create_departments(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'EMP-BULK-001',
                    'first_name' => 'Nasir',
                    'last_name' => 'Hossain',
                    'phone' => '+8801811223344',
                    'email' => 'nasir@slicemart.com',
                    'department' => 'Embroidery',
                    'designation' => 'Machine Operator',
                    'employment_type' => 'permanent',
                    'employment_status' => 'active',
                ],
                [
                    'employee_code' => 'EMP-BULK-002',
                    'first_name' => 'Fatima',
                    'last_name' => 'Begum',
                    'phone' => '+8801811223345',
                    'email' => 'fatima@slicemart.com',
                    'department' => 'Embroidery',
                    'designation' => 'Quality Inspector',
                    'employment_type' => 'piece_rate',
                    'employment_status' => 'active',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/hr/employees/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'total' => 2,
                'imported' => 2,
                'skipped' => 0,
                'failed' => 0,
            ]);

        $this->assertDatabaseHas('employees', [
            'tenant_id' => $this->tenant->id,
            'employee_code' => 'EMP-BULK-001',
            'first_name' => 'Nasir',
        ]);

        $this->assertDatabaseHas('departments', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Embroidery',
        ]);

        $this->assertDatabaseHas('designations', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Machine Operator',
        ]);
    }

    public function test_skips_existing_records_in_skip_mode(): void
    {
        // Pre-create employee
        Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => 1,
            'employee_code' => 'EMP-EXIST-01',
            'first_name' => 'Existing',
            'last_name' => 'Staff',
            'display_name' => 'Existing Staff',
            'phone' => '+8801999888777',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'date_of_joining' => '2025-01-01',
            'is_active' => true,
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'EMP-EXIST-01',
                    'first_name' => 'Attempted Duplicate',
                    'phone' => '+8801999888777',
                ],
                [
                    'employee_code' => 'EMP-NEW-02',
                    'first_name' => 'Brand New',
                    'phone' => '+8801999888778',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/hr/employees/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'total' => 2,
                'imported' => 1,
                'skipped' => 1,
                'failed' => 0,
            ]);
    }

    public function test_updates_existing_records_in_upsert_mode(): void
    {
        // Pre-create employee
        $emp = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => 1,
            'employee_code' => 'EMP-UPSERT-01',
            'first_name' => 'OldName',
            'display_name' => 'OldName',
            'phone' => '+8801911223344',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'date_of_joining' => '2025-01-01',
            'is_active' => true,
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $payload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'employee_code' => 'EMP-UPSERT-01',
                    'first_name' => 'NewName',
                    'last_name' => 'Updated',
                    'phone' => '+8801911223344',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/hr/employees/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'total' => 1,
                'imported' => 0,
                'updated' => 1,
                'skipped' => 0,
            ]);

        $emp->refresh();
        $this->assertEquals('NewName', $emp->first_name);
        $this->assertEquals('Updated', $emp->last_name);
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
