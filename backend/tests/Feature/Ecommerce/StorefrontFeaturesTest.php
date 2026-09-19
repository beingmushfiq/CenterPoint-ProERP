<?php

declare(strict_types=1);

namespace Tests\Feature\Ecommerce;

use App\Core\Auth\JwtService;
use App\Models\Coupon;
use App\Models\Product;
use App\Models\Storefront;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

final class StorefrontFeaturesTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $tenantAdmin;
    private string $tenantToken;
    private Storefront $storefront;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->tenant = Tenant::firstOrFail();
        $this->tenantAdmin = User::withoutTenantScope()->where('email', 'admin@slicemart.test')->firstOrFail();

        $jwtService = app(JwtService::class);
        $this->tenantToken = $jwtService->issueToken(
            userId: $this->tenantAdmin->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1,
            permVersion: '1',
            scopes: []
        );

        $this->storefront = Storefront::where('tenant_id', $this->tenant->id)->firstOrFail();
    }

    public function test_tenant_admin_can_fetch_and_update_storefront_settings(): void
    {
        // 1. Get settings
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->getJson('/api/v1/storefront/settings');

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.subdomain', $this->storefront->subdomain);

        // 2. Update settings
        $updateResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->putJson('/api/v1/storefront/settings', [
            'name' => 'Slice Mart Fresh Bakery Direct',
            'theme' => [
                'primary_color' => '#059669',
                'accent_color' => '#0d9488',
                'hero_title' => 'Warm Baked Bread Delivered Today',
                'hero_subtitle' => 'From our factory lines to your breakfast table.',
            ],
            'guest_checkout_enabled' => true,
            'cod_enabled' => true,
        ]);

        $updateResponse->assertOk();
        $this->assertDatabaseHas('storefronts', [
            'id' => $this->storefront->id,
            'name' => 'Slice Mart Fresh Bakery Direct',
        ]);
    }

    public function test_tenant_admin_can_toggle_product_storefront_publication(): void
    {
        $product = Product::where('tenant_id', $this->tenant->id)->firstOrFail();

        // 1. Publish product
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->postJson('/api/v1/storefront/products/toggle-publish', [
            'product_id' => $product->id,
            'is_published' => true,
            'is_featured' => true,
            'price_override' => '95.0000',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('storefront_products', [
            'tenant_id' => $this->tenant->id,
            'product_id' => $product->id,
            'is_available' => 1,
            'is_featured' => 1,
        ]);

        // 2. Unpublish product
        $unpublishResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->tenantToken}",
        ])->postJson('/api/v1/storefront/products/toggle-publish', [
            'product_id' => $product->id,
            'is_published' => false,
        ]);

        $unpublishResponse->assertOk();
        $this->assertDatabaseHas('storefront_products', [
            'tenant_id' => $this->tenant->id,
            'product_id' => $product->id,
            'is_available' => 0,
        ]);
    }

    public function test_customer_can_track_order_via_order_number(): void
    {
        // Create an online sales order
        $order = SalesOrder::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'SO-ONL-20260828-9999',
            'company_id' => 1,
            'branch_id' => 1,
            'warehouse_id' => 1,
            'channel' => 'online',
            'order_date' => now()->toDateString(),
            'currency' => 'BDT',
            'subtotal' => '500.0000',
            'discount_amount' => '0.0000',
            'tax_amount' => '0.0000',
            'shipping_amount' => '0.0000',
            'total_amount' => '500.0000',
            'paid_amount' => '0.0000',
            'status' => 'confirmed',
            'payment_status' => 'pending',
            'shipping_address' => 'House 12, Road 4, Banani, Dhaka',
        ]);

        $product = Product::where('tenant_id', $this->tenant->id)->firstOrFail();

        SalesOrderItem::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'sales_order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => '2.0000',
            'unit_id' => 1,
            'unit_price' => '250.0000',
            'line_total' => '500.0000',
        ]);

        $response = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
        ])->getJson('/api/v1/storefront/orders/track?order_number=SO-ONL-20260828-9999');

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.order_number', 'SO-ONL-20260828-9999');
        $response->assertJsonPath('data.status', 'confirmed');
        $response->assertJsonCount(4, 'data.timeline');
    }

    public function test_can_apply_and_remove_discount_coupon_on_cart(): void
    {
        // 1. Create a coupon
        Coupon::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'SAVE20',
            'name' => '20% Welcome Discount',
            'discount_type' => 'percentage',
            'discount_value' => '20.0000',
            'min_order_amount' => '10.0000',
            'is_active' => true,
        ]);

        $sessionToken = 'cart_test_coupon_' . Str::random(8);
        $product = Product::where('tenant_id', $this->tenant->id)->where('type', 'finished')->firstOrFail();

        // 2. Add product to cart
        $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
            'X-Cart-Session' => $sessionToken,
        ])->postJson('/api/v1/storefront/cart/items', [
            'product_id' => $product->id,
            'quantity' => 2,
        ]);

        // 3. Apply coupon
        $couponRes = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
            'X-Cart-Session' => $sessionToken,
        ])->postJson('/api/v1/storefront/cart/coupon', [
            'code' => 'SAVE20',
        ]);

        $couponRes->assertOk();
        $couponRes->assertJsonPath('success', true);
        $couponRes->assertJsonPath('data.coupon_code', 'SAVE20');

        // 4. Remove coupon
        $removeRes = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
            'X-Cart-Session' => $sessionToken,
        ])->deleteJson('/api/v1/storefront/cart/coupon');

        $removeRes->assertOk();
        $removeRes->assertJsonPath('data.coupon_code', null);
    }
}
