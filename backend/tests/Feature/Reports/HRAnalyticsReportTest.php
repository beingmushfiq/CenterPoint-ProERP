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

class HRAnalyticsReportTest extends TestCase
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
            'name' => 'HR Manager Alpha',
            'email' => 'hr@alpha.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $this->userB = User::create([
            'id' => 2,
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'name' => 'HR Manager Beta',
            'email' => 'hr@beta.com',
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
            ['code' => 'payroll_summary', 'name' => 'Payroll Summary', 'module' => 'hr'],
            ['code' => 'employee_directory', 'name' => 'Employee Directory', 'module' => 'hr'],
            ['code' => 'daily_attendance', 'name' => 'Daily Attendance', 'module' => 'hr'],
            ['code' => 'worker_piece_rate_summary', 'name' => 'Worker Piece-Rate Summary', 'module' => 'hr'],
        ];

        foreach ($reports as $r) {
            ReportDefinition::create([
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'code' => $r['code'],
                'name' => $r['name'],
                'module' => $r['module'],
                'category' => 'hr',
                'description' => 'HR report',
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
                'category' => 'hr',
                'description' => 'HR report',
                'required_permission' => 'reports.view',
                'supports_export' => true,
                'tier' => 'live',
                'is_active' => true,
            ]);
        }

        // Seed Departments & Designations for Tenant A
        $deptA = DB::table('departments')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => $compA->id,
            'code' => 'DEPT-PROD',
            'name' => 'Production & Sewing',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $desigA = DB::table('designations')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'DESIG-OP',
            'name' => 'Sewing Machine Operator',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Shifts
        $shiftA = DB::table('shifts')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'SHIFT-MORNING',
            'name' => 'Morning Shift (8AM - 5PM)',
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Employees
        $empA = DB::table('employees')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => $compA->id,
            'department_id' => $deptA,
            'designation_id' => $desigA,
            'employee_code' => 'EMP-HR-001',
            'first_name' => 'Nasir',
            'last_name' => 'Uddin',
            'display_name' => 'Nasir Uddin',
            'phone' => '+8801700998811',
            'date_of_joining' => '2024-03-01',
            'employment_type' => 'piece_rate',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $empB = DB::table('employees')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'company_id' => $compB->id,
            'employee_code' => 'EMP-BETA-CONFIDENTIAL-888',
            'first_name' => 'Beta',
            'last_name' => 'Secret',
            'display_name' => 'Beta Secret Employee',
            'phone' => '+8801700998899',
            'date_of_joining' => '2024-01-01',
            'employment_type' => 'permanent',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Payroll Periods
        $periodA = DB::table('payroll_periods')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => $compA->id,
            'period_code' => 'PAY-2026-08',
            'pay_frequency' => 'monthly',
            'period_start' => '2026-08-01',
            'period_end' => '2026-08-31',
            'payment_date' => '2026-09-05',
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $periodB = DB::table('payroll_periods')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'company_id' => $compB->id,
            'period_code' => 'PAY-BETA-CONFIDENTIAL-2026-08',
            'pay_frequency' => 'monthly',
            'period_start' => '2026-08-01',
            'period_end' => '2026-08-31',
            'payment_date' => '2026-09-05',
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Payslips
        DB::table('payslips')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'payroll_period_id' => $periodA,
            'employee_id' => $empA,
            'payslip_number' => 'PS-ALPHA-202608-001',
            'gross_amount' => 18500.00,
            'total_earnings' => 18500.00,
            'total_deductions' => 500.00,
            'net_amount' => 18000.00,
            'produced_quantity' => 1200.00,
            'payment_status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('payslips')->insert([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'payroll_period_id' => $periodB,
            'employee_id' => $empB,
            'payslip_number' => 'PS-BETA-CONFIDENTIAL-999',
            'gross_amount' => 99999.00,
            'total_earnings' => 99999.00,
            'total_deductions' => 0.00,
            'net_amount' => 99999.00,
            'payment_status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Attendance
        DB::table('attendances')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'employee_id' => $empA,
            'shift_id' => $shiftA,
            'attendance_date' => '2026-09-01',
            'check_in_at' => '2026-09-01 08:05:00',
            'check_out_at' => '2026-09-01 17:00:00',
            'worked_minutes' => 535,
            'late_minutes' => 5,
            'status' => 'present',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Product & Unit for Worker Production
        $unitA = DB::table('units')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'unit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $prodA = DB::table('products')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'sku' => 'TSHIRT-001',
            'name' => 'Cotton Crew T-Shirt',
            'type' => 'finished',
            'base_unit_id' => $unitA,
            'standard_cost' => 200.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $factoryA = DB::table('factories')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => $compA->id,
            'code' => 'FAC-HR-01',
            'name' => 'Factory HR 1',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $lineA = DB::table('production_lines')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'factory_id' => $factoryA,
            'code' => 'LINE-HR-01',
            'name' => 'Line HR 1',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $bomA = DB::table('bill_of_materials')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'product_id' => $prodA,
            'version' => '1.0',
            'name' => 'BoM HR 1',
            'output_quantity' => 1.00,
            'output_unit_id' => $unitA,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $batchA = DB::table('production_batches')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'batch_number' => 'BAT-HR-001',
            'factory_id' => $factoryA,
            'production_line_id' => $lineA,
            'product_id' => $prodA,
            'bill_of_material_id' => $bomA,
            'output_unit_id' => $unitA,
            'batch_date' => '2026-09-01',
            'planned_quantity' => 1000.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('worker_production_entries')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'production_batch_id' => $batchA,
            'employee_id' => $empA,
            'product_id' => $prodA,
            'work_date' => '2026-09-01',
            'measure_type' => 'piece',
            'quantity' => 150.00,
            'unit_id' => $unitA,
            'rejected_quantity' => 2.00,
            'rate_type' => 'piece_rate',
            'rate' => 3.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_payroll_summary_report_returns_real_data_and_summary(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/payroll_summary/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'payroll_summary')
            ->assertJsonPath('data.0.period_code', 'PAY-2026-08')
            ->assertJsonPath('data.0.employee_name', 'Nasir Uddin (EMP-HR-001)')
            ->assertJsonPath('data.0.produced_quantity', '1200.00')
            ->assertJsonPath('data.0.gross_amount', '18500.0000')
            ->assertJsonPath('data.0.net_amount', '18000.0000')
            ->assertJsonPath('data.0.payment_status', 'paid')
            ->assertJsonPath('summary.total_payslips', 1)
            ->assertJsonPath('summary.total_gross', '18500.0000')
            ->assertJsonPath('summary.total_net', '18000.0000');

        // Cross-tenant verification: Tenant B's payslip must not appear
        $response->assertDontSee('PS-BETA-CONFIDENTIAL-999');
        $response->assertDontSee('EMP-BETA-CONFIDENTIAL-888');
    }

    public function test_employee_directory_report_displays_workforce_distribution(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/employee_directory/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'employee_directory')
            ->assertJsonPath('data.0.employee_code', 'EMP-HR-001')
            ->assertJsonPath('data.0.name', 'Nasir Uddin')
            ->assertJsonPath('data.0.department', 'Production & Sewing')
            ->assertJsonPath('data.0.designation', 'Sewing Machine Operator')
            ->assertJsonPath('data.0.employment_type', 'Piece rate')
            ->assertJsonPath('data.0.phone', '+8801700998811');
    }

    public function test_daily_attendance_report_calculates_punch_and_punctuality(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/daily_attendance/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'daily_attendance')
            ->assertJsonPath('data.0.employee_code', 'EMP-HR-001')
            ->assertJsonPath('data.0.check_in', '08:05')
            ->assertJsonPath('data.0.check_out', '17:00')
            ->assertJsonPath('data.0.late_minutes', 5)
            ->assertJsonPath('data.0.status', 'present');
    }

    public function test_worker_piece_rate_summary_aggregates_completed_pieces(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/worker_piece_rate_summary/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'worker_piece_rate_summary')
            ->assertJsonPath('data.0.employee_code', 'EMP-HR-001')
            ->assertJsonPath('data.0.total_pieces', 150)
            ->assertJsonPath('data.0.total_rejected', 2)
            ->assertJsonPath('data.0.total_earnings', 450); // 150 * 3.00 = 450
    }
}
