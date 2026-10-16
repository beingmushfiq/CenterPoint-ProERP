# AI Finance Copilot — Finish, Verify & Submit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the FinTechathon 2026 WeBank Track E "AI Finance Copilot" (CenterPoint ProERP / SliceMartFMS) produce contract-correct data end to end, drive it with a real Anthropic-native `/v1/messages` provider, and produce the five required submission artifacts with mandatory verification gates.

**Architecture:** Two coordinated layers are reconciled against a single source of truth (`frontend/src/modules/ai/types/copilot.ts`). The Laravel backend is enriched so its tool results, controller payloads and audit/alert/history endpoints emit exactly the fields the existing React cards, tabs and dialogs already read — computed from the tenant ledger, never invented. A new `AnthropicClient` service translates to/from Anthropic Messages blocks and is used by `AgentOrchestrator` for the live LLM path; the existing deterministic fallback engine remains the offline path and gets PL/Inventory branches plus a word-boundary AR fix.

**Tech Stack:** Laravel 13 / PHP 8.5 · PHPUnit 12 · Larastan/PHPStan 2 · Pint · React 19 + TypeScript 6 + Vite 8 · Vitest 4 · Playwright 1.63 · ffmpeg (for demo video mp4) · PowerShell (Windows shell)

---

## File Structure

**Backend — created**
- `backend/app/Modules/AI/Services/AnthropicClient.php` — Anthropic `/v1/messages` wire translator (request build, block parsing, tool schema variant).
- `backend/tests/Feature/AI/CopilotContractTest.php` — new contract tests for every payload shape the frontend consumes.

**Backend — modified**
- `backend/config/services.php` — add `anthropic` block.
- `backend/.env.example` — add `ANTHROPIC_*` vars.
- `backend/app/Modules/AI/Services/AgentOrchestrator.php` — Anthropic live path; `tool`/`permission_tier` emission; `PendingAction` shape; pending-action persistence + resolution; fallback branches and AR word-boundary fix.
- `backend/app/Modules/AI/Services/AgentToolRegistry.php` — `getAnthropicToolSchemas()`; SQL column fixes; 5 tool payload enrichments.
- `backend/app/Modules/AI/Services/AgentPermissionGuard.php` — `riskLevelFor()`.
- `backend/app/Modules/AI/Services/FinancingMatchEngine.php` — AR/AP status filter fixes; `formatProduct()` / `formatMatchData()` / `computeSolvencyScore()` / `computeRiskProfile()`.
- `backend/app/Modules/AI/Controllers/CopilotController.php` — confirm contract; audit-log/alerts/financing-history transformers; WeBank real metrics; match-financing request contract.
- `backend/tests/Feature/AI/CopilotTest.php` — reconcile 3 tests with the new contract.

**Frontend — modified**
- `frontend/src/modules/ai/api/copilotApi.ts` — add `preQualifyWebank()`.
- `frontend/src/modules/ai/components/FinancingMatcherTab.tsx` — wire `handleApply()` to the real endpoint.

**Frontend — created**
- `frontend/e2e/copilot-demo-capture.spec.ts` — Playwright spec that records the 5-minute demo and exports the deck PDF.

**Submission tooling — created**
- `scripts/capture-demo.ps1` — seeds, resets a deterministic demo password, runs the capture spec.
- `docs/submission/SUBMISSION_EMAIL.md` — submission email body.
- `docs/submission/execution_evidence.zip` — generated artifact.

---

## Task 1: Anthropic provider configuration

**Files:**
- Modify: `backend/config/services.php`
- Modify: `backend/.env.example:90-97`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php` (created here)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\AI;

use Tests\TestCase;

final class CopilotContractTest extends TestCase
{
    public function test_anthropic_service_config_is_registered(): void
    {
        $this->assertIsArray(config('services.anthropic'));
        $this->assertSame('https://agentrouter.org', config('services.anthropic.base_url'));
        $this->assertSame('deepseek-v4-flash', config('services.anthropic.model'));
        $this->assertSame('2023-06-01', config('services.anthropic.version'));
        $this->assertSame(2000, config('services.anthropic.max_tokens'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_anthropic_service_config_is_registered`
Expected: FAIL — `config('services.anthropic')` is `null` (`assertIsArray` fails).

- [ ] **Step 3: Add the config block**

In `backend/config/services.php`, immediately after the closing of the `'slack'` array and before the final `];`, add:

```php
    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'base_url' => env('ANTHROPIC_BASE_URL', 'https://agentrouter.org'),
        'model' => env('ANTHROPIC_MODEL', 'deepseek-v4-flash'),
        'max_tokens' => (int) env('ANTHROPIC_MAX_TOKENS', 2000),
        'version' => env('ANTHROPIC_VERSION', '2023-06-01'),
    ],
```

- [ ] **Step 4: Add the env variables**

In `backend/.env.example`, replace the AI block (lines 90–97) with:

```
# AI Financial Copilot Configuration (FinTechathon 2026 WeBank Topic E)
AI_COPILOT_ENABLED=true
AI_COPILOT_SANDBOX_MODE=true
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
AI_COPILOT_MAX_TOKENS=2000
AI_COPILOT_MAX_TURNS=5
AI_COPILOT_RATE_LIMIT=30

# Anthropic-compatible provider (AgentRouter gateway)
# Never commit a real key. Put the live value only in backend/.env
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://agentrouter.org
ANTHROPIC_MODEL=deepseek-v4-flash
ANTHROPIC_MAX_TOKENS=2000
ANTHROPIC_VERSION=2023-06-01
```

- [ ] **Step 5: Add the live key to the local `.env`**

Append to `backend/.env` (this file is git-ignored — verify with `git check-ignore -v backend/.env`):

```
ANTHROPIC_API_KEY=sk-EciWQ0Z9VGbTGZYIXuh7Kx2iDGByfskdH8o6BrWqIksqZWyC
ANTHROPIC_BASE_URL=https://agentrouter.org
ANTHROPIC_MODEL=deepseek-v4-flash
ANTHROPIC_MAX_TOKENS=2000
ANTHROPIC_VERSION=2023-06-01
```

Then run: `cd backend; php artisan config:clear`
Expected: `Configuration cache cleared successfully.`

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend; php artisan test --filter=test_anthropic_service_config_is_registered`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/config/services.php backend/.env.example backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): register anthropic provider configuration"
```

---

## Task 2: Anthropic Messages wire translator

**Files:**
- Create: `backend/app/Modules/AI/Services/AnthropicClient.php`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

Anthropic's Messages API differs from OpenAI in four ways the translator must absorb:
1. Tool schema shape is `{name, description, input_schema}` — not `{type:'function', function:{…}}`.
2. The system prompt is a top-level `system` string, not a `system` role message.
3. Assistant tool calls arrive as `content[]` blocks of `type: 'tool_use'` with `id` + `name` + `input`.
4. Tool results are sent back as a **user** message whose `content` is a list of `{type:'tool_result', tool_use_id, content}` blocks.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend; php artisan test --filter=test_anthropic_client`
Expected: FAIL — `Class "App\Modules\AI\Services\AnthropicClient" not found`.

- [ ] **Step 3: Write the client**

Create `backend/app/Modules/AI/Services/AnthropicClient.php`:

```php
<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Translates between the Copilot's internal message/tool model and the
 * Anthropic Messages API (POST {base_url}/v1/messages).
 */
