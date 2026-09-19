<?php

declare(strict_types=1);

namespace Tests\Feature\Reports;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Company;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Reports\Models\ReportDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductionAnalyticsReportTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenantA;
    protected Tenant $tenantB;
    protected User $userA;
    protected User $userB;
    protected string $tokenA;
    protected string $tokenB;

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

        $this->tenantA = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Tenant Alpha Garments',
            'slug' => 'alpha-garments',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->tenantB = Tenant::create([
            'id' => 2,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Tenant Beta Textiles',
            'slug' => 'beta-textiles',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenantA->toArray());

        $compA = Company::create([
            'tenant_id' => 1,
            'name' => 'Alpha Co',
            'code' => 'ALPHA',
            'currency_code' => 'BDT',
        ]);

        $compB = Company::create([
            'tenant_id' => 2,
            'name' => 'Beta Co',
            'code' => 'BETA',
            'currency_code' => 'BDT',
        ]);

        $this->userA = User::create([
            'id' => 1,
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Manager Alpha',
            'email' => 'manager@alpha.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $this->userB = User::create([
            'id' => 2,
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'name' => 'Manager Beta',
            'email' => 'manager@beta.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $jwt = app(JwtService::class);
        $this->tokenA = $jwt->issueToken($this->userA->id, 1);
        $this->tokenB = $jwt->issueToken($this->userB->id, 2);
        $this->actingAs($this->userA);

        // Seed Report Definitions
        $reports = [
            ['code' => 'production_yield', 'name' => 'Production Yield & Scrap Analysis', 'module' => 'production'],
            ['code' => 'daily_production', 'name' => 'Daily Production Report', 'module' => 'production'],
            ['code' => 'production_target_vs_achievement', 'name' => 'Production Target vs Achievement', 'module' => 'production'],
            ['code' => 'worker_production', 'name' => 'Worker Piece-Rate Production Log', 'module' => 'production'],
        ];

        foreach ($reports as $r) {
            ReportDefinition::create([
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'code' => $r['code'],
                'name' => $r['name'],
                'module' => $r['module'],
                'category' => 'production',
                'description' => 'Production report',
                'required_permission' => 'reports.view',
                'supports_export' => true,
                'tier' => 'live',
                'is_active' => true,
            ]);
            ReportDefinition::create([
                'tenant_id' => 2,
                'uuid' => (string) Str::uuid(),
                'code' => $r['code'],
                'name' => $r['name'],
                'module' => $r['module'],
                'category' => 'production',
                'description' => 'Production report',
                'required_permission' => 'reports.view',
                'supports_export' => true,
                'tier' => 'live',
                'is_active' => true,
            ]);
        }

        // Seed Units
        $unitA = DB::table('units')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'unit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $unitB = DB::table('units')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'code' => 'PCS-B',
            'name' => 'Pieces',
            'type' => 'unit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Factories
        $factoryA = DB::table('factories')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => $compA->id,
            'code' => 'FAC-ALPHA-01',
            'name' => 'Alpha Main Garments Factory',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $factoryB = DB::table('factories')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'company_id' => $compB->id,
            'code' => 'FAC-BETA-SECRET',
            'name' => 'Beta Classified Facility',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Production Lines
        $lineA = DB::table('production_lines')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'factory_id' => $factoryA,
            'code' => 'LINE-SEW-01',
            'name' => 'Sewing Line Alpha 1',
            'capacity_per_shift' => 600.00,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $lineB = DB::table('production_lines')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'factory_id' => $factoryB,
            'code' => 'LINE-BETA-SECRET',
            'name' => 'Beta Secret Line',
            'capacity_per_shift' => 9999.00,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Shifts
        $shiftA = DB::table('shifts')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'SHIFT-MORNING',
            'name' => 'Morning Shift',
            'start_time' => '08:00:00',
            'end_time' => '16:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shiftB = DB::table('shifts')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'code' => 'SHIFT-NIGHT',
            'name' => 'Night Shift',
            'start_time' => '20:00:00',
            'end_time' => '04:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Products
        $prodA = DB::table('products')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'sku' => 'TSHIRT-001',
            'name' => 'Cotton Polo T-Shirt',
            'type' => 'finished',
            'base_unit_id' => $unitA,
            'standard_cost' => 300.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $prodB = DB::table('products')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'sku' => 'BETA-TOP-SECRET-GARMENT',
            'name' => 'Confidential Silk Shirt',
            'type' => 'finished',
            'base_unit_id' => $unitB,
            'standard_cost' => 1200.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Bill of Materials
        $bomA = DB::table('bill_of_materials')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'product_id' => $prodA,
            'version' => '1.0',
            'name' => 'Standard Polo BoM v1',
            'output_quantity' => 1.00,
            'output_unit_id' => $unitA,
            'expected_yield_percentage' => 98.00,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $bomB = DB::table('bill_of_materials')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'product_id' => $prodB,
            'version' => '1.0',
            'name' => 'Beta Confidential BoM',
            'output_quantity' => 1.00,
            'output_unit_id' => $unitB,
            'expected_yield_percentage' => 99.00,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Production Batches for Tenant A
        DB::table('production_batches')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'batch_number' => 'BAT-ALPHA-202609-01',
            'factory_id' => $factoryA,
            'production_line_id' => $lineA,
            'product_id' => $prodA,
            'bill_of_material_id' => $bomA,
            'shift_id' => $shiftA,
            'batch_date' => now()->toDateString(),
            'planned_quantity' => 500.00,
            'output_unit_id' => $unitA,
            'total_output_quantity' => 480.00,
            'variance_quantity' => 20.00,
            'yield_percentage' => 96.00,
            'status' => 'completed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Production Batches for Tenant B (Confidential)
        DB::table('production_batches')->insert([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'batch_number' => 'BAT-BETA-CONFIDENTIAL-999',
            'factory_id' => $factoryB,
            'production_line_id' => $lineB,
            'product_id' => $prodB,
            'bill_of_material_id' => $bomB,
            'shift_id' => $shiftB,
            'batch_date' => now()->toDateString(),
            'planned_quantity' => 10000.00,
            'output_unit_id' => $unitB,
            'total_output_quantity' => 9999.00,
            'variance_quantity' => 1.00,
            'yield_percentage' => 99.99,
            'status' => 'completed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Employees
        $empA = DB::table('employees')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => $compA->id,
            'factory_id' => $factoryA,
            'production_line_id' => $lineA,
            'employee_code' => 'EMP-001',
            'first_name' => 'Mohammad',
            'last_name' => 'Karim',
            'display_name' => 'Mohammad Karim',
            'phone' => '+8801700000001',
            'date_of_joining' => '2025-01-01',
            'employment_type' => 'piece_rate',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $empB = DB::table('employees')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'company_id' => $compB->id,
            'factory_id' => $factoryB,
            'production_line_id' => $lineB,
            'employee_code' => 'EMP-BETA-SECRET',
            'first_name' => 'Secret',
            'last_name' => 'Operative',
            'display_name' => 'Secret Operative',
            'phone' => '+8801700000999',
            'date_of_joining' => '2025-01-01',
            'employment_type' => 'piece_rate',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Worker Production Entries
        $batchIdA = DB::table('production_batches')->where('batch_number', 'BAT-ALPHA-202609-01')->value('id');
        DB::table('worker_production_entries')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'production_batch_id' => $batchIdA,
            'employee_id' => $empA,
            'product_id' => $prodA,
            'production_line_id' => $lineA,
            'shift_id' => $shiftA,
            'work_date' => now()->toDateString(),
            'measure_type' => 'piece',
            'quantity' => 200.00,
            'unit_id' => $unitA,
            'rejected_quantity' => 4.00,
            'rate_type' => 'piece_rate',
            'rate' => 2.50,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $batchIdB = DB::table('production_batches')->where('batch_number', 'BAT-BETA-CONFIDENTIAL-999')->value('id');
        DB::table('worker_production_entries')->insert([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'production_batch_id' => $batchIdB,
            'employee_id' => $empB,
            'product_id' => $prodB,
            'production_line_id' => $lineB,
            'shift_id' => $shiftB,
            'work_date' => now()->toDateString(),
            'measure_type' => 'piece',
            'quantity' => 8888.00,
            'unit_id' => $unitB,
            'rejected_quantity' => 0.00,
            'rate_type' => 'piece_rate',
            'rate' => 10.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_production_yield_report_returns_real_batch_yield_and_summary(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/production_yield/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'production_yield')
            ->assertJsonPath('data.0.batch_number', 'BAT-ALPHA-202609-01')
            ->assertJsonPath('data.0.planned_quantity', '500.00')
            ->assertJsonPath('data.0.actual_quantity', '480.00')
            ->assertJsonPath('data.0.rejected_quantity', '20.00')
            ->assertJsonPath('data.0.yield_percentage', '96%')
            ->assertJsonPath('summary.total_batches', 1)
            ->assertJsonPath('summary.total_planned_quantity', '500.0000')
            ->assertJsonPath('summary.total_actual_quantity', '480.0000');

        // Cross-tenant verification: Tenant B's batch must not appear
        $response->assertDontSee('BAT-BETA-CONFIDENTIAL-999');
    }

    public function test_daily_production_report_aggregates_line_and_shift_adherence(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/daily_production/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'daily_production')
            ->assertJsonPath('data.0.line_name', 'Sewing Line Alpha 1')
            ->assertJsonPath('data.0.shift_name', 'Morning Shift')
            ->assertJsonPath('data.0.planned_quantity', 500)
            ->assertJsonPath('data.0.actual_quantity', 480)
            ->assertJsonPath('data.0.scrap_quantity', 20)
            ->assertJsonPath('data.0.adherence_percent', 96);
    }

    public function test_production_target_vs_achievement_calculates_line_utilization(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/production_target_vs_achievement/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'production_target_vs_achievement')
            ->assertJsonPath('data.0.line_code', 'LINE-SEW-01')
            ->assertJsonPath('data.0.daily_capacity', 600)
            ->assertJsonPath('data.0.target_quantity', 500)
            ->assertJsonPath('data.0.achieved_quantity', 480)
            ->assertJsonPath('data.0.achievement_percent', 96)
            ->assertJsonPath('data.0.status', 'on_track');
    }

    public function test_worker_production_report_tracks_piece_rate_and_earnings(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/worker_production/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'worker_production')
            ->assertJsonPath('data.0.employee_code', 'EMP-001')
            ->assertJsonPath('data.0.worker_name', 'Mohammad Karim')
            ->assertJsonPath('data.0.quantity_produced', 200)
            ->assertJsonPath('data.0.quantity_rejected', 4)
            ->assertJsonPath('data.0.piece_rate', 2.5)
            ->assertJsonPath('data.0.earnings', 500); // 200 * 2.50 = 500

        $response->assertDontSee('EMP-BETA-SECRET');
    }
}
