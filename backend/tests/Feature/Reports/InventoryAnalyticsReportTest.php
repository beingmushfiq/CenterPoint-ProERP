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

class InventoryAnalyticsReportTest extends TestCase
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

        Company::create([
            'tenant_id' => 1,
            'name' => 'Alpha Co',
            'code' => 'ALPHA',
            'currency_code' => 'BDT',
        ]);

        Company::create([
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
            ['code' => 'stock_valuation', 'name' => 'Stock Valuation', 'module' => 'inventory'],
            ['code' => 'current_stock', 'name' => 'Current Stock', 'module' => 'inventory'],
            ['code' => 'stock_ledger', 'name' => 'Perpetual Stock Ledger', 'module' => 'inventory'],
            ['code' => 'stock_movement', 'name' => 'Stock Movement', 'module' => 'inventory'],
            ['code' => 'low_stock', 'name' => 'Low Stock Alert', 'module' => 'inventory'],
        ];

        foreach ($reports as $r) {
            ReportDefinition::create([
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'code' => $r['code'],
                'name' => $r['name'],
                'module' => $r['module'],
                'category' => 'inventory',
                'description' => 'Inventory report',
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
                'category' => 'inventory',
                'description' => 'Inventory report',
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
            'code' => 'MTR',
            'name' => 'Meters',
            'type' => 'unit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Warehouses
        $warehouseA = DB::table('warehouses')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Central Factory Warehouse',
            'code' => 'WH-ALPHA-01',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $warehouseB = DB::table('warehouses')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'name' => 'Beta Secret Depot',
            'code' => 'WH-BETA-01',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Categories
        $catA = DB::table('categories')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Apparel',
            'code' => 'CAT-APP',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Product 1 (Normal Stock)
        $prod1 = DB::table('products')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'sku' => 'POLO-BLU-L',
            'name' => 'Blue Polo Shirt (Large)',
            'type' => 'finished',
            'category_id' => $catA,
            'base_unit_id' => $unitA,
            'standard_cost' => 450.00,
            'reorder_level' => 50.00,
            'reorder_quantity' => 100.00,
            'is_stock_tracked' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Product 2 (Low Stock Deficit)
        $prod2 = DB::table('products')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'sku' => 'BUTTON-WHT-10MM',
            'name' => 'White Resin Buttons (Pack)',
            'type' => 'raw_material',
            'category_id' => $catA,
            'base_unit_id' => $unitA,
            'standard_cost' => 15.00,
            'reorder_level' => 200.00,
            'reorder_quantity' => 500.00,
            'is_stock_tracked' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Product for Tenant B
        $prodB = DB::table('products')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'sku' => 'BETA-SECRET-ITEM',
            'name' => 'Confidential Silk Fabric',
            'type' => 'raw_material',
            'base_unit_id' => $unitB,
            'standard_cost' => 999.00,
            'is_stock_tracked' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Stock Balances for Tenant A
        DB::table('stock_balances')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'product_id' => $prod1,
            'warehouse_id' => $warehouseA,
            'batch_code' => 'BATCH-2026-01',
            'quantity' => 120.00,
            'average_cost' => 450.00,
            'total_value' => 54000.00,
            'stock_state' => 'available',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('stock_balances')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'product_id' => $prod2,
            'warehouse_id' => $warehouseA,
            'batch_code' => 'BATCH-BTN-09',
            'quantity' => 25.00, // Deficit! Reorder level is 200
            'average_cost' => 15.00,
            'total_value' => 375.00,
            'stock_state' => 'available',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Stock Balances for Tenant B
        DB::table('stock_balances')->insert([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'product_id' => $prodB,
            'warehouse_id' => $warehouseB,
            'batch_code' => 'BETA-BATCH-X',
            'quantity' => 9999.00,
            'average_cost' => 999.00,
            'total_value' => 9989001.00,
            'stock_state' => 'available',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Stock Movements for Tenant A
        DB::table('stock_movements')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'movement_number' => 'SM-202609-0001',
            'moved_at' => now()->subDays(2),
            'product_id' => $prod1,
            'warehouse_id' => $warehouseA,
            'unit_id' => $unitA,
            'movement_type' => 'receipt',
            'direction' => 'in',
            'quantity' => 150.00,
            'unit_cost' => 450.00,
            'total_cost' => 67500.00,
            'balance_after' => 150.00,
            'created_by' => $this->userA->id,
            'created_at' => now()->subDays(2),
        ]);

        DB::table('stock_movements')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'movement_number' => 'SM-202609-0002',
            'moved_at' => now()->subDay(),
            'product_id' => $prod1,
            'warehouse_id' => $warehouseA,
            'unit_id' => $unitA,
            'movement_type' => 'issue',
            'direction' => 'out',
            'quantity' => 30.00,
            'unit_cost' => 450.00,
            'total_cost' => 13500.00,
            'balance_after' => 120.00,
            'created_by' => $this->userA->id,
            'created_at' => now()->subDay(),
        ]);

        // Seed Stock Movement for Tenant B
        DB::table('stock_movements')->insert([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'movement_number' => 'SM-BETA-SECRET-0099',
            'moved_at' => now(),
            'product_id' => $prodB,
            'warehouse_id' => $warehouseB,
            'unit_id' => $unitB,
            'movement_type' => 'receipt',
            'direction' => 'in',
            'quantity' => 5000.00,
            'unit_cost' => 999.00,
            'total_cost' => 4995000.00,
            'balance_after' => 5000.00,
            'created_by' => $this->userB->id,
            'created_at' => now(),
        ]);
    }

    public function test_stock_valuation_report_returns_real_data_and_summary(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/stock_valuation/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'stock_valuation')
            ->assertJsonPath('data.0.sku', 'POLO-BLU-L')
            ->assertJsonPath('data.0.quantity_on_hand', 120)
            ->assertJsonPath('data.0.unit_cost', 450)
            ->assertJsonPath('data.0.total_valuation', 54000)
            ->assertJsonPath('summary.total_valuation', 54375) // 54000 + 375
            ->assertJsonPath('summary.total_quantity', 145); // 120 + 25

        // Cross-tenant verification: Tenant B's items must never appear
        $response->assertDontSee('BETA-SECRET-ITEM');
        $response->assertDontSee('WH-BETA-01');
    }

    public function test_current_stock_report_calculates_on_hand_and_stock_health(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/current_stock/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'current_stock')
            ->assertJsonPath('data.0.sku', 'POLO-BLU-L')
            ->assertJsonPath('data.0.available_qty', 120)
            ->assertJsonPath('data.0.total_on_hand', 120)
            ->assertJsonPath('data.0.status', 'healthy')
            ->assertJsonPath('data.1.sku', 'BUTTON-WHT-10MM')
            ->assertJsonPath('data.1.total_on_hand', 25)
            ->assertJsonPath('data.1.status', 'low_stock'); // 25 <= reorder_level 200
    }

    public function test_stock_ledger_report_tracks_perpetual_movements_in_chronological_order(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/stock_ledger/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'stock_ledger')
            ->assertJsonPath('pagination.total', 2)
            ->assertJsonPath('data.0.movement_number', 'SM-202609-0002') // latest first
            ->assertJsonPath('data.0.direction', 'OUT')
            ->assertJsonPath('data.0.quantity', 30)
            ->assertJsonPath('data.0.balance_after', 120)
            ->assertJsonPath('data.1.movement_number', 'SM-202609-0001')
            ->assertJsonPath('data.1.direction', 'IN')
            ->assertJsonPath('data.1.quantity', 150);

        $response->assertDontSee('SM-BETA-SECRET-0099');
    }

    public function test_stock_movement_report_aggregates_velocity_and_net_changes(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/stock_movement/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'stock_movement')
            ->assertJsonPath('data.0.sku', 'POLO-BLU-L')
            ->assertJsonPath('data.0.total_in', 150)
            ->assertJsonPath('data.0.total_out', 30)
            ->assertJsonPath('data.0.net_change', 120)
            ->assertJsonPath('data.0.transaction_count', 2);
    }

    public function test_low_stock_report_detects_deficits_and_calculates_restock_costs(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/low_stock/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'low_stock')
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('data.0.sku', 'BUTTON-WHT-10MM')
            ->assertJsonPath('data.0.current_stock', 25)
            ->assertJsonPath('data.0.reorder_level', 200)
            ->assertJsonPath('data.0.deficit', 175) // 200 - 25 = 175
            ->assertJsonPath('data.0.suggested_reorder_qty', 500)
            ->assertJsonPath('data.0.restock_cost', 7500) // 500 * standard_cost 15 = 7500
            ->assertJsonPath('data.0.status', 'low_stock_warning');
    }
}
