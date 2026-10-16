<?php

declare(strict_types=1);

namespace Tests\Feature\AI;

use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CopilotContractTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        if (DB::table('plans')->where('id', 1)->doesntExist()) {
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
        }
    }

    private function createTenant(array $attributes = []): Tenant
    {
        return Tenant::create(array_merge([
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Contract Tenant',
            'slug' => 'contract-tenant-'.Str::random(6),
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ], $attributes));
    }

    public function test_anthropic_service_config_is_registered(): void
    {
        $this->assertIsArray(config('services.anthropic'));
        $this->assertSame('https://agentrouter.org', config('services.anthropic.base_url'));
        $this->assertSame('deepseek-v4-flash', config('services.anthropic.model'));
        $this->assertSame('2023-06-01', config('services.anthropic.version'));
        $this->assertSame(2000, config('services.anthropic.max_tokens'));
    }

    public function test_anthropic_client_builds_messages_request_body(): void
    {
        $client = new \App\Modules\AI\Services\AnthropicClient();

        $body = $client->buildRequestBody(
            systemPrompt: 'You are the copilot.',
            messages: [
                ['role' => 'user', 'content' => 'What is our cash position?'],
            ],
            tools: [
                [
                    'name' => 'get_cash_position',
                    'description' => 'Live liquidity.',
                    'input_schema' => ['type' => 'object', 'properties' => [], 'required' => []],
                ],
            ]
        );

        $this->assertSame('deepseek-v4-flash', $body['model']);
        $this->assertSame(2000, $body['max_tokens']);
        $this->assertSame('You are the copilot.', $body['system']);
        $this->assertSame('get_cash_position', $body['tools'][0]['name']);
        $this->assertArrayHasKey('input_schema', $body['tools'][0]);
        $this->assertArrayNotHasKey('type', $body['tools'][0]);
    }

    public function test_anthropic_client_parses_text_and_tool_use_blocks(): void
    {
        $client = new \App\Modules\AI\Services\AnthropicClient();

        $parsed = $client->parseResponse([
            'stop_reason' => 'tool_use',
            'content' => [
                ['type' => 'text', 'text' => 'Let me check your ledger.'],
                [
                    'type' => 'tool_use',
                    'id' => 'toolu_01',
                    'name' => 'get_cash_position',
                    'input' => ['account_type' => 'bank'],
                ],
            ],
        ]);

        $this->assertSame('Let me check your ledger.', $parsed['content']);
        $this->assertCount(1, $parsed['tool_calls']);
        $this->assertSame('toolu_01', $parsed['tool_calls'][0]['id']);
        $this->assertSame('get_cash_position', $parsed['tool_calls'][0]['name']);
        $this->assertSame(['account_type' => 'bank'], $parsed['tool_calls'][0]['arguments']);
        $this->assertSame('tool_use', $parsed['stop_reason']);
    }

    public function test_anthropic_client_formats_tool_results_as_user_blocks(): void
    {
        $client = new \App\Modules\AI\Services\AnthropicClient();

        $message = $client->toolResultMessage([
            ['tool_use_id' => 'toolu_01', 'output' => ['total_liquidity' => 900000]],
            ['tool_use_id' => 'toolu_02', 'output' => ['error' => 'none']],
        ]);

        $this->assertSame('user', $message['role']);
        $this->assertSame('tool_result', $message['content'][0]['type']);
        $this->assertSame('toolu_01', $message['content'][0]['tool_use_id']);
        $this->assertSame('{"total_liquidity":900000}', $message['content'][0]['content']);
        $this->assertSame('toolu_02', $message['content'][1]['tool_use_id']);
    }

    public function test_anthropic_tool_schemas_use_input_schema_shape(): void
    {
        $registry = app(\App\Modules\AI\Services\AgentToolRegistry::class);

        $schemas = $registry->getAnthropicToolSchemas();

        $this->assertCount(8, $schemas);

        $byName = collect($schemas)->keyBy('name');
        $this->assertTrue($byName->has('get_cash_position'));
        $this->assertTrue($byName->has('create_cash_flow_alert'));

        foreach ($schemas as $schema) {
            $this->assertArrayHasKey('name', $schema);
            $this->assertArrayHasKey('description', $schema);
            $this->assertArrayHasKey('input_schema', $schema);
            $this->assertArrayNotHasKey('type', $schema);
            $this->assertSame('object', $schema['input_schema']['type']);
        }

        $alert = $byName->get('create_cash_flow_alert');
        $this->assertSame(
            ['alert_type', 'severity', 'title', 'description'],
            $alert['input_schema']['required']
        );
    }

    public function test_ar_and_ap_outstanding_use_status_column_not_payment_status(): void
    {
        $tenant = $this->createTenant();

        $partyId = \Illuminate\Support\Facades\DB::table('parties')->insertGetId([
            'tenant_id' => $tenant->id,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'code' => 'PARTY-001',
            'name' => 'Trade Partner',
            'is_customer' => 1,
            'is_supplier' => 1,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \Illuminate\Support\Facades\DB::table('invoices')->insert([
            'tenant_id' => $tenant->id,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'invoice_number' => 'INV-AR-1',
            'party_id' => $partyId,
            'invoice_date' => now()->subDays(10)->toDateString(),
            'due_date' => now()->subDays(5)->toDateString(),
            'total_amount' => '100000.0000',
            'paid_amount' => '25000.0000',
            'status' => 'posted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \Illuminate\Support\Facades\DB::table('purchase_bills')->insert([
            'tenant_id' => $tenant->id,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'bill_number' => 'BILL-AP-1',
            'party_id' => $partyId,
            'bill_date' => now()->subDays(10)->toDateString(),
            'due_date' => now()->addDays(5)->toDateString(),
            'subtotal' => '60000.0000',
            'total_amount' => '60000.0000',
            'paid_amount' => '0.0000',
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $metrics = app(\App\Modules\AI\Services\FinancingMatchEngine::class)
            ->gatherFinancialMetrics($tenant->id);

        $this->assertSame(75000.0, (float) $metrics['ar_outstanding']);
        $this->assertSame(60000.0, (float) $metrics['ap_outstanding']);
    }
}


