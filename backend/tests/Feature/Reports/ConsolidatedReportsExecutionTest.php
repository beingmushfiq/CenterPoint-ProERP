<?php

declare(strict_types=1);

namespace Tests\Feature\Reports;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Reports\Models\ReportDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ConsolidatedReportsExecutionTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;
    protected User $adminUser;
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
            'name' => 'SliceMart Industries Ltd',
            'slug' => 'slicemart-industries',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->adminUser = User::create([
            'id' => 1,
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Super Administrator',
            'email' => 'admin@slicemart.test',
            'password' => 'secret123',
            'status' => 'active',
            'is_platform_admin' => true,
        ]);

        $jwt = app(JwtService::class);
        $this->token = $jwt->issueToken($this->adminUser->id, 1);
        $this->actingAs($this->adminUser);

        TenantContext::bind($this->tenant->toArray());

        $definitions = [
            [
                'code' => 'best_selling_products',
                'name' => 'Best-Selling Products & SKU Velocity',
                'module' => 'sales',
                'category' => 'analytical',
                'required_permission' => 'sales.view',
            ],
            [
                'code' => 'batch_expiry_aging',
                'name' => 'Batch Expiry & Shelf-Life Aging',
                'module' => 'inventory',
                'category' => 'compliance',
                'required_permission' => 'inventory.view',
            ],
            [
                'code' => 'slow_moving_stock',
                'name' => 'Slow-Moving & Dead Stock Analyzer',
                'module' => 'inventory',
                'category' => 'analytical',
                'required_permission' => 'inventory.view',
            ],
            [
                'code' => 'supplier_scorecard',
                'name' => 'Supplier Performance & OTIF Scorecard',
                'module' => 'purchasing',
                'category' => 'executive',
                'required_permission' => 'purchasing.view',
            ],
        ];

        foreach ($definitions as $d) {
            ReportDefinition::create([
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'code' => $d['code'],
                'canonical_code' => null,
                'name' => $d['name'],
                'module' => $d['module'],
                'category' => $d['category'],
                'description' => $d['name'],
                'required_permission' => $d['required_permission'],
                'supports_export' => true,
                'tier' => 'live',
                'is_active' => true,
            ]);
        }
    }

    public function test_best_selling_products_report_runs_successfully(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/best_selling_products/data');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'report' => ['code', 'name', 'category', 'module'],
            'columns',
            'data',
            'pagination' => ['total', 'current_page', 'per_page', 'last_page'],
            'summary' => ['total_products_sold', 'total_units_sold', 'total_revenue', 'total_gross_profit', 'overall_margin_percentage', 'total_orders'],
        ]);
    }

    public function test_batch_expiry_aging_report_runs_successfully(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/batch_expiry_aging/data');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'report' => ['code', 'name', 'category', 'module'],
            'columns',
            'data',
            'pagination' => ['total', 'current_page', 'per_page'],
            'summary' => ['total_batch_records', 'total_quantity', 'expired_valuation', 'value_at_risk', 'expired_batches_count'],
        ]);
    }

    public function test_slow_moving_stock_report_runs_successfully(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/slow_moving_stock/data');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'report' => ['code', 'name', 'category', 'module'],
            'columns',
            'data',
            'pagination' => ['total', 'current_page', 'per_page'],
            'summary' => ['total_idle_skus', 'total_idle_quantity', 'total_idle_value'],
        ]);
    }

    public function test_supplier_scorecard_report_runs_successfully(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/supplier_scorecard/data');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'report' => ['code', 'name', 'category', 'module'],
            'columns',
            'data',
            'pagination' => ['total', 'current_page', 'per_page'],
            'summary' => ['total_suppliers', 'total_procurement_spend', 'avg_otif_rate', 'avg_lead_time_days', 'avg_rejection_rate'],
        ]);
    }

    public function test_legacy_aliases_route_to_new_canonical_reports(): void
    {
        // supplier_performance -> supplier_scorecard
        $respSupplier = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/supplier_performance/data');
        $respSupplier->assertStatus(200);
        $this->assertArrayHasKey('otif_rate', $respSupplier->json('columns'));

        // expiry_aging -> batch_expiry_aging
        $respExpiry = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/expiry_aging/data');
        $respExpiry->assertStatus(200);
        $this->assertArrayHasKey('days_remaining', $respExpiry->json('columns'));

        // slow_moving -> slow_moving_stock
        $respSlow = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/slow_moving/data');
        $respSlow->assertStatus(200);
        $this->assertArrayHasKey('days_idle', $respSlow->json('columns'));

        // best_selling -> best_selling_products
        $respBest = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/best_selling/data');
        $respBest->assertStatus(200);
        $this->assertArrayHasKey('sales_velocity', $respBest->json('columns'));
    }
}
