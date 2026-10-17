<?php

declare(strict_types=1);

namespace Tests\Feature\AI;

use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Modules\AI\Services\UnifiedLLMClient;
use App\Modules\Platform\Models\TenantAISetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class UnifiedLLMClientTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

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
    }

    public function test_unified_client_resolves_tenant_config(): void
    {
        $setting = new TenantAISetting();
        $setting->tenant_id = $this->tenant->id;
        $setting->model_name = 'Custom DeepSeek V3';
        $setting->model_id = 'deepseek-chat';
        $setting->base_url = 'https://api.deepseek.com';
        $setting->api_key = 'sk-tenant-custom-key-12345';
        $setting->max_tokens = 2048;
        $setting->save();

        $client = app(UnifiedLLMClient::class);
        $client->configureForTenant($this->tenant->id);

        $this->assertTrue($client->isConfigured());
        $this->assertEquals('Custom DeepSeek V3', $client->getActiveModelName());
    }

    public function test_unified_client_falls_back_to_global_when_no_tenant_config(): void
    {
        $client = app(UnifiedLLMClient::class);
        $client->configureForTenant($this->tenant->id);

        // Falls back to global model name
        $this->assertEquals(config('services.anthropic.model', 'claude-3-7-sonnet-20250219'), $client->getActiveModelName());
    }
}
