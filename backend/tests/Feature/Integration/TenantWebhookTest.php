<?php

declare(strict_types=1);

namespace Tests\Feature\Integration;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use App\Services\WebhookDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantWebhookTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;

    protected function setUp(): void
    {
        parent::setUp();

        DB::table('plans')->insert([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'ENTERPRISE',
            'name' => 'Enterprise Plan',
            'price' => '10000.0000',
            'billing_period' => 'monthly',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->tenant = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Demo Enterprise',
            'slug' => 'demo-enterprise',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'name'      => 'Integration Manager',
            'email'     => 'integrations@demo.test',
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

        $jwtService = app(JwtService::class);
        $this->jwt = $jwtService->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1,
            permVersion: '1',
            scopes: ['*']
        );
    }

    public function test_can_register_webhook_endpoint(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->postJson('/api/v1/integrations/webhooks', [
            'url'    => 'https://example.com/api/webhooks/incoming',
            'events' => ['order.created', 'order.cancelled', 'stock.low'],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.url', 'https://example.com/api/webhooks/incoming')
            ->assertJsonPath('data.is_active', true);

        $signingSecret = $response->json('data.signing_secret');
        $this->assertNotEmpty($signingSecret);
        $this->assertStringStartsWith('whsec_', $signingSecret);

        $this->assertDatabaseHas('webhook_endpoints', [
            'tenant_id' => $this->tenant->id,
            'url'       => 'https://example.com/api/webhooks/incoming',
            'is_active' => 1,
        ]);
    }

    public function test_can_list_and_show_webhook_endpoints(): void
    {
        $endpoint = WebhookEndpoint::create([
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'url'       => 'https://partner.com/hooks',
            'secret'    => 'whsec_test123456789',
            'events'    => ['order.created'],
            'is_active' => true,
        ]);

        WebhookDelivery::create([
            'tenant_id'           => $this->tenant->id,
            'uuid'                => (string) Str::uuid(),
            'webhook_endpoint_id' => $endpoint->id,
            'event_type'          => 'order.created',
            'payload'             => ['order_id' => 123],
            'attempt_count'       => 1,
            'status'              => 'delivered',
        ]);

        // List
        $listResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->getJson('/api/v1/integrations/webhooks');

        $listResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.uuid', $endpoint->uuid)
            ->assertJsonPath('data.0.deliveries_count', 1);

        // Show
        $showResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->getJson("/api/v1/integrations/webhooks/{$endpoint->uuid}");

        $showResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.endpoint.uuid', $endpoint->uuid)
            ->assertJsonPath('data.recent_deliveries.0.event_type', 'order.created');
    }

    public function test_can_update_and_delete_webhook_endpoint(): void
    {
        $endpoint = WebhookEndpoint::create([
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'url'       => 'https://partner.com/v1/hooks',
            'secret'    => 'whsec_update123',
            'events'    => ['order.created'],
            'is_active' => true,
        ]);

        $updateResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->patchJson("/api/v1/integrations/webhooks/{$endpoint->uuid}", [
            'url'       => 'https://partner.com/v2/hooks',
            'is_active' => false,
        ]);

        $updateResponse->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.url', 'https://partner.com/v2/hooks')
            ->assertJsonPath('data.is_active', false);

        $deleteResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->deleteJson("/api/v1/integrations/webhooks/{$endpoint->uuid}");

        $deleteResponse->assertStatus(200);
        $this->assertSoftDeleted('webhook_endpoints', ['id' => $endpoint->id]);
    }

    public function test_can_ping_webhook_endpoint_and_verify_hmac_signature(): void
    {
        $secret = 'whsec_supersecretkey123';

        $endpoint = WebhookEndpoint::create([
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'url'       => 'https://external-receiver.test/webhook',
            'secret'    => $secret,
            'events'    => ['*'],
            'is_active' => true,
        ]);

        Http::fake([
            'https://external-receiver.test/webhook' => Http::response(['received' => true], 200),
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->postJson("/api/v1/integrations/webhooks/{$endpoint->uuid}/ping");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.event_type', 'webhook.ping')
            ->assertJsonPath('data.status', 'delivered')
            ->assertJsonPath('data.response_status', 200);

        Http::assertSent(function ($request) use ($secret) {
            $hasHeader = $request->hasHeader('X-SliceMart-Signature');
            $signatureHeader = $request->header('X-SliceMart-Signature')[0] ?? '';
            $expectedSignature = 'sha256=' . hash_hmac('sha256', $request->body(), $secret);

            return $hasHeader
                && $signatureHeader === $expectedSignature
                && $request->header('X-SliceMart-Event')[0] === 'webhook.ping';
        });
    }

    public function test_webhook_dispatch_service_queues_deliveries_for_matching_endpoints(): void
    {
        Http::fake();

        // Endpoint 1: Subscribed to order.created
        $endpoint1 = WebhookEndpoint::create([
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'url'       => 'https://service1.test/orders',
            'secret'    => 'whsec_111',
            'events'    => ['order.created'],
            'is_active' => true,
        ]);

        // Endpoint 2: Subscribed to stock.low only
        $endpoint2 = WebhookEndpoint::create([
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'url'       => 'https://service2.test/stock',
            'secret'    => 'whsec_222',
            'events'    => ['stock.low'],
            'is_active' => true,
        ]);

        $dispatchService = app(WebhookDispatchService::class);
        $queued = $dispatchService->dispatch($this->tenant->id, 'order.created', [
            'order_id' => 99,
            'order_number' => 'SO-2026-99',
            'total' => '1500.00',
        ]);

        $this->assertEquals(1, $queued);

        $this->assertDatabaseHas('webhook_deliveries', [
            'tenant_id'           => $this->tenant->id,
            'webhook_endpoint_id' => $endpoint1->id,
            'event_type'          => 'order.created',
        ]);

        $this->assertDatabaseMissing('webhook_deliveries', [
            'webhook_endpoint_id' => $endpoint2->id,
        ]);
    }

    public function test_cross_tenant_isolation_protects_webhooks(): void
    {
        $foreignTenant = Tenant::create([
            'id' => 888,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Foreign Corp',
            'slug' => 'foreign-corp',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $foreignEndpoint = WebhookEndpoint::create([
            'tenant_id' => $foreignTenant->id,
            'uuid'      => (string) Str::uuid(),
            'url'       => 'https://foreign.test/hooks',
            'secret'    => 'whsec_foreign',
            'events'    => ['order.created'],
            'is_active' => true,
        ]);

        // Attempt to show foreign endpoint
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->getJson("/api/v1/integrations/webhooks/{$foreignEndpoint->uuid}");

        $response->assertStatus(404);
    }
}
