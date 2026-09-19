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

class PurchaseAnalyticsReportTest extends TestCase
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
            'name' => 'Purchasing Manager Alpha',
            'email' => 'purchase@alpha.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $this->userB = User::create([
            'id' => 2,
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'name' => 'Purchasing Manager Beta',
            'email' => 'purchase@beta.com',
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
            ['code' => 'purchase_summary', 'name' => 'Purchase Order Summary', 'module' => 'purchasing'],
            ['code' => 'purchase_details', 'name' => 'Purchase Details & GRN Log', 'module' => 'purchasing'],
            ['code' => 'supplier_purchase', 'name' => 'Supplier-wise Purchase Analysis', 'module' => 'purchasing'],
            ['code' => 'supplier_due', 'name' => 'Supplier Payables & Aging Ledger', 'module' => 'purchasing'],
        ];

        foreach ($reports as $r) {
            ReportDefinition::create([
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'code' => $r['code'],
                'name' => $r['name'],
                'module' => $r['module'],
                'category' => 'purchasing',
                'description' => 'Purchasing report',
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
                'category' => 'purchasing',
                'description' => 'Purchasing report',
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
            'code' => 'KG',
            'name' => 'Kilograms',
            'type' => 'weight',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $unitB = DB::table('units')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'code' => 'MTR',
            'name' => 'Meters',
            'type' => 'unit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Suppliers (Parties)
        $supplierA = DB::table('parties')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'SUP-TEX-001',
            'type' => 'supplier',
            'name' => 'Beximco Textiles Ltd',
            'phone' => '+8801700112233',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $supplierB = DB::table('parties')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'code' => 'SUP-BETA-SECRET',
            'type' => 'supplier',
            'name' => 'Confidential Silk Suppliers',
            'phone' => '+8801700998877',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Products
        $prodA = DB::table('products')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'sku' => 'YARN-COT-01',
            'name' => 'Combed Cotton Yarn 30/1',
            'type' => 'raw_material',
            'base_unit_id' => $unitA,
            'standard_cost' => 250.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $prodB = DB::table('products')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'sku' => 'SILK-RAW-99',
            'name' => 'Confidential Raw Silk Thread',
            'type' => 'raw_material',
            'base_unit_id' => $unitB,
            'standard_cost' => 1500.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Purchase Orders for Tenant A
        $poA = DB::table('purchase_orders')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'po_number' => 'PO-ALPHA-202609-001',
            'party_id' => $supplierA,
            'company_id' => $compA->id,
            'order_date' => now()->toDateString(),
            'expected_date' => now()->addDays(7)->toDateString(),
            'currency_code' => 'BDT',
            'subtotal' => 50000.00,
            'tax_amount' => 2500.00,
            'total_amount' => 52500.00,
            'received_value' => 30000.00,
            'billed_value' => 20000.00, // Due = 52500 - 20000 = 32500
            'payment_terms' => 'Net 30',
            'status' => 'partially_received',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('purchase_order_items')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'purchase_order_id' => $poA,
            'product_id' => $prodA,
            'quantity' => 200.00,
            'unit_id' => $unitA,
            'unit_price' => 250.00,
            'line_total' => 50000.00,
            'received_quantity' => 120.00, // Pending = 200 - 120 = 80
            'billed_quantity' => 80.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Confidential Purchase Order for Tenant B
        $poB = DB::table('purchase_orders')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'po_number' => 'PO-BETA-CONFIDENTIAL-999',
            'party_id' => $supplierB,
            'company_id' => $compB->id,
            'order_date' => now()->toDateString(),
            'currency_code' => 'BDT',
            'subtotal' => 999999.00,
            'total_amount' => 999999.00,
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_purchase_summary_report_returns_real_po_data_and_summary(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/purchase_summary/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'purchase_summary')
            ->assertJsonPath('data.0.po_number', 'PO-ALPHA-202609-001')
            ->assertJsonPath('data.0.supplier_name', 'Beximco Textiles Ltd')
            ->assertJsonPath('data.0.total_amount', 52500)
            ->assertJsonPath('data.0.received_value', 30000)
            ->assertJsonPath('data.0.billed_value', 20000)
            ->assertJsonPath('data.0.status', 'partially_received')
            ->assertJsonPath('summary.total_pos', 1)
            ->assertJsonPath('summary.total_procurement_spend', 52500)
            ->assertJsonPath('summary.outstanding_ap_due', 32500);

        // Cross-tenant verification: Tenant B's confidential PO must not appear
        $response->assertDontSee('PO-BETA-CONFIDENTIAL-999');
        $response->assertDontSee('Confidential Silk Suppliers');
    }

    public function test_purchase_details_report_calculates_ordered_vs_received_and_pending(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/purchase_details/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'purchase_details')
            ->assertJsonPath('data.0.po_number', 'PO-ALPHA-202609-001')
            ->assertJsonPath('data.0.sku', 'YARN-COT-01')
            ->assertJsonPath('data.0.ordered_quantity', 200)
            ->assertJsonPath('data.0.received_quantity', 120)
            ->assertJsonPath('data.0.pending_quantity', 80) // 200 - 120 = 80
            ->assertJsonPath('data.0.unit_price', 250)
            ->assertJsonPath('data.0.line_total', 50000);
    }

    public function test_supplier_purchase_report_aggregates_spend_and_aov_per_vendor(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/supplier_purchase/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'supplier_purchase')
            ->assertJsonPath('data.0.supplier_code', 'SUP-TEX-001')
            ->assertJsonPath('data.0.supplier_name', 'Beximco Textiles Ltd')
            ->assertJsonPath('data.0.total_orders', 1)
            ->assertJsonPath('data.0.total_spend', 52500)
            ->assertJsonPath('data.0.average_po_value', 52500);
    }

    public function test_supplier_due_report_tracks_outstanding_accounts_payable(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/supplier_due/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'supplier_due')
            ->assertJsonPath('data.0.supplier_code', 'SUP-TEX-001')
            ->assertJsonPath('data.0.total_po_amount', 52500)
            ->assertJsonPath('data.0.billed_amount', 20000)
            ->assertJsonPath('data.0.outstanding_due', 32500) // 52500 - 20000 = 32500
            ->assertJsonPath('data.0.status', 'payable_pending');
    }
}
