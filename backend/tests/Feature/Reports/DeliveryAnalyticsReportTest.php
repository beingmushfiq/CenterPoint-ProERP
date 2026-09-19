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

class DeliveryAnalyticsReportTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenantA;
    protected Tenant $tenantB;
    protected User $userA;
    protected User $userB;
    protected string $tokenA;
    protected string $tokenB;
    protected Company $companyA;
    protected Company $companyB;

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
            'name' => 'Tenant Beta Apparel',
            'slug' => 'beta-apparel',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenantA->toArray());

        $this->companyA = Company::create([
            'id' => 1,
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Alpha Logistics Co Ltd',
            'code' => 'ALC',
            'currency_code' => 'BDT',
            'is_active' => true,
        ]);

        $this->companyB = Company::create([
            'id' => 2,
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'name' => 'Beta Logistics Co Ltd',
            'code' => 'BLC',
            'currency_code' => 'BDT',
            'is_active' => true,
        ]);

        $this->userA = User::create([
            'id' => 1,
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Logistics Director Alpha',
            'email' => 'logistics@alpha.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $this->userB = User::create([
            'id' => 2,
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'name' => 'Logistics Director Beta',
            'email' => 'logistics@beta.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $jwt = app(JwtService::class);
        $this->tokenA = $jwt->issueToken($this->userA->id, 1);
        $this->tokenB = $jwt->issueToken($this->userB->id, 2);
        $this->actingAs($this->userA);

        $this->seedReportDefinitions();
    }

    protected function tearDown(): void
    {
        TenantContext::flush();
        parent::tearDown();
    }

    protected function seedReportDefinitions(): void
    {
        $definitions = [
            [
                'code' => 'pending_deliveries',
                'name' => 'Pending Deliveries & Dispatch Queue',
                'module' => 'delivery',
                'category' => 'operational',
                'tier' => 'live',
            ],
            [
                'code' => 'delivered_orders',
                'name' => 'Delivered Shipments & POD Log',
                'module' => 'delivery',
                'category' => 'operational',
                'tier' => 'live',
            ],
            [
                'code' => 'returned_orders',
                'name' => 'Returned (RTO) Consignments',
                'module' => 'delivery',
                'category' => 'operational',
                'tier' => 'live',
            ],
            [
                'code' => 'courier_performance',
                'name' => 'Courier Partner Fulfillment Performance',
                'module' => 'delivery',
                'category' => 'analytical',
                'tier' => 'daily',
            ],
        ];

        foreach ($definitions as $def) {
            ReportDefinition::create([
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'code' => $def['code'],
                'name' => $def['name'],
                'module' => $def['module'],
                'category' => $def['category'],
                'description' => 'Delivery report',
                'required_permission' => 'reports.view',
                'supports_export' => true,
                'tier' => $def['tier'],
                'is_active' => true,
            ]);

            ReportDefinition::create([
                'tenant_id' => 2,
                'uuid' => (string) Str::uuid(),
                'code' => $def['code'],
                'name' => $def['name'],
                'module' => $def['module'],
                'category' => $def['category'],
                'description' => 'Delivery report',
                'required_permission' => 'reports.view',
                'supports_export' => true,
                'tier' => $def['tier'],
                'is_active' => true,
            ]);
        }
    }

    protected function seedDeliveryData(): void
    {
        // Warehouse
        $warehouseA = DB::table('warehouses')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-CENTRAL',
            'name' => 'Central Hub Dhaka',
            'type' => 'finished_goods',
            'is_active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $warehouseB = DB::table('warehouses')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-BETA',
            'name' => 'Beta Hub',
            'type' => 'finished_goods',
            'is_active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Couriers
        $pathaoId = DB::table('courier_providers')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'pathao',
            'name' => 'Pathao Courier',
            'adapter_class' => 'App\\Modules\\Delivery\\Adapters\\PathaoAdapter',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $steadfastId = DB::table('courier_providers')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'steadfast',
            'name' => 'Steadfast Courier',
            'adapter_class' => 'App\\Modules\\Delivery\\Adapters\\SteadfastAdapter',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Customers
        $partyA = DB::table('parties')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'CUST-DEL-01',
            'name' => 'Tanvir Ahmed',
            'type' => 'customer',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Sales orders
        $so1 = DB::table('sales_orders')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'party_id' => $partyA,
            'order_number' => 'ORD-2026-001',
            'order_date' => '2026-09-10',
            'total_amount' => '3500.0000',
            'status' => 'confirmed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $so2 = DB::table('sales_orders')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'party_id' => $partyA,
            'order_number' => 'ORD-2026-002',
            'order_date' => '2026-09-11',
            'total_amount' => '5200.0000',
            'status' => 'confirmed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $so3 = DB::table('sales_orders')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'party_id' => $partyA,
            'order_number' => 'ORD-2026-003',
            'order_date' => '2026-09-12',
            'total_amount' => '1800.0000',
            'status' => 'confirmed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Delivery orders for Tenant A
        // 1. Pending dispatch
        DB::table('delivery_orders')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'delivery_number' => 'DO-2026-001',
            'sales_order_id' => $so1,
            'warehouse_id' => $warehouseA,
            'courier_provider_id' => $pathaoId,
            'recipient_name' => 'Tanvir Ahmed',
            'recipient_phone' => '+8801812345678',
            'delivery_type' => 'courier',
            'status' => 'pending',
            'cod_amount' => '3500.0000',
            'cod_collected_amount' => '0.0000',
            'cod_status' => 'pending',
            'scheduled_date' => '2026-09-20',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. In Transit
        DB::table('delivery_orders')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'delivery_number' => 'DO-2026-002',
            'sales_order_id' => $so2,
            'warehouse_id' => $warehouseA,
            'courier_provider_id' => $pathaoId,
            'recipient_name' => 'Farhana Kabir',
            'recipient_phone' => '+8801912345678',
            'delivery_type' => 'courier',
            'status' => 'in_transit',
            'cod_amount' => '5200.0000',
            'cod_collected_amount' => '0.0000',
            'cod_status' => 'pending',
            'scheduled_date' => '2026-09-19',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 3. Delivered
        DB::table('delivery_orders')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'delivery_number' => 'DO-2026-003',
            'sales_order_id' => $so3,
            'warehouse_id' => $warehouseA,
            'courier_provider_id' => $steadfastId,
            'recipient_name' => 'Kamal Hossain',
            'recipient_phone' => '+8801712345678',
            'delivery_type' => 'courier',
            'status' => 'delivered',
            'delivered_at' => '2026-09-18 14:30:00',
            'cod_amount' => '1800.0000',
            'cod_collected_amount' => '1800.0000',
            'cod_status' => 'collected',
            'pod_received_by' => 'Kamal Hossain (Self)',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 4. Returned (RTO)
        DB::table('delivery_orders')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'delivery_number' => 'DO-2026-004',
            'sales_order_id' => $so1,
            'warehouse_id' => $warehouseA,
            'courier_provider_id' => $steadfastId,
            'recipient_name' => 'Rafiqul Islam',
            'recipient_phone' => '+8801612345678',
            'delivery_type' => 'courier',
            'status' => 'returned',
            'cod_amount' => '2400.0000',
            'cod_collected_amount' => '0.0000',
            'cod_status' => 'not_applicable',
            'attempt_count' => 3,
            'special_instructions' => 'Customer phone switched off continuously',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Tenant B delivery order to test isolation
        $soBeta = DB::table('sales_orders')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'BETA-ORD-999',
            'order_date' => '2026-09-15',
            'total_amount' => '99999.0000',
            'status' => 'confirmed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('delivery_orders')->insert([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'delivery_number' => 'DO-BETA-SECRET-999',
            'sales_order_id' => $soBeta,
            'warehouse_id' => $warehouseB,
            'recipient_name' => 'Beta Secret VIP',
            'recipient_phone' => '+8801512345678',
            'delivery_type' => 'own_delivery',
            'status' => 'pending',
            'cod_amount' => '99999.0000',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_pending_deliveries_report_returns_staged_and_in_transit_orders(): void
    {
        $this->seedDeliveryData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/pending_deliveries/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'pending_deliveries');

        $data = $response->json('data');
        $this->assertCount(2, $data);

        $do1 = collect($data)->firstWhere('delivery_number', 'DO-2026-001');
        $this->assertNotNull($do1);
        $this->assertEquals('ORD-2026-001', $do1['order_number']);
        $this->assertEquals('Pathao Courier', $do1['courier_name']);
        $this->assertEquals('pending', $do1['status']);
        $this->assertEquals('3500.00', $do1['cod_amount']);

        $do2 = collect($data)->firstWhere('delivery_number', 'DO-2026-002');
        $this->assertNotNull($do2);
        $this->assertEquals('in_transit', $do2['status']);
    }

    public function test_delivered_orders_report_returns_delivered_consignments_with_pod(): void
    {
        $this->seedDeliveryData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/delivered_orders/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'delivered_orders');

        $data = $response->json('data');
        $this->assertCount(1, $data);

        $row = $data[0];
        $this->assertEquals('DO-2026-003', $row['delivery_number']);
        $this->assertEquals('Steadfast Courier', $row['courier_name']);
        $this->assertEquals('1800.00', $row['cod_collected_amount']);
        $this->assertEquals('collected', $row['cod_status']);
        $this->assertEquals('Kamal Hossain (Self)', $row['pod_received_by']);
    }

    public function test_returned_orders_report_returns_failed_and_cancelled_orders(): void
    {
        $this->seedDeliveryData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/returned_orders/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'returned_orders');

        $data = $response->json('data');
        $this->assertCount(1, $data);

        $row = $data[0];
        $this->assertEquals('DO-2026-004', $row['delivery_number']);
        $this->assertEquals('Steadfast Courier', $row['courier_name']);
        $this->assertEquals('returned', $row['status']);
        $this->assertEquals(3, $row['attempt_count']);
        $this->assertStringContainsString('switched off', $row['return_reason']);
    }

    public function test_courier_performance_report_calculates_fulfillment_metrics(): void
    {
        $this->seedDeliveryData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/courier_performance/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'courier_performance');

        $data = $response->json('data');
        $this->assertCount(2, $data);

        // Steadfast: 2 assigned (1 delivered, 1 returned) -> 50.00% success rate, 1800.00 collected
        $steadfast = collect($data)->firstWhere('courier_code', 'steadfast');
        $this->assertNotNull($steadfast);
        $this->assertEquals(2, $steadfast['total_assigned']);
        $this->assertEquals(1, $steadfast['total_delivered']);
        $this->assertEquals(1, $steadfast['total_returned']);
        $this->assertEquals('50.00%', $steadfast['success_rate']);
        $this->assertEquals('1800.00', $steadfast['total_cod_collected']);

        // Pathao: 2 assigned (0 delivered, 0 returned, 2 pending/in-transit) -> 0.00% success rate
        $pathao = collect($data)->firstWhere('courier_code', 'pathao');
        $this->assertNotNull($pathao);
        $this->assertEquals(2, $pathao['total_assigned']);
        $this->assertEquals(0, $pathao['total_delivered']);
    }

    public function test_strict_tenant_isolation_in_delivery_reports(): void
    {
        $this->seedDeliveryData();

        // Tenant A request
        $responseA = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/pending_deliveries/data');

        $responseA->assertOk();
        $responseA->assertDontSee('DO-BETA-SECRET-999');

        // Tenant B request
        $responseB = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenB}",
            'X-Tenant-ID' => (string) $this->tenantB->id,
        ])->getJson('/api/v1/reports/pending_deliveries/data');

        $responseB->assertOk();
        $responseB->assertSee('DO-BETA-SECRET-999');
        $responseB->assertDontSee('DO-2026-001');
    }
}
