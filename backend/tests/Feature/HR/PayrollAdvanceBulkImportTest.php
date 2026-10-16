<?php

declare(strict_types=1);

namespace Tests\Feature\HR;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\HR\Models\Employee;
use App\Modules\HR\Models\PayrollPeriod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class PayrollAdvanceBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Employee $employee1;

    private Employee $employee2;

    private PayrollPeriod $period;

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
            'name' => 'SliceMart Finance Corp',
            'slug' => 'slicemart-finance',
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
            'name' => 'Finance Director',
            'email' => 'finance@slicemart.com',
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
            'name' => 'SliceMart Finance Ltd',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->employee1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => 1,
            'uuid' => (string) Str::uuid(),
            'employee_code' => 'EMP-00101',
            'first_name' => 'Kamal',
            'last_name' => 'Ahmed',
            'display_name' => 'Kamal Ahmed',
            'phone' => '01711223311',
            'email' => 'kamal@slicemart.com',
            'date_of_joining' => '2025-01-01',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'is_active' => 1,
        ]);

        $this->employee2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => 1,
            'uuid' => (string) Str::uuid(),
            'employee_code' => 'EMP-00102',
            'first_name' => 'Jamal',
            'last_name' => 'Khandaker',
            'display_name' => 'Jamal Khandaker',
            'phone' => '01711223322',
            'email' => 'jamal@slicemart.com',
            'date_of_joining' => '2025-02-01',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'is_active' => 1,
        ]);

        $this->period = PayrollPeriod::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'company_id' => 1,
            'period_code' => 'PAY-2026-09',
            'pay_frequency' => 'monthly',
            'period_start' => '2026-09-01',
            'period_end' => '2026-09-30',
            'payment_date' => '2026-10-05',
            'status' => 'open',
            'total_gross' => '0.0000',
            'total_deductions' => '0.0000',
            'total_net' => '0.0000',
            'employee_count' => 0,
        ]);
    }

    public function test_advances_bulk_import_skip_and_upsert_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'EMP-00101',
                    'advance_number' => 'ADV-2026-0001',
                    'amount' => 15000,
                    'installment_amount' => 3000,
                    'issued_on' => '2026-09-01',
                    'recovery_start_period_code' => 'PAY-2026-09',
                    'status' => 'active',
                    'notes' => 'Medical advance for family care',
                ],
                [
                    'employee_code' => 'EMP-00102',
                    'advance_number' => 'ADV-2026-0002',
                    'amount' => 10000,
                    'installment_amount' => 2500,
                    'issued_on' => '2026-09-05',
                    'status' => 'active',
                    'notes' => 'Emergency personal expense loan',
                ],
            ],
        ];

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->postJson('/api/v1/hr/payroll/advances/bulk-import', $payload);

        $res->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.imported', 2)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('payroll_advances', [
            'tenant_id' => 1,
            'advance_number' => 'ADV-2026-0001',
            'amount' => '15000.0000',
            'installment_amount' => '3000.0000',
            'recovery_start_period_id' => $this->period->id,
        ]);

        // Upsert mode
        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'employee_code' => 'EMP-00101',
                    'advance_number' => 'ADV-2026-0001',
                    'amount' => 18000,
                    'installment_amount' => 3600,
                    'notes' => 'Adjusted medical loan balance',
                ],
            ],
        ];

        $resUpsert = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->postJson('/api/v1/hr/payroll/advances/bulk-import', $upsertPayload);

        $resUpsert->assertOk()
            ->assertJsonPath('data.updated', 1)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('payroll_advances', [
            'tenant_id' => 1,
            'advance_number' => 'ADV-2026-0001',
            'amount' => '18000.0000',
            'installment_amount' => '3600.0000',
            'notes' => 'Adjusted medical loan balance',
        ]);
    }
}
