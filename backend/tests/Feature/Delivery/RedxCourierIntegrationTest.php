<?php

declare(strict_types=1);

namespace Tests\Feature\Delivery;

use App\Core\Auth\JwtService;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Delivery\Adapters\RedxCourierAdapter;
use App\Modules\Delivery\Models\CourierProvider;
use App\Modules\Delivery\Models\CourierShipment;
use App\Modules\Sales\Models\DeliveryOrder;
use App\Modules\Sales\Models\SalesOrder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class RedxCourierIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $tenantUser;

    private string $tenantToken;

    private CourierProvider $redxProvider;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->tenant = Tenant::where('slug', 'slicemart')->firstOrFail();
        $this->tenantUser = User::withoutTenantScope()->where('email', 'admin@slicemart.test')->firstOrFail();

        $jwtService = app(JwtService::class);
        $this->tenantToken = $jwtService->issueToken(
            userId: $this->tenantUser->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1,
            permVersion: '1',
            scopes: []
        );

        $this->redxProvider = CourierProvider::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'redx',
            'name' => 'REDX Logistics Bangladesh',
            'adapter_class' => RedxCourierAdapter::class,
            'is_active' => true,
            'credentials' => ['api_key' => 'test_redx_api_key_xyz'],
            'capabilities' => ['create_shipment', 'cancel_shipment', 'get_status', 'webhooks'],
            'webhook_secret' => 'redx_secret_123',
            'default_charge' => '60.0000',
        ]);
    }

    public function test_can_process_redx_webhook_and_synchronize_shipment_status(): void
    {
        $customer = \App\Models\Party::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'CUST-REDX-001',
            'name' => 'Alice Customer',
            'party_types' => ['customer'],
            'is_active' => true,
        ]);

        $salesOrder = SalesOrder::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'SO-REDX-001',
            'party_id' => $customer->id,
            'channel' => 'ecommerce',
            'subtotal' => '450.0000',
            'tax_amount' => '0.0000',
            'total_amount' => '450.0000',
            'status' => 'approved',
            'payment_status' => 'unpaid',
            'order_date' => now(),
        ]);

        $deliveryOrder = DeliveryOrder::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'delivery_number' => 'DO-REDX-001',
            'sales_order_id' => $salesOrder->id,
            'party_id' => $customer->id,
            'warehouse_id' => 1,
            'status' => 'in_transit',
            'delivery_type' => 'courier',
            'recipient_name' => 'John Doe',
            'recipient_phone' => '+8801700000000',
            'cod_amount' => '450.0000',
            'cod_status' => 'pending',
        ]);

        // 2. Create courier shipment
        $shipment = CourierShipment::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'courier_provider_id' => $this->redxProvider->id,
            'delivery_order_id' => $deliveryOrder->id,
            'consignment_id' => 'REDX-TEST-999',
            'awb_number' => 'AWB-REDX-999',
            'status' => 'in_transit',
            'charge_amount' => '60.0000',
            'cod_amount' => '450.0000',
        ]);

        $deliveryOrder->update(['courier_shipment_id' => $shipment->id]);

        // 3. Post webhook payload from REDX for successful delivery
        $response = $this->postJson('/api/v1/webhooks/couriers/redx', [
            'event_id' => 'evt_redx_delivered_001',
            'tracking_id' => 'REDX-TEST-999',
            'status' => 'delivered_successful',
            'collected_amount' => '450.0000',
            'location' => 'Dhaka North Hub',
            'message' => 'Delivered to recipient with cash collected',
        ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.status', 'processed');

        // Verify status synchronized in database
        $this->assertDatabaseHas('courier_shipments', [
            'id' => $shipment->id,
            'status' => 'delivered',
        ]);

        $this->assertDatabaseHas('delivery_orders', [
            'id' => $deliveryOrder->id,
            'status' => 'delivered',
        ]);
    }
}
