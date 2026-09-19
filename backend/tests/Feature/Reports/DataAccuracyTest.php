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

/**
 * Phase 12 — Data Accuracy Testing
 *
 * Mathematically validates the core balance equations across major operational reports:
 * 1. Inventory: Opening + Stock In - Stock Out ± Adjustments = Closing
 * 2. Sales: Revenue - COGS = Gross Profit
 * 3. Production: Material Input -> Production -> Wastage -> Rework -> Finished Goods
 * 4. Salesman: Target - Converted Sales = Remaining Target Gap
 * 5. Employee: Target -> Actual -> Achievement % -> Incentive Accrual
 */
class DataAccuracyTest extends TestCase
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
            'name' => 'Data Accuracy Test Tenant',
            'slug' => 'accuracy-tenant',
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
            'name' => 'Data Accuracy Manufacturing Ltd',
            'code' => 'DAM-LTD',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'fiscal_year_start_month' => 7,
            'is_active' => true,
        ]);

        $this->user = User::create([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Auditor General',
            'email' => 'auditor@accuracy.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
            'is_platform_admin' => true,
        ]);

        $jwtService = app(JwtService::class);
        $this->token = $jwtService->issueToken($this->user->id, $this->tenant->id);
        $this->actingAs($this->user);
    }

    /**
     * Test 1: Inventory Balance Identity
     * Equation: Opening (500) + In (200) - Out (150) - Adjustment (10) = Closing (540)
     */
    public function test_inventory_stock_balance_equation_reconciles_exactly(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'stock_ledger',
            'name' => 'Stock Movement Ledger',
            'module' => 'inventory',
            'category' => 'operational',
            'required_permission' => 'inventory.reports.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'stock_valuation',
            'name' => 'Inventory Valuation FIFO',
            'module' => 'inventory',
            'category' => 'financial',
            'required_permission' => 'inventory.reports.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        $unitId = DB::table('units')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'MTR',
            'name' => 'Meter',
            'type' => 'length',
            'precision' => 2,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $warehouseId = DB::table('warehouses')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Central RM Warehouse',
            'code' => 'WH-RM',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $productId = DB::table('products')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sku' => 'FAB-COTTON-01',
            'name' => 'Organic Raw Cotton Twill',
            'type' => 'raw_material',
            'base_unit_id' => $unitId,
            'standard_cost' => 120.00,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Manually tracked ledger movements:
        // Movement 1: Opening balance (+500)
        DB::table('stock_movements')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'movement_number' => 'MOV-001',
            'warehouse_id' => $warehouseId,
            'product_id' => $productId,
            'unit_id' => $unitId,
            'movement_type' => 'opening_balance',
            'direction' => 'in',
            'quantity' => 500,
            'unit_cost' => 120.00,
            'total_cost' => 60000.00,
            'balance_after' => 500,
            'moved_at' => '2026-09-01 08:00:00',
            'created_at' => now(),
        ]);

        // Movement 2: Stock In from Supplier GRN (+200)
        DB::table('stock_movements')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'movement_number' => 'MOV-002',
            'warehouse_id' => $warehouseId,
            'product_id' => $productId,
            'unit_id' => $unitId,
            'movement_type' => 'purchase_receipt',
            'direction' => 'in',
            'quantity' => 200,
            'unit_cost' => 120.00,
            'total_cost' => 24000.00,
            'balance_after' => 700,
            'moved_at' => '2026-09-05 10:00:00',
            'created_at' => now(),
        ]);

        // Movement 3: Stock Out for Production Batch (-150)
        DB::table('stock_movements')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'movement_number' => 'MOV-003',
            'warehouse_id' => $warehouseId,
            'product_id' => $productId,
            'unit_id' => $unitId,
            'movement_type' => 'production_consumption',
            'direction' => 'out',
            'quantity' => 150,
            'unit_cost' => 120.00,
            'total_cost' => 18000.00,
            'balance_after' => 550,
            'moved_at' => '2026-09-10 14:00:00',
            'created_at' => now(),
        ]);

        // Movement 4: Damaged Scrap Adjustment (-10)
        DB::table('stock_movements')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'movement_number' => 'MOV-004',
            'warehouse_id' => $warehouseId,
            'product_id' => $productId,
            'unit_id' => $unitId,
            'movement_type' => 'adjustment',
            'direction' => 'out',
            'quantity' => 10,
            'unit_cost' => 120.00,
            'total_cost' => 1200.00,
            'balance_after' => 540,
            'moved_at' => '2026-09-12 16:00:00',
            'created_at' => now(),
        ]);

        // Current stock balance recorded in perpetual ledger
        $expectedClosingQty = 500 + 200 - 150 - 10; // 540
        $expectedValuation = $expectedClosingQty * 120.00; // 64,800

        DB::table('stock_balances')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'warehouse_id' => $warehouseId,
            'product_id' => $productId,
            'stock_state' => 'available',
            'quantity' => $expectedClosingQty,
            'average_cost' => 120.00,
            'total_value' => $expectedValuation,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 1. Verify Stock Movement Ledger Report
        $ledgerRes = $this->getJson('/api/v1/reports/stock_ledger/data', [
            'Authorization' => 'Bearer ' . $this->token,
        ]);

        $ledgerRes->assertOk();
        $ledgerRows = $ledgerRes->json('data');
        $this->assertCount(4, $ledgerRows);
        $this->assertEquals(540.0, (float) $ledgerRows[0]['balance_after']);

        // 2. Verify Inventory Valuation FIFO Report
        $valRes = $this->getJson('/api/v1/reports/stock_valuation/data', [
            'Authorization' => 'Bearer ' . $this->token,
        ]);

        $valRes->assertOk();
        $valRow = $valRes->json('data.0');
        $this->assertEquals('FAB-COTTON-01', $valRow['sku']);
        $this->assertEquals(540.0, (float) $valRow['quantity_on_hand']);
        $this->assertEquals(120.0, (float) $valRow['unit_cost']);
        $this->assertEquals(64800.0, (float) $valRow['total_valuation']);
    }

    /**
     * Test 2: Sales Gross Profit Identity
     * Equation: Invoice Total (৳5,000) - Cost of Goods Sold (৳3,000) = Gross Profit (৳2,000, 40%)
     */
    public function test_sales_gross_profit_equation_reconciles_exactly(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'invoice_profit',
            'name' => 'Invoice Profitability',
            'module' => 'profit',
            'category' => 'financial',
            'required_permission' => 'reports.view',
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

        $partyId = DB::table('parties')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'CUST-001',
            'name' => 'Beximco Fashion Retail',
            'type' => 'customer',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $productId = DB::table('products')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sku' => 'SHIRT-LUX-01',
            'name' => 'Executive Denim Shirt',
            'type' => 'finished',
            'base_unit_id' => $unitId,
            'standard_cost' => 600.00,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $orderId = DB::table('sales_orders')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'SO-2026-0001',
            'order_date' => '2026-09-15',
            'party_id' => $partyId,
            'customer_name' => 'Beximco Fashion Retail',
            'total_amount' => 5000.00,
            'paid_amount' => 5000.00,
            'status' => 'confirmed',
            'payment_status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('sales_order_items')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sales_order_id' => $orderId,
            'product_id' => $productId,
            'unit_id' => $unitId,
            'quantity' => 5.0,
            'unit_price' => 1000.00,
            'line_total' => 5000.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/reports/invoice_profit/data', [
            'Authorization' => 'Bearer ' . $this->token,
        ]);

        $response->assertOk();
        $row = $response->json('data.0');

        $this->assertEquals('SO-2026-0001', $row['order_number']);
        $this->assertEquals(5000.00, (float) $row['revenue']);
        $this->assertEquals(3000.00, (float) $row['cost_of_goods']); // 5 pcs * 600
        $this->assertEquals(2000.00, (float) $row['gross_profit']); // 5000 - 3000
        $this->assertEquals('40%', $row['margin_percent']); // (2000 / 5000) * 100
    }

    /**
     * Test 3: Production Material & Yield Accuracy
     * Equation: Planned (1,000) -> Output (920, 92%) + Scrap (50, 5%) + Variance (80, 8%)
     */
    public function test_production_yield_and_scrap_equations_reconcile_exactly(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'production_efficiency',
            'name' => 'Production Efficiency Report',
            'module' => 'production',
            'category' => 'operational',
            'required_permission' => 'reports.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'production_wastage_scrap',
            'name' => 'Production Wastage & Scrap',
            'module' => 'production',
            'category' => 'operational',
            'required_permission' => 'reports.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        $factoryId = DB::table('factories')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'company_id' => $this->company->id,
            'name' => 'Dhaka Stitching Unit 1',
            'code' => 'DSU-1',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $unitId = DB::table('units')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'PCS',
            'name' => 'Piece',
            'type' => 'piece',
            'precision' => 0,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $productId = DB::table('products')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sku' => 'POLO-001',
            'name' => 'Classic Pique Polo',
            'type' => 'finished',
            'base_unit_id' => $unitId,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $bomId = DB::table('bill_of_materials')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Polo BOM Spec',
            'product_id' => $productId,
            'version' => 1,
            'status' => 'approved',
            'output_quantity' => 1,
            'output_unit_id' => $unitId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $batchId = DB::table('production_batches')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'factory_id' => $factoryId,
            'batch_number' => 'BAT-202609-POLO',
            'product_id' => $productId,
            'bill_of_material_id' => $bomId,
            'batch_date' => '2026-09-16',
            'output_unit_id' => $unitId,
            'planned_quantity' => 1000.0,
            'total_output_quantity' => 920.0,
            'yield_percentage' => 92.00,
            'variance_percentage' => 8.00,
            'status' => 'completed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $reasonId = DB::table('reason_codes')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'SEW-DEF',
            'name' => 'Sewing Defect / Needle Cut',
            'context' => 'wastage',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('wastage_records')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'wastage_number' => 'WST-2026-001',
            'production_batch_id' => $batchId,
            'product_id' => $productId,
            'stage' => 'output',
            'quantity' => 50.0,
            'unit_id' => $unitId,
            'reason_code_id' => $reasonId,
            'estimated_cost' => 15000.0,
            'recorded_at' => '2026-09-16 17:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 1. Verify Production Efficiency Report
        $effRes = $this->getJson('/api/v1/reports/production_efficiency/data', [
            'Authorization' => 'Bearer ' . $this->token,
        ]);

        $effRes->assertOk();
        $effRow = $effRes->json('data.0');
        $this->assertEquals('BAT-202609-POLO', $effRow['batch_number']);
        $this->assertEquals(1000.0, (float) $effRow['planned_quantity']);
        $this->assertEquals(920.0, (float) $effRow['actual_quantity']);
        $this->assertEquals('92%', $effRow['yield_percentage']);
        $this->assertEquals('8%', $effRow['variance_percentage']);

        // 2. Verify Production Wastage Report
        $scrapRes = $this->getJson('/api/v1/reports/production_wastage_scrap/data', [
            'Authorization' => 'Bearer ' . $this->token,
        ]);

        $scrapRes->assertOk();
        $scrapRow = $scrapRes->json('data.0');
        $this->assertEquals('WST-2026-001', $scrapRow['wastage_number']);
        $this->assertEquals('BAT-202609-POLO', $scrapRow['batch_number']);
        $this->assertEquals(50.0, (float) $scrapRow['scrap_quantity']);
        $this->assertEquals(15000.0, (float) $scrapRow['estimated_cost']);
    }

    /**
     * Test 4: Salesman Target Achievement & Remaining Gap
     * Equation: Monthly Target (৳500,000) - Converted Sales (৳350,000) = Remaining Gap (৳150,000, 70%)
     */
    public function test_salesman_target_and_remaining_gap_reconciles_exactly(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'salesman_quota_achievement',
            'name' => 'Salesman Quota Achievement',
            'module' => 'salesmen',
            'category' => 'operational',
            'required_permission' => 'reports.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'salesman_remaining_target',
            'name' => 'Salesman Remaining Target',
            'module' => 'salesmen',
            'category' => 'operational',
            'required_permission' => 'reports.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        $salesman = User::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Kamal Hossain',
            'email' => 'kamal@accuracy.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        // Salesman converts 2 orders totaling ৳350,000
        DB::table('sales_orders')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'SO-KAMAL-01',
            'order_date' => '2026-09-10',
            'salesperson_id' => $salesman->id,
            'customer_name' => 'Chittagong Mart',
            'total_amount' => 200000.00,
            'paid_amount' => 200000.00,
            'status' => 'delivered',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('sales_orders')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'SO-KAMAL-02',
            'order_date' => '2026-09-14',
            'salesperson_id' => $salesman->id,
            'customer_name' => 'Sylhet Plaza',
            'total_amount' => 150000.00,
            'paid_amount' => 150000.00,
            'status' => 'delivered',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 1. Quota Achievement Report
        $quotaRes = $this->getJson('/api/v1/reports/salesman_quota_achievement/data', [
            'Authorization' => 'Bearer ' . $this->token,
        ]);

        $quotaRes->assertOk();
        $quotaRow = $quotaRes->json('data.0');
        $this->assertEquals('Kamal Hossain', $quotaRow['salesman_name']);
        $this->assertEquals(2, (int) $quotaRow['orders_closed']);
        $this->assertEquals(500000.0, (float) $quotaRow['target_quota']);
        $this->assertEquals(350000.0, (float) $quotaRow['achieved_revenue']);
        $this->assertEquals('70%', $quotaRow['achievement_percent']);

        // 2. Remaining Target Gap Report
        $gapRes = $this->getJson('/api/v1/reports/salesman_remaining_target/data', [
            'Authorization' => 'Bearer ' . $this->token,
        ]);

        $gapRes->assertOk();
        $gapRow = $gapRes->json('data.0');
        $this->assertEquals('Kamal Hossain', $gapRow['salesman_name']);
        $this->assertEquals(500000.0, (float) $gapRow['monthly_target']);
        $this->assertEquals(350000.0, (float) $gapRow['achieved_amount']);
        $this->assertEquals(150000.0, (float) $gapRow['remaining_gap']); // 500k - 350k
    }

    /**
     * Test 5: Employee Output & Incentive Accrual
     * Equation: Collected Revenue (৳400,000) * 3% Incentive Rate = ৳12,000 Accrual
     */
    public function test_employee_incentive_accrual_equation_reconciles_exactly(): void
    {
        ReportDefinition::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'salesman_incentive_accrual',
            'name' => 'Salesman Incentive Accrual',
            'module' => 'salesmen',
            'category' => 'financial',
            'required_permission' => 'reports.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        $salesman = User::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Nasir Uddin',
            'email' => 'nasir@accuracy.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        DB::table('sales_orders')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'SO-NASIR-01',
            'order_date' => '2026-09-17',
            'salesperson_id' => $salesman->id,
            'customer_name' => 'Apex Footwear Store',
            'total_amount' => 400000.00,
            'paid_amount' => 400000.00,
            'status' => 'delivered',
            'payment_status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/reports/salesman_incentive_accrual/data', [
            'Authorization' => 'Bearer ' . $this->token,
        ]);

        $response->assertOk();
        $row = $response->json('data.0');
        $this->assertEquals('Nasir Uddin', $row['salesman_name']);
        $this->assertEquals(400000.0, (float) $row['total_sales']);
        $this->assertEquals(400000.0, (float) $row['collected_sales']);
        $this->assertEquals('3.00%', $row['incentive_rate']);
        $this->assertEquals(12000.00, (float) $row['accrued_incentive']); // 400,000 * 0.03
    }
}
