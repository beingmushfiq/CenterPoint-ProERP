<?php

declare(strict_types=1);

namespace Tests\Feature\HR;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkerProductionEntry;
use App\Modules\HR\Models\Employee;
use App\Modules\HR\Models\Payslip;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class PayrollPieceRateTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private User $workerUser;

    private string $token;

    private Company $company;

    private Branch $branch;

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

        $this->workerUser = User::create([
            'id' => 2,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'email' => 'worker@slicemart.com',
            'password' => Hash::make('password123'),
            'name' => 'Karim Worker',
            'is_active' => true,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

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
    }

    public function test_payroll_consumes_worker_production_piece_rate_output_and_locks_period(): void
    {
        // 1. Create a piece-rate employee bound to workerUser
        $employee = Employee::create([
            'tenant_id' => 1,
            'employee_code' => 'EMP-0099',
            'user_id' => $this->workerUser->id,
            'company_id' => $this->company->id,
            'branch_id' => $this->branch->id,
            'first_name' => 'Abdul',
            'last_name' => 'Karim',
            'display_name' => 'Abdul Karim',
            'phone' => '+8801711111111',
            'employment_type' => 'piece_rate',
            'employment_status' => 'active',
            'date_of_joining' => '2026-01-01',
            'is_active' => true,
        ]);

        // 2. Create Unit & Product for production
        $unit = Unit::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'quantity',
            'is_active' => true,
        ]);

        $product = Product::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'sku' => 'PRD-01',
            'name' => 'Premium Shirt',
            'type' => 'manufactured',
            'base_unit_id' => $unit->id,
            'is_active' => true,
        ]);

        $factoryId = DB::table('factories')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'branch_id' => $this->branch->id,
            'code' => 'FAC-01',
            'name' => 'Main Factory',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $bom = \App\Models\BillOfMaterial::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'product_id' => $product->id,
            'version' => '1.0',
            'name' => 'Premium Shirt BOM',
            'output_quantity' => '100.0000',
            'output_unit_id' => $unit->id,
            'expected_yield_percentage' => '100.0000',
            'status' => 'active',
        ]);

        $batch = ProductionBatch::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'factory_id' => $factoryId,
            'bill_of_material_id' => $bom->id,
            'batch_number' => 'BAT-202608-001',
            'batch_date' => '2026-08-15',
            'product_id' => $product->id,
            'planned_quantity' => '100.0000',
            'actual_quantity' => '100.0000',
            'output_unit_id' => $unit->id,
            'status' => 'completed',
        ]);

        // 3. Create Phase 3 Worker Production Output: 50 pieces @ 30 BDT = 1500 BDT
        WorkerProductionEntry::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'production_batch_id' => $batch->id,
            'employee_id' => $employee->id,
            'product_id' => $product->id,
            'work_date' => '2026-08-15',
            'measure_type' => 'piece',
            'quantity' => '50.0000',
            'unit_id' => $unit->id,
            'rate_type' => 'piece_rate',
            'rate' => '30.0000',
            'status' => 'verified',
        ]);

        // 4. Create Payroll Period for August 2026
        $periodRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/hr/payroll/periods', [
                'company_id' => $this->company->id,
                'period_code' => 'PAY-202608',
                'pay_frequency' => 'monthly',
                'period_start' => '2026-08-01',
                'period_end' => '2026-08-31',
                'payment_date' => '2026-09-01',
            ]);

        $periodRes->assertStatus(201);
        $periodId = $periodRes->json('data.id');

        // 5. Process Payroll Run
        $processRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/v1/hr/payroll/periods/{$periodId}/process");

        $processRes->assertStatus(200);
        $processRes->assertJsonPath('data.status', 'closed');
        $processRes->assertJsonPath('data.total_gross', '1500.0000');
        $processRes->assertJsonPath('data.total_net', '1500.0000');

        // Verify Payslip generated for the piece-rate worker
        $payslip = Payslip::where('payroll_period_id', $periodId)->where('employee_id', $employee->id)->first();
        $this->assertNotNull($payslip);
        $this->assertEquals(1500.00, (float) $payslip->gross_amount);
        $this->assertEquals(50.00, (float) $payslip->produced_quantity);

        // 6. Re-processing a locked period must fail with PERIOD_CLOSED
        $reprocessRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/v1/hr/payroll/periods/{$periodId}/process");

        $reprocessRes->assertStatus(422);
    }
}
