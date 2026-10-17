<?php

declare(strict_types=1);

namespace Tests\Feature\AI;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Platform\Models\TenantAISetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

final class TenantAISettingsTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;

    private Tenant $secondTenant;
    private User $secondUser;
    private string $secondJwt;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

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
            'name' => 'SliceMart Retail Ltd',
            'slug' => 'slicemart-retail',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->user = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Admin Officer',
            'email' => 'admin@slicemart.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->jwt = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: $this->user->token_version,
        );

        // Tenant 2 for isolation testing
        $this->secondTenant = Tenant::create([
            'id' => 2,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Competitor Corp',
            'slug' => 'competitor-corp',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->secondUser = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->secondTenant->id,
            'name' => 'Competitor Admin',
            'email' => 'admin@competitor.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->secondJwt = app(JwtService::class)->issueToken(
            userId: $this->secondUser->id,
            tenantId: $this->secondTenant->id,
            tokenVersion: $this->secondUser->token_version,
        );
    }

    public function test_get_ai_settings_returns_global_defaults_when_not_configured(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant'      => 'slicemart-retail',
        ])->getJson('/api/v1/settings/ai-model');

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'configured' => false,
                'source'     => 'global',
            ],
        ]);
    }

    public function test_update_ai_settings_persists_and_encrypts_key(): void
    {
        $payload = [
            'model_name'  => 'Custom DeepSeek V3',
            'model_id'    => 'deepseek-chat',
            'base_url'    => 'https://api.deepseek.com',
            'api_key'     => 'sk-deepseek-super-secret-12345678',
            'api_version' => '2023-06-01',
            'max_tokens'  => 8192,
            'is_active'   => true,
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant'      => 'slicemart-retail',
        ])->postJson('/api/v1/settings/ai-model', $payload);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'configured' => true,
                'model_name' => 'Custom DeepSeek V3',
                'model_id'   => 'deepseek-chat',
                'base_url'   => 'https://api.deepseek.com',
                'source'     => 'tenant',
            ],
        ]);

        // Ensure key is NOT returned plaintext in response
        $this->assertStringNotContainsString('sk-deepseek-super-secret-12345678', $response->getContent());

        // Verify database storage is encrypted
        $setting = TenantAISetting::where('tenant_id', $this->tenant->id)->firstOrFail();
        $this->assertNotEmpty($setting->api_key_encrypted);
        $this->assertNotEquals('sk-deepseek-super-secret-12345678', $setting->api_key_encrypted);
        $this->assertEquals('sk-deepseek-super-secret-12345678', Crypt::decryptString($setting->api_key_encrypted));
    }

    public function test_test_connection_endpoint(): void
    {
        // Save tenant config
        $setting = new TenantAISetting();
        $setting->tenant_id = $this->tenant->id;
        $setting->model_id = 'claude-3-7-sonnet-20250219';
        $setting->base_url = 'https://api.anthropic.com';
        $setting->api_key = 'sk-ant-test-key-1234567890';
        $setting->save();

        // Fake outgoing Anthropic /v1/messages call
        Http::fake([
            'https://api.anthropic.com/v1/messages' => Http::response([
                'id' => 'msg_123',
                'model' => 'claude-3-7-sonnet-20250219',
                'content' => [
                    ['type' => 'text', 'text' => 'pong'],
                ],
            ], 200),
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant'      => 'slicemart-retail',
        ])->postJson('/api/v1/settings/ai-model/test');

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'success' => true,
                'model'   => 'claude-3-7-sonnet-20250219',
            ],
        ]);
    }

    public function test_delete_settings_reverts_to_global(): void
    {
        $setting = new TenantAISetting();
        $setting->tenant_id = $this->tenant->id;
        $setting->model_id = 'custom-model';
        $setting->base_url = 'https://custom.api.com';
        $setting->api_key = 'sk-custom-12345678';
        $setting->save();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant'      => 'slicemart-retail',
        ])->deleteJson('/api/v1/settings/ai-model');

        $response->assertStatus(200);
        $this->assertDatabaseMissing('tenant_ai_settings', ['tenant_id' => $this->tenant->id]);
    }

    public function test_tenant_isolation_settings(): void
    {
        // Tenant 1 config
        $setting = new TenantAISetting();
        $setting->tenant_id = $this->tenant->id;
        $setting->model_name = 'Tenant 1 Model';
        $setting->model_id = 'model-tenant-1';
        $setting->base_url = 'https://tenant1.api.com';
        $setting->api_key = 'sk-tenant-1-key-1234';
        $setting->save();

        // Tenant 2 requests settings
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->secondJwt}",
            'X-Tenant'      => 'competitor-corp',
        ])->getJson('/api/v1/settings/ai-model');

        $response->assertStatus(200);
        // Tenant 2 sees global fallback, not Tenant 1's config
        $response->assertJson([
            'success' => true,
            'data' => [
                'configured' => false,
                'source'     => 'global',
            ],
        ]);
        $this->assertStringNotContainsString('Tenant 1 Model', $response->getContent());
    }
}
