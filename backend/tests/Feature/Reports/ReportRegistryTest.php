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

class ReportRegistryTest extends TestCase
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
            'name' => 'Reports Manager',
            'email' => 'reports@slicemart.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $jwtService = app(JwtService::class);
        $this->token = $jwtService->issueToken($this->user->id, $this->tenant->id);
        $this->actingAs($this->user);
    }

    public function test_can_list_report_definitions_from_registry(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'production_yield',
            'name' => 'Production Yield & Scrap Report',
            'module' => 'production',
            'category' => 'operational',
            'required_permission' => 'reports.production_yield.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'stock_valuation',
            'name' => 'Warehouse Stock Valuation',
            'module' => 'inventory',
            'category' => 'financial',
            'required_permission' => 'reports.stock_valuation.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/reports', [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $response->assertOk()
            ->assertJsonPath('meta.count', 2)
            ->assertJsonFragment(['code' => 'production_yield'])
            ->assertJsonFragment(['code' => 'stock_valuation']);
    }

    public function test_can_fetch_report_schema_contract(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'sales_performance',
            'name' => 'Channel Sales Performance',
            'module' => 'sales',
            'category' => 'analytical',
            'description' => 'Summary of orders, gross revenue, tax and payment status',
            'required_permission' => 'reports.sales_performance.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/reports/sales_performance/schema', [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.code', 'sales_performance')
            ->assertJsonPath('data.name', 'Channel Sales Performance')
            ->assertJsonPath('data.module', 'sales')
            ->assertJsonPath('data.tier', 'live');
    }
}
