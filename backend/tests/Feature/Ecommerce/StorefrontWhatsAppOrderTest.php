<?php

declare(strict_types=1);

namespace Tests\Feature\Ecommerce;

use App\Models\Product;
use App\Models\Storefront;
use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StorefrontWhatsAppOrderTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private Storefront $storefront;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->tenant = Tenant::firstOrFail();
        $this->storefront = Storefront::firstOrFail();

        $this->storefront->update([
            'whatsapp_number' => '+8801811223344',
            'whatsapp_ordering_enabled' => true,
        ]);

        $this->product = Product::where('tenant_id', $this->tenant->id)->firstOrFail();
    }

    public function test_can_generate_whatsapp_order_link_for_product(): void
    {
        $response = $this->withHeader('X-Storefront-Subdomain', $this->storefront->subdomain)
            ->postJson('/api/v1/storefront/whatsapp/order-link', [
                'product_id' => $this->product->id,
                'quantity' => 2,
                'customer_name' => 'John Shopper',
                'customer_phone' => '+8801700000000',
                'delivery_address' => 'Banani, Dhaka',
            ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'data' => [
                'whatsapp_number',
                'message',
                'whatsapp_url',
                'total_amount',
            ],
        ]);

        $whatsappUrl = $response->json('data.whatsapp_url');
        $this->assertStringContainsString('https://wa.me/8801811223344', $whatsappUrl);
        $this->assertStringContainsString(rawurlencode($this->product->name), $whatsappUrl);
    }

    public function test_can_generate_whatsapp_receipt_for_order(): void
    {
        $order = \App\Modules\Sales\Models\SalesOrder::create([
            'tenant_id' => $this->tenant->id,
            'order_number' => 'SO-TEST-WA-001',
            'order_date' => now()->toDateString(),
            'status' => 'confirmed',
            'payment_status' => 'paid',
            'subtotal' => '200.0000',
            'tax_amount' => '0.0000',
            'shipping_amount' => '0.0000',
            'discount_amount' => '20.0000',
            'total_amount' => '180.0000',
            'currency' => 'BDT',
            'shipping_address' => 'Gulshan 2, Dhaka',
        ]);

        \App\Modules\Sales\Models\SalesOrderItem::create([
            'sales_order_id' => $order->id,
            'product_id' => $this->product->id,
            'unit_id' => $this->product->base_unit_id ?? 1,
            'quantity' => '2.0000',
            'unit_price' => '100.0000',
            'line_total' => '200.0000',
        ]);

        $response = $this->withHeader('X-Storefront-Subdomain', $this->storefront->subdomain)
            ->postJson('/api/v1/storefront/whatsapp/order-link', [
                'order_number' => 'SO-TEST-WA-001',
            ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $whatsappUrl = $response->json('data.whatsapp_url');
        $this->assertStringContainsString('SO-TEST-WA-001', $whatsappUrl);
        $this->assertStringContainsString('OFFICIAL%20ORDER%20RECEIPT', $whatsappUrl);
    }
}

