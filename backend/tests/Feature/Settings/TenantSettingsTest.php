<?php

declare(strict_types=1);

namespace Tests\Feature\Settings;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\AuditLog;
use App\Models\Setting;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantSettingsTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->tenant = Tenant::where('slug', 'slicemart')->firstOrFail();
        $this->admin = User::where('email', 'admin@slicemart.test')->firstOrFail();

        TenantContext::bind($this->tenant->toArray());

        $jwtService = app(JwtService::class);
        $this->token = $jwtService->issueToken(
            userId: $this->admin->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1,
            permVersion: '1',
            scopes: ['*']
        );
    }

    public function test_can_fetch_settings_schema(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->getJson('/api/v1/settings/schema');

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'data' => [
                'general',
                'production',
                'inventory',
                'purchase',
                'sales',
                'pos',
                'ecommerce',
                'delivery',
                'integrations',
                'qc',
                'hr_payroll',
                'assets',
                'finance',
                'notifications',
                'security',
                'reports',
            ],
        ]);
    }

    public function test_can_reset_settings_group_to_defaults(): void
    {
        // 1. Set custom value
        $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->putJson('/api/v1/settings/general', [
                'settings' => [
                    'company_legal_name' => 'Custom Name Inc.',
                ],
            ]);

        // 2. Reset group
        $resetRes = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->postJson('/api/v1/settings/general/reset');

        $resetRes->assertOk();
        $resetRes->assertJsonPath('success', true);
        $resetRes->assertJsonPath('data.settings.company_legal_name.value', 'SliceMart Industries Ltd.');
    }

    public function test_can_read_and_batch_update_general_settings(): void
    {
        // 1. Read default group settings
        $getRes = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->getJson('/api/v1/settings/general');

        $getRes->assertOk();
        $getRes->assertJsonPath('success', true);

        // 2. Batch update settings
        $updateRes = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->putJson('/api/v1/settings/general', [
                'settings' => [
                    'company_legal_name' => 'SliceMart Global Foods Ltd.',
                    'currency_code' => 'BDT',
                    'decimal_places' => 2,
                    'invoice_prefix' => 'SM-INV-',
                ],
            ]);

        $updateRes->assertOk();
        $updateRes->assertJsonPath('success', true);
        $updateRes->assertJsonPath('data.settings.company_legal_name.value', 'SliceMart Global Foods Ltd.');
        $updateRes->assertJsonPath('data.settings.invoice_prefix.value', 'SM-INV-');

        // 3. Verify audit log was recorded
        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $this->tenant->id,
            'action' => 'updated',
        ]);
    }

    public function test_sensitive_credentials_are_masked_on_read(): void
    {
        // Update sensitive API key
        $updateRes = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->putJson('/api/v1/settings/delivery', [
                'settings' => [
                    'steadfast_api_key' => 'secret_sf_key_998877',
                    'steadfast_secret_key' => 'super_secret_steadfast_token',
                ],
            ]);

        $updateRes->assertOk();

        // Read delivery settings - must return masked bullets
        $getRes = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->getJson('/api/v1/settings/delivery');

        $getRes->assertOk();
        $getRes->assertJsonPath('data.settings.steadfast_api_key.value', '••••••••');
        $getRes->assertJsonPath('data.settings.steadfast_secret_key.value', '••••••••');
    }

    public function test_can_test_courier_connection(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer ' . $this->token)
            ->postJson('/api/v1/settings/delivery/test-connection', [
                'provider' => 'steadfast',
                'credentials' => [
                    'steadfast_api_key' => 'key123',
                    'steadfast_secret_key' => 'secret123',
                ],
            ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.status', 'connected');
    }
}
