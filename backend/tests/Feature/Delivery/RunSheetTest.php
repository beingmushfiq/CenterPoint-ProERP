<?php

declare(strict_types=1);

namespace Tests\Feature\Delivery;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Branch;
use App\Models\Party;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Sales\Models\DeliveryOrder;
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class RunSheetTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private User $rider;

    private Branch $branch;

    private string $jwt;

    private DeliveryOrder $order1;

    private DeliveryOrder $order2;

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
            'name' => 'SliceMart BD',
            'slug' => 'slicemart-bd',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $companyId = DB::table('companies')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'SliceMart Retail',
            'legal_name' => 'SliceMart Retail Ltd.',
            'tax_identifier' => 'BIN-RS-01',
            'registration_number' => 'REG-RS-01',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->branch = Branch::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $companyId,
            'code' => 'BR-DHK',
            'name' => 'Dhaka Main Branch',
            'type' => 'warehouse',
            'is_active' => true,
        ]);

        $this->user = User::create([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'email' => 'manager@slicemart.com',
            'password' => Hash::make('password123'),
            'name' => 'Dispatch Manager',
            'is_active' => true,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $role = \App\Models\Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Super Administrator',
            'slug' => 'super-administrator',
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role);

        $this->rider = User::create([
            'id' => 2,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'email' => 'rider@slicemart.com',
            'password' => Hash::make('password123'),
            'name' => 'Karim Rider',
            'is_active' => true,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $this->jwt = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: 1,
            tokenVersion: 1
        );

        $customer = Party::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'party_type' => 'customer',
            'code' => 'CUST-001',
            'name' => 'Retail Customer',
            'phone' => '+8801722222222',
            'is_active' => true,
        ]);

        $warehouse = Warehouse::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-MAIN',
            'name' => 'Main Warehouse',
            'is_active' => true,
        ]);

        $salesOrder = SalesOrder::create([
            'tenant_id' => $this->tenant->id,
            'order_number' => 'SO-2026-003',
            'party_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
            'channel' => 'direct',
            'subtotal' => '1000.0000',
            'tax_amount' => '0.0000',
            'total_amount' => '1000.0000',
            'status' => 'approved',
            'payment_status' => 'unpaid',
            'order_date' => now(),
        ]);

        $this->order1 = DeliveryOrder::create([
            'tenant_id' => $this->tenant->id,
            'delivery_number' => 'DO-2026-003A',
            'sales_order_id' => $salesOrder->id,
            'party_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
            'recipient_name' => 'Customer A',
            'recipient_phone' => '+8801722222222',
            'delivery_type' => 'own_delivery',
            'status' => 'pending',
            'cod_amount' => '500.0000',
        ]);

        $this->order2 = DeliveryOrder::create([
            'tenant_id' => $this->tenant->id,
            'delivery_number' => 'DO-2026-003B',
            'sales_order_id' => $salesOrder->id,
            'party_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
            'recipient_name' => 'Customer B',
            'recipient_phone' => '+8801733333333',
            'delivery_type' => 'own_delivery',
            'status' => 'pending',
            'cod_amount' => '500.0000',
        ]);
    }

    public function test_can_create_run_sheet_and_complete_deliveries(): void
    {
        $payload = [
            'branch_id' => $this->branch->id,
            'rider_id' => $this->rider->id,
            'run_date' => date('Y-m-d'),
            'delivery_order_ids' => [$this->order1->id, $this->order2->id],
        ];

        $response = $this->withHeader('Authorization', 'Bearer '.$this->jwt)
            ->postJson('/api/v1/logistics/run-sheets', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'dispatched')
            ->assertJsonPath('data.total_stops', 2)
            ->assertJsonPath('data.total_cod_expected', '1000.0000');

        $runSheetId = $response->json('data.id');

        $this->order1->refresh();
        $this->assertSame('in_transit', $this->order1->status);
        $this->assertEquals($runSheetId, $this->order1->run_sheet_id);

        // Complete the run sheet
        $completePayload = [
            'deliveries' => [
                [
                    'delivery_order_id' => $this->order1->id,
                    'status' => 'delivered',
                    'cod_collected' => '500.0000',
                ],
                [
                    'delivery_order_id' => $this->order2->id,
                    'status' => 'delivered',
                    'cod_collected' => '500.0000',
                ],
            ],
        ];

        $completeResponse = $this->withHeader('Authorization', 'Bearer '.$this->jwt)
            ->postJson("/api/v1/logistics/run-sheets/{$runSheetId}/complete", $completePayload);

        $completeResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.completed_stops', 2)
            ->assertJsonPath('data.total_cod_collected', '1000.0000');

        $this->order1->refresh();
        $this->assertSame('delivered', $this->order1->status);
        $this->assertSame('collected', $this->order1->cod_status);
    }
}
