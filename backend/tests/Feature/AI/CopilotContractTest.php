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
        $tenant = Tenant::create(array_merge([
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

        $companyId = DB::table('companies')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'name' => 'Default Company',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $coaId = DB::table('chart_of_accounts')->insertGetId([
            'tenant_id' => $tenant->id,
            'company_id' => $companyId,
            'uuid' => (string) Str::uuid(),
            'account_code' => 'COA-'.Str::upper(Str::random(4)),
            'name' => 'Bank Clearing Account',
            'account_type' => 'asset',
            'account_subtype' => 'bank',
            'is_group' => false,
            'normal_balance' => 'debit',
            'is_system' => false,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $branchId = DB::table('branches')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'company_id' => $companyId,
            'code' => 'BR-'.Str::upper(Str::random(4)),
            'name' => 'Main Branch',
            'type' => 'sales',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $tenant->setAttribute('default_company_id', $companyId);
        $tenant->setAttribute('default_coa_id', $coaId);
        $tenant->setAttribute('default_branch_id', $branchId);

        return $tenant;
    }

    private function createExpense(Tenant $tenant, array $attributes): int
    {
        return (int) DB::table('expenses')->insertGetId(array_merge([
            'tenant_id' => $tenant->id,
            'company_id' => $tenant->getAttribute('default_company_id'),
            'branch_id' => $tenant->getAttribute('default_branch_id'),
            'uuid' => (string) Str::uuid(),
            'expense_number' => 'EXP-'.Str::upper(Str::random(6)),
            'expense_date' => now()->toDateString(),
            'payee_type' => 'other',
            'payee_name' => 'Service Provider',
            'payment_method' => 'cash',
            'amount' => '1000.0000',
            'tax_amount' => '0.0000',
            'total_amount' => '1000.0000',
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    private function createBankAccount(Tenant $tenant, array $attributes): \App\Modules\Finance\Models\BankAccount
    {
        return \App\Modules\Finance\Models\BankAccount::create(array_merge([
            'tenant_id' => $tenant->id,
            'company_id' => $tenant->getAttribute('default_company_id'),
            'chart_of_account_id' => $tenant->getAttribute('default_coa_id'),
            'uuid' => (string) Str::uuid(),
            'code' => 'BA-'.Str::upper(Str::random(6)),
            'currency' => 'BDT',
            'is_active' => true,
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

    public function test_cash_position_tool_matches_cash_position_data_contract(): void
    {
        $tenant = $this->createTenant();
        $tenantId = $tenant->id;

        $this->createBankAccount($tenant, [
            'name' => 'BRAC Principal',
            'account_number' => 'BRAC-1501-0092',
            'bank_name' => 'BRAC Bank',
            'account_type' => 'bank',
            'current_balance' => '845000.0000',
        ]);

        $this->createBankAccount($tenant, [
            'name' => 'Petty Cash',
            'account_number' => 'CASH-0001',
            'bank_name' => 'Internal',
            'account_type' => 'cash',
            'current_balance' => '125000.0000',
        ]);

        $result = app(\App\Modules\AI\Services\AgentToolRegistry::class)
            ->executeTool('get_cash_position', [], $tenantId);

        $this->assertSame(970000.0, (float) $result['total_liquid_cash']);
        $this->assertSame(845000.0, (float) $result['bank_balance']);
        $this->assertSame(125000.0, (float) $result['cash_on_hand']);
        $this->assertContains($result['health_status'], ['healthy', 'moderate', 'critical']);
        $this->assertIsInt($result['runway_days']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $result['as_of_date']);
        $this->assertCount(2, $result['accounts_breakdown']);
        $this->assertSame('BRAC Principal', $result['accounts_breakdown'][0]['name']);
        $this->assertSame('bank', $result['accounts_breakdown'][0]['type']);
        $this->assertArrayHasKey('code', $result['accounts_breakdown'][0]);
        $this->assertArrayNotHasKey('total_liquidity', $result);
        $this->assertArrayNotHasKey('accounts', $result);
    }

    public function test_overdue_invoices_tool_matches_contract_and_aging_buckets(): void
    {
        $tenant = $this->createTenant();
        $tenantId = $tenant->id;

        $partyId = \Illuminate\Support\Facades\DB::table('parties')->insertGetId([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'code' => 'CUST-001',
            'name' => 'Apex Superstore',
            'is_customer' => 1,
            'is_supplier' => 0,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \Illuminate\Support\Facades\DB::table('invoices')->insert([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'invoice_number' => 'INV-2026-001',
            'party_id' => $partyId,
            'invoice_date' => now()->subDays(60)->toDateString(),
            'due_date' => now()->subDays(45)->toDateString(),
            'total_amount' => '200000.0000',
            'paid_amount' => '50000.0000',
            'status' => 'posted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = app(\App\Modules\AI\Services\AgentToolRegistry::class)
            ->executeTool('list_overdue_invoices', ['days_overdue' => 0, 'limit' => 10], $tenantId);

        $this->assertSame(150000.0, (float) $result['total_overdue']);
        $this->assertSame(1, $result['total_invoices_count']);
        $this->assertSame(150000.0, (float) $result['aging_summary']['31-60']);
        $this->assertSame(0.0, (float) $result['aging_summary']['1-30']);

        $invoice = $result['invoices'][0];
        $this->assertSame('INV-2026-001', $invoice['invoice_number']);
        $this->assertSame('Apex Superstore', $invoice['customer_name']);
        $this->assertSame(150000.0, (float) $invoice['amount_due']);
        $this->assertSame(50000.0, (float) $invoice['amount_paid']);
        $this->assertSame(200000.0, (float) $invoice['total_amount']);
        $this->assertSame(45, $invoice['days_overdue']);
        $this->assertSame('31-60', $invoice['aging_bucket']);
        $this->assertIsInt($invoice['id']);
    }

    public function test_pl_summary_tool_matches_contract_and_joins_expense_category(): void
    {
        $tenant = $this->createTenant();
        $tenantId = $tenant->id;

        $categoryId = \Illuminate\Support\Facades\DB::table('expense_categories')->insertGetId([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'code' => 'UTIL',
            'name' => 'Utilities',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->createExpense($tenant, [
            'expense_number' => 'EXP-001',
            'expense_category_id' => $categoryId,
            'expense_date' => now()->subDays(5)->toDateString(),
            'amount' => '400000.0000',
            'total_amount' => '400000.0000',
            'status' => 'approved',
        ]);

        $partyId = \Illuminate\Support\Facades\DB::table('parties')->insertGetId([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'code' => 'CUST-PL-1',
            'name' => 'PL Customer',
            'is_customer' => 1,
            'is_supplier' => 0,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \Illuminate\Support\Facades\DB::table('invoices')->insert([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'invoice_number' => 'INV-PL-1',
            'party_id' => $partyId,
            'invoice_date' => now()->subDays(5)->toDateString(),
            'due_date' => now()->addDays(5)->toDateString(),
            'total_amount' => '1000000.0000',
            'paid_amount' => '0.0000',
            'status' => 'posted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = app(\App\Modules\AI\Services\AgentToolRegistry::class)
            ->executeTool('get_pl_summary', [], $tenantId);

        $this->assertSame(1000000.0, (float) $result['total_revenue']);
        $this->assertSame(400000.0, (float) $result['operating_expenses']);
        $this->assertSame(0.0, (float) $result['cogs']);
        $this->assertSame(1000000.0, (float) $result['gross_profit']);
        $this->assertSame(100.0, (float) $result['gross_margin_pct']);
        $this->assertSame(600000.0, (float) $result['net_operating_income']);
        $this->assertSame(60.0, (float) $result['net_margin_pct']);
        $this->assertSame('Utilities', $result['expense_breakdown'][0]['category']);
        $this->assertSame(100.0, (float) $result['expense_breakdown'][0]['pct_of_total']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $result['period_start']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $result['period_end']);
        $this->assertArrayNotHasKey('net_profit', $result);
    }
}