class AnthropicClient
{
    public function isConfigured(): bool
    {
        $key = config('services.anthropic.key');

        return is_string($key) && trim($key) !== '';
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $tools
     * @return array<string, mixed>
     */
    public function buildRequestBody(string $systemPrompt, array $messages, array $tools = []): array
    {
        $body = [
            'model' => (string) config('services.anthropic.model'),
            'max_tokens' => (int) config('services.anthropic.max_tokens'),
            'system' => $systemPrompt,
            'messages' => $messages,
        ];

        if ($tools !== []) {
            $body['tools'] = $tools;
        }

        return $body;
    }

    /**
     * Perform a single Messages API turn.
     *
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $tools
     * @return array{content: string, tool_calls: list<array{id: string, name: string, arguments: array<string, mixed>}>, stop_reason: string}|null
     */
    public function messages(string $systemPrompt, array $messages, array $tools = []): ?array
    {
        if (! $this->isConfigured()) {
            return null;
        }

        $baseUrl = rtrim((string) config('services.anthropic.base_url'), '/');

        try {
            $response = Http::withHeaders([
                'x-api-key' => (string) config('services.anthropic.key'),
                'anthropic-version' => (string) config('services.anthropic.version'),
                'content-type' => 'application/json',
            ])
                ->timeout(45)
                ->post($baseUrl.'/v1/messages', $this->buildRequestBody($systemPrompt, $messages, $tools));

            if (! $response->successful()) {
                Log::warning('Anthropic API call returned error: '.$response->body());

                return null;
            }

            /** @var array<string, mixed> $json */
            $json = $response->json();

            return $this->parseResponse($json);
        } catch (Throwable $e) {
            Log::error('Anthropic connection exception: '.$e->getMessage());

            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $response
     * @return array{content: string, tool_calls: list<array{id: string, name: string, arguments: array<string, mixed>}>, stop_reason: string}
     */
    public function parseResponse(array $response): array
    {
        $text = '';
        $toolCalls = [];
        $blocks = is_array($response['content'] ?? null) ? $response['content'] : [];

        foreach ($blocks as $block) {
            if (! is_array($block)) {
                continue;
            }

            if (($block['type'] ?? null) === 'text' && is_string($block['text'] ?? null)) {
                $text .= (string) $block['text'];
            }

            if (($block['type'] ?? null) === 'tool_use') {
                $input = is_array($block['input'] ?? null) ? $block['input'] : [];
                $toolCalls[] = [
                    'id' => is_string($block['id'] ?? null) ? (string) $block['id'] : '',
                    'name' => is_string($block['name'] ?? null) ? (string) $block['name'] : '',
                    'arguments' => $input,
                ];
            }
        }

        return [
            'content' => $text,
            'tool_calls' => $toolCalls,
            'stop_reason' => is_string($response['stop_reason'] ?? null) ? (string) $response['stop_reason'] : 'end_turn',
        ];
    }

    /**
     * Build the assistant turn that must be echoed back before tool results.
     *
     * @param  array{content: string, tool_calls: list<array{id: string, name: string, arguments: array<string, mixed>}>}  $turn
     * @return array<string, mixed>
     */
    public function assistantTurn(array $turn): array
    {
        $blocks = [];

        if ($turn['content'] !== '') {
            $blocks[] = ['type' => 'text', 'text' => $turn['content']];
        }

        foreach ($turn['tool_calls'] as $call) {
            $blocks[] = [
                'type' => 'tool_use',
                'id' => $call['id'],
                'name' => $call['name'],
                'input' => $call['arguments'],
            ];
        }

        return ['role' => 'assistant', 'content' => $blocks];
    }

    /**
     * @param  list<array{tool_use_id: string, output: mixed}>  $results
     * @return array<string, mixed>
     */
    public function toolResultMessage(array $results): array
    {
        $blocks = [];

        foreach ($results as $result) {
            $blocks[] = [
                'type' => 'tool_result',
                'tool_use_id' => $result['tool_use_id'],
                'content' => json_encode($result['output'], JSON_UNESCAPED_UNICODE),
            ];
        }

        return ['role' => 'user', 'content' => $blocks];
    }

    /**
     * Convert stored string-content history turns to Anthropic message shape.
     *
     * @param  list<array{role: string, content: string}>  $history
     * @return list<array<string, mixed>>
     */
    public function historyToMessages(array $history): array
    {
        $messages = [];

        foreach ($history as $turn) {
            $role = $turn['role'] === 'assistant' ? 'assistant' : 'user';
            $messages[] = ['role' => $role, 'content' => (string) $turn['content']];
        }

        return $messages;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend; php artisan test --filter=test_anthropic_client`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Services/AnthropicClient.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): add anthropic messages wire translator"
```

---

## Task 3: Anthropic tool schemas on the registry

**Files:**
- Modify: `backend/app/Modules/AI/Services/AgentToolRegistry.php` (after `getOpenAiToolSchemas()` ends at line 221)
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_anthropic_tool_schemas_use_input_schema_shape`
Expected: FAIL — `Call to undefined method ... getAnthropicToolSchemas()`.

- [ ] **Step 3: Implement the converter**

In `backend/app/Modules/AI/Services/AgentToolRegistry.php`, insert a new public method immediately after `getOpenAiToolSchemas()` (i.e. after line 221's closing brace):

```php
    /**
     * Convert the OpenAI function schemas to Anthropic Messages tool shape.
     *
     * @return list<array<string, mixed>>
     */
    public function getAnthropicToolSchemas(): array
    {
        $tools = [];

        foreach ($this->getOpenAiToolSchemas() as $schema) {
            $function = is_array($schema['function'] ?? null) ? $schema['function'] : [];

            $tools[] = [
                'name' => $function['name'] ?? '',
                'description' => $function['description'] ?? '',
                'input_schema' => $function['parameters'] ?? [
                    'type' => 'object',
                    'properties' => [],
                    'required' => [],
                ],
            ];
        }

        return $tools;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; php artisan test --filter=test_anthropic_tool_schemas_use_input_schema_shape`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Services/AgentToolRegistry.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): expose anthropic-native tool schemas"
```

---

## Task 4: Fix AR/AP status column filters in the financing engine

**Files:**
- Modify: `backend/app/Modules/AI/Services/FinancingMatchEngine.php:266-296`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

`invoices` and `purchase_bills` have a `status` column, not `payment_status`. The valid invoice statuses are `draft|posted|partially_paid|paid|void`. The valid bill statuses include `approved` (written by `PurchaseBillController::approve()`), so AP must include it.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php` (add the imports listed after the test):

```php
    public function test_ar_and_ap_outstanding_use_status_column_not_payment_status(): void
    {
        $tenant = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Contract Tenant',
            'slug' => 'contract-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        \Illuminate\Support\Facades\DB::table('invoices')->insert([
            'tenant_id' => $tenant->id,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'invoice_number' => 'INV-AR-1',
            'party_id' => null,
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
            'party_id' => null,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_ar_and_ap_outstanding_use_status_column_not_payment_status`
Expected: FAIL — both metrics are `0.0` because `payment_status` does not exist and the `try/catch` swallows the SQL error.

- [ ] **Step 3: Fix both queries**

In `backend/app/Modules/AI/Services/FinancingMatchEngine.php`, replace `calculateArOutstanding()` body:

```php
    private function calculateArOutstanding(int $tenantId): float
    {
        if (! Schema::hasTable('invoices')) {
            return 0.0;
        }

        try {
            return (float) Invoice::where('tenant_id', $tenantId)
                ->whereIn('status', ['posted', 'partially_paid'])
                ->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as due')
                ->value('due');
        } catch (Throwable) {
            return 0.0;
        }
    }
```

And `calculateApOutstanding()`:

```php
    private function calculateApOutstanding(int $tenantId): float
    {
        if (! Schema::hasTable('purchase_bills')) {
            return 0.0;
        }

        try {
            return (float) PurchaseBill::where('tenant_id', $tenantId)
                ->whereIn('status', ['posted', 'approved', 'partially_paid'])
                ->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as due')
                ->value('due');
        } catch (Throwable) {
            return 0.0;
        }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; php artisan test --filter=test_ar_and_ap_outstanding_use_status_column_not_payment_status`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Services/FinancingMatchEngine.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "fix(ai): use status column for AR/AP outstanding aggregation"
```

---

## Task 5: Enrich `get_cash_position` to `CashPositionData`

**Files:**
- Modify: `backend/app/Modules/AI/Services/AgentToolRegistry.php:257-286`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

The target contract (from `frontend/src/modules/ai/types/copilot.ts`):

```
total_liquid_cash, bank_balance, cash_on_hand,
accounts_breakdown[{id, code, name, type, balance}],
daily_burn_rate, runway_days, health_status, as_of_date
```

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_cash_position_tool_matches_cash_position_data_contract(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Cash Contract Tenant',
            'slug' => 'cash-contract-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        \App\Modules\Finance\Models\BankAccount::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'BRAC Principal',
            'account_number' => 'BRAC-1501-0092',
            'bank_name' => 'BRAC Bank',
            'account_type' => 'bank',
            'currency' => 'BDT',
            'current_balance' => '845000.0000',
            'is_active' => true,
        ]);

        \App\Modules\Finance\Models\BankAccount::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Petty Cash',
            'account_number' => 'CASH-0001',
            'bank_name' => 'Internal',
            'account_type' => 'cash',
            'currency' => 'BDT',
            'current_balance' => '125000.0000',
            'is_active' => true,
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
        $this->assertSame('Petty Cash', $result['accounts_breakdown'][0]['name']);
        $this->assertSame('cash', $result['accounts_breakdown'][0]['type']);
        $this->assertArrayHasKey('code', $result['accounts_breakdown'][0]);
        $this->assertArrayNotHasKey('total_liquidity', $result);
        $this->assertArrayNotHasKey('accounts', $result);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_cash_position_tool_matches_cash_position_data_contract`
Expected: FAIL — `total_liquid_cash` is undefined (`Undefined array key`).

- [ ] **Step 3: Replace `executeCashPosition()`**

In `backend/app/Modules/AI/Services/AgentToolRegistry.php`, replace lines 257–286 with:

```php
    protected function executeCashPosition(int $tenantId, array $arguments): array
    {
        $query = BankAccount::where('tenant_id', $tenantId)->where('is_active', true);

        if (! empty($arguments['account_type'])) {
            $query->where('account_type', $arguments['account_type']);
        }

        $accounts = $query->orderBy('id', 'asc')->get();

        $bankBalance = 0.0;
        $cashOnHand = 0.0;
        $breakdown = [];

        foreach ($accounts as $account) {
            $balance = is_numeric($account->current_balance) ? (float) $account->current_balance : 0.0;

            if ($account->account_type === 'cash') {
                $cashOnHand += $balance;
            } else {
                $bankBalance += $balance;
            }

            $breakdown[] = [
                'id' => (int) $account->id,
                'code' => (string) ($account->code ?? $account->account_number ?? $account->uuid),
                'name' => (string) $account->name,
                'type' => (string) ($account->account_type ?? 'bank'),
                'balance' => round($balance, 2),
            ];
        }

        $totalLiquidCash = $bankBalance + $cashOnHand;
        $monthlyExpenses = (float) $this->financingMatchEngine->gatherFinancialMetrics($tenantId)['monthly_expenses'];
        $dailyBurnRate = round($monthlyExpenses / 30.0, 2);
        $runwayDays = $dailyBurnRate > 0 ? (int) floor($totalLiquidCash / $dailyBurnRate) : 999;

        if ($runwayDays >= 60) {
            $healthStatus = 'healthy';
        } elseif ($runwayDays >= 30) {
            $healthStatus = 'moderate';
        } else {
            $healthStatus = 'critical';
        }

        return [
            'total_liquid_cash' => round($totalLiquidCash, 2),
            'bank_balance' => round($bankBalance, 2),
            'cash_on_hand' => round($cashOnHand, 2),
            'accounts_breakdown' => $breakdown,
            'daily_burn_rate' => $dailyBurnRate,
            'runway_days' => $runwayDays,
            'health_status' => $healthStatus,
            'as_of_date' => Carbon::now()->toDateString(),
        ];
    }
```

Note: `BankAccount` exposes a `code` column (used by `CopilotDemoSeeder`); the fallback chain keeps the method safe if a row lacks it.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; php artisan test --filter=test_cash_position_tool_matches_cash_position_data_contract`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Services/AgentToolRegistry.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): emit CashPositionData contract from get_cash_position"
```

---

## Task 6: Fix and enrich `list_overdue_invoices` to `OverdueInvoicesData`

**Files:**
- Modify: `backend/app/Modules/AI/Services/AgentToolRegistry.php:292-347`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

Three defects to fix at once: wrong status column, wrong join column (`invoices.customer_id` → `invoices.party_id`), and a missing output contract with aging buckets.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_overdue_invoices_tool_matches_contract_and_aging_buckets(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'AR Contract Tenant',
            'slug' => 'ar-contract-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        $partyId = \Illuminate\Support\Facades\DB::table('parties')->insertGetId([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'party_code' => 'CUST-001',
            'name' => 'Apex Superstore',
            'party_type' => 'customer',
            'is_active' => true,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_overdue_invoices_tool_matches_contract_and_aging_buckets`
Expected: FAIL — `total_overdue` is undefined and the invoice list is empty because `payment_status` / `customer_id` do not exist.

- [ ] **Step 3: Replace `executeListOverdueInvoices()`**

Replace lines 292–347 with:

```php
    protected function executeListOverdueInvoices(int $tenantId, array $arguments): array
    {
        $daysOverdue = max(0, is_numeric($arguments['days_overdue'] ?? null) ? (int) $arguments['days_overdue'] : 0);
        $limit = min(50, max(1, is_numeric($arguments['limit'] ?? null) ? (int) $arguments['limit'] : 10));
        $now = Carbon::now();

        $empty = [
            'total_overdue' => 0.0,
            'total_invoices_count' => 0,
            'aging_summary' => ['1-30' => 0.0, '31-60' => 0.0, '61-90' => 0.0, '90+' => 0.0],
            'invoices' => [],
        ];

        if (! Schema::hasTable('invoices')) {
            return $empty;
        }

        $rows = Invoice::where('invoices.tenant_id', $tenantId)
            ->whereIn('invoices.status', ['posted', 'partially_paid'])
            ->where('invoices.due_date', '<', $now->copy()->subDays($daysOverdue))
            ->leftJoin('parties', 'invoices.party_id', '=', 'parties.id')
            ->select([
                'invoices.id',
                'invoices.invoice_number',
                'parties.name as customer_name',
                'invoices.due_date',
                'invoices.total_amount',
                'invoices.paid_amount',
            ])
            ->orderBy('invoices.due_date', 'asc')
            ->limit($limit)
            ->get();

        $buckets = ['1-30' => 0.0, '31-60' => 0.0, '61-90' => 0.0, '90+' => 0.0];
        $invoices = [];

        foreach ($rows as $row) {
            $dueDate = Carbon::parse((string) $row->due_date);
            $daysPast = max(0, (int) $dueDate->diffInDays($now, false));
            $total = is_numeric($row->total_amount) ? (float) $row->total_amount : 0.0;
            $paid = is_numeric($row->paid_amount) ? (float) $row->paid_amount : 0.0;
            $due = max(0.0, $total - $paid);

            if ($daysPast <= 30) {
                $bucket = '1-30';
            } elseif ($daysPast <= 60) {
                $bucket = '31-60';
            } elseif ($daysPast <= 90) {
                $bucket = '61-90';
            } else {
                $bucket = '90+';
            }

            $buckets[$bucket] += $due;

            $invoices[] = [
                'id' => (int) $row->id,
                'invoice_number' => (string) $row->invoice_number,
                'customer_name' => is_string($row->customer_name ?? null) ? (string) $row->customer_name : 'Walk-in Customer',
                'total_amount' => round($total, 2),
                'amount_paid' => round($paid, 2),
                'amount_due' => round($due, 2),
                'due_date' => $dueDate->toDateString(),
                'days_overdue' => $daysPast,
                'aging_bucket' => $bucket,
            ];
        }

        $totalOverdue = (float) (Invoice::where('tenant_id', $tenantId)
            ->whereIn('status', ['posted', 'partially_paid'])
            ->where('due_date', '<', $now)
            ->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as total')
            ->value('total') ?? 0.0);

        return [
            'total_overdue' => round(max(0.0, $totalOverdue), 2),
            'total_invoices_count' => $rows->count(),
            'aging_summary' => [
                '1-30' => round($buckets['1-30'], 2),
                '31-60' => round($buckets['31-60'], 2),
                '61-90' => round($buckets['61-90'], 2),
                '90+' => round($buckets['90+'], 2),
            ],
            'invoices' => $invoices,
        ];
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; php artisan test --filter=test_overdue_invoices_tool_matches_contract_and_aging_buckets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Services/AgentToolRegistry.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "fix(ai): correct overdue invoice query and emit aging-bucket contract"
```

---

## Task 7: Fix the expense-category join and enrich `get_pl_summary` to `PLSummaryData`

**Files:**
- Modify: `backend/app/Modules/AI/Services/AgentToolRegistry.php:353-404`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

`expenses.category_id` does not exist — the column is `expenses.expense_category_id`. COGS is sourced from the ledger (`chart_of_accounts.account_type = 'cost_of_goods_sold'` joined to `journal_lines`), matching `FinanceDataProvider::incomeStatement()`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_pl_summary_tool_matches_contract_and_joins_expense_category(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'PL Contract Tenant',
            'slug' => 'pl-contract-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        $categoryId = \Illuminate\Support\Facades\DB::table('expense_categories')->insertGetId([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'code' => 'UTIL',
            'name' => 'Utilities',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \Illuminate\Support\Facades\DB::table('expenses')->insert([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'expense_number' => 'EXP-001',
            'expense_category_id' => $categoryId,
            'expense_date' => now()->subDays(5)->toDateString(),
            'amount' => '400000.0000',
            'total_amount' => '400000.0000',
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \Illuminate\Support\Facades\DB::table('invoices')->insert([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'invoice_number' => 'INV-PL-1',
            'party_id' => null,
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
        $this->assertSame(400000.0, (float) $result['cogs']);
        $this->assertSame(200000.0, (float) $result['gross_profit']);
        $this->assertSame(20.0, (float) $result['gross_margin_pct']);
        $this->assertSame(600000.0, (float) $result['net_operating_income']);
        $this->assertSame(60.0, (float) $result['net_margin_pct']);
        $this->assertSame('Utilities', $result['expense_breakdown'][0]['category']);
        $this->assertSame(100.0, (float) $result['expense_breakdown'][0]['pct_of_total']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $result['period_start']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $result['period_end']);
        $this->assertArrayNotHasKey('net_profit', $result);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_pl_summary_tool_matches_contract_and_joins_expense_category`
Expected: FAIL — `operating_expenses` undefined; with the bad join most DB drivers raise an unknown-column error, so `expense_breakdown` is empty.

- [ ] **Step 3: Replace `executePlSummary()`**

Replace lines 353–404 with:

```php
    protected function executePlSummary(int $tenantId, array $arguments): array
    {
        $startDate = ! empty($arguments['start_date']) && is_string($arguments['start_date'])
            ? Carbon::parse($arguments['start_date'])->startOfDay()
            : Carbon::now()->subDays(30)->startOfDay();

        $endDate = ! empty($arguments['end_date']) && is_string($arguments['end_date'])
            ? Carbon::parse($arguments['end_date'])->endOfDay()
            : Carbon::now()->endOfDay();

        $totalRevenue = 0.0;
        if (Schema::hasTable('invoices')) {
            $totalRevenue = (float) Invoice::where('tenant_id', $tenantId)
                ->whereIn('status', ['posted', 'partially_paid', 'paid'])
                ->whereBetween('invoice_date', [$startDate, $endDate])
                ->sum('total_amount');
        }

        $totalExpenses = 0.0;
        $expenseBreakdown = [];
        if (Schema::hasTable('expenses')) {
            $totalExpenses = (float) Expense::where('expenses.tenant_id', $tenantId)
                ->whereBetween('expenses.expense_date', [$startDate, $endDate])
                ->sum('expenses.amount');

            $expenseBreakdown = Expense::where('expenses.tenant_id', $tenantId)
                ->whereBetween('expenses.expense_date', [$startDate, $endDate])
                ->leftJoin('expense_categories', 'expenses.expense_category_id', '=', 'expense_categories.id')
                ->selectRaw('COALESCE(expense_categories.name, "General") as category, SUM(expenses.amount) as total')
                ->groupBy('expense_categories.name')
                ->orderByDesc('total')
                ->limit(5)
                ->get()
                ->map(fn ($row): array => [
                    'category' => (string) $row->category,
                    'amount' => round((float) $row->total, 2),
                    'pct_of_total' => $totalExpenses > 0
                        ? round(((float) $row->total / $totalExpenses) * 100, 2)
                        : 0.0,
                ])
                ->all();
        }

        // COGS comes from posted ledger balances on cost_of_goods_sold accounts.
        $cogs = 0.0;
        if (Schema::hasTable('chart_of_accounts') && Schema::hasTable('journal_lines')) {
            $cogsRow = DB::table('chart_of_accounts as coa')
                ->leftJoin('journal_lines as jl', 'coa.id', '=', 'jl.account_id')
                ->where('coa.tenant_id', $tenantId)
                ->where('coa.account_type', 'cost_of_goods_sold')
                ->whereNull('coa.deleted_at')
                ->selectRaw('COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0) as cogs')
                ->value('cogs');

            $cogs = max(0.0, (float) $cogsRow);
        }

        $grossProfit = $totalRevenue - $cogs;
        $netOperatingIncome = $grossProfit - $totalExpenses;

        return [
            'period_start' => $startDate->toDateString(),
            'period_end' => $endDate->toDateString(),
            'total_revenue' => round($totalRevenue, 2),
            'cogs' => round($cogs, 2),
            'gross_profit' => round($grossProfit, 2),
            'gross_margin_pct' => $totalRevenue > 0 ? round(($grossProfit / $totalRevenue) * 100, 2) : 0.0,
            'operating_expenses' => round($totalExpenses, 2),
            'net_operating_income' => round($netOperatingIncome, 2),
            'net_margin_pct' => $totalRevenue > 0 ? round(($netOperatingIncome / $totalRevenue) * 100, 2) : 0.0,
            'expense_breakdown' => $expenseBreakdown,
        ];
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; php artisan test --filter=test_pl_summary_tool_matches_contract_and_joins_expense_category`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Services/AgentToolRegistry.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "fix(ai): repair expense category join and emit PLSummaryData contract"
```

---

## Task 8: Enrich `analyze_cash_flow_risk` to `CashFlowRiskData`

**Files:**
- Modify: `backend/app/Modules/AI/Services/AgentToolRegistry.php:410-455`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

Target contract: `horizon_days, starting_cash, projected_inflows, projected_outflows, projected_net_cash_flow, ending_cash, liquidity_shortfall, days_until_deficit, shortfall_amount, risk_level('low'|'moderate'|'severe'|'critical'), recommended_actions[]`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_cash_flow_risk_tool_matches_contract(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Risk Contract Tenant',
            'slug' => 'risk-contract-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        \App\Modules\Finance\Models\BankAccount::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Risk Account',
            'account_number' => 'RISK-0001',
            'bank_name' => 'City Bank',
            'account_type' => 'bank',
            'currency' => 'BDT',
            'current_balance' => '50000.0000',
            'is_active' => true,
        ]);

        \Illuminate\Support\Facades\DB::table('expenses')->insert([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'expense_number' => 'EXP-RISK-1',
            'expense_date' => now()->subDays(5)->toDateString(),
            'amount' => '900000.0000',
            'total_amount' => '900000.0000',
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = app(\App\Modules\AI\Services\AgentToolRegistry::class)
            ->executeTool('analyze_cash_flow_risk', ['forecast_days' => 30], $tenantId);

        $this->assertSame(30, $result['horizon_days']);
        $this->assertSame(50000.0, (float) $result['starting_cash']);
        $this->assertSame(0.0, (float) $result['projected_inflows']);
        $this->assertSame(930000.0, (float) $result['projected_outflows']);
        $this->assertSame(-880000.0, (float) $result['projected_net_cash_flow']);
        $this->assertSame(-880000.0, (float) $result['ending_cash']);
        $this->assertTrue($result['liquidity_shortfall']);
        $this->assertSame(880000.0, (float) $result['shortfall_amount']);
        $this->assertSame('critical', $result['risk_level']);
        $this->assertIsArray($result['recommended_actions']);
        $this->assertNotEmpty($result['recommended_actions']);
        $this->assertArrayNotHasKey('estimated_runway_days', $result);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_cash_flow_risk_tool_matches_contract`
Expected: FAIL — `horizon_days` exists but `starting_cash` does not.

- [ ] **Step 3: Replace `executeAnalyzeCashFlowRisk()`**

Replace lines 410–455 with:

```php
    protected function executeAnalyzeCashFlowRisk(int $tenantId, array $arguments): array
    {
        $forecastDays = is_numeric($arguments['forecast_days'] ?? null) ? (int) $arguments['forecast_days'] : 30;
        $horizonDays = max(7, min(90, $forecastDays));

        $metrics = $this->financingMatchEngine->gatherFinancialMetrics($tenantId);
        $startingCash = is_numeric($metrics['bank_balance'] ?? null) ? (float) $metrics['bank_balance'] : 0.0;
        $ar = is_numeric($metrics['ar_outstanding'] ?? null) ? (float) $metrics['ar_outstanding'] : 0.0;
        $ap = is_numeric($metrics['ap_outstanding'] ?? null) ? (float) $metrics['ap_outstanding'] : 0.0;
        $monthlyExpenses = is_numeric($metrics['monthly_expenses'] ?? null) ? (float) $metrics['monthly_expenses'] : 0.0;

        $dailyBurnRate = $monthlyExpenses / 30.0;
        $projectedInflows = round($ar * 0.70, 2);
        $projectedOutflows = round($ap + ($dailyBurnRate * $horizonDays), 2);
        $projectedNet = round($projectedInflows - $projectedOutflows, 2);
        $endingCash = round($startingCash + $projectedNet, 2);
        $liquidityShortfall = $endingCash < 0;
        $shortfallAmount = $liquidityShortfall ? round(abs($endingCash), 2) : 0.0;

        $daysUntilDeficit = null;
        if ($dailyBurnRate > 0) {
            $daysUntilDeficit = $startingCash + $projectedInflows >= $projectedOutflows
                ? null
                : max(0, (int) floor(($startingCash + $projectedInflows) / $dailyBurnRate));
        }

        if ($daysUntilDeficit !== null && $daysUntilDeficit < 15) {
            $riskLevel = 'critical';
            $actions = [
                'Accelerate overdue receivables collection',
                'Apply for invoice discounting against validated AR',
                'Defer all non-critical capital expenditure',
            ];
        } elseif ($daysUntilDeficit !== null && $daysUntilDeficit < 30) {
            $riskLevel = 'severe';
            $actions = [
                'Accelerate overdue receivables collection',
                'Negotiate extended supplier payment terms',
                'Secure a working capital facility before the deficit window',
            ];
        } elseif ($liquidityShortfall) {
            $riskLevel = 'moderate';
            $actions = [
                'Tighten receivables follow-up on 31-60 day buckets',
                'Reschedule discretionary operating expenses',
            ];
        } else {
            $riskLevel = 'low';
            $actions = [
                'Maintain current collection discipline',
                'Consider deploying surplus liquidity into inventory or high-margin lines',
            ];
        }

        return [
            'horizon_days' => $horizonDays,
            'starting_cash' => round($startingCash, 2),
            'projected_inflows' => $projectedInflows,
            'projected_outflows' => $projectedOutflows,
            'projected_net_cash_flow' => $projectedNet,
            'ending_cash' => $endingCash,
            'liquidity_shortfall' => $liquidityShortfall,
            'days_until_deficit' => $daysUntilDeficit,
            'shortfall_amount' => $shortfallAmount,
            'risk_level' => $riskLevel,
            'recommended_actions' => $actions,
        ];
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; php artisan test --filter=test_cash_flow_risk_tool_matches_contract`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Services/AgentToolRegistry.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): emit CashFlowRiskData contract from analyze_cash_flow_risk"
```

---

## Task 9: Enrich `get_inventory_value` to `InventoryValuationData`

**Files:**
- Modify: `backend/app/Modules/AI/Services/AgentToolRegistry.php:461-483`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

Target contract: `total_valuation, item_count, high_value_items[{id,sku,name,quantity,unit_cost,total_value}], slow_moving_valuation, estimated_holding_cost_monthly`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_inventory_value_tool_matches_contract(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Inventory Contract Tenant',
            'slug' => 'inventory-contract-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        $productId = \Illuminate\Support\Facades\DB::table('products')->insertGetId([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'sku' => 'FLOUR-50',
            'name' => 'Premium Flour 50kg',
            'standard_cost' => '1200.0000',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \Illuminate\Support\Facades\DB::table('stock_balances')->insert([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'product_id' => $productId,
            'quantity' => '150.0000',
            'reserved_quantity' => '0.0000',
            'average_cost' => '1200.0000',
            'total_value' => '180000.0000',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = app(\App\Modules\AI\Services\AgentToolRegistry::class)
            ->executeTool('get_inventory_value', [], $tenantId);

        $this->assertSame(180000.0, (float) $result['total_valuation']);
        $this->assertSame(1, $result['item_count']);
        $this->assertSame('FLOUR-50', $result['high_value_items'][0]['sku']);
        $this->assertSame('Premium Flour 50kg', $result['high_value_items'][0]['name']);
        $this->assertSame(150.0, (float) $result['high_value_items'][0]['quantity']);
        $this->assertSame(1200.0, (float) $result['high_value_items'][0]['unit_cost']);
        $this->assertSame(180000.0, (float) $result['high_value_items'][0]['total_value']);
        $this->assertSame(0.0, (float) $result['slow_moving_valuation']);
        $this->assertSame(3600.0, (float) $result['estimated_holding_cost_monthly']);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_inventory_value_tool_matches_contract`
Expected: FAIL — `item_count` undefined.

- [ ] **Step 3: Replace `executeInventoryValue()`**

Replace lines 461–483 with:

```php
    protected function executeInventoryValue(int $tenantId, array $arguments): array
    {
        $warehouseId = is_numeric($arguments['warehouse_id'] ?? null) ? (int) $arguments['warehouse_id'] : null;

        $rows = StockBalance::where('stock_balances.tenant_id', $tenantId)
            ->when($warehouseId !== null, fn ($q) => $q->where('stock_balances.warehouse_id', $warehouseId))
            ->with('product:id,sku,name,standard_cost')
            ->get();

        $totalValuation = 0.0;
        $slowMovingValuation = 0.0;
        $items = [];

        foreach ($rows as $row) {
            $quantity = is_numeric($row->quantity) ? (float) $row->quantity : 0.0;
            $unitCost = is_numeric($row->average_cost) ? (float) $row->average_cost : 0.0;
            $lineValue = round($quantity * $unitCost, 2);
            $totalValuation += $lineValue;

            // No movement in 90+ days is treated as slow-moving capital.
            $isSlowMoving = $row->last_movement_at !== null
                && Carbon::parse((string) $row->last_movement_at)->lt(Carbon::now()->subDays(90));

            if ($isSlowMoving) {
                $slowMovingValuation += $lineValue;
            }

            $items[] = [
                'id' => (int) $row->id,
                'sku' => (string) ($row->product->sku ?? ''),
                'name' => (string) ($row->product->name ?? 'Unknown Item'),
                'quantity' => round($quantity, 2),
                'unit_cost' => round($unitCost, 2),
                'total_value' => $lineValue,
            ];
        }

        usort($items, fn (array $a, array $b): int => $b['total_value'] <=> $a['total_value']);

        return [
            'total_valuation' => round($totalValuation, 2),
            'item_count' => count($items),
            'high_value_items' => array_slice($items, 0, 5),
            'slow_moving_valuation' => round($slowMovingValuation, 2),
            // 2% monthly cost of carry on average inventory value.
            'estimated_holding_cost_monthly' => round($totalValuation * 0.02, 2),
        ];
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; php artisan test --filter=test_inventory_value_tool_matches_contract`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Services/AgentToolRegistry.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): emit InventoryValuationData contract from get_inventory_value"
```

---

## Task 10: Financing match formatters and the `/ai/financing/match` contract

**Files:**
- Modify: `backend/app/Modules/AI/Services/FinancingMatchEngine.php` (add 3 public methods after `assessAndMatch()`, i.e. after line 86)
- Modify: `backend/app/Modules/AI/Services/AgentToolRegistry.php:241`
- Modify: `backend/app/Modules/AI/Controllers/CopilotController.php:215-239`
- Modify: `backend/tests/Feature/AI/CopilotTest.php:361-390`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

Target contract: `assessment_uuid?, cash_deficit_amount, recommended_financing, credit_score_indicator, matched_products[FinancingProduct], evaluation_summary`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_financing_match_data_formatter_matches_contract(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Financing Contract Tenant',
            'slug' => 'financing-contract-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        $engine = app(\App\Modules\AI\Services\FinancingMatchEngine::class);
        $assessment = $engine->assessAndMatch($tenantId, null, [
            'monthly_revenue' => 500000.0,
            'monthly_expenses' => 350000.0,
            'ar_outstanding' => 250000.0,
            'inventory_value' => 600000.0,
            'bank_balance' => 150000.0,
            'ap_outstanding' => 400000.0,
        ]);

        $data = $engine->formatMatchData($assessment);

        $this->assertSame($assessment['assessment_uuid'], $data['assessment_uuid']);
        $this->assertIsFloat($data['cash_deficit_amount']);
        $this->assertSame(105000.0, (float) $data['cash_deficit_amount']);
        $this->assertSame(1500000.0, (float) $data['recommended_financing']);
        $this->assertSame(90, $data['credit_score_indicator']);
        $this->assertCount(4, $data['matched_products']);
        $this->assertIsString($data['evaluation_summary']);

        $product = $data['matched_products'][0];
        $this->assertArrayHasKey('product_id', $product);
        $this->assertArrayHasKey('institution', $product);
        $this->assertSame('WeBank Digital SME Micro-Finance', $product['institution']);
        $this->assertIsFloat($product['interest_rate_pct']);
        $this->assertIsInt($product['eligibility_score']);
        $this->assertContains($product['qualification_status'], ['pre_approved', 'eligible', 'conditionally_eligible', 'not_eligible']);
        $this->assertIsString($product['repayment_terms']);
        $this->assertIsString($product['required_collateral']);
        $this->assertIsString($product['application_turnaround']);
        $this->assertIsArray($product['benefits']);
        $this->assertArrayNotHasKey('confidence', $product);
        $this->assertArrayNotHasKey('products', $data);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_financing_match_data_formatter_matches_contract`
Expected: FAIL — `Call to undefined method ... formatMatchData()`.

- [ ] **Step 3: Add the formatter methods**

In `backend/app/Modules/AI/Services/FinancingMatchEngine.php`, insert after `assessAndMatch()` (after line 86):

```php
    /**
     * Deterministic solvency indicator (0-100) derived only from verified ledger metrics.
     *
     * @param  array<string, mixed>  $metrics
     */
    public function computeSolvencyScore(array $metrics): int
    {
        $score = 50;
        $revenue = (float) ($metrics['monthly_revenue'] ?? 0);
        $expenses = (float) ($metrics['monthly_expenses'] ?? 0);
        $ar = (float) ($metrics['ar_outstanding'] ?? 0);
        $bank = (float) ($metrics['bank_balance'] ?? 0);

        if ($revenue > 0) {
            $score += 15;
        }

        if ($revenue > $expenses && $expenses > 0) {
            $score += 15;
        }

        if ($bank > 0) {
            $score += 10;
        }

        if ($revenue > 0 && $ar <= $revenue) {
            $score += 10;
        }

        return max(0, min(100, $score));
    }

    /**
     * Convert an internal product row into the FinancingProduct contract.
     *
     * @param  array<string, mixed>  $product
     * @return array<string, mixed>
     */
    public function formatProduct(array $product): array
    {
        $confidence = is_string($product['confidence'] ?? null) ? (string) $product['confidence'] : 'LOW';
        $isEligible = (bool) ($product['is_eligible'] ?? false);

        $scoreByConfidence = ['HIGH' => 85, 'MEDIUM' => 65, 'LOW' => 40];
        $eligibilityScore = ($scoreByConfidence[$confidence] ?? 40) + ($isEligible ? 10 : 0);
        $eligibilityScore = max(0, min(100, $eligibilityScore));

        if (! $isEligible) {
            $qualificationStatus = 'not_eligible';
        } elseif ($confidence === 'HIGH') {
            $qualificationStatus = 'pre_approved';
        } elseif ($confidence === 'MEDIUM') {
            $qualificationStatus = 'eligible';
        } else {
            $qualificationStatus = 'conditionally_eligible';
        }

        $rateString = is_string($product['estimated_interest_rate'] ?? null) ? (string) $product['estimated_interest_rate'] : '';
        $interestRate = is_numeric(strtok($rateString, '%- ')) ? (float) strtok($rateString, '%- ') : 0.0;

        $turnaroundByProduct = [
            'working_capital_loan' => '5-7 business days',
            'invoice_discounting' => '24-48 hours',
            'inventory_financing' => '3-5 business days',
            'equipment_leasing' => '7-10 business days',
        ];
        $productId = is_string($product['product_id'] ?? null) ? (string) $product['product_id'] : '';

        $maxAmount = is_numeric($product['max_amount'] ?? null) ? (float) $product['max_amount'] : 0.0;
        $rationale = is_string($product['rationale'] ?? null) ? (string) $product['rationale'] : '';
        $collateral = is_string($product['collateral_requirement'] ?? null) ? (string) $product['collateral_requirement'] : '';

        return [
            'product_id' => $productId,
            'product_name' => is_string($product['product_name'] ?? null) ? (string) $product['product_name'] : '',
            'institution' => 'WeBank Digital SME Micro-Finance',
            'interest_rate_pct' => round($interestRate, 2),
            'repayment_terms' => is_string($product['tenor_months'] ?? null) ? (string) $product['tenor_months'] : '',
            'eligible_amount' => round($maxAmount, 2),
            'eligibility_score' => $eligibilityScore,
            'qualification_status' => $qualificationStatus,
            'required_collateral' => $collateral,
            'application_turnaround' => $turnaroundByProduct[$productId] ?? '5-7 business days',
            'benefits' => array_values(array_filter([
                $rationale !== '' ? $rationale : null,
                'Facility up to BDT '.number_format($maxAmount, 2).' against verified ERP data',
            ])),
        ];
    }

    /**
     * Convert a full assessment into the FinancingMatchData UI contract.
     *
     * @param  array<string, mixed>  $assessment
     * @return array<string, mixed>
     */
    public function formatMatchData(array $assessment): array
    {
        /** @var array<string, mixed> $metrics */
        $metrics = is_array($assessment['metrics'] ?? null) ? $assessment['metrics'] : [];
        /** @var list<array<string, mixed>> $products */
        $products = is_array($assessment['products'] ?? null) ? $assessment['products'] : [];

        $matchedProducts = array_map(fn (array $p): array => $this->formatProduct($p), $products);

        $recommendedFinancing = 0.0;
        $top = $assessment['top_recommendation'] ?? null;
        if (is_array($top) && is_numeric($top['max_amount'] ?? null)) {
            $recommendedFinancing = (float) $top['max_amount'];
        }

        $bank = (float) ($metrics['bank_balance'] ?? 0);
        $ar = (float) ($metrics['ar_outstanding'] ?? 0);
        $ap = (float) ($metrics['ap_outstanding'] ?? 0);
        $expenses = (float) ($metrics['monthly_expenses'] ?? 0);

        $cashDeficit = max(0.0, ($ap + $expenses) - ($bank + ($ar * 0.70)));

        return [
            'assessment_uuid' => is_string($assessment['assessment_uuid'] ?? null) ? (string) $assessment['assessment_uuid'] : null,
            'cash_deficit_amount' => round($cashDeficit, 2),
            'recommended_financing' => round($recommendedFinancing, 2),
            'credit_score_indicator' => $this->computeSolvencyScore($metrics),
            'matched_products' => $matchedProducts,
            'evaluation_summary' => is_string($assessment['summary'] ?? null) ? (string) $assessment['summary'] : '',
        ];
    }
```

- [ ] **Step 4: Route the tool through the formatter**

In `backend/app/Modules/AI/Services/AgentToolRegistry.php`, replace line 241:

```php
            'match_financing_options' => $this->financingMatchEngine->assessAndMatch($tenantId, $userId, $arguments),
```

with:

```php
            'match_financing_options' => $this->financingMatchEngine->formatMatchData(
                $this->financingMatchEngine->assessAndMatch($tenantId, $userId, $arguments)
            ),
```

- [ ] **Step 5: Route the controller through the formatter**

In `backend/app/Modules/AI/Controllers/CopilotController.php`, replace lines 229–233 with:

```php
        $assessment = $this->financingMatchEngine->assessAndMatch(
            tenantId: $tenantId,
            userId: $userId,
            customInputs: $validated
        );

        $data = $this->financingMatchEngine->formatMatchData($assessment);
```

and replace line 237 `'data' => $assessment,` with `'data' => $data,`.

- [ ] **Step 6: Update the existing conflicting test**

In `backend/tests/Feature/AI/CopilotTest.php`, replace the `assertJsonStructure` block at lines 374–384 with:

```php
            ->assertJsonStructure([
                'status',
                'data' => [
                    'assessment_uuid',
                    'cash_deficit_amount',
                    'recommended_financing',
                    'credit_score_indicator',
                    'matched_products',
                    'evaluation_summary',
                ],
            ]);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend; php artisan test --filter="test_financing_match_data_formatter_matches_contract|test_financing_match_engine_computes_recommendations"`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/app/Modules/AI/Services/FinancingMatchEngine.php backend/app/Modules/AI/Services/AgentToolRegistry.php backend/app/Modules/AI/Controllers/CopilotController.php backend/tests/Feature/AI/CopilotTest.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): emit FinancingMatchData contract from match endpoints"
```

---

## Task 11: Emit `tool`/`permission_tier` and the `PendingAction` shape

**Files:**
- Modify: `backend/app/Modules/AI/Services/AgentPermissionGuard.php` (after `requiresConfirmation()`, line 88)
- Modify: `backend/app/Modules/AI/Services/AgentOrchestrator.php:103-156`, `:210-265`, `:443-624`
- Modify: `backend/tests/Feature/AI/CopilotTest.php:293-315`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

The UI dispatches cards on `tc.tool` and reads `tc.permission_tier`; the dialog reads `pending_action.{action_id, tool, permission_tier, risk_level}`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_tool_calls_and_pending_action_use_ui_contract_keys(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Dispatch Tenant',
            'slug' => 'dispatch-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        $user = \App\Models\User::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenantId,
            'name' => 'Dispatch Officer',
            'email' => 'dispatch@example.com',
            'password' => \Illuminate\Support\Facades\Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $orchestrator = app(\App\Modules\AI\Services\AgentOrchestrator::class);

        $result = $orchestrator->chat(
            tenantId: $tenantId,
            userId: $user->id,
            conversationUuid: null,
            userMessage: 'What is our current cash position?'
        );

        $this->assertNotEmpty($result['tool_calls']);
        $call = $result['tool_calls'][0];
        $this->assertArrayHasKey('tool', $call);
        $this->assertArrayHasKey('permission_tier', $call);
        $this->assertSame('get_cash_position', $call['tool']);
        $this->assertSame(0, $call['permission_tier']);
        $this->assertArrayNotHasKey('name', $call);
        $this->assertArrayNotHasKey('tier', $call);

        $pending = $orchestrator->chat(
            tenantId: $tenantId,
            userId: $user->id,
            conversationUuid: null,
            userMessage: 'Create a cash flow alert for low liquidity'
        );

        $action = $pending['pending_action'];
        $this->assertIsArray($action);
        $this->assertSame('create_cash_flow_alert', $action['tool']);
        $this->assertSame(2, $action['permission_tier']);
        $this->assertSame('high', $action['risk_level']);
        $this->assertIsString($action['action_id']);
        $this->assertIsString($action['description']);
        $this->assertIsArray($action['arguments']);
        $this->assertIsString($action['expires_at']);
        $this->assertArrayNotHasKey('tool_name', $action);
        $this->assertArrayNotHasKey('tier', $action);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_tool_calls_and_pending_action_use_ui_contract_keys`
Expected: FAIL — `tool` key missing (only `name` is emitted).

- [ ] **Step 3: Add `riskLevelFor()` to the guard**

In `backend/app/Modules/AI/Services/AgentPermissionGuard.php`, insert after `requiresConfirmation()` (after line 88):

```php
    /**
     * Risk classification surfaced to the Tier 2 confirmation dialog.
     */
    public function riskLevelFor(string $toolName): string
    {
        $highRisk = ['create_cash_flow_alert'];

        return in_array($toolName, $highRisk, true) ? 'high' : 'low';
    }
```

- [ ] **Step 4: Emit the `PendingAction` shape**

In `backend/app/Modules/AI/Services/AgentOrchestrator.php`, replace lines 105–112:

```php
                            $pendingAction = [
                                'tool_call_id' => $toolCallId,
                                'tool_name' => $toolName,
                                'arguments' => $toolArgs,
                                'tier' => $tier,
                                'status' => 'PENDING_CONFIRMATION',
                                'prompt' => "Confirm action: {$toolName} with parameters: ".json_encode($toolArgs),
                            ];
```

with:

```php
                            $pendingAction = [
                                'action_id' => $toolCallId,
                                'tool' => $toolName,
                                'description' => "Authorize the Copilot to run '{$toolName}' with the supplied parameters against live tenant data.",
                                'arguments' => $toolArgs,
                                'permission_tier' => AgentPermissionGuard::TIER_2_SUPERVISED,
                                'risk_level' => $this->permissionGuard->riskLevelFor($toolName),
                                'expires_at' => Carbon::now()->addMinutes(30)->toIso8601String(),
                            ];
```

- [ ] **Step 5: Emit `tool`/`permission_tier` for the live branch**

Replace lines 142–148:

```php
                        $executedTools[] = [
                            'tool_call_id' => $toolCallId,
                            'name' => $toolName,
                            'arguments' => $toolArgs,
                            'result' => $toolOutput,
                            'tier' => $tier,
                        ];
```

with:

```php
                        $executedTools[] = [
                            'tool_call_id' => $toolCallId,
                            'tool' => $toolName,
                            'arguments' => $toolArgs,
                            'permission_tier' => $tier,
                            'result' => $toolOutput,
                        ];
```

- [ ] **Step 6: Emit `tool`/`permission_tier` for the confirmed-action message**

Replace lines 245–252:

```php
            'tool_calls' => [
                [
                    'name' => $toolName,
                    'arguments' => $actionData,
                    'result' => $result,
                    'tier' => $tier,
                    'confirmed' => true,
                ],
            ],
```

with:

```php
            'tool_calls' => [
                [
                    'tool' => $toolName,
                    'arguments' => $actionData,
                    'permission_tier' => $tier,
                    'result' => $result,
                    'confirmed' => true,
                ],
            ],
```

- [ ] **Step 7: Emit `tool`/`permission_tier` in the fallback engine**

In `runDeterministicFallbackEngine()`, apply the same key rename to all five `$executedTools[]` occurrences. Replace lines 456–463 (Tier 2 pending shape):

```php
            $pendingAction = [
                'tool_call_id' => 'call_'.Str::random(8),
                'tool_name' => 'create_cash_flow_alert',
                'arguments' => $args,
                'tier' => 2,
                'status' => 'PENDING_CONFIRMATION',
                'prompt' => 'Please confirm creating an operational Cash Flow Alert for BDT 50,000 threshold.',
            ];
```

with:

```php
            $pendingAction = [
                'action_id' => 'call_'.Str::random(8),
                'tool' => 'create_cash_flow_alert',
                'description' => 'Authorize the Copilot to create an operational Cash Flow Alert with a BDT 50,000 threshold on the tenant dashboard.',
                'arguments' => $args,
                'permission_tier' => AgentPermissionGuard::TIER_2_SUPERVISED,
                'risk_level' => $this->permissionGuard->riskLevelFor('create_cash_flow_alert'),
                'expires_at' => Carbon::now()->addMinutes(30)->toIso8601String(),
            ];
```

Then, for each of the five `$executedTools[]` blocks (originally at lines 492–498, 531–537, 575–581, 618–624, and the two new ones added in Task 19), the keys must be renamed. The cash-position block:

```php
            $executedTools[] = [
                'tool_call_id' => 'call_'.Str::random(8),
                'tool' => 'get_cash_position',
                'arguments' => [],
                'permission_tier' => 0,
                'result' => $toolOutput,
            ];
```

The overdue block:

```php
            $executedTools[] = [
                'tool_call_id' => 'call_'.Str::random(8),
                'tool' => 'list_overdue_invoices',
                'arguments' => ['days_overdue' => 0, 'limit' => 5],
                'permission_tier' => 0,
                'result' => $toolOutput,
            ];
```

The financing block:

```php
            $executedTools[] = [
                'tool_call_id' => 'call_'.Str::random(8),
                'tool' => 'match_financing_options',
                'arguments' => [],
                'permission_tier' => 1,
                'result' => $toolOutput,
            ];
```

The risk block:

```php
            $executedTools[] = [
                'tool_call_id' => 'call_'.Str::random(8),
                'tool' => 'analyze_cash_flow_risk',
                'arguments' => ['forecast_days' => 30],
                'permission_tier' => 0,
                'result' => $toolOutput,
            ];
```

- [ ] **Step 8: Update the existing conflicting test**

In `backend/tests/Feature/AI/CopilotTest.php`, replace lines 300–303:

```php
        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.pending_action.status', 'PENDING_CONFIRMATION')
            ->assertJsonPath('data.pending_action.tier', 2);
```

with:

```php
        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.pending_action.tool', 'create_cash_flow_alert')
            ->assertJsonPath('data.pending_action.permission_tier', 2);
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd backend; php artisan test --filter="test_tool_calls_and_pending_action_use_ui_contract_keys|test_tier_2_tool_triggers_pending_confirmation"`
Expected: PASS (2 tests).

- [ ] **Step 10: Commit**

```bash
git add backend/app/Modules/AI/Services/AgentPermissionGuard.php backend/app/Modules/AI/Services/AgentOrchestrator.php backend/tests/Feature/AI/CopilotTest.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): emit UI-native tool_calls and pending_action contracts"
```

---

## Task 12: Reconcile the confirm-action contract

**Files:**
- Modify: `backend/app/Modules/AI/Services/AgentOrchestrator.php:183-201` (persist pending action), add `resolvePendingAction()`
- Modify: `backend/app/Modules/AI/Controllers/CopilotController.php:101-127`
- Modify: `backend/tests/Feature/AI/CopilotTest.php:317-359`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

The frontend posts `{action_id, approved, rejection_reason}` and reads back `{executed, action_id, result?, reason?}`. Because `action_id` alone is not enough to execute, the pending action is persisted in the assistant message `metadata` and resolved by scan.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_confirm_endpoint_accepts_action_id_contract(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Confirm Tenant',
            'slug' => 'confirm-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        $user = \App\Models\User::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenantId,
            'name' => 'Confirm Officer',
            'email' => 'confirm@example.com',
            'password' => \Illuminate\Support\Facades\Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $orchestrator = app(\App\Modules\AI\Services\AgentOrchestrator::class);

        $chat = $orchestrator->chat(
            tenantId: $tenantId,
            userId: $user->id,
            conversationUuid: null,
            userMessage: 'Create a cash flow alert for low liquidity'
        );

        $actionId = $chat['pending_action']['action_id'];
        $conversationUuid = $chat['conversation_uuid'];

        $approved = $orchestrator->resolveAndConfirmAction(
            tenantId: $tenantId,
            userId: $user->id,
            conversationUuid: $conversationUuid,
            actionId: $actionId,
            approved: true
        );

        $this->assertTrue($approved['executed']);
        $this->assertSame($actionId, $approved['action_id']);
        $this->assertSame('CONFIRMED_AND_CREATED', $approved['result']['status']);
        $this->assertSame(1, \App\Modules\AI\Models\CashFlowAlert::where('tenant_id', $tenantId)->count());

        $second = $orchestrator->chat(
            tenantId: $tenantId,
            userId: $user->id,
            conversationUuid: null,
            userMessage: 'Create a cash flow alert for low liquidity'
        );

        $rejected = $orchestrator->resolveAndConfirmAction(
            tenantId: $tenantId,
            userId: $user->id,
            conversationUuid: $second['conversation_uuid'],
            actionId: $second['pending_action']['action_id'],
            approved: false,
            rejectionReason: 'Not needed right now'
        );

        $this->assertFalse($rejected['executed']);
        $this->assertSame('Not needed right now', $rejected['reason']);
        $this->assertSame(1, \App\Modules\AI\Models\CashFlowAlert::where('tenant_id', $tenantId)->count());
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_confirm_endpoint_accepts_action_id_contract`
Expected: FAIL — `Call to undefined method ... resolveAndConfirmAction()`.

- [ ] **Step 3: Persist the pending action**

In `backend/app/Modules/AI/Services/AgentOrchestrator.php`, replace the assistant-message metadata block at lines 189–192:

```php
            'metadata' => [
                'tier_used' => $maxTierUsed,
                'has_pending_action' => $pendingAction !== null,
            ],
```

with:

```php
            'metadata' => [
                'tier_used' => $maxTierUsed,
                'has_pending_action' => $pendingAction !== null,
                'pending_action' => $pendingAction,
            ],
```

The `AgentMessage` model already casts `metadata` to `array`, so this persists as JSON.

- [ ] **Step 4: Add `resolveAndConfirmAction()`**

In `backend/app/Modules/AI/Services/AgentOrchestrator.php`, insert a new public method immediately after `executeConfirmedAction()` (after line 265):

```php
    /**
     * Resolve a previously persisted pending action by id, then execute or reject it.
     *
     * @return array{executed: bool, action_id: string, result?: array<string, mixed>, reason?: string}
     */
    public function resolveAndConfirmAction(
        int $tenantId,
        int $userId,
        string $conversationUuid,
        string $actionId,
        bool $approved,
        ?string $rejectionReason = null,
        ?string $ipAddress = null
    ): array {
        $conversation = AgentConversation::where('tenant_id', $tenantId)->where('uuid', $conversationUuid)->firstOrFail();

        $message = AgentMessage::where('conversation_id', $conversation->id)
            ->where('role', 'assistant')
            ->orderBy('id', 'desc')
            ->get()
            ->first(function (AgentMessage $candidate) use ($actionId): bool {
                $metadata = is_array($candidate->metadata) ? $candidate->metadata : [];
                $pending = $metadata['pending_action'] ?? null;

                return is_array($pending) && ($pending['action_id'] ?? null) === $actionId;
            });

        if (! $message instanceof AgentMessage) {
            throw ValidationException::withMessages([
                'action_id' => ['No pending action matches the supplied identifier.'],
            ]);
        }

        $metadata = is_array($message->metadata) ? $message->metadata : [];
        /** @var array<string, mixed> $pending */
        $pending = $metadata['pending_action'];

        if (! $approved) {
            $message->update([
                'metadata' => array_merge($metadata, [
                    'has_pending_action' => false,
                    'pending_action' => array_merge($pending, [
                        'status' => 'REJECTED',
                        'rejection_reason' => $rejectionReason,
                    ]),
                ]),
            ]);

            $this->auditLogger->log(
                tenantId: $tenantId,
                userId: $userId,
                conversationId: $conversation->id,
                action: (string) ($pending['tool'] ?? 'unknown'),
                permissionTier: AgentPermissionGuard::TIER_2_SUPERVISED,
                inputParams: is_array($pending['arguments'] ?? null) ? $pending['arguments'] : [],
                resultSummary: 'Operator rejected the pending action: '.($rejectionReason ?? 'no reason supplied'),
                executed: false,
                ipAddress: $ipAddress
            );

            return [
                'executed' => false,
                'action_id' => $actionId,
                'reason' => $rejectionReason ?? 'Action rejected by operator.',
            ];
        }

        $result = $this->executeConfirmedAction(
            tenantId: $tenantId,
            userId: $userId,
            conversationUuid: $conversationUuid,
            toolName: (string) ($pending['tool'] ?? ''),
            actionData: is_array($pending['arguments'] ?? null) ? $pending['arguments'] : [],
            ipAddress: $ipAddress
        );

        $message->update([
            'metadata' => array_merge($metadata, [
                'has_pending_action' => false,
                'pending_action' => array_merge($pending, ['status' => 'CONFIRMED']),
            ]),
        ]);

        return [
            'executed' => true,
            'action_id' => $actionId,
            'result' => is_array($result['result'] ?? null) ? $result['result'] : [],
        ];
    }
```

Add the import at the top of the file (after line 11 `use Carbon\Carbon;`):

```php
use Illuminate\Validation\ValidationException;
```

- [ ] **Step 5: Update the controller**

In `backend/app/Modules/AI/Controllers/CopilotController.php`, replace lines 104–127:

```php
    public function confirmAction(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'tool_name' => 'required|string|max:100',
            'arguments' => 'required|array',
        ]);

        $tenantId = TenantContext::current()->tenantId();
        $userId = (int) (Auth::id() ?? 1);

        $result = $this->orchestrator->executeConfirmedAction(
            tenantId: $tenantId,
            userId: $userId,
            conversationUuid: $uuid,
            toolName: $validated['tool_name'],
            actionData: $validated['arguments'],
            ipAddress: $request->ip()
        );

        return response()->json([
            'status' => 'success',
            'data' => $result,
        ]);
    }
```

with:

```php
    public function confirmAction(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'action_id' => 'required|string|max:100',
            'approved' => 'required|boolean',
            'rejection_reason' => 'nullable|string|max:500',
        ]);

        $tenantId = TenantContext::current()->tenantId();
        $userId = (int) (Auth::id() ?? 1);

        $result = $this->orchestrator->resolveAndConfirmAction(
            tenantId: $tenantId,
            userId: $userId,
            conversationUuid: $uuid,
            actionId: $validated['action_id'],
            approved: (bool) $validated['approved'],
            rejectionReason: $validated['rejection_reason'] ?? null,
            ipAddress: $request->ip()
        );

        return response()->json([
            'status' => 'success',
            'data' => $result,
        ]);
    }
```

- [ ] **Step 6: Update the existing conflicting test**

In `backend/tests/Feature/AI/CopilotTest.php`, replace the whole `test_confirm_action_executes_tier_2_and_creates_alert()` method (lines 317–359) with:

```php
    public function test_confirm_action_executes_tier_2_and_creates_alert(): void
    {
        $chat = $this->withHeader('Authorization', "Bearer {$this->jwt}")
            ->json('POST', '/api/v1/ai/copilot/chat', [
                'message' => 'Create a cash flow alert for low liquidity',
            ]);

        $chat->assertOk();

        $conversationUuid = $chat->json('data.conversation_uuid');
        $actionId = $chat->json('data.pending_action.action_id');

        $response = $this->withHeader('Authorization', "Bearer {$this->jwt}")
            ->json('POST', "/api/v1/ai/copilot/conversations/{$conversationUuid}/confirm", [
                'action_id' => $actionId,
                'approved' => true,
            ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.executed', true)
            ->assertJsonPath('data.action_id', $actionId)
            ->assertJsonPath('data.result.status', 'CONFIRMED_AND_CREATED');

        $this->assertDatabaseHas('cash_flow_alerts', [
            'tenant_id' => $this->tenant->id,
            'alert_type' => 'low_balance',
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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend; php artisan test --filter="test_confirm_endpoint_accepts_action_id_contract|test_confirm_action_executes_tier_2_and_creates_alert"`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/app/Modules/AI/Services/AgentOrchestrator.php backend/app/Modules/AI/Controllers/CopilotController.php backend/tests/Feature/AI/CopilotTest.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): reconcile confirm-action contract with persisted pending actions"
```

---

## Task 13: Audit-log contract transformer

**Files:**
- Modify: `backend/app/Modules/AI/Controllers/CopilotController.php:129-157`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

`agent_audit_logs` has no `uuid`, `tool_name`, `input_payload`, `output_payload` or `blocked_reason`; the controller maps the stored columns onto the `AgentAuditLogItem` contract.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_audit_log_endpoint_matches_agent_audit_log_item_contract(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Audit Tenant',
            'slug' => 'audit-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        $log = \App\Modules\AI\Models\AgentAuditLog::create([
            'tenant_id' => $tenantId,
            'action' => 'list_overdue_invoices',
            'permission_tier' => 0,
            'input_params' => ['days_overdue' => 0],
            'result_summary' => 'Returned 2 overdue invoices totalling BDT 150,000.00',
            'executed' => true,
            'duration_ms' => 42,
            'ip_address' => '127.0.0.1',
        ]);

        $formatted = app(\App\Modules\AI\Controllers\CopilotController::class)->formatAuditLog($log);

        $this->assertSame($log->id, $formatted['id']);
        $this->assertSame('audit-'.$log->id, $formatted['uuid']);
        $this->assertSame('list_overdue_invoices', $formatted['tool_name']);
        $this->assertSame(0, $formatted['permission_tier']);
        $this->assertSame(['days_overdue' => 0], $formatted['input_payload']);
        $this->assertSame('Returned 2 overdue invoices totalling BDT 150,000.00', $formatted['output_payload']['result_summary']);
        $this->assertTrue($formatted['executed']);
        $this->assertNull($formatted['blocked_reason']);
        $this->assertSame(42, $formatted['duration_ms']);
        $this->assertSame('127.0.0.1', $formatted['ip_address']);
        $this->assertIsString($formatted['created_at']);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_audit_log_endpoint_matches_agent_audit_log_item_contract`
Expected: FAIL — `Call to undefined method ... formatAuditLog()`.

- [ ] **Step 3: Add the transformer and map the paginator**

In `backend/app/Modules/AI/Controllers/CopilotController.php`, replace lines 138–157 with:

```php
        if ($request->has('action') || $request->has('tool_name')) {
            $query->where('action', $request->query('tool_name', $request->query('action')));
        }

        if ($request->has('permission_tier')) {
            $query->where('permission_tier', (int) $request->query('permission_tier'));
        }

        if ($request->has('executed')) {
            $query->where('executed', filter_var($request->query('executed'), FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = $request->integer('per_page', 25);
        $logs = $query->orderBy('created_at', 'desc')->paginate($perPage);
        $logs->through(fn (AgentAuditLog $log): array => $this->formatAuditLog($log));

        return response()->json([
            'status' => 'success',
            'data' => $logs,
        ]);
    }

    /**
     * Map a stored audit row onto the AgentAuditLogItem UI contract.
     *
     * @return array<string, mixed>
     */
    public function formatAuditLog(AgentAuditLog $log): array
    {
        return [
            'id' => (int) $log->id,
            'uuid' => 'audit-'.$log->id,
            'tool_name' => (string) $log->action,
            'permission_tier' => (int) $log->permission_tier,
            'input_payload' => is_array($log->input_params) ? $log->input_params : [],
            'output_payload' => [
                'result_summary' => $log->result_summary,
                'confirmed_by' => $log->confirmed_by,
            ],
            'executed' => (bool) $log->executed,
            'blocked_reason' => $log->executed ? null : $log->result_summary,
            'duration_ms' => (int) ($log->duration_ms ?? 0),
            'ip_address' => $log->ip_address,
            'user' => $log->user,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }
```

Remove the now-duplicated trailing `}` that closed `getAuditLog()` if your editor leaves one; the final file must contain exactly one `formatAuditLog()` closing brace before `getAlerts()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; php artisan test --filter=test_audit_log_endpoint_matches_agent_audit_log_item_contract`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Controllers/CopilotController.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): map audit log rows onto AgentAuditLogItem contract"
```

---

## Task 14: Alerts contract transformer

**Files:**
- Modify: `backend/app/Modules/AI/Controllers/CopilotController.php:159-186`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_alerts_endpoint_matches_cash_flow_alert_item_contract(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Alerts Tenant',
            'slug' => 'alerts-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        $alert = \App\Modules\AI\Models\CashFlowAlert::create([
            'tenant_id' => $tenantId,
            'alert_type' => 'payroll_due',
            'severity' => 'critical',
            'title' => '14-Day Factory Payroll Deficit Warning',
            'description' => 'Payroll obligations exceed available liquidity.',
            'threshold_value' => '250000.0000',
            'actual_value' => '145000.0000',
            'currency' => 'BDT',
            'status' => 'active',
            'generated_by' => 'agent',
        ]);

        $formatted = app(\App\Modules\AI\Controllers\CopilotController::class)->formatAlert($alert);

        $this->assertSame($alert->id, $formatted['id']);
        $this->assertSame($alert->uuid, $formatted['uuid']);
        $this->assertSame('payroll_due', $formatted['alert_type']);
        $this->assertSame('critical', $formatted['severity']);
        $this->assertSame('14-Day Factory Payroll Deficit Warning', $formatted['title']);
        $this->assertSame(105000.0, (float) $formatted['projected_shortfall']);
        $this->assertIsInt($formatted['days_until_shortfall']);
        $this->assertSame('active', $formatted['status']);
        $this->assertIsString($formatted['created_at']);
        $this->assertArrayNotHasKey('threshold_value', $formatted);
        $this->assertArrayNotHasKey('actual_value', $formatted);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_alerts_endpoint_matches_cash_flow_alert_item_contract`
Expected: FAIL — `Call to undefined method ... formatAlert()`.

- [ ] **Step 3: Add the transformer and map the collection**

In `backend/app/Modules/AI/Controllers/CopilotController.php`, replace lines 180–186:

```php
        $alerts = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $alerts,
        ]);
    }
```

with:

```php
        $alerts = $query->orderBy('created_at', 'desc')->get()
            ->map(fn (CashFlowAlert $alert): array => $this->formatAlert($alert))
            ->all();

        return response()->json([
            'status' => 'success',
            'data' => $alerts,
        ]);
    }

    /**
     * Map a stored alert onto the CashFlowAlertItem UI contract.
     *
     * @return array<string, mixed>
     */
    public function formatAlert(CashFlowAlert $alert): array
    {
        $severityMap = ['info' => 'low', 'warning' => 'medium', 'critical' => 'critical'];
        $threshold = is_numeric($alert->threshold_value) ? (float) $alert->threshold_value : 0.0;
        $actual = is_numeric($alert->actual_value) ? (float) $alert->actual_value : 0.0;

        $daysUntilShortfall = 30;
        if ($alert->expires_at !== null) {
            $daysUntilShortfall = max(0, (int) Carbon::now()->diffInDays($alert->expires_at, false));
        } elseif ($alert->created_at !== null) {
            $daysUntilShortfall = max(0, 30 - (int) $alert->created_at->diffInDays(Carbon::now()));
        }

        return [
            'id' => (int) $alert->id,
            'uuid' => (string) $alert->uuid,
            'alert_type' => (string) $alert->alert_type,
            'severity' => $severityMap[(string) $alert->severity] ?? 'medium',
            'title' => (string) $alert->title,
            'description' => (string) ($alert->description ?? ''),
            'projected_shortfall' => round(max(0.0, $threshold - $actual), 2),
            'days_until_shortfall' => $daysUntilShortfall,
            'status' => (string) $alert->status,
            'acknowledged_at' => $alert->acknowledged_at?->toIso8601String(),
            'acknowledged_by_user' => $alert->acknowledgedByUser,
            'created_at' => $alert->created_at?->toIso8601String(),
        ];
    }
```

Also update `acknowledgeAlert()` (lines 205–209) so its `data` uses the same contract:

```php
        return response()->json([
            'status' => 'success',
            'message' => 'Alert successfully acknowledged.',
            'data' => $this->formatAlert($alert->fresh('acknowledgedByUser')),
        ]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend; php artisan test --filter="test_alerts_endpoint_matches_cash_flow_alert_item_contract|test_alerts_acknowledge_workflow"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Controllers/CopilotController.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): map alerts onto CashFlowAlertItem contract"
```

---

## Task 15: Financing-history contract transformer

**Files:**
- Modify: `backend/app/Modules/AI/Controllers/CopilotController.php:241-258`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_financing_history_matches_assessment_record_contract(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'History Tenant',
            'slug' => 'history-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        $engine = app(\App\Modules\AI\Services\FinancingMatchEngine::class);
        $engine->assessAndMatch($tenantId, null, [
            'monthly_revenue' => 500000.0,
            'monthly_expenses' => 300000.0,
            'ar_outstanding' => 250000.0,
            'inventory_value' => 600000.0,
            'bank_balance' => 450000.0,
        ]);

        $record = \App\Modules\AI\Models\FinancingAssessment::where('tenant_id', $tenantId)->firstOrFail();

        $formatted = app(\App\Modules\AI\Controllers\CopilotController::class)->formatAssessmentRecord($record);

        $this->assertSame($record->id, $formatted['id']);
        $this->assertSame($record->uuid, $formatted['uuid']);
        $this->assertSame(1500000.0, (float) $formatted['requested_amount']);
        $this->assertSame(45, $formatted['projected_runway_days']);
        $this->assertSame(10000.0, (float) $formatted['burn_rate']);
        $this->assertSame(500000.0, (float) $formatted['revenue_run_rate']);
        $this->assertSame(600000.0, (float) $formatted['collateral_value']);
        $this->assertCount(4, $formatted['recommended_products']);
        $this->assertArrayHasKey('eligibility_score', $formatted['recommended_products'][0]);
        $this->assertSame('submitted', $formatted['status']);
        $this->assertIsString($formatted['created_at']);
        $this->assertArrayNotHasKey('recommendations', $formatted);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_financing_history_matches_assessment_record_contract`
Expected: FAIL — `Call to undefined method ... formatAssessmentRecord()`.

- [ ] **Step 3: Add the transformer**

In `backend/app/Modules/AI/Controllers/CopilotController.php`, replace lines 248–257 with:

```php
        $history = FinancingAssessment::where('tenant_id', $tenantId)
            ->orderBy('assessment_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get()
            ->map(fn (FinancingAssessment $record): array => $this->formatAssessmentRecord($record))
            ->all();

        return response()->json([
            'status' => 'success',
            'data' => $history,
        ]);
    }

    /**
     * Map a stored assessment onto the FinancingAssessmentRecord UI contract.
     *
     * @return array<string, mixed>
     */
    public function formatAssessmentRecord(FinancingAssessment $record): array
    {
        $recommendations = is_array($record->recommendations) ? $record->recommendations : [];
        $products = is_array($recommendations['products'] ?? null) ? $recommendations['products'] : [];
        $top = is_array($recommendations['top_recommendation'] ?? null) ? $recommendations['top_recommendation'] : null;

        $monthlyExpenses = (float) $record->monthly_expenses;
        $bankBalance = (float) $record->bank_balance;
        $dailyBurnRate = round($monthlyExpenses / 30.0, 2);
        $runwayDays = $dailyBurnRate > 0 ? (int) floor($bankBalance / $dailyBurnRate) : 999;

        $requestedAmount = 0.0;
        if (is_array($top) && is_numeric($top['max_amount'] ?? null)) {
            $requestedAmount = (float) $top['max_amount'];
        }

        return [
            'id' => (int) $record->id,
            'uuid' => (string) $record->uuid,
            'requested_amount' => round($requestedAmount, 2),
            'projected_runway_days' => $runwayDays,
            'burn_rate' => $dailyBurnRate,
            'revenue_run_rate' => round((float) $record->monthly_revenue, 2),
            'collateral_value' => round((float) $record->inventory_value, 2),
            'recommended_products' => array_map(
                fn (array $product): array => $this->financingMatchEngine->formatProduct($product),
                array_values(array_filter($products, 'is_array'))
            ),
            'status' => $products === [] ? 'draft' : 'submitted',
            'created_at' => $record->created_at?->toIso8601String(),
        ];
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; php artisan test --filter=test_financing_history_matches_assessment_record_contract`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Modules/AI/Controllers/CopilotController.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): map financing history onto FinancingAssessmentRecord contract"
```

---

## Task 16: Real metrics in WeBank pre-qualification

**Files:**
- Modify: `backend/app/Modules/AI/Services/FinancingMatchEngine.php` (add `computeRiskProfile()`, after `computeSolvencyScore()`)
- Modify: `backend/app/Modules/AI/Controllers/CopilotController.php:265-312`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

The `?? 92` / `?? 16` hardcoded fallbacks must go.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_webank_pre_qualify_uses_computed_metrics_not_hardcoded_fallbacks(): void
    {
        $engine = app(\App\Modules\AI\Services\FinancingMatchEngine::class);

        $profile = $engine->computeRiskProfile([
            'monthly_revenue' => 500000.0,
            'monthly_expenses' => 450000.0,
            'bank_balance' => 600000.0,
            'operating_margin_pct' => 10.0,
        ]);

        $this->assertSame(20, $profile['runway_cushion_days']);
        $this->assertSame(10.0, $profile['operating_margin_pct']);
    }

    public function test_webank_pre_qualify_payload_keys_are_computed(): void
    {
        $tenantId = \App\Models\Tenant::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'WeBank Tenant',
            'slug' => 'webank-tenant',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ])->id;

        $engine = app(\App\Modules\AI\Services\FinancingMatchEngine::class);
        $assessment = $engine->assessAndMatch($tenantId, null, [
            'monthly_revenue' => 800000.0,
            'monthly_expenses' => 600000.0,
            'ar_outstanding' => 300000.0,
            'bank_balance' => 200000.0,
            'inventory_value' => 500000.0,
        ]);

        $errors = $engine->webankCreditAssessment($assessment);

        $this->assertSame(90, $errors['solvency_score']);
        $this->assertSame(800000.0, (float) $errors['monthly_revenue_verified']);
        $this->assertSame(25.0, (float) $errors['operating_margin_verified']);
        $this->assertSame(300000.0, (float) $errors['verified_ar_pool']);
        $this->assertSame(10, $errors['runway_cushion_days']);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter="test_webank_pre_qualify_uses_computed_metrics_not_hardcoded_fallbacks|test_webank_pre_qualify_payload_keys_are_computed"`
Expected: FAIL — `Call to undefined method ... computeRiskProfile()`.

- [ ] **Step 3: Add the metric helpers**

In `backend/app/Modules/AI/Services/FinancingMatchEngine.php`, insert after `computeSolvencyScore()`:

```php
    /**
     * Derive runway and margin indicators from verified metrics.
     *
     * @param  array<string, mixed>  $metrics
     * @return array{runway_cushion_days: int, operating_margin_pct: float}
     */
    public function computeRiskProfile(array $metrics): array
    {
        $bank = (float) ($metrics['bank_balance'] ?? 0);
        $revenue = (float) ($metrics['monthly_revenue'] ?? 0);
        $expenses = (float) ($metrics['monthly_expenses'] ?? 0);

        $dailyBurn = $expenses / 30.0;
        $runway = $dailyBurn > 0 ? (int) floor($bank / $dailyBurn) : 999;

        $margin = $revenue > 0
            ? round((($revenue - $expenses) / $revenue) * 100, 2)
            : 0.0;

        return [
            'runway_cushion_days' => $runway,
            'operating_margin_pct' => is_numeric($metrics['operating_margin_pct'] ?? null)
                ? (float) $metrics['operating_margin_pct']
                : $margin,
        ];
    }

    /**
     * Build the WeBank credit_assessment block from a completed assessment.
     *
     * @param  array<string, mixed>  $assessment
     * @return array<string, mixed>
     */
    public function webankCreditAssessment(array $assessment): array
    {
        /** @var array<string, mixed> $metrics */
        $metrics = is_array($assessment['metrics'] ?? null) ? $assessment['metrics'] : [];
        $profile = $this->computeRiskProfile($metrics);

        return [
            'solvency_score' => $this->computeSolvencyScore($metrics),
            'monthly_revenue_verified' => round((float) ($metrics['monthly_revenue'] ?? 0), 2),
            'operating_margin_verified' => $profile['operating_margin_pct'],
            'verified_ar_pool' => round((float) ($metrics['ar_outstanding'] ?? 0), 2),
            'runway_cushion_days' => $profile['runway_cushion_days'],
        ];
    }
```

- [ ] **Step 4: Use the helper in the controller**

In `backend/app/Modules/AI/Controllers/CopilotController.php`, replace lines 296–302:

```php
            'credit_assessment' => [
                'solvency_score' => $assessment['credit_score_indicator'] ?? 92,
                'monthly_revenue_verified' => $assessment['metrics']['monthly_revenue'] ?? 0,
                'operating_margin_verified' => $assessment['metrics']['operating_margin_pct'] ?? 0,
                'verified_ar_pool' => $assessment['metrics']['ar_outstanding'] ?? 0,
                'runway_cushion_days' => $assessment['metrics']['runway_days'] ?? 16,
            ],
```

with:

```php
            'credit_assessment' => $this->financingMatchEngine->webankCreditAssessment($assessment),
```

Also replace line 276 `app(FinancingMatchEngine::class)->assessAndMatch(` with `$this->financingMatchEngine->assessAndMatch(` so the injected dependency is used.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend; php artisan test --filter="test_webank_pre_qualify"`
Expected: PASS (3 tests — the two new ones plus the existing `test_webank_pre_qualify_returns_standardized_payload`).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Modules/AI/Services/FinancingMatchEngine.php backend/app/Modules/AI/Controllers/CopilotController.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): compute webank credit assessment from verified ledger metrics"
```

---

## Task 17: Accept the financing-match request contract

**Files:**
- Modify: `backend/app/Modules/AI/Controllers/CopilotController.php:215-233`
- Test: `backend/tests/Feature/AI/CopilotContractTest.php`

The UI posts `{requested_amount, preferred_term_months, collateral_available, purpose}`; the controller currently only validates six numeric overrides and silently drops all four.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotContractTest.php`:

```php
    public function test_financing_match_accepts_ui_request_contract(): void
    {
        $engine = app(\App\Modules\AI\Services\FinancingMatchEngine::class);

        $inputs = $engine->normalizeMatchInputs([
            'requested_amount' => 500000,
            'preferred_term_months' => 12,
            'collateral_available' => 'unsecured',
            'purpose' => 'working_capital',
            'monthly_revenue' => 400000,
        ]);

        $this->assertSame(400000.0, $inputs['monthly_revenue']);
        $this->assertSame(500000.0, $inputs['requested_amount']);
        $this->assertSame(12, $inputs['preferred_term_months']);
        $this->assertSame('unsecured', $inputs['collateral_available']);
        $this->assertSame('working_capital', $inputs['purpose']);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=test_financing_match_accepts_ui_request_contract`
Expected: FAIL — `Call to undefined method ... normalizeMatchInputs()`.

- [ ] **Step 3: Add the normaliser**

In `backend/app/Modules/AI/Services/FinancingMatchEngine.php`, insert after `webankCreditAssessment()`:

```php
    /**
     * Merge the UI request contract into the internal custom-input map.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function normalizeMatchInputs(array $payload): array
    {
        $inputs = [];

        foreach (['monthly_revenue', 'monthly_expenses', 'ar_outstanding', 'ap_outstanding', 'inventory_value', 'bank_balance'] as $key) {
            if (isset($payload[$key]) && is_numeric($payload[$key])) {
                $inputs[$key] = (float) $payload[$key];
            }
        }

        if (isset($payload['requested_amount']) && is_numeric($payload['requested_amount'])) {
            $inputs['requested_amount'] = (float) $payload['requested_amount'];
        }

        if (isset($payload['preferred_term_months']) && is_numeric($payload['preferred_term_months'])) {
            $inputs['preferred_term_months'] = (int) $payload['preferred_term_months'];
        }

        if (isset($payload['collateral_available']) && is_string($payload['collateral_available'])) {
            $inputs['collateral_available'] = $payload['collateral_available'];
        }

        if (isset($payload['purpose']) && is_string($payload['purpose'])) {
            $inputs['purpose'] = $payload['purpose'];
        }

        return $inputs;
    }
```

`gatherFinancialMetrics()` ignores unknown keys, so `requested_amount`, `preferred_term_months`, `collateral_available` and `purpose` pass through harmlessly while remaining available on the assessment call.

- [ ] **Step 4: Update the controller validation**

In `backend/app/Modules/AI/Controllers/CopilotController.php`, replace lines 217–233:

```php
        $validated = $request->validate([
            'monthly_revenue' => 'nullable|numeric|min:0',
            'monthly_expenses' => 'nullable|numeric|min:0',
            'ar_outstanding' => 'nullable|numeric|min:0',
            'ap_outstanding' => 'nullable|numeric|min:0',
            'inventory_value' => 'nullable|numeric|min:0',
            'bank_balance' => 'nullable|numeric|min:0',
        ]);

        $tenantId = TenantContext::current()->tenantId();
        $userId = (int) (Auth::id() ?? 1);

        $assessment = $this->financingMatchEngine->assessAndMatch(
            tenantId: $tenantId,
            userId: $userId,
            customInputs: $validated
        );
```

with:

```php
        $validated = $request->validate([
            'monthly_revenue' => 'nullable|numeric|min:0',
            'monthly_expenses' => 'nullable|numeric|min:0',
            'ar_outstanding' => 'nullable|numeric|min:0',
            'ap_outstanding' => 'nullable|numeric|min:0',
            'inventory_value' => 'nullable|numeric|min:0',
            'bank_balance' => 'nullable|numeric|min:0',
            'requested_amount' => 'nullable|numeric|min:0',
            'preferred_term_months' => 'nullable|integer|min:1|max:120',
            'collateral_available' => 'nullable|string|max:100',
            'purpose' => 'nullable|string|max:100',
        ]);

        $tenantId = TenantContext::current()->tenantId();
        $userId = (int) (Auth::id() ?? 1);

        $assessment = $this->financingMatchEngine->assessAndMatch(
            tenantId: $tenantId,
            userId: $userId,
            customInputs: $this->financingMatchEngine->normalizeMatchInputs($validated)
        );
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend; php artisan test --filter="test_financing_match_accepts_ui_request_contract|test_financing_match_engine_computes_recommendations"`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Modules/AI/Services/FinancingMatchEngine.php backend/app/Modules/AI/Controllers/CopilotController.php backend/tests/Feature/AI/CopilotContractTest.php
git commit -m "feat(ai): accept the UI financing match request contract"
```

---

## Task 18: Wire the live Anthropic path into the orchestrator

**Files:**
- Modify: `backend/app/Modules/AI/Services/AgentOrchestrator.php:19-23`, `:62`, `:64-171`
- Test: `backend/tests/Feature/AI/CopilotOrchestratorTest.php` (created here)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Feature/AI/CopilotOrchestratorTest.php`:

```php
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
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=CopilotOrchestratorTest`
Expected: FAIL — `test_orchestrator_prefers_anthropic_when_configured` sees `Http::assertSentCount(2)` fail because the OpenAI branch matches no fake URL and 0 requests were sent to `/v1/messages`.

- [ ] **Step 3: Inject the client into the orchestrator**

In `backend/app/Modules/AI/Services/AgentOrchestrator.php`, replace the constructor at lines 19–23 with:

```php
    public function __construct(
        protected AgentToolRegistry $toolRegistry,
        protected AgentPermissionGuard $permissionGuard,
        protected AgentAuditLogger $auditLogger,
        protected AnthropicClient $anthropicClient
    ) {}
```

- [ ] **Step 4: Replace the dead OpenAI branch with the live Anthropic branch**

Delete the now-unused payload assignment at line 62:

```php
        $payloadMessages = array_merge([['role' => 'system', 'content' => $systemPrompt]], $recentMessages);
```

Then replace lines 64–171 — the whole `// 4. Check for OpenAI API Key` block through the closing brace of `if (! empty($apiKey) ...)` — with:

```php
        // 4. Live LLM call via the Anthropic Messages API when a key is configured
        $executedTools = [];
        $pendingAction = null;
        $maxTierUsed = AgentPermissionGuard::TIER_0_READ;
        $assistantContent = '';

        /** @var list<array{role: string, content: string}> $recentMessages */
        $history = $this->anthropicClient->historyToMessages($recentMessages);

        if ($this->anthropicClient->isConfigured()) {
            $turn = $this->anthropicClient->messages(
                $systemPrompt,
                $history,
                $this->toolRegistry->getAnthropicToolSchemas()
            );

            if ($turn !== null) {
                $assistantContent = $turn['content'];
                $toolResultBlocks = [];

                foreach ($turn['tool_calls'] as $toolCall) {
                    $toolName = $toolCall['name'];
                    $toolArgs = $toolCall['arguments'];
                    $toolUseId = $toolCall['id'] !== '' ? $toolCall['id'] : (string) Str::uuid();
                    $tier = $this->permissionGuard->getToolTier($toolName);
                    $maxTierUsed = max($maxTierUsed, $tier);

                    if ($this->permissionGuard->requiresConfirmation($toolName)) {
                        // Tier 2 — supervised action. Stop and await explicit operator confirmation.
                        $pendingAction = [
                            'action_id' => $toolUseId,
                            'tool' => $toolName,
                            'description' => "Confirm action: {$toolName} with parameters: ".json_encode($toolArgs),
                            'arguments' => $toolArgs,
                            'permission_tier' => AgentPermissionGuard::TIER_2_SUPERVISED,
                            'risk_level' => $this->permissionGuard->riskLevelFor($toolName),
                            'expires_at' => now()->addMinutes(30)->toIso8601String(),
                        ];

                        $this->auditLogger->log(
                            tenantId: $tenantId,
                            userId: $userId,
                            conversationId: $conversation->id,
                            action: $toolName,
                            permissionTier: $tier,
                            inputParams: $toolArgs,
                            resultSummary: 'Action placed in pending_confirmation state awaiting user authorization',
                            executed: false,
                            ipAddress: $ipAddress
                        );

                        break;
                    }

                    // Execute Tier 0 / Tier 1 tool directly
                    $toolOutput = $this->auditLogger->measureAndLog(
                        tenantId: $tenantId,
                        userId: $userId,
                        conversationId: $conversation->id,
                        toolName: $toolName,
                        permissionTier: $tier,
                        inputParams: $toolArgs,
                        callback: fn () => $this->toolRegistry->executeTool($toolName, $toolArgs, $tenantId, $userId),
                        ipAddress: $ipAddress
                    );

                    $executedTools[] = [
                        'tool_call_id' => $toolUseId,
                        'tool' => $toolName,
                        'arguments' => $toolArgs,
                        'result' => $toolOutput,
                        'permission_tier' => $tier,
                    ];

                    $toolResultBlocks[] = [
                        'tool_use_id' => $toolUseId,
                        'output' => $toolOutput,
                    ];
                }

                // Ask the model to synthesise a natural-language answer from the tool results.
                if (! empty($toolResultBlocks) && $pendingAction === null) {
                    $followUpMessages = array_merge(
                        $history,
                        [$this->anthropicClient->assistantTurn($turn)],
                        [$this->anthropicClient->toolResultMessage($toolResultBlocks)]
                    );

                    $followUp = $this->anthropicClient->messages($systemPrompt, $followUpMessages, []);

                    if ($followUp !== null && $followUp['content'] !== '') {
                        $assistantContent = $followUp['content'];
                    }
                }
            }
        }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend; php artisan test --filter=CopilotOrchestratorTest`
Expected: PASS (2 tests).

- [ ] **Step 6: Verify the existing copilot suite still passes**

Run: `cd backend; php artisan test --filter=CopilotTest`
Expected: PASS — the container still auto-resolves `AgentOrchestrator` with the new fourth dependency; every existing test runs on the deterministic fallback because `services.anthropic.key` is unset in the testing environment.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Modules/AI/Services/AgentOrchestrator.php backend/tests/Feature/AI/CopilotOrchestratorTest.php
git commit -m "feat(ai): drive the copilot with the anthropic messages api"
```

---

## Task 19: Cover every quick prompt in the deterministic fallback engine

The six `QUICK_PROMPTS` in `CopilotChat.tsx` must all resolve to a tool even when no live key is configured (the judging environment may run offline). Two prompts currently fall through to the greeting, and the `ar` keyword can mis-fire on unrelated words.

**Files:**
- Modify: `backend/app/Modules/AI/Services/AgentOrchestrator.php` (`runDeterministicFallbackEngine`)
- Test: `backend/tests/Feature/AI/CopilotOrchestratorTest.php`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/AI/CopilotOrchestratorTest.php`:

```php
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

    /**
     * @dataProvider quickPromptProvider
     */
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; php artisan test --filter=CopilotOrchestratorTest`
Expected: FAIL — the `pl` and `inventory` cases return zero tool calls (greeting branch), and `list_overdue_invoices` matches on `Are` because the current check is a bare `str_contains($lower, 'ar')`.

- [ ] **Step 3: Add the missing branches and tighten the `ar` check**

In `backend/app/Modules/AI/Services/AgentOrchestrator.php`, inside `runDeterministicFallbackEngine()`, widen the overdue-invoice condition from the bare substring to a word-boundary match:

```php
        if (preg_match('/\b(overdue|invoice|invoices|ar|receivable|receivables)\b/', $lower) === 1) {
```

and insert two new branches immediately before the final default/greeting branch:

```php
        if (str_contains($lower, 'pl') || str_contains($lower, 'p&l') || str_contains($lower, 'profit') || str_contains($lower, 'margin')) {
            return $this->fallbackToolTurn(
                toolName: 'get_pl_summary',
                arguments: ['period' => 'current_month'],
                tenantId: $tenantId,
                userId: $userId,
                conversationId: $conversationId,
                intro: 'Pulling your profit and loss summary for the current month.'
            );
        }

        if (str_contains($lower, 'inventory') || str_contains($lower, 'stock')) {
            return $this->fallbackToolTurn(
                toolName: 'get_inventory_value',
                arguments: [],
                tenantId: $tenantId,
                userId: $userId,
                conversationId: $conversationId,
                intro: 'Valuing your current inventory position.'
            );
        }
```

- [ ] **Step 4: Extract the repeated fallback tool-turn logic into one helper**

The existing branches each inline the same sequence (tier lookup, direct execution, `measureAndLog`, `$executedTools` shape, free-text summary). Add this private helper and route the two new branches plus the existing cash/overdue/risk/financing branches through it:

```php
    /**
     * Execute a deterministic Tier 0/1 tool and shape it exactly like the live path.
     *
     * @param  array<string, mixed>  $arguments
     * @return array{content: string, tools: list<array<string, mixed>>, pending_action: null, tier: int}
     */
    private function fallbackToolTurn(
        string $toolName,
        array $arguments,
        int $tenantId,
        int $userId,
        int $conversationId,
        string $intro
    ): array {
        $tier = $this->permissionGuard->getToolTier($toolName);

        $output = $this->auditLogger->measureAndLog(
            tenantId: $tenantId,
            userId: $userId,
            conversationId: $conversationId,
            toolName: $toolName,
            permissionTier: $tier,
            inputParams: $arguments,
            callback: fn () => $this->toolRegistry->executeTool($toolName, $arguments, $tenantId, $userId),
        );

        return [
            'content' => $intro,
            'tools' => [[
                'tool_call_id' => 'fallback-'.Str::uuid(),
                'tool' => $toolName,
                'arguments' => $arguments,
                'result' => $output,
                'permission_tier' => $tier,
            ]],
            'pending_action' => null,
            'tier' => $tier,
        ];
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend; php artisan test --filter=CopilotOrchestratorTest`
Expected: PASS (9 tests — 2 orchestrator + 6 quick-prompt data rows + 1 word-boundary).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Modules/AI/Services/AgentOrchestrator.php backend/tests/Feature/AI/CopilotOrchestratorTest.php
git commit -m "fix(ai): resolve every quick prompt through the offline fallback engine"
```

---

## Task 20: Wire the financing "Apply" button to the real pre-qualification endpoint

`FinancingMatcherTab.handleApply()` currently fakes the call with `await new Promise((resolve) => setTimeout(resolve, 800))`. It must call the real `POST /ai/webank/pre-qualify` route that Task 16 made honest.

**Files:**
- Modify: `frontend/src/modules/ai/api/copilotApi.ts`
- Modify: `frontend/src/modules/ai/components/FinancingMatcherTab.tsx:73-86`
- Test: `frontend/src/modules/ai/components/__tests__/FinancingMatcherTab.test.tsx` (created here)

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/ai/components/__tests__/FinancingMatcherTab.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const preQualifyWebank = vi.fn();
const matchFinancing = vi.fn();
const getFinancingHistory = vi.fn();

vi.mock('../../api/copilotApi', () => ({
  copilotApi: {
    preQualifyWebank: (...args: unknown[]) => preQualifyWebank(...args),
    matchFinancing: (...args: unknown[]) => matchFinancing(...args),
    getFinancingHistory: (...args: unknown[]) => getFinancingHistory(...args),
  },
}));

import { FinancingMatcherTab } from '../FinancingMatcherTab';

describe('FinancingMatcherTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFinancingHistory.mockResolvedValue([]);
    matchFinancing.mockResolvedValue({
      assessment_uuid: 'a-1',
      cash_deficit_amount: 0,
      recommended_financing: 500000,
      credit_score_indicator: 78,
      matched_products: [
        {
          product_id: 'we-bank-micro',
          product_name: 'WeBank Digital SME Micro-Finance',
          max_amount: 500000,
          interest_rate_pct: 9.5,
          eligibility_score: 88,
          qualification_status: 'qualified',
          application_turnaround: '48 hours',
          benefits: ['No collateral'],
        },
      ],
      evaluation_summary: 'Eligible.',
    });
    preQualifyWebank.mockResolvedValue({
      application_reference: 'WB-123',
      status: 'pre_qualified',
    });
  });

  it('calls the real pre-qualification endpoint when applying', async () => {
    render(<FinancingMatcherTab />);

    await waitFor(() => expect(matchFinancing).toBeDefined());

    await userEvent.click(await screen.findByRole('button', { name: /apply/i }));

    await waitFor(() =>
      expect(preQualifyWebank).toHaveBeenCalledWith(
        expect.objectContaining({ product_id: 'we-bank-micro' })
      )
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- FinancingMatcherTab`
Expected: FAIL — `copilotApi.preQualifyWebank is not a function` (the mock records the call but the component still runs the `setTimeout` stub, so the assertion times out).

- [ ] **Step 3: Add the API method**

In `frontend/src/modules/ai/api/copilotApi.ts`, add to the exported `copilotApi` object:

```ts
  async preQualifyWebank(payload: {
    product_id: string;
    requested_amount: number;
    collateral_type: string;
  }): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>('/ai/webank/pre-qualify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
```

Match the existing `matchFinancing` method's helper (`request` / `apiClient`) and error handling exactly — read the file first and reuse whatever `POST` helper the sibling methods use.

- [ ] **Step 4: Replace the fake handler**

In `frontend/src/modules/ai/components/FinancingMatcherTab.tsx`, replace `handleApply()` (lines 73–86) with:

```tsx
  async function handleApply() {
    if (!selectedProduct) return;
    setIsApplying(true);
    try {
      await copilotApi.preQualifyWebank({
        product_id: selectedProduct.product_id,
        requested_amount: requestedAmount,
        collateral_type: collateral,
      });
      notify.success('Pre-qualification submitted. Our partner will contact you shortly.');
      setShowApplyModal(false);
      await loadHistory();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Pre-qualification failed.');
    } finally {
      setIsApplying(false);
    }
  }
```

If the component uses a different notification primitive than `notify`, reuse the one already imported in the file.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend; npm run test -- FinancingMatcherTab`
Expected: PASS.

- [ ] **Step 6: Typecheck and lint the touched files**

Run: `cd frontend; npm run typecheck; npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/ai/api/copilotApi.ts frontend/src/modules/ai/components/FinancingMatcherTab.tsx frontend/src/modules/ai/components/__tests__/FinancingMatcherTab.test.tsx
git commit -m "feat(ai): submit financing applications to the real pre-qualification endpoint"
```

---

## Task 21: Mandatory verification gate — backend static analysis and tests

Nothing after this task may be claimed as working until this gate is green. Run it once here, and again in Task 25 after the capture tooling lands.

**Files:**
- Verify only (no source changes expected). If a gate fails, fix the offending file from Tasks 1–20.

- [ ] **Step 1: Run the full backend gate**

Run: `cd backend; composer check`
Expected: `pint --test` reports no style issues, `phpstan analyse` reports no errors, and the PHPUnit suite passes with 0 failures. Record the exact tail of the output — it is pasted into `docs/submission/SUBMISSION_EMAIL.md` in Task 25.

- [ ] **Step 2: If Pint fails**

Run: `cd backend; composer lint:fix` then re-run `composer check`.
Expected: PASS.

- [ ] **Step 3: If PHPStan fails**

Run: `cd backend; composer analyse` and fix the reported file in place. Do not add `@phpstan-ignore` unless the existing codebase already uses it in that file.

- [ ] **Step 4: Run the frontend gate**

Run: `cd frontend; npm run typecheck; npm run lint; npm run test`
Expected: `tsc` clean, ESLint (and oxlint) with zero warnings, Vitest green.

- [ ] **Step 5: Confirm the AI slice specifically**

Run: `cd backend; php artisan test --filter=AI`
Expected: `CopilotTest`, `CopilotContractTest`, `CopilotOrchestratorTest` all PASS.

- [ ] **Step 6: Commit any gate fixes**

```bash
git add -p
git commit -m "chore: satisfy lint, static analysis and test gates"
```

Only run this if Steps 1–5 required an edit; otherwise skip.

---

## Task 22: Automated demo capture (video + deck)

**Files:**
- Create: `frontend/e2e/copilot-demo-capture.spec.ts`
- Create: `scripts/capture-demo.ps1`
- Modify: `frontend/playwright.config.ts` (enable `video`)

- [ ] **Step 1: Enable video recording**

In `frontend/playwright.config.ts`, inside the `use` block of the `chromium` project, add:

```ts
    video: 'on',
```

- [ ] **Step 2: Write the capture spec**

Create `frontend/e2e/copilot-demo-capture.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const PASSWORD = process.env.DEMO_PASSWORD ?? 'Password123!';
const EMAIL = process.env.DEMO_EMAIL ?? 'demo@slicemart.com';

test('copilot demo walkthrough', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);

  await page.goto('/finance?tab=copilot');

  const prompts = [
    'What is our current cash position?',
    'Show me overdue invoices',
    'Show me the P&L summary for this month',
    'Analyze our cash flow risk for the next 30 days',
    'What is our inventory valuation?',
    'What financing options do we qualify for?',
  ];

  for (const prompt of prompts) {
    await page.click('[data-testid="copilot-prompt-cash"]');
    await page.fill('[data-testid="copilot-input"] textarea, textarea', prompt);
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="copilot-message-assistant"]').last()).toBeVisible();
    await page.waitForTimeout(1200);
  }

  await page.fill('textarea', 'Create a cash flow alert for low liquidity');
  await page.keyboard.press('Enter');
  await page.click('[data-testid="tier2-confirm-button"], button:has-text("Confirm")');
  await page.waitForTimeout(1200);

  await page.click('button:has-text("Financing Matcher")');
  await page.click('button:has-text("Find Matches")');
  await page.waitForTimeout(1500);
  const apply = page.locator('button:has-text("Apply")').first();
  if (await apply.isVisible().catch(() => false)) {
    await apply.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: 'test-results/demo-final.png', fullPage: true });
});
```

Before committing, read `frontend/src/modules/ai/components/CopilotChat.tsx` and `FinancingMatcherTab.tsx` and replace each selector above with the real `data-testid` (or role/text) those components render. Do not invent test ids; if a component has none, select by accessible role/name instead.

- [ ] **Step 3: Write the capture script**

Create `scripts/capture-demo.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host 'Seeding demo tenant...'
Push-Location "$root\backend"
php artisan migrate:fresh --seed --seeder=CopilotDemoSeeder
php artisan config:clear
Pop-Location

Write-Host 'Capturing demo video...'
Push-Location "$root\frontend"
$env:DEMO_EMAIL = 'demo@slicemart.com'
$env:DEMO_PASSWORD = 'Password123!'
npx playwright test e2e/copilot-demo-capture.spec.ts --project=chromium
Pop-Location

Write-Host 'Video written to frontend/test-results/**.webm'
```

Verify the seeder class name and the seeded demo credentials by reading `backend/database/seeders/CopilotDemoSeeder.php` and adjust `DEMO_EMAIL` / `DEMO_PASSWORD` to match exactly.

- [ ] **Step 4: Install ffmpeg and convert to 1080p mp4**

Run (once, elevated is not required for a per-user install):

```powershell
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
```

Then, after Step 3 has produced a `.webm`:

```powershell
$webm = (Get-ChildItem "$root\frontend\test-results" -Recurse -Filter *.webm | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
ffmpeg -y -i $webm -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart "$root\docs\submission\demo_video.mp4"
```

Expected: `docs/submission/demo_video.mp4` exists and `ffprobe` reports `1920x1080` with an h264 stream.

- [ ] **Step 5: Export the deck as PDF**

Run:

```powershell
Push-Location "$root\frontend"
npx playwright test e2e/copilot-demo-capture.spec.ts --project=chromium --headed=false
Pop-Location
```

Then export the presentation route to PDF with Playwright's `page.pdf()` (Chromium only). If the deck is a Vite route (e.g. `/docs/deck`), add a second spec that navigates to it and calls:

```ts
await page.pdf({ path: '../docs/submission/presentation_deck.pdf', format: 'A4', printBackground: true });
```

If the deck is not a route, skip this step and note in `docs/submission/SUBMISSION_EMAIL.md` that the deck is submitted as the committed HTML/PDF already present in the repo.

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/copilot-demo-capture.spec.ts frontend/playwright.config.ts scripts/capture-demo.ps1
git commit -m "test(e2e): capture the automated copilot demo walkthrough"
```

`frontend/test-results/` and `docs/submission/*.mp4` must stay untracked — verify with `git check-ignore -v`.

---

## Task 23: Assemble the execution evidence archive

**Files:**
- Create: `docs/submission/execution_evidence.zip` (assembled, not hand-written)

- [ ] **Step 1: Produce the raw evidence**

Run each command and tee its output into the evidence folder:

```powershell
New-Item -ItemType Directory -Force docs\submission\evidence | Out-Null
Push-Location backend
composer check *>&1 | Tee-Object -FilePath ..\docs\submission\evidence\backend-check.txt
Pop-Location
Push-Location frontend
npm run typecheck *>&1 | Tee-Object -FilePath ..\docs\submission\evidence\frontend-typecheck.txt
npm run test *>&1 | Tee-Object -FilePath ..\docs\submission\evidence\frontend-test.txt
Pop-Location
```

Expected: three text files, each ending in a zero exit status.

- [ ] **Step 2: Add the committed-vs-working-tree proof**

```powershell
git log --oneline -20 | Out-File -Encoding utf8 docs\submission\evidence\git-log.txt
git status --short | Out-File -Encoding utf8 docs\submission\evidence\git-status.txt
```

- [ ] **Step 3: Zip it**

```powershell
Compress-Archive -Path docs\submission\evidence\* -DestinationPath docs\submission\execution_evidence.zip -Force
```

Expected: `docs/submission/execution_evidence.zip` contains the five evidence files at the archive root.

- [ ] **Step 4: Commit the archive**

```bash
git add docs/submission/execution_evidence.zip
git commit -m "docs(submission): add execution evidence archive"
```

---

## Task 24: Write the submission email with embedded evidence

**Files:**
- Create: `docs/submission/SUBMISSION_EMAIL.md`

- [ ] **Step 1: Confirm the recipient and deadline once more**

Read `FINTECHATHON_MASTER_PLAN.md` §submission and copy the recipient address and the exact deadline string verbatim. Do not retype either from memory.

- [ ] **Step 2: Write the email**

Create `docs/submission/SUBMISSION_EMAIL.md` with this structure, filling each bracket from the actual run output captured in Task 23 — never with invented numbers:

```markdown
# FinTechathon 2026 — WeBank Topic E Submission

**To:** wangyr@pbcsf.tsinghua.edu.cn
**Subject:** FinTechathon 2026 Submission — AI Finance Copilot (SliceMartFMS) — Topic E, WeBank

## Attachments
- technical_documentation.pdf
- presentation_deck.pdf
- security_self_assessment.pdf
- demo_video.mp4
- execution_evidence.zip

## Repository
https://github.com/beingmushfiq/SliceMartFMS

## Verification summary (pasted from Task 21 / Task 23 output)
- `composer check` … [paste final summary line]
- `npm run typecheck` … [paste exit status]
- `npm run test` … [paste test count]
```

- [ ] **Step 3: Produce the three PDFs**

If they are not already committed as PDFs, generate each from its Markdown source with Playwright `page.pdf()` (A4, `printBackground: true`) and write them to `docs/submission/`. Do not submit Markdown in place of a required PDF.

- [ ] **Step 4: Verify every attachment exists and is non-empty**

```powershell
Get-ChildItem docs\submission\*.pdf, docs\submission\*.mp4, docs\submission\*.zip | Select-Object Name, Length
```

Expected: five rows, every `Length` greater than zero.

- [ ] **Step 5: Commit**

```bash
git add docs/submission/SUBMISSION_EMAIL.md docs/submission/*.pdf
git commit -m "docs(submission): finalize the submission email and artifacts"
```

---

## Task 25: Final gate after the capture tooling

**Files:**
- Verify only.

- [ ] **Step 1: Re-run both gates on the frozen commit**

Run: `cd backend; composer check` and `cd frontend; npm run typecheck; npm run lint; npm run test`
Expected: all green on the exact commit that will be submitted.

- [ ] **Step 2: Confirm the demo still runs end to end**

Run: `.\scripts\capture-demo.ps1`
Expected: a fresh `.webm` is produced and Task 22 Step 4's conversion still succeeds.

- [ ] **Step 3: Confirm the working tree is clean**

Run: `git status --short`
Expected: no output (all deliverables committed or ignored).

- [ ] **Step 4: Tag the submission commit**

```bash
git tag -a fintechathon-2026-submission -m "FinTechathon 2026 WeBank Topic E submission"
git push origin main --tags
```

Only push after the user approves.

---

## Self-Review

**1. Spec coverage.** Every requirement in `FINTECHATHON_MASTER_PLAN.md` maps to a task:

| Requirement | Task |
| --- | --- |
| Live Anthropic-compatible provider wired end to end | 1, 2, 3, 18 |
| Deterministic offline fallback for every quick prompt | 19 |
| Card payloads match the React contracts exactly | 4–10 |
| Tier 2 supervised confirmation round-trip | 11, 12 |
| Audit log, alerts and financing history endpoints match the UI | 13, 14, 15 |
| WeBank pre-qualification uses computed metrics, not hardcoded values | 16, 17 |
| Financing "Apply" performs a real action | 20 |
| Mandatory verification gates | 21, 25 |
| `demo_video.mp4` | 22 |
| `presentation_deck.pdf` | 22 |
| `execution_evidence.zip` | 23 |
| Submission email + `technical_documentation.pdf`, `security_self_assessment.pdf` | 24 |

**2. Placeholder scan.** Tasks 1–20 quote complete code. Tasks 21–25 are verification/assembly tasks whose "code" is shell commands whose output is captured as evidence; the two places where the plan says "read the file and match what is there" (Task 20 Step 3, Task 22 Step 2) are deliberate because the exact selector/helper names cannot be known until the file is read, and those instructions name the specific file and the specific thing to match.

**3. Type consistency.** `AnthropicClient::messages()` returns the parsed shape `{content: string, tool_calls: list<{id, name, arguments}>, stop_reason: string}` (Task 2) and `AgentOrchestrator` (Task 18) consumes exactly those keys; `assistantTurn()` and `toolResultMessage()` take the parsed turn and the `{tool_use_id, output}` list respectively, and Task 18 supplies those shapes; the `tool`/`permission_tier`/`action_id` keys emitted in Tasks 11 and 18 are the same keys the frontend types in `types/copilot.ts` and the confirm endpoint in Task 12 expect.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-16-ai-copilot-finish-verify-submit.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batched with checkpoints for review.

Which approach?