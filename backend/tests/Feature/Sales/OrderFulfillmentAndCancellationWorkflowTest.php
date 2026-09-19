<?php

declare(strict_types=1);

namespace Tests\Feature\Sales;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Party;
use App\Models\Product;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Delivery\Models\CourierShipment;
use App\Modules\Sales\Models\CrmActivity;
use App\Modules\Sales\Models\CrmLead;
use App\Modules\Sales\Models\DeliveryOrder;
use App\Modules\Sales\Models\DeliveryOrderItem;
use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class OrderFulfillmentAndCancellationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;
    private Party $customer;
    private Warehouse $warehouse;
    private Product $product;
    private Unit $unit;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id'             => 1,
            'uuid'           => (string) Str::uuid(),
            'code'           => 'ENTERPRISE',
            'name'           => 'Enterprise',
            'price'          => '10000.0000',
            'billing_period' => 'monthly',
            'limits'         => json_encode(['max_users' => 100]),
            'is_active'      => true,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        $this->tenant = Tenant::create([
            'id'            => 1,
            'uuid'          => (string) Str::uuid(),
            'plan_id'       => 1,
            'name'          => 'SliceMart Flow Tenant',
            'slug'          => 'slicemart-flow',
            'status'        => 'active',
            'currency_code' => 'BDT',
            'timezone'      => 'Asia/Dhaka',
            'locale'        => 'en',
            'date_format'   => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'id'        => 1,
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'name'      => 'Operations Manager',
            'email'     => 'ops@slicemart.com',
            'password'  => 'secret123',
            'status'    => 'active',
        ]);

        $role = Role::create([
            'tenant_id'  => $this->tenant->id,
            'uuid'       => (string) Str::uuid(),
            'name'       => 'Super Administrator',
            'slug'       => 'super-admin',
            'is_system'  => true,
        ]);
        $this->user->roles()->attach($role->id, ['tenant_id' => $this->tenant->id]);

        $this->jwt = app(JwtService::class)->issueToken($this->user->id, $this->tenant->id);

        $this->unit = Unit::create([
            'tenant_id'   => $this->tenant->id,
            'uuid'        => (string) Str::uuid(),
            'name'        => 'Piece',
            'code'        => 'PCS',
            'symbol'      => 'pcs',
            'type'        => 'unit',
            'allow_decimal' => false,
        ]);

        $this->product = Product::create([
            'tenant_id'    => $this->tenant->id,
            'uuid'         => (string) Str::uuid(),
            'name'         => 'Test T-Shirt',
            'sku'          => 'TSHIRT-TEST',
            'base_unit_id' => $this->unit->id,
            'type'         => 'finished',
            'cost_price'   => '300.0000',
            'selling_price' => '650.0000',
            'is_active'    => true,
        ]);

        $this->warehouse = Warehouse::create([
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'name'      => 'Central Fulfillment Warehouse',
            'code'      => 'WH-CENTRAL',
            'type'      => 'physical',
            'is_active' => true,
        ]);

        $this->customer = Party::create([
            'tenant_id'  => $this->tenant->id,
            'uuid'       => (string) Str::uuid(),
            'code'       => 'CUST-001',
            'type'       => 'customer',
            'name'       => 'Corporate Client Corp',
            'phone'      => '01700000000',
            'is_active'  => true,
        ]);
    }

    public function test_cancelling_order_via_dedicated_endpoint_cancels_linked_unfulfilled_deliveries_and_shipments(): void
    {
        $order = SalesOrder::create([
            'tenant_id'        => $this->tenant->id,
            'uuid'             => (string) Str::uuid(),
            'order_number'     => 'SO-TEST-CANCEL-01',
            'party_id'         => $this->customer->id,
            'warehouse_id'     => $this->warehouse->id,
            'order_date'       => '2026-09-20',
            'subtotal'         => '1300.0000',
            'tax_amount'       => '0.0000',
            'discount_amount'  => '0.0000',
            'shipping_amount'  => '0.0000',
            'total_amount'     => '1300.0000',
            'paid_amount'      => '0.0000',
            'status'           => 'confirmed',
            'payment_status'   => 'unpaid',
            'channel'          => 'manual',
            'created_by'       => $this->user->id,
        ]);

        $delivery = DeliveryOrder::create([
            'tenant_id'       => $this->tenant->id,
            'uuid'            => (string) Str::uuid(),
            'delivery_number' => 'DO-TEST-01',
            'sales_order_id'  => $order->id,
            'warehouse_id'    => $this->warehouse->id,
            'recipient_name'  => 'Recipient Name',
            'recipient_phone' => '01711111111',
            'delivery_type'   => 'courier',
            'status'          => 'pending',
            'cod_amount'      => '1300.0000',
            'package_count'   => 1,
            'created_by'      => $this->user->id,
        ]);

        $provider = \App\Modules\Delivery\Models\CourierProvider::create([
            'tenant_id'     => $this->tenant->id,
            'uuid'          => (string) Str::uuid(),
            'code'          => 'steadfast',
            'name'          => 'Steadfast Courier',
            'adapter_class' => 'App\Modules\Delivery\Adapters\SteadfastAdapter',
            'is_active'     => true,
            'created_by'    => $this->user->id,
        ]);

        $shipment = CourierShipment::create([
            'tenant_id'           => $this->tenant->id,
            'uuid'                => (string) Str::uuid(),
            'delivery_order_id'   => $delivery->id,
            'courier_provider_id' => $provider->id,
            'consignment_id'      => 'CS-TEST-999',
            'status'              => 'in_transit',
            'charge_amount'       => '100.0000',
            'cod_amount'          => '1300.0000',
            'created_by'          => $this->user->id,
        ]);

        // Cancel via dedicated POST /api/v1/sales/orders/{id}/cancel
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->postJson("/api/v1/sales/orders/{$order->id}/cancel", [
            'reason' => 'Customer changed mind before dispatch',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertEquals('cancelled', $order->fresh()->status);
        $this->assertNotNull($order->fresh()->cancelled_at);
        $this->assertEquals($this->user->id, $order->fresh()->cancelled_by);
        $this->assertStringContainsString('Customer changed mind', $order->fresh()->internal_notes);

        // Verify linked delivery order transitioned to cancelled
        $this->assertEquals('cancelled', $delivery->fresh()->status);

        // Verify linked courier shipment transitioned to cancelled
        $this->assertEquals('cancelled', $shipment->fresh()->status);
        $this->assertEquals('Linked sales order was cancelled.', $shipment->fresh()->error_message);
    }

    public function test_cancelling_order_via_status_patch_cancels_linked_unfulfilled_deliveries(): void
    {
        $order = SalesOrder::create([
            'tenant_id'        => $this->tenant->id,
            'uuid'             => (string) Str::uuid(),
            'order_number'     => 'SO-TEST-CANCEL-02',
            'party_id'         => $this->customer->id,
            'warehouse_id'     => $this->warehouse->id,
            'order_date'       => '2026-09-20',
            'subtotal'         => '650.0000',
            'tax_amount'       => '0.0000',
            'discount_amount'  => '0.0000',
            'shipping_amount'  => '0.0000',
            'total_amount'     => '650.0000',
            'paid_amount'      => '0.0000',
            'status'           => 'confirmed',
            'payment_status'   => 'unpaid',
            'channel'          => 'manual',
            'created_by'       => $this->user->id,
        ]);

        $delivery = DeliveryOrder::create([
            'tenant_id'       => $this->tenant->id,
            'uuid'            => (string) Str::uuid(),
            'delivery_number' => 'DO-TEST-02',
            'sales_order_id'  => $order->id,
            'warehouse_id'    => $this->warehouse->id,
            'recipient_name'  => 'Recipient 2',
            'recipient_phone' => '01722222222',
            'delivery_type'   => 'own_delivery',
            'status'          => 'pending',
            'cod_amount'      => '650.0000',
            'package_count'   => 1,
            'created_by'      => $this->user->id,
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->patchJson("/api/v1/sales/orders/{$order->id}/status", [
            'status' => 'cancelled',
            'notes'  => 'Cancelled via status patch',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertEquals('cancelled', $order->fresh()->status);
        $this->assertEquals('cancelled', $delivery->fresh()->status);
    }

    public function test_cancelling_order_voids_linked_draft_invoices(): void
    {
        $order = SalesOrder::create([
            'tenant_id'        => $this->tenant->id,
            'uuid'             => (string) Str::uuid(),
            'order_number'     => 'SO-TEST-CANCEL-03',
            'party_id'         => $this->customer->id,
            'warehouse_id'     => $this->warehouse->id,
            'order_date'       => '2026-09-20',
            'subtotal'         => '650.0000',
            'tax_amount'       => '0.0000',
            'discount_amount'  => '0.0000',
            'shipping_amount'  => '0.0000',
            'total_amount'     => '650.0000',
            'paid_amount'      => '0.0000',
            'status'           => 'confirmed',
            'payment_status'   => 'unpaid',
            'channel'          => 'manual',
            'created_by'       => $this->user->id,
        ]);

        $invoice = Invoice::create([
            'tenant_id'       => $this->tenant->id,
            'uuid'            => (string) Str::uuid(),
            'invoice_number'  => 'INV-DRAFT-01',
            'sales_order_id'  => $order->id,
            'party_id'        => $this->customer->id,
            'invoice_date'    => '2026-09-20',
            'subtotal'        => '650.0000',
            'discount_amount' => '0.0000',
            'tax_amount'      => '0.0000',
            'shipping_amount' => '0.0000',
            'total_amount'    => '650.0000',
            'paid_amount'     => '0.0000',
            'status'          => 'draft',
            'created_by'      => $this->user->id,
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->postJson("/api/v1/sales/orders/{$order->id}/cancel");

        $response->assertStatus(200);
        $this->assertEquals('void', $invoice->fresh()->status);
    }

    public function test_cancelling_already_delivered_order_is_rejected(): void
    {
        $order = SalesOrder::create([
            'tenant_id'        => $this->tenant->id,
            'uuid'             => (string) Str::uuid(),
            'order_number'     => 'SO-TEST-CANCEL-04',
            'party_id'         => $this->customer->id,
            'warehouse_id'     => $this->warehouse->id,
            'order_date'       => '2026-09-20',
            'subtotal'         => '650.0000',
            'tax_amount'       => '0.0000',
            'discount_amount'  => '0.0000',
            'shipping_amount'  => '0.0000',
            'total_amount'     => '650.0000',
            'paid_amount'      => '650.0000',
            'status'           => 'delivered',
            'payment_status'   => 'paid',
            'channel'          => 'manual',
            'created_by'       => $this->user->id,
        ]);

        $this->expectException(\DomainException::class);
        app(\App\Modules\Sales\Actions\CancelSalesOrderAction::class)->execute($order, $this->user->id);
    }

    public function test_cancelling_order_logs_activity_on_linked_crm_lead(): void
    {
        $lead = CrmLead::create([
            'tenant_id'     => $this->tenant->id,
            'uuid'          => (string) Str::uuid(),
            'name'          => 'Lead John',
            'phone'         => '01899999999',
            'stage'         => 'won',
            'source'        => 'facebook',
            'created_by'    => $this->user->id,
        ]);

        $order = SalesOrder::create([
            'tenant_id'        => $this->tenant->id,
            'uuid'             => (string) Str::uuid(),
            'order_number'     => 'SO-TEST-CANCEL-05',
            'party_id'         => $this->customer->id,
            'warehouse_id'     => $this->warehouse->id,
            'lead_id'          => $lead->id,
            'order_date'       => '2026-09-20',
            'subtotal'         => '650.0000',
            'tax_amount'       => '0.0000',
            'discount_amount'  => '0.0000',
            'shipping_amount'  => '0.0000',
            'total_amount'     => '650.0000',
            'paid_amount'      => '0.0000',
            'status'           => 'confirmed',
            'payment_status'   => 'unpaid',
            'channel'          => 'crm',
            'created_by'       => $this->user->id,
        ]);

        $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->postJson("/api/v1/sales/orders/{$order->id}/cancel", [
            'reason' => 'Duplicate order submitted',
        ])->assertStatus(200);

        $activity = CrmActivity::where('tenant_id', $this->tenant->id)
            ->where('subject_type', 'lead')
            ->where('subject_id', $lead->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($activity);
        $this->assertStringContainsString('Order Cancelled', $activity->title);
        $this->assertStringContainsString('Duplicate order submitted', $activity->description);
    }
}
