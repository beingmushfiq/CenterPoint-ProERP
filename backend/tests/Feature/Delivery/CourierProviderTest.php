<?php

declare(strict_types=1);

namespace Tests\Feature\Delivery;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Delivery\Adapters\PathaoCourierAdapter;
use App\Modules\Delivery\Adapters\SteadfastCourierAdapter;
use App\Modules\Delivery\Contracts\CourierCapability;
use App\Modules\Delivery\Models\CourierProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CourierProviderTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

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
    }

    public function test_can_create_and_list_courier_providers(): void
    {
        $payload = [
            'code' => 'PATHAO',
            'name' => 'Pathao Courier',
            'adapter_class' => PathaoCourierAdapter::class,
            'is_active' => true,
            'credentials' => [
                'client_id' => 'test_client_id',
                'client_secret' => 'test_secret',
                'username' => 'test@slicemart.com',
                'password' => 'secret',
            ],
            'capabilities' => [
                'create_shipment' => true,
                'cancel_shipment' => true,
                'get_status' => true,
                'calculate_rate' => true,
            ],
            'default_charge' => '60.0000',
        ];

        $response = $this->withHeader('Authorization', 'Bearer '.$this->jwt)
            ->postJson('/api/v1/logistics/couriers', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.code', 'PATHAO')
            ->assertJsonPath('data.name', 'Pathao Courier');

        $this->assertDatabaseHas('courier_providers', [
            'tenant_id' => $this->tenant->id,
            'code' => 'PATHAO',
            'is_active' => true,
        ]);

        $listResponse = $this->withHeader('Authorization', 'Bearer '.$this->jwt)
            ->getJson('/api/v1/logistics/couriers');

        $listResponse->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }

    public function test_provider_adapter_instance_resolves_and_verifies_capabilities(): void
    {
        $provider = CourierProvider::create([
            'tenant_id' => $this->tenant->id,
            'code' => 'STEADFAST',
            'name' => 'Steadfast Courier',
            'adapter_class' => SteadfastCourierAdapter::class,
            'is_active' => true,
            'credentials' => ['api_key' => 'sf_key_123'],
            'default_charge' => '70.0000',
        ]);

        $adapter = $provider->getAdapterInstance();

        $this->assertInstanceOf(SteadfastCourierAdapter::class, $adapter);
        $this->assertTrue($adapter->supports(CourierCapability::CREATE_SHIPMENT));
        $this->assertTrue($adapter->supports(CourierCapability::CANCEL_SHIPMENT));
        $this->assertFalse($adapter->supports(CourierCapability::CALCULATE_RATE));
    }
}
