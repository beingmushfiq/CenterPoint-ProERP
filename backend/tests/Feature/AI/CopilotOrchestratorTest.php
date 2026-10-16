<?php

declare(strict_types=1);

namespace Tests\Feature\AI;

use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\AI\Services\AgentOrchestrator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class CopilotOrchestratorTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

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
            'name' => 'Finance Executive',
            'email' => 'finance@slicemart.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);
    }

    protected function tearDown(): void
    {
        TenantContext::flush();
        parent::tearDown();
    }

    public function test_orchestrator_prefers_anthropic_when_configured(): void
    {
        config(['services.anthropic.key' => 'sk-test-key']);

        Http::fake([
            '*/v1/messages' => Http::sequence()
                ->push([
                    'stop_reason' => 'tool_use',
                    'content' => [
                        ['type' => 'text', 'text' => 'Checking your liquidity.'],
                        ['type' => 'tool_use', 'id' => 'toolu_01', 'name' => 'get_cash_position', 'input' => []],
                    ],
                ])
                ->push([
                    'stop_reason' => 'end_turn',
                    'content' => [
                        ['type' => 'text', 'text' => 'Your liquidity is healthy.'],
                    ],
                ]),
        ]);

        $result = app(AgentOrchestrator::class)->chat(
            tenantId: $this->tenant->id,
            userId: $this->user->id,
            conversationUuid: null,
            userMessage: 'How is my cash position?',
        );

        $this->assertSame('Your liquidity is healthy.', $result['message']);
        $this->assertSame('get_cash_position', $result['tool_calls'][0]['tool']);
        $this->assertSame('toolu_01', $result['tool_calls'][0]['tool_call_id']);
        $this->assertSame(0, $result['tool_calls'][0]['permission_tier']);

        Http::assertSentCount(2);
        Http::assertSent(fn ($request): bool => $request->url() === 'https://agentrouter.org/v1/messages'
            && $request->hasHeader('x-api-key', 'sk-test-key')
            && $request->hasHeader('anthropic-version', '2023-06-01'));
    }

    public function test_orchestrator_falls_back_when_anthropic_not_configured(): void
    {
        config(['services.anthropic.key' => null]);

        Http::fake();

        $result = app(AgentOrchestrator::class)->chat(
            tenantId: $this->tenant->id,
            userId: $this->user->id,
            conversationUuid: null,
            userMessage: 'What is our current cash position?',
        );

        Http::assertNothingSent();
        $this->assertSame('get_cash_position', $result['tool_calls'][0]['tool']);
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function quickPromptProvider(): array
    {
        return [
            'cash' => ['What is our current cash position?', 'get_cash_position'],
            'overdue' => ['Show me overdue invoices', 'list_overdue_invoices'],
            'pl' => ['Show me the P&L summary for this month', 'get_pl_summary'],
            'risk' => ['Analyze our cash flow risk for the next 30 days', 'analyze_cash_flow_risk'],
            'inventory' => ['What is our inventory valuation?', 'get_inventory_value'],
            'financing' => ['What financing options do we qualify for?', 'match_financing_options'],
        ];
    }

    #[DataProvider('quickPromptProvider')]
    public function test_every_quick_prompt_resolves_to_a_tool(string $prompt, string $expectedTool): void
    {
        config(['services.anthropic.key' => null]);

        $result = app(AgentOrchestrator::class)->chat(
            tenantId: $this->tenant->id,
            userId: $this->user->id,
            conversationUuid: null,
            userMessage: $prompt,
        );

        $this->assertNotEmpty($result['tool_calls'], "Prompt '{$prompt}' produced no tool call");
        $this->assertSame($expectedTool, $result['tool_calls'][0]['tool']);
    }

    public function test_ar_keyword_does_not_match_inside_unrelated_words(): void
    {
        config(['services.anthropic.key' => null]);

        $result = app(AgentOrchestrator::class)->chat(
            tenantId: $this->tenant->id,
            userId: $this->user->id,
            conversationUuid: null,
            userMessage: 'Are our quarterly estimates ready?',
        );

        $this->assertNotSame('list_overdue_invoices', $result['tool_calls'][0]['tool'] ?? null);
    }
}

