<?php

declare(strict_types=1);

namespace Tests\Feature\Ecommerce;

use App\Models\Party;
use App\Models\Storefront;
use App\Models\StorefrontCustomer;
use App\Models\Tenant;
use App\Modules\Sales\Models\SalesOrder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class StorefrontCustomerAuthTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Storefront $storefront;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->tenant = Tenant::firstOrFail();
        $this->storefront = Storefront::firstOrFail();
    }

    public function test_can_register_new_customer_and_receive_jwt(): void
    {
        $response = $this->withHeader('X-Storefront-Subdomain', $this->storefront->subdomain)
            ->postJson('/api/v1/storefront/customer/register', [
                'name' => 'Sara Tancredi',
                'phone' => '+8801755555555',
                'email' => 'sara@example.com',
                'password' => 'secret123',
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'data' => [
                'token',
                'customer' => ['uuid', 'name', 'email', 'phone'],
            ],
        ]);

        $this->assertDatabaseHas('storefront_customers', [
            'tenant_id' => $this->tenant->id,
            'storefront_id' => $this->storefront->id,
            'phone' => '+8801755555555',
            'name' => 'Sara Tancredi',
        ]);

        $this->assertDatabaseHas('parties', [
            'tenant_id' => $this->tenant->id,
            'phone' => '+8801755555555',
            'is_customer' => true,
        ]);
    }

    public function test_can_login_customer_and_retrieve_profile_and_orders(): void
    {
        // 1. Register customer
        $registerRes = $this->withHeader('X-Storefront-Subdomain', $this->storefront->subdomain)
            ->postJson('/api/v1/storefront/customer/register', [
                'name' => 'Michael Scofield',
                'phone' => '+8801766666666',
                'email' => 'michael@example.com',
                'password' => 'foobar123',
            ]);

        $registerRes->assertStatus(201);
        $token = $registerRes->json('data.token');
        $customer = StorefrontCustomer::where('phone', '+8801766666666')->firstOrFail();

        // 2. Login
        $loginRes = $this->withHeader('X-Storefront-Subdomain', $this->storefront->subdomain)
            ->postJson('/api/v1/storefront/customer/login', [
                'phone' => '+8801766666666',
                'password' => 'foobar123',
            ]);

        $loginRes->assertOk();
        $loginRes->assertJsonPath('success', true);
        $loginToken = $loginRes->json('data.token');

        // 3. Get profile
        $profileRes = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
            'Authorization' => "Bearer {$loginToken}",
        ])->getJson('/api/v1/storefront/customer/profile');

        $profileRes->assertOk();
        $profileRes->assertJsonPath('data.name', 'Michael Scofield');
        $profileRes->assertJsonPath('data.phone', '+8801766666666');

        // 4. Create an order for this customer's party
        SalesOrder::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'order_number' => 'SO-CUST-001',
            'party_id' => $customer->party_id,
            'channel' => 'online',
            'subtotal' => '850.0000',
            'tax_amount' => '0.0000',
            'total_amount' => '850.0000',
            'status' => 'pending',
            'payment_status' => 'pending',
            'order_date' => now(),
        ]);

        // 5. Query customer orders
        $ordersRes = $this->withHeaders([
            'X-Storefront-Subdomain' => $this->storefront->subdomain,
            'Authorization' => "Bearer {$loginToken}",
        ])->getJson('/api/v1/storefront/customer/orders');

        $ordersRes->assertOk();
        $ordersRes->assertJsonPath('success', true);
        $ordersRes->assertJsonCount(1, 'data');
        $ordersRes->assertJsonPath('data.0.order_number', 'SO-CUST-001');
    }

    public function test_rejects_login_with_invalid_credentials(): void
    {
        $response = $this->withHeader('X-Storefront-Subdomain', $this->storefront->subdomain)
            ->postJson('/api/v1/storefront/customer/login', [
                'phone' => '+8801799999999',
                'password' => 'wrongpassword',
            ]);

        $response->assertStatus(401);
        $response->assertJsonPath('success', false);
    }
}
