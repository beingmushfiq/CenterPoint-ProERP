<?php

declare(strict_types=1);

namespace Tests\Feature\Platform;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class AIBrainTest extends TestCase
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
            'name' => 'ProERP Enterprise',
            'slug' => 'proerp-ent',
            'status' => 'active',
            'currency_code' => 'USD',
            'timezone' => 'UTC',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'Super Operator',
            'email' => 'operator@proerp.test',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->jwt = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: 1,
            tokenVersion: 1
        );
    }

    public function test_brain_capabilities_endpoint_returns_whitelabel_agent_specs(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
        ])->getJson('/api/v1/brain/capabilities');

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.name', 'ProERP Operations AI Brain Agent');
        $response->assertJsonPath('data.mode', 'Self-Contained / Local Agentic Execution');
        $this->assertNotEmpty($response->json('data.tools'));
    }

    public function test_brain_ask_endpoint_answers_operational_queries(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
        ])->postJson('/api/v1/brain/ask', [
            'query' => 'Explain our 3-way purchase order matching policy',
        ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $this->assertNotNull($response->json('data'));
    }

    public function test_brain_ask_validates_required_query(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
        ])->postJson('/api/v1/brain/ask', []);

        $response->assertStatus(422);
    }
}
