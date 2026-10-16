<?php

declare(strict_types=1);

namespace Tests\Feature\Delivery;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Party;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Delivery\Adapters\PathaoCourierAdapter;
use App\Modules\Delivery\Models\CourierProvider;
use App\Modules\Sales\Models\DeliveryOrder;
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CourierShipmentTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private DeliveryOrder $deliveryOrder;

    private CourierProvider $provider;

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

        $this->user = User::create([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'email' => 'admin@slicemart.com',
            'password' => Hash::make('password123'),
            'name' => 'Admin User',
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
            'name' => 'John Doe',
            'phone' => '+8801700000000',
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
            'order_number' => 'SO-2026-001',
            'party_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
            'channel' => 'direct',
            'subtotal' => '1000.0000',
            'tax_amount' => '150.0000',
            'total_amount' => '1150.0000',
            'status' => 'approved',
            'payment_status' => 'unpaid',
            'order_date' => now(),
        ]);

        $this->deliveryOrder = DeliveryOrder::create([
            'tenant_id' => $this->tenant->id,
            'delivery_number' => 'DO-2026-001',
            'sales_order_id' => $salesOrder->id,
            'party_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
            'recipient_name' => 'John Doe',
            'recipient_phone' => '+8801700000000',
            'delivery_type' => 'own_delivery',
            'status' => 'pending',
            'cod_amount' => '1150.0000',
            'cod_status' => 'pending',
            'weight' => '2.5000',
        ]);

        $this->provider = CourierProvider::create([
            'tenant_id' => $this->tenant->id,
            'code' => 'PATHAO',
            'name' => 'Pathao Express',
            'adapter_class' => PathaoCourierAdapter::class,
            'is_active' => true,
            'credentials' => ['client_id' => 'p_id'],
            'default_charge' => '60.0000',
        ]);
    }

    public function test_can_book_and_track_courier_shipment(): void
    {
        $payload = [
            'delivery_order_id' => $this->deliveryOrder->id,
            'courier_provider_id' => $this->provider->id,
            'pickup_address' => 'Tejgaon Industrial Area, Dhaka',
        ];

        $response = $this->withHeader('Authorization', 'Bearer '.$this->jwt)
            ->postJson('/api/v1/logistics/shipments', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.provider_name', 'Pathao Express');

        $this->deliveryOrder->refresh();
        $this->assertSame('in_transit', $this->deliveryOrder->status);
        $this->assertSame('courier', $this->deliveryOrder->delivery_type);

        $shipmentId = $response->json('data.id');

        // Track shipment
        $trackResponse = $this->withHeader('Authorization', 'Bearer '.$this->jwt)
            ->postJson("/api/v1/logistics/shipments/{$shipmentId}/track");

        $trackResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'in_transit');

        // Get label URL
        $labelResponse = $this->withHeader('Authorization', 'Bearer '.$this->jwt)
            ->getJson("/api/v1/logistics/shipments/{$shipmentId}/label");

        $labelResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        // Cancel shipment
        $cancelResponse = $this->withHeader('Authorization', 'Bearer '.$this->jwt)
            ->postJson("/api/v1/logistics/shipments/{$shipmentId}/cancel", [
                'reason' => 'Customer requested cancellation',
            ]);

        $cancelResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'cancelled');

        $this->deliveryOrder->refresh();
        $this->assertSame('cancelled', $this->deliveryOrder->status);
    }
}
