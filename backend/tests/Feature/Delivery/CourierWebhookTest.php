<?php

declare(strict_types=1);

namespace Tests\Feature\Delivery;

use App\Core\Tenancy\TenantContext;
use App\Models\Party;
use App\Models\Tenant;
use App\Models\Warehouse;
use App\Modules\Delivery\Adapters\PathaoCourierAdapter;
use App\Modules\Delivery\Models\CourierProvider;
use App\Modules\Delivery\Models\CourierShipment;
use App\Modules\Delivery\Models\CourierWebhookEvent;
use App\Modules\Sales\Models\DeliveryOrder;
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CourierWebhookTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private CourierProvider $provider;

    private CourierShipment $shipment;

    private DeliveryOrder $deliveryOrder;

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

        $customer = Party::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'party_type' => 'customer',
            'code' => 'CUST-001',
            'name' => 'Alice Rahman',
            'phone' => '+8801711111111',
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
            'order_number' => 'SO-2026-002',
            'party_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
            'channel' => 'ecommerce',
            'subtotal' => '2000.0000',
            'tax_amount' => '300.0000',
            'total_amount' => '2300.0000',
            'status' => 'approved',
            'payment_status' => 'unpaid',
            'order_date' => now(),
        ]);

        $this->deliveryOrder = DeliveryOrder::create([
            'tenant_id' => $this->tenant->id,
            'delivery_number' => 'DO-2026-002',
            'sales_order_id' => $salesOrder->id,
            'party_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
            'recipient_name' => 'Alice Rahman',
            'recipient_phone' => '+8801711111111',
            'delivery_type' => 'courier',
            'status' => 'in_transit',
            'cod_amount' => '2300.0000',
            'cod_status' => 'pending',
        ]);

        $this->provider = CourierProvider::create([
            'tenant_id' => $this->tenant->id,
            'code' => 'PATHAO',
            'name' => 'Pathao Express',
            'adapter_class' => PathaoCourierAdapter::class,
            'is_active' => true,
            'credentials' => ['client_id' => 'p_id'],
            'webhook_secret' => 'secret_sig_123',
            'default_charge' => '60.0000',
        ]);

        $this->shipment = CourierShipment::create([
            'tenant_id' => $this->tenant->id,
            'delivery_order_id' => $this->deliveryOrder->id,
            'courier_provider_id' => $this->provider->id,
            'consignment_id' => 'PTH-CONSIGN-999',
            'awb_number' => 'AWB-999',
            'status' => 'in_transit',
            'charge_amount' => '60.0000',
            'cod_amount' => '2300.0000',
        ]);

        $this->deliveryOrder->update(['courier_shipment_id' => $this->shipment->id]);
    }

    public function test_inbound_webhook_updates_shipment_and_delivery_order(): void
    {
        $payload = [
            'event_id' => 'EVT-PTH-1001',
            'consignment_id' => 'PTH-CONSIGN-999',
            'event_name' => 'Delivered',
            'collected_amount' => '2300.0000',
            'location' => 'Gulshan Delivery Hub',
            'timestamp' => now()->toIso8601String(),
        ];

        $response = $this->withHeader('X-Courier-Signature', 'valid_sig')
            ->postJson('/api/v1/webhooks/couriers/PATHAO', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'processed');

        $this->shipment->refresh();
        $this->assertSame('delivered', $this->shipment->status);

        $this->deliveryOrder->refresh();
        $this->assertSame('delivered', $this->deliveryOrder->status);
        $this->assertSame('collected', $this->deliveryOrder->cod_status);
        $this->assertEquals('2300.0000', $this->deliveryOrder->cod_collected_amount);
    }

    public function test_webhook_idempotency_ignores_repeated_payloads(): void
    {
        $payload = [
            'event_id' => 'EVT-PTH-REPEATED-01',
            'consignment_id' => 'PTH-CONSIGN-999',
            'event_name' => 'Delivered',
            'collected_amount' => '2300.0000',
        ];

        // Send 5 identical webhook deliveries
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/v1/webhooks/couriers/PATHAO', $payload);
            $response->assertStatus(200);
        }

        // Must create exactly 1 event record in database
        $this->assertSame(1, CourierWebhookEvent::where('provider_event_id', 'EVT-PTH-REPEATED-01')->count());
    }

    public function test_out_of_order_webhook_does_not_regress_delivered_state(): void
    {
        // First mark as delivered
        $this->shipment->update(['status' => 'delivered']);
        $this->deliveryOrder->update(['status' => 'delivered']);

        // Receive late 'In Transit' webhook
        $latePayload = [
            'event_id' => 'EVT-PTH-LATE-01',
            'consignment_id' => 'PTH-CONSIGN-999',
            'event_name' => 'In Transit',
        ];

        $response = $this->postJson('/api/v1/webhooks/couriers/PATHAO', $latePayload);
        $response->assertStatus(200);

        // Shipment and DeliveryOrder must remain delivered
        $this->shipment->refresh();
        $this->assertSame('delivered', $this->shipment->status);

        $this->deliveryOrder->refresh();
        $this->assertSame('delivered', $this->deliveryOrder->status);
    }
}
