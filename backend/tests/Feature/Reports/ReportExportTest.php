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

class ReportExportTest extends TestCase
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
            'name' => 'Finance Director',
            'email' => 'finance@slicemart.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $jwtService = app(JwtService::class);
        $this->token = $jwtService->issueToken($this->user->id, $this->tenant->id);
        $this->actingAs($this->user);
    }

    public function test_export_report_returns_202_job_contract(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'stock_valuation',
            'name' => 'Stock Valuation Export',
            'module' => 'inventory',
            'category' => 'financial',
            'required_permission' => 'reports.stock_valuation.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/reports/stock_valuation/export', [
            'format' => 'xlsx',
            'filters' => ['warehouse_id' => 1],
        ], [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $response->assertStatus(202)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.format', 'xlsx')
            ->assertJsonStructure([
                'message',
                'data' => [
                    'uuid',
                    'status',
                    'format',
                    'file_path',
                    'row_count',
                    'file_size_bytes',
                ],
            ]);
    }

    public function test_can_save_and_retrieve_custom_report_views(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'production_yield',
            'name' => 'Production Yield Report',
            'module' => 'production',
            'category' => 'operational',
            'required_permission' => 'reports.production_yield.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        $saveResponse = $this->postJson('/api/v1/reports/production_yield/views', [
            'name' => 'Cutting Floor Daily View',
            'filters' => ['product_id' => 10],
            'columns' => ['batch_number', 'actual_quantity', 'yield_percentage'],
            'is_default' => true,
        ], [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $saveResponse->assertCreated()
            ->assertJsonPath('data.name', 'Cutting Floor Daily View')
            ->assertJsonPath('data.is_default', true);

        $listResponse = $this->getJson('/api/v1/reports/production_yield/views', [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $listResponse->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Cutting Floor Daily View');
    }
}
