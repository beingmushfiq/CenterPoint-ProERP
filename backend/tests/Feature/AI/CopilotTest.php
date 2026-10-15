<?php

declare(strict_types=1);

namespace Tests\Feature\AI;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\AI\Models\AgentConversation;
use App\Modules\AI\Models\CashFlowAlert;
use App\Modules\Finance\Models\BankAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CopilotTest extends TestCase
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

        // Base plan
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

        // Tenant 1
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

        DB::table('companies')->insert([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'SliceMart HQ',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
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

        // Grant ai.copilot.use permission
        $perm = Permission::firstOrCreate(
            ['name' => 'ai.copilot.use'],
            [
                'uuid' => (string) Str::uuid(),
                'module' => 'ai',
                'resource' => 'copilot',
                'action' => 'use',
                'description' => 'Access and converse with AI Financial Copilot',
            ]
        );

        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Finance Executive',
            'slug' => 'finance-executive',
            'is_system' => false,
        ]);

        $role->permissions()->attach($perm);
        $this->user->roles()->attach($role);

        $this->jwt = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: $this->user->token_version,
        );

        // Tenant 2 (for multi-tenant isolation testing)
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
            'name' => 'Other CFO',
            'email' => 'other@competitor.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role2 = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->secondTenant->id,
            'name' => 'Finance Executive 2',
            'slug' => 'finance-executive-2',
            'is_system' => false,
        ]);
        $role2->permissions()->attach($perm);
        $this->secondUser->roles()->attach($role2);

        $this->secondJwt = app(JwtService::class)->issueToken(
            userId: $this->secondUser->id,
            tenantId: $this->secondTenant->id,
            tokenVersion: $this->secondUser->token_version,
        );
    }

    protected function tearDown(): void
    {
        TenantContext::flush();
        parent::tearDown();
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->json('POST', '/api/v1/ai/copilot/chat', [
            'message' => 'What is our current cash position?',
        ]);

        $response->assertUnauthorized();
    }

    public function test_user_without_permission_is_forbidden(): void
    {
        // Create user without ai.copilot.use permission
        $unauthorizedUser = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Guest Staff',
            'email' => 'guest@slicemart.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $unauthJwt = app(JwtService::class)->issueToken(
            userId: $unauthorizedUser->id,
            tenantId: $this->tenant->id,
            tokenVersion: $unauthorizedUser->token_version,
        );

        $response = $this->withHeader('Authorization', "Bearer {$unauthJwt}")
            ->json('POST', '/api/v1/ai/copilot/chat', [
                'message' => 'Show me the financial data',
            ]);

        $response->assertForbidden();
    }

    public function test_chat_creates_conversation_and_messages(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->jwt}")
            ->json('POST', '/api/v1/ai/copilot/chat', [
                'message' => 'Hello, what financial insights can you provide?',
            ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure([
                'status',
                'data' => [
                    'conversation_uuid',
                    'message',
                    'tool_calls',
                    'tier_used',
                ],
            ]);

        $conversationUuid = $response->json('data.conversation_uuid');
        $this->assertDatabaseHas('agent_conversations', [
            'uuid' => $conversationUuid,
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
        ]);

        $this->assertDatabaseHas('agent_messages', [
            'tenant_id' => $this->tenant->id,
            'role' => 'user',
            'content' => 'Hello, what financial insights can you provide?',
        ]);
    }

    public function test_chat_handles_tier_0_cash_position_tool(): void
    {
        $coaId = DB::table('chart_of_accounts')->insertGetId([
            'tenant_id' => $this->tenant->id,
            'company_id' => 1,
            'uuid' => (string) Str::uuid(),
            'account_code' => '1010',
            'name' => 'City Bank Operational Account',
            'account_type' => 'asset',
            'account_subtype' => 'bank',
            'is_group' => false,
            'normal_balance' => 'debit',
            'is_system' => false,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed bank account
        BankAccount::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => 1,
            'chart_of_account_id' => $coaId,
            'uuid' => (string) Str::uuid(),
            'name' => 'Main Operational Account',
            'account_number' => '1234567890',
            'bank_name' => 'City Bank PLC',
            'account_type' => 'bank',
            'currency' => 'BDT',
            'current_balance' => '750000.0000',
            'is_active' => true,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->jwt}")
            ->json('POST', '/api/v1/ai/copilot/chat', [
                'message' => 'What is our current cash position?',
            ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('agent_audit_logs', [
            'tenant_id' => $this->tenant->id,
            'action' => 'get_cash_position',
            'permission_tier' => 0,
            'executed' => 1,
        ]);
    }

    public function test_tier_2_tool_triggers_pending_confirmation(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->jwt}")
            ->json('POST', '/api/v1/ai/copilot/chat', [
                'message' => 'Create a cash flow alert for low liquidity',
            ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.pending_action.status', 'PENDING_CONFIRMATION')
            ->assertJsonPath('data.pending_action.tier', 2);

        // Verify alert was NOT created yet
        $this->assertDatabaseCount('cash_flow_alerts', 0);

        // Verify audit log recorded unexecuted pending action
        $this->assertDatabaseHas('agent_audit_logs', [
            'tenant_id' => $this->tenant->id,
            'action' => 'create_cash_flow_alert',
            'permission_tier' => 2,
            'executed' => 0,
        ]);
    }

    public function test_confirm_action_executes_tier_2_and_creates_alert(): void
    {
        $conv = AgentConversation::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'title' => 'Test Confirmation Session',
            'status' => 'active',
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->jwt}")
            ->json('POST', "/api/v1/ai/copilot/conversations/{$conv->uuid}/confirm", [
                'tool_name' => 'create_cash_flow_alert',
                'arguments' => [
                    'alert_type' => 'low_balance',
                    'severity' => 'critical',
                    'title' => 'Critical Bank Account Runway Alert',
                    'description' => 'Cash balance dropped below safety buffer threshold.',
                    'threshold_value' => 100000.0,
                    'actual_value' => 45000.0,
                    'currency' => 'BDT',
                ],
            ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.result.status', 'CONFIRMED_AND_CREATED');

        $this->assertDatabaseHas('cash_flow_alerts', [
            'tenant_id' => $this->tenant->id,
            'alert_type' => 'low_balance',
            'severity' => 'critical',
            'title' => 'Critical Bank Account Runway Alert',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('agent_audit_logs', [
            'tenant_id' => $this->tenant->id,
            'action' => 'create_cash_flow_alert',
            'permission_tier' => 2,
            'executed' => 1,
            'confirmed_by' => $this->user->id,
        ]);
    }

    public function test_financing_match_engine_computes_recommendations(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->jwt}")
            ->json('POST', '/api/v1/ai/financing/match', [
                'monthly_revenue' => 500000.0,
                'monthly_expenses' => 350000.0,
                'ar_outstanding' => 250000.0,
                'inventory_value' => 600000.0,
                'bank_balance' => 150000.0,
            ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure([
                'status',
                'data' => [
                    'assessment_uuid',
                    'tenant_id',
                    'metrics',
                    'products',
                    'top_recommendation',
                    'summary',
                ],
            ]);

        $this->assertDatabaseHas('financing_assessments', [
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
        ]);
    }

    public function test_cross_tenant_isolation_is_strictly_enforced(): void
    {
        // Create conversation in Tenant 1
        $convTenant1 = AgentConversation::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'title' => 'Tenant 1 Secret Discussion',
            'status' => 'active',
        ]);

        // Attempt to access conversation using Tenant 2's JWT
        $response = $this->withHeader('Authorization', "Bearer {$this->secondJwt}")
            ->json('GET', "/api/v1/ai/copilot/conversations/{$convTenant1->uuid}/history");

        // Must fail with 404 Not Found (or 403 Forbidden) to maintain zero leak
        $response->assertNotFound();
    }

    public function test_alerts_acknowledge_workflow(): void
    {
        $alert = CashFlowAlert::create([
            'tenant_id' => $this->tenant->id,
            'alert_type' => 'overdue_ar',
            'severity' => 'warning',
            'title' => 'Overdue Receivables Exceeding 60 Days',
            'description' => 'Three customer invoices remain uncollected.',
            'status' => 'active',
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->jwt}")
            ->json('PATCH', "/api/v1/ai/copilot/alerts/{$alert->uuid}/acknowledge");

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.status', 'acknowledged');

        $this->assertDatabaseHas('cash_flow_alerts', [
            'id' => $alert->id,
            'status' => 'acknowledged',
            'acknowledged_by' => $this->user->id,
        ]);
    }
}
