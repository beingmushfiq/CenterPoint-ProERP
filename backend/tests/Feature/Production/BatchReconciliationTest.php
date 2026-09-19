<?php

declare(strict_types=1);

namespace Tests\Feature\Production;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\BillOfMaterial;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\ProductionOutput;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WorkerProductionEntry;
use App\Modules\HR\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class BatchReconciliationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;
    private Product $product;
    private Unit $unit;
    private object $factory;
    private BillOfMaterial $bom;
    private Warehouse $warehouse;
    private Employee $worker;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id'             => 1,
            'uuid'           => (string) Str::uuid(),
            'code'           => 'ENTERPRISE',
            'name'           => 'Enterprise',
            'price'          => '10000.0000',
            'billing_period' => 'monthly',
            'limits'         => json_encode(['max_users' => 100]),
            'is_active'      => true,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        $this->tenant = Tenant::create([
            'id'            => 1,
            'uuid'          => (string) Str::uuid(),
            'plan_id'       => 1,
            'name'          => 'SliceMart Apparel Factory',
            'slug'          => 'slicemart-apparel',
            'status'        => 'active',
            'currency_code' => 'BDT',
            'timezone'      => 'Asia/Dhaka',
            'locale'        => 'en',
            'date_format'   => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'id'        => 1,
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'name'      => 'Plant Supervisor',
            'email'     => 'supervisor@slicemart.com',
            'password'  => 'secret123',
            'status'    => 'active',
        ]);

        $role = Role::create([
            'tenant_id'  => $this->tenant->id,
            'uuid'       => (string) Str::uuid(),
            'name'       => 'Super Administrator',
            'slug'       => 'super-admin',
            'is_system'  => true,
        ]);
        $this->user->roles()->attach($role->id, ['tenant_id' => $this->tenant->id]);

        $this->jwt = app(JwtService::class)->issueToken($this->user->id, $this->tenant->id);

        $this->unit = Unit::create([
            'tenant_id'     => $this->tenant->id,
            'uuid'          => (string) Str::uuid(),
            'name'          => 'Piece',
            'code'          => 'PCS',
            'symbol'        => 'pcs',
            'type'          => 'unit',
            'allow_decimal' => false,
        ]);

        $this->product = Product::create([
            'tenant_id'    => $this->tenant->id,
            'uuid'         => (string) Str::uuid(),
            'name'         => 'Premium Polo Shirt',
            'sku'          => 'POLO-001',
            'base_unit_id' => $this->unit->id,
            'type'         => 'finished',
            'cost_price'   => '400.0000',
            'selling_price' => '850.0000',
            'is_active'    => true,
        ]);

        $this->warehouse = Warehouse::create([
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'name'      => 'Finished Goods Warehouse',
            'code'      => 'WH-FG',
            'type'      => 'physical',
            'is_active' => true,
        ]);

        $companyId = DB::table('companies')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'SliceMart Textiles',
            'legal_name' => 'SliceMart Textiles Ltd.',
            'tax_identifier' => 'BIN-778899',
            'registration_number' => 'REG-778899',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $branchId = DB::table('branches')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $companyId,
            'code' => 'BR-01',
            'name' => 'Main Branch',
            'type' => 'mixed',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $factoryId = DB::table('factories')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $companyId,
            'branch_id' => $branchId,
            'code' => 'FACT-01',
            'name' => 'Chittagong Main Mill',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->factory = (object) ['id' => $factoryId];

        $this->bom = BillOfMaterial::create([
            'tenant_id'                  => $this->tenant->id,
            'uuid'                       => (string) Str::uuid(),
            'name'                       => 'Polo Shirt Recipe',
            'product_id'                 => $this->product->id,
            'bom_number'                 => 'BOM-POLO-001',
            'version'                    => '1.0',
            'output_quantity'            => '1.0000',
            'output_unit_id'             => $this->unit->id,
            'expected_yield_percentage'  => '98.0000',
            'status'                     => 'approved',
            'is_active'                  => true,
        ]);

        $this->worker = Employee::create([
            'tenant_id'         => $this->tenant->id,
            'company_id'        => $companyId,
            'uuid'              => (string) Str::uuid(),
            'employee_code'     => 'EMP-101',
            'first_name'        => 'Rafiq',
            'last_name'         => 'Islam',
            'display_name'      => 'Rafiq Islam',
            'phone'             => '+8801700000001',
            'date_of_joining'   => '2025-01-01',
            'employment_type'   => 'piece_rate',
            'employment_status' => 'active',
            'is_active'         => 1,
        ]);
    }

    public function test_can_list_batch_reconciliations_and_detect_within_tolerance(): void
    {
        $batch = ProductionBatch::create([
            'tenant_id'            => $this->tenant->id,
            'uuid'                 => (string) Str::uuid(),
            'batch_number'         => 'BATCH-2026-001',
            'factory_id'           => $this->factory->id,
            'product_id'           => $this->product->id,
            'bill_of_material_id'  => $this->bom->id,
            'batch_date'           => '2026-09-20',
            'planned_quantity'     => '100.0000',
            'total_output_quantity' => '100.0000',
            'output_unit_id'       => $this->unit->id,
            'status'               => 'completed',
        ]);

        ProductionOutput::create([
            'tenant_id'           => $this->tenant->id,
            'uuid'                => (string) Str::uuid(),
            'production_batch_id' => $batch->id,
            'product_id'          => $this->product->id,
            'target_warehouse_id' => $this->warehouse->id,
            'output_type'         => 'primary',
            'quantity'            => '100.0000',
            'unit_id'             => $this->unit->id,
            'output_date'         => '2026-09-20',
            'created_by'          => $this->user->id,
        ]);

        // Worker claim = 101 (1% variance <= 2% threshold)
        WorkerProductionEntry::create([
            'tenant_id'           => $this->tenant->id,
            'uuid'                => (string) Str::uuid(),
            'production_batch_id' => $batch->id,
            'employee_id'         => $this->worker->id,
            'product_id'          => $this->product->id,
            'work_date'           => '2026-09-20',
            'measure_type'        => 'piece',
            'quantity'            => '101.0000',
            'unit_id'             => $this->unit->id,
            'status'              => 'submitted',
            'entered_by'          => $this->user->id,
            'created_by'          => $this->user->id,
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->getJson('/api/v1/production/reconciliation');

        $response->assertStatus(200)
            ->assertJsonPath('data.0.batch_number', 'BATCH-2026-001')
            ->assertJsonPath('data.0.reconciliation.tolerance_status', 'WITHIN_TOLERANCE')
            ->assertJsonPath('data.0.reconciliation.requires_signoff', false)
            ->assertJsonPath('data.0.reconciliation.batch_actual_output', 100)
            ->assertJsonPath('data.0.reconciliation.worker_claimed_quantity', 101)
            ->assertJsonPath('summary.exceeds_tolerance_count', 0);
    }

    public function test_detects_exceeds_tolerance_when_claims_exceed_output_by_more_than_2_percent(): void
    {
        $batch = ProductionBatch::create([
            'tenant_id'            => $this->tenant->id,
            'uuid'                 => (string) Str::uuid(),
            'batch_number'         => 'BATCH-2026-002',
            'factory_id'           => $this->factory->id,
            'product_id'           => $this->product->id,
            'bill_of_material_id'  => $this->bom->id,
            'batch_date'           => '2026-09-20',
            'planned_quantity'     => '100.0000',
            'total_output_quantity' => '100.0000',
            'output_unit_id'       => $this->unit->id,
            'status'               => 'completed',
        ]);

        ProductionOutput::create([
            'tenant_id'           => $this->tenant->id,
            'uuid'                => (string) Str::uuid(),
            'production_batch_id' => $batch->id,
            'product_id'          => $this->product->id,
            'target_warehouse_id' => $this->warehouse->id,
            'output_type'         => 'primary',
            'quantity'            => '100.0000',
            'unit_id'             => $this->unit->id,
            'output_date'         => '2026-09-20',
            'created_by'          => $this->user->id,
        ]);

        // Worker claim = 110 (10% variance > 2% tolerance threshold)
        WorkerProductionEntry::create([
            'tenant_id'           => $this->tenant->id,
            'uuid'                => (string) Str::uuid(),
            'production_batch_id' => $batch->id,
            'employee_id'         => $this->worker->id,
            'product_id'          => $this->product->id,
            'work_date'           => '2026-09-20',
            'measure_type'        => 'piece',
            'quantity'            => '110.0000',
            'unit_id'             => $this->unit->id,
            'status'              => 'submitted',
            'entered_by'          => $this->user->id,
            'created_by'          => $this->user->id,
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->getJson('/api/v1/production/reconciliation');

        $response->assertStatus(200)
            ->assertJsonPath('data.0.reconciliation.tolerance_status', 'EXCEEDS_TOLERANCE')
            ->assertJsonPath('data.0.reconciliation.requires_signoff', true)
            ->assertJsonPath('data.0.reconciliation.variance_percentage', 10)
            ->assertJsonPath('summary.exceeds_tolerance_count', 1)
            ->assertJsonPath('summary.pending_signoff_count', 1);
    }

    public function test_can_show_detailed_batch_worker_claims_breakdown(): void
    {
        $batch = ProductionBatch::create([
            'tenant_id'            => $this->tenant->id,
            'uuid'                 => (string) Str::uuid(),
            'batch_number'         => 'BATCH-2026-003',
            'factory_id'           => $this->factory->id,
            'product_id'           => $this->product->id,
            'bill_of_material_id'  => $this->bom->id,
            'batch_date'           => '2026-09-20',
            'planned_quantity'     => '200.0000',
            'total_output_quantity' => '200.0000',
            'output_unit_id'       => $this->unit->id,
            'status'               => 'completed',
        ]);

        WorkerProductionEntry::create([
            'tenant_id'           => $this->tenant->id,
            'uuid'                => (string) Str::uuid(),
            'production_batch_id' => $batch->id,
            'employee_id'         => $this->worker->id,
            'product_id'          => $this->product->id,
            'work_date'           => '2026-09-20',
            'measure_type'        => 'piece',
            'quantity'            => '150.0000',
            'unit_id'             => $this->unit->id,
            'status'              => 'verified',
            'entered_by'          => $this->user->id,
            'created_by'          => $this->user->id,
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->getJson("/api/v1/production/reconciliation/{$batch->uuid}");

        $response->assertStatus(200)
            ->assertJsonPath('data.batch.batch_number', 'BATCH-2026-003')
            ->assertJsonPath('data.worker_claims.0.quantity', 150)
            ->assertJsonPath('data.worker_claims.0.employee.code', 'EMP-101');
    }

    public function test_supervisor_can_sign_off_on_variance(): void
    {
        $batch = ProductionBatch::create([
            'tenant_id'            => $this->tenant->id,
            'uuid'                 => (string) Str::uuid(),
            'batch_number'         => 'BATCH-2026-004',
            'factory_id'           => $this->factory->id,
            'product_id'           => $this->product->id,
            'bill_of_material_id'  => $this->bom->id,
            'batch_date'           => '2026-09-20',
            'planned_quantity'     => '100.0000',
            'total_output_quantity' => '100.0000',
            'output_unit_id'       => $this->unit->id,
            'status'               => 'completed',
        ]);

        // 105 claims vs 100 batch (5% variance)
        WorkerProductionEntry::create([
            'tenant_id'           => $this->tenant->id,
            'uuid'                => (string) Str::uuid(),
            'production_batch_id' => $batch->id,
            'employee_id'         => $this->worker->id,
            'product_id'          => $this->product->id,
            'work_date'           => '2026-09-20',
            'measure_type'        => 'piece',
            'quantity'            => '105.0000',
            'unit_id'             => $this->unit->id,
            'status'              => 'submitted',
            'entered_by'          => $this->user->id,
            'created_by'          => $this->user->id,
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->postJson("/api/v1/production/reconciliation/{$batch->uuid}/sign-off", [
            'notes' => 'Minor fabric count discrepancy verified by floor lead; approved for payroll.',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.signed_off', true)
            ->assertJsonPath('data.requires_signoff', false)
            ->assertJsonPath('data.signoff_notes', 'Minor fabric count discrepancy verified by floor lead; approved for payroll.');

        $this->assertEquals($this->user->id, $batch->fresh()->supervisor_id);
    }

    public function test_sign_off_requires_notes(): void
    {
        $batch = ProductionBatch::create([
            'tenant_id'            => $this->tenant->id,
            'uuid'                 => (string) Str::uuid(),
            'batch_number'         => 'BATCH-2026-005',
            'factory_id'           => $this->factory->id,
            'product_id'           => $this->product->id,
            'bill_of_material_id'  => $this->bom->id,
            'batch_date'           => '2026-09-20',
            'planned_quantity'     => '100.0000',
            'total_output_quantity' => '100.0000',
            'output_unit_id'       => $this->unit->id,
            'status'               => 'completed',
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->postJson("/api/v1/production/reconciliation/{$batch->uuid}/sign-off", [
            'notes' => '',
        ]);

        $response->assertStatus(422);
    }
}
