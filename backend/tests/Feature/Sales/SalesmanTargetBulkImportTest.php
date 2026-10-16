<?php

declare(strict_types=1);

namespace Tests\Feature\Sales;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Employee;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class SalesmanTargetBulkImportTest extends TestCase
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
            'name' => 'SliceMart Master Org',
            'slug' => 'slicemart-master-org',
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
            'name' => 'Sales Director',
            'email' => 'salesdir@slicemart.com',
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

        $this->user->roles()->attach($role->id);

        $this->token = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1
        );

        DB::table('companies')->insert([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'SliceMart Master Org',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->employee = Employee::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => 1,
            'employee_code' => 'EMP-SALES-01',
            'first_name' => 'Jamal',
            'last_name' => 'Khan',
            'display_name' => 'Jamal Khan',
            'phone' => '+8801711000111',
            'email' => 'jamal.khan@slicemart.com',
            'date_of_joining' => '2025-01-01',
            'employment_type' => 'full_time',
            'status' => 'active',
        ]);
    }

    public function test_can_bulk_import_salesman_targets_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'EMP-SALES-01',
                    'target_name' => 'Q4 Industrial Sales Target',
                    'period_month' => '2026-10',
                    'target_amount' => 500000,
                    'achieved_amount' => 125000,
                    'status' => 'active',
                    'notes' => 'Corporate accounts quarterly quota',
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/targets/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 1);
        $response->assertJsonPath('data.skipped_count', 0);

        $this->assertDatabaseHas('salesman_targets', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'period_month' => '2026-10',
            'target_amount' => '500000.0000',
            'achieved_amount' => '125000.0000',
            'achievement_percentage' => '25.00',
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/targets/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 1);
    }

    public function test_can_bulk_import_salesman_targets_in_upsert_mode(): void
    {
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'EMP-SALES-01',
                    'period_month' => '2026-11',
                    'target_amount' => 400000,
                    'achieved_amount' => 100000,
                ],
            ],
        ];

        $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/targets/bulk-import', $initialPayload);

        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'employee_code' => 'EMP-SALES-01',
                    'period_month' => '2026-11',
                    'target_amount' => 450000,
                    'achieved_amount' => 450000,
                    'status' => 'completed',
                    'notes' => 'Target revised and exceeded',
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/targets/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('salesman_targets', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'period_month' => '2026-11',
            'target_amount' => '450000.0000',
            'achieved_amount' => '450000.0000',
            'achievement_percentage' => '100.00',
            'status' => 'completed',
        ]);
    }
}
