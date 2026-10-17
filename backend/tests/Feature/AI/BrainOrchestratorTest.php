<?php

declare(strict_types=1);

namespace Tests\Feature\AI;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\AI\Models\AgentConversation;
use App\Modules\Platform\Services\BrainOrchestrator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

final class BrainOrchestratorTest extends TestCase
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
            'name' => 'Enterprise Plan',
            'price' => '10000.0000',
            'billing_period' => 'monthly',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        config(['services.anthropic.key' => 'sk-ant-test-key-1234567890']);

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
            'name' => 'CFO Officer',
            'email' => 'cfo@slicemart.com',
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
    }

    public function test_brain_chat_persists_conversation_with_brain_context_type(): void
    {
        // Fake LLM response
        Http::fake([
            '*/v1/messages' => Http::response([
                'id' => 'msg_brain_1',
                'model' => 'claude-3-7-sonnet-20250219',
                'stop_reason' => 'end_turn',
                'content' => [
                    ['type' => 'text', 'text' => 'Hello! As your Financial & Operations Advisor, I am ready.'],
                ],
            ], 200),
        ]);

        $orchestrator = app(BrainOrchestrator::class);
        $result = $orchestrator->chat(
            tenantId: $this->tenant->id,
            userId: $this->user->id,
            conversationUuid: null,
            userMessage: 'What can you help me with?'
        );

        $this->assertNotEmpty($result['conversation_uuid']);
        $this->assertEquals('Hello! As your Financial & Operations Advisor, I am ready.', $result['message']);

        // Verify conversation is stored with context_type = 'brain'
        $conversation = AgentConversation::where('uuid', $result['conversation_uuid'])->firstOrFail();
        $this->assertEquals($this->tenant->id, $conversation->tenant_id);
        $this->assertEquals('brain', $conversation->context_type);
    }

    public function test_brain_ask_endpoint_via_http(): void
    {
        Http::fake([
            '*/v1/messages' => Http::response([
                'id' => 'msg_brain_2',
                'model' => 'claude-3-7-sonnet-20250219',
                'stop_reason' => 'end_turn',
                'content' => [
                    ['type' => 'text', 'text' => 'Our cash position is stable.'],
                ],
            ], 200),
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant'      => 'slicemart-retail',
        ])->postJson('/api/v1/brain/ask', [
            'query' => 'What is our financial health?',
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'answer' => 'Our cash position is stable.',
            ],
        ]);
    }

    public function test_brain_conversations_endpoint(): void
    {
        // Create a brain conversation
        AgentConversation::create([
            'uuid'         => (string) Str::uuid(),
            'tenant_id'    => $this->tenant->id,
            'user_id'      => $this->user->id,
            'title'        => 'Brain Cash Analysis',
            'status'       => 'active',
            'context_type' => 'brain',
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant'      => 'slicemart-retail',
        ])->getJson('/api/v1/brain/conversations');

        $response->assertStatus(200);
        $response->assertJson(['success' => true]);
        $data = $response->json('data');
        $this->assertNotEmpty($data);
        $this->assertEquals('Brain Cash Analysis', $data[0]['title']);
    }
}
