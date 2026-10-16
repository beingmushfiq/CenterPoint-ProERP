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

class ReportDataReconciliationTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected Company $company;

    protected User $user;

    protected string $token;

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
            'name' => 'SliceMart Test Tenant',
            'slug' => 'slicemart-test',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->company = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'SliceMart Apparels Ltd',
            'code' => 'SM-APP',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'fiscal_year_start_month' => 7,
            'is_active' => true,
        ]);

        $this->user = User::create([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Auditor',
            'email' => 'auditor@slicemart.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $jwtService = app(JwtService::class);
        $this->token = $jwtService->issueToken($this->user->id, $this->tenant->id);
        $this->actingAs($this->user);
    }

    public function test_production_yield_report_reconciles_to_batches_with_freshness_stamp(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'production_yield',
            'name' => 'Production Yield',
            'module' => 'production',
            'category' => 'operational',
            'required_permission' => 'reports.production_yield.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        $unitId = DB::table('units')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'piece',
            'precision' => 0,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $productId = DB::table('products')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sku' => 'TSH-001',
            'name' => 'Cotton Crew T-Shirt',
            'type' => 'finished',
            'base_unit_id' => $unitId,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $factoryId = DB::table('factories')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Main Factory',
            'code' => 'FAC-01',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $bomId = DB::table('bill_of_materials')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Standard T-Shirt BOM',
            'product_id' => $productId,
            'version' => 1,
            'status' => 'approved',
            'output_quantity' => 1,
            'output_unit_id' => $unitId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('production_batches')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'factory_id' => $factoryId,
            'batch_number' => 'BAT-202608-001',
            'product_id' => $productId,
            'bill_of_material_id' => $bomId,
            'batch_date' => '2026-08-28',
            'output_unit_id' => $unitId,
            'planned_quantity' => 1000,
            'total_output_quantity' => 980,
            'variance_quantity' => 20,
            'yield_percentage' => 98.0,
            'status' => 'completed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/reports/production_yield/data', [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $response->assertOk()
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('data.0.batch_number', 'BAT-202608-001')
            ->assertJsonPath('data.0.planned_quantity', '1000.00')
            ->assertJsonPath('data.0.actual_quantity', '980.00')
            ->assertJsonPath('data.0.yield_percentage', '98%')
            ->assertJsonPath('summary.total_batches', 1)
            ->assertJsonPath('summary.total_actual_quantity', '980.0000')
            ->assertJsonPath('meta.freshness.tier', 'live')
            ->assertJsonPath('meta.freshness.stale', false);
    }

    public function test_general_ledger_summary_report_verifies_balance_equilibrium(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'gl_summary',
            'name' => 'General Ledger Summary Trial Balance',
            'module' => 'finance',
            'category' => 'financial',
            'required_permission' => 'reports.gl_summary.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        $coaCash = DB::table('chart_of_accounts')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'uuid' => (string) Str::uuid(),
            'account_code' => '1010',
            'name' => 'Cash on Hand',
            'account_type' => 'asset',
            'account_subtype' => 'cash',
            'normal_balance' => 'debit',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $coaSales = DB::table('chart_of_accounts')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'uuid' => (string) Str::uuid(),
            'account_code' => '4010',
            'name' => 'Sales Revenue',
            'account_type' => 'income',
            'account_subtype' => 'sales',
            'normal_balance' => 'credit',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $jeId = DB::table('journal_entries')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'uuid' => (string) Str::uuid(),
            'entry_number' => 'JE-0001',
            'entry_date' => '2026-08-28',
            'entry_type' => 'manual',
            'total_debit' => 5000.00,
            'total_credit' => 5000.00,
            'status' => 'posted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('journal_lines')->insert([
            [
                'tenant_id' => $this->tenant->id,
                'uuid' => (string) Str::uuid(),
                'journal_entry_id' => $jeId,
                'account_id' => $coaCash,
                'debit_amount' => 5000.00,
                'credit_amount' => 0.00,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'tenant_id' => $this->tenant->id,
                'uuid' => (string) Str::uuid(),
                'journal_entry_id' => $jeId,
                'account_id' => $coaSales,
                'debit_amount' => 0.00,
                'credit_amount' => 5000.00,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->getJson('/api/v1/reports/gl_summary/data', [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $response->assertOk()
            ->assertJsonPath('summary.total_debits', '5000.0000')
            ->assertJsonPath('summary.total_credits', '5000.0000')
            ->assertJsonPath('summary.is_balanced', true);
    }
}
