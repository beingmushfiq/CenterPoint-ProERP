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

class SalesAnalyticsReportTest extends TestCase
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

        $companyA = Company::create([
            'tenant_id' => 1,
            'name' => 'Alpha Co',
            'code' => 'ALPHA',
            'currency_code' => 'BDT',
        ]);

        $companyB = Company::create([
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
            ['code' => 'sales_performance', 'name' => 'Sales Performance', 'module' => 'sales'],
            ['code' => 'sales_by_product', 'name' => 'Sales By Product', 'module' => 'sales'],
            ['code' => 'sales_by_customer', 'name' => 'Sales By Customer', 'module' => 'sales'],
            ['code' => 'sales_by_salesman', 'name' => 'Sales By Salesman', 'module' => 'sales'],
        ];

        foreach ($reports as $r) {
            ReportDefinition::create([
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'code' => $r['code'],
                'name' => $r['name'],
                'module' => $r['module'],
                'category' => 'sales',
                'description' => 'Sales report',
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
                'category' => 'sales',
                'description' => 'Sales report',
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

        // Seed Products for Tenant A
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

        // Seed Customer Party for Tenant A
        $partyA = DB::table('parties')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'CUST-001',
            'type' => 'customer',
            'name' => 'Apex Retail Ltd',
            'phone' => '+8801711000000',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Sales Order for Tenant A
        $soA = DB::table('sales_orders')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'SO-ALPHA-001',
            'order_date' => now()->toDateString(),
            'channel' => 'counter',
            'party_id' => $partyA,
            'salesperson_id' => $this->userA->id,
            'subtotal' => 1000.00,
            'tax_amount' => 50.00,
            'total_amount' => 1050.00,
            'paid_amount' => 1050.00,
            'due_amount' => 0.00,
            'status' => 'delivered',
            'payment_status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('sales_order_items')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'sales_order_id' => $soA,
            'product_id' => $prodA,
            'quantity' => 2.00,
            'unit_id' => $unitA,
            'unit_price' => 500.00,
            'line_total' => 1000.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Secret Sales Order for Tenant B (to verify isolation)
        $soB = DB::table('sales_orders')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'SO-BETA-CONFIDENTIAL-999',
            'order_date' => now()->toDateString(),
            'channel' => 'field',
            'subtotal' => 99999.00,
            'total_amount' => 99999.00,
            'paid_amount' => 99999.00,
            'due_amount' => 0.00,
            'status' => 'delivered',
            'payment_status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_sales_performance_report_returns_real_tenant_data_and_summary(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/sales_performance/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'sales_performance')
            ->assertJsonPath('data.0.order_number', 'SO-ALPHA-001')
            ->assertJsonPath('data.0.grand_total', 1050)
            ->assertJsonPath('data.0.customer_name', 'Apex Retail Ltd')
            ->assertJsonPath('summary.total_revenue', 1050)
            ->assertJsonPath('summary.total_orders', 1);

        // Crucial: Tenant B's order must NOT appear
        $response->assertDontSee('SO-BETA-CONFIDENTIAL-999');
    }

    public function test_sales_by_product_calculates_cogs_and_profit_margin(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/sales_by_product/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'sales_by_product')
            ->assertJsonPath('data.0.sku', 'TSHIRT-001')
            ->assertJsonPath('data.0.total_revenue', 1000)
            ->assertJsonPath('data.0.total_cogs', 600) // 2 units * standard_cost 300 = 600
            ->assertJsonPath('data.0.gross_profit', 400) // 1000 - 600 = 400
            ->assertJsonPath('data.0.margin_percent', 40); // (400 / 1000) * 100 = 40%
    }

    public function test_sales_by_customer_calculates_customer_spend_and_tier(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/sales_by_customer/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'sales_by_customer')
            ->assertJsonPath('data.0.customer_name', 'Apex Retail Ltd')
            ->assertJsonPath('data.0.total_orders', 1)
            ->assertJsonPath('data.0.total_spend', 1050)
            ->assertJsonPath('data.0.average_order_value', 1050);
    }

    public function test_sales_by_salesman_aggregates_rep_revenue(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/sales_by_salesman/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'sales_by_salesman')
            ->assertJsonPath('data.0.salesperson', 'Manager Alpha')
            ->assertJsonPath('data.0.orders_count', 1)
            ->assertJsonPath('data.0.total_revenue', 1050);
    }

    public function test_idor_prevention_tenant_a_cannot_pass_tenant_b_id_in_filters(): void
    {
        // Tenant A tries to explicitly pass tenant_id=2 in query params
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/sales_performance/data?tenant_id=2');

        // Middleware strictly detects mismatch and rejects with 403
        $response->assertStatus(403)
            ->assertJsonPath('error.code', 'TENANT_MISMATCH');
    }
}
