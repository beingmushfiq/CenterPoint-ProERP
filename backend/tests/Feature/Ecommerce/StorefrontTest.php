<?php

declare(strict_types=1);

namespace Tests\Feature\Ecommerce;

use App\Core\Tenancy\TenantContext;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Product;
use App\Models\Storefront;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\Warehouse;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class StorefrontTest extends TestCase
{
    use RefreshDatabase;

    private Storefront $storefront;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $tenant = Tenant::first();
        TenantContext::bind($tenant->toArray());

        $this->storefront = Storefront::firstOrFail();
        $this->product = Product::where('status', 'active')->where('type', '!=', 'raw_material')->first();
    }

    public function test_can_fetch_public_storefront_config(): void
    {
        $response = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
        ])->getJson('/api/v1/storefront/config');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.subdomain', $this->storefront->subdomain)
            ->assertJsonPath('data.currency', 'BDT')
            ->assertJsonPath('data.status', 'live');

        $this->assertNotEmpty($response->json('data.legal_name'));
    }

    public function test_storefront_config_syncs_with_tenant_legal_name(): void
    {
        $settingService = app(\App\Core\Settings\SettingService::class);
        $settingService->batchUpdate('general', [
            'company_legal_name' => 'Apex Global Manufacturing Ltd.',
            'company_name' => 'Apex Brands',
        ]);

        $response = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
        ])->getJson('/api/v1/storefront/config');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.legal_name', 'Apex Global Manufacturing Ltd.')
            ->assertJsonPath('data.company_name', 'Apex Brands')
            ->assertJsonPath('data.name', 'Apex Brands Online Store');
    }

    public function test_can_fetch_storefront_catalog_products(): void
    {
        $response = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
        ])->getJson('/api/v1/storefront/products');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'sku', 'name', 'default_sale_price'],
                ],
                'meta' => ['pagination'],
            ]);
    }

    public function test_can_fetch_single_product_details(): void
    {
        $response = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
        ])->getJson("/api/v1/storefront/products/{$this->product->sku}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.sku', $this->product->sku);
    }

    public function test_can_add_item_to_cart_and_update_quantity(): void
    {
        $sessionToken = (string) Str::uuid();

        // 1. Add item to cart
        $addResponse = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
            'X-Cart-Session' => $sessionToken,
        ])->postJson('/api/v1/storefront/cart/items', [
            'product_id' => $this->product->id,
            'quantity' => 2,
        ]);

        $addResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.item_count', 2);

        $itemId = $addResponse->json('data.items.0.id');

        // 2. Update item quantity
        $updateResponse = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
            'X-Cart-Session' => $sessionToken,
        ])->putJson("/api/v1/storefront/cart/items/{$itemId}", [
            'quantity' => 5,
        ]);

        $updateResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.item_count', 5);
    }

    public function test_can_checkout_cart_and_generate_online_sales_order(): void
    {
        $sessionToken = (string) Str::uuid();

        // 1. Add product to cart
        $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
            'X-Cart-Session' => $sessionToken,
        ])->postJson('/api/v1/storefront/cart/items', [
            'product_id' => $this->product->id,
            'quantity' => 3,
        ]);

        // 2. Perform Checkout
        $checkoutResponse = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
            'X-Cart-Session' => $sessionToken,
        ])->postJson('/api/v1/storefront/checkout', [
            'customer_name' => 'John Retail Customer',
            'phone' => '+8801700112233',
            'email' => 'john@customer.test',
            'delivery_address' => 'House 12, Road 4, Dhanmondi',
            'city' => 'Dhaka',
            'payment_method' => 'cod',
            'notes' => 'Please deliver before 5 PM',
        ]);

        $checkoutResponse->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.payment_method', 'cod');

        $orderNumber = $checkoutResponse->json('data.order_number');
        $this->assertStringStartsWith('SO-ONL-', $orderNumber);

        // 3. Verify Sales Order created in database with channel = 'online'
        $this->assertDatabaseHas('sales_orders', [
            'order_number' => $orderNumber,
            'channel' => 'online',
            'status' => 'pending',
        ]);
    }

    public function test_returns_404_for_unknown_storefront_subdomain(): void
    {
        $response = $this->withHeaders([
            'X-Storefront-Subdomain' => 'nonexistent-bakery-999',
        ])->getJson('/api/v1/storefront/config');

        $response->assertStatus(404)
            ->assertJsonPath('error.code', 'STOREFRONT_NOT_FOUND');
    }
}
