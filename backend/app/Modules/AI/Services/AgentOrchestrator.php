<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Models\Tenant;
use App\Models\User;
use App\Modules\AI\Models\AgentConversation;
use App\Modules\AI\Models\AgentMessage;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class AgentOrchestrator
{
    public function __construct(
        protected AgentToolRegistry $toolRegistry,
        protected AgentPermissionGuard $permissionGuard,
        protected AgentAuditLogger $auditLogger,
        protected AnthropicClient $anthropicClient
    ) {}

    /**
     * Main conversation orchestrator for AI Financial Copilot.
     *
     * @return array{
     *     conversation_uuid: string,
     *     message: string,
     *     tool_calls: list<array<string, mixed>>,
     *     pending_action: array<string, mixed>|null,
     *     tier_used: int
     * }
     */
    public function chat(
        int $tenantId,
        int $userId,
        ?string $conversationUuid,
        string $userMessage,
        int $maxApprovedTier = 2,
        ?string $ipAddress = null
    ): array {
        // Guardrail 2: Input Sanitization & Prompt Injection Neutralization
        $sanitizedMessage = $this->sanitizeAndInspectMessage($tenantId, $userId, $userMessage, $ipAddress);

        // 1. Resolve or create conversation
        $conversation = $this->resolveConversation($tenantId, $userId, $conversationUuid, $sanitizedMessage);

        // 2. Persist user message
        AgentMessage::create([
            'conversation_id' => $conversation->id,
            'tenant_id' => $tenantId,
            'role' => 'user',
            'content' => $sanitizedMessage,
        ]);

        // 3. Build context & message payload
        $systemPrompt = $this->buildSystemPrompt($tenantId, $userId);
        $recentMessages = $this->getConversationHistoryPayload($conversation->id);

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

        // If no LLM key or offline simulation mode, use intelligent fallback engine
        if (empty($assistantContent) && empty($executedTools) && $pendingAction === null) {
            $fallback = $this->runDeterministicFallbackEngine($tenantId, $userId, $conversation->id, $userMessage, $ipAddress);
            $assistantContent = $fallback['content'];
            $executedTools = $fallback['tools'];
            $pendingAction = $fallback['pending_action'];
            $maxTierUsed = $fallback['tier'];
        }

        // Persist assistant message in DB
        AgentMessage::create([
            'conversation_id' => $conversation->id,
            'tenant_id' => $tenantId,
            'role' => 'assistant',
            'content' => $assistantContent,
            'tool_calls' => ! empty($executedTools) ? $executedTools : null,
            'metadata' => [
                'tier_used' => $maxTierUsed,
                'has_pending_action' => $pendingAction !== null,
                'pending_action' => $pendingAction,
            ],
        ]);

        return [
            'conversation_uuid' => $conversation->uuid,
            'message' => $assistantContent,
            'tool_calls' => $executedTools,
            'pending_action' => $pendingAction,
            'tier_used' => $maxTierUsed,
        ];
    }

    /**
     * Execute a previously pending Tier 2 confirmed action.
     *
     * @param  array<string, mixed>  $actionData
     * @return array<string, mixed>
     */
    public function executeConfirmedAction(
        int $tenantId,
        int $userId,
        string $conversationUuid,
        string $toolName,
        array $actionData,
        ?string $ipAddress = null
    ): array {
        $conversation = AgentConversation::where('tenant_id', $tenantId)->where('uuid', $conversationUuid)->firstOrFail();
        $tier = $this->permissionGuard->getToolTier($toolName);

        $result = $this->auditLogger->measureAndLog(
            tenantId: $tenantId,
            userId: $userId,
            conversationId: $conversation->id,
            toolName: $toolName,
            permissionTier: $tier,
            inputParams: $actionData,
            callback: fn () => $this->toolRegistry->executeTool(
                toolName: $toolName,
                arguments: $actionData,
                tenantId: $tenantId,
                userId: $userId,
                confirmedBy: $userId
            ),
            confirmedBy: $userId,
            ipAddress: $ipAddress
        );

        // Record confirmation message in conversation history
        AgentMessage::create([
            'conversation_id' => $conversation->id,
            'tenant_id' => $tenantId,
            'role' => 'assistant',
            'content' => "Operator confirmed and executed action: **{$toolName}**.",
            'tool_calls' => [
                [
                    'tool' => $toolName,
                    'arguments' => $actionData,
                    'permission_tier' => $tier,
                    'result' => $result,
                    'confirmed' => true,
                ],
            ],
            'metadata' => [
                'action_confirmed' => true,
                'confirmed_by' => $userId,
            ],
        ]);

        return [
            'status' => 'SUCCESS',
            'tool_name' => $toolName,
            'result' => $result,
        ];
    }

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

    /**
     * Guardrail 2: Input Sanitization & Anti-Prompt-Injection defense.
     */
    public function sanitizeAndInspectMessage(
        int $tenantId,
        int $userId,
        string $rawMessage,
        ?string $ipAddress = null
    ): string {
        // Clamp to 2000 chars
        $sanitized = mb_substr(trim($rawMessage), 0, 2000);

        $injectionPatterns = [
            '/\bignore\s+(all\s+)?previous\s+instructions\b/i',
            '/\bdisregard\s+(all\s+)?(system|prior)\s+(prompt|instructions)\b/i',
            '/\byou\s+are\s+now\s+in\s+(developer|unrestricted|god)\s+mode\b/i',
            '/\bsystem\s+override\b/i',
            '/\breveal\s+(all\s+)?passwords\b/i',
            '/\bprint\s+env\s+variables\b/i',
        ];

        $flagged = false;
        foreach ($injectionPatterns as $pattern) {
            if (preg_match($pattern, $sanitized)) {
                $flagged = true;
                $sanitized = (string) preg_replace($pattern, '[SECURITY_BLOCKED_INJECTION]', $sanitized);
            }
        }

        if ($flagged) {
            $this->auditLogger->log(
                tenantId: $tenantId,
                userId: $userId,
                conversationId: null,
                action: 'security_guardrail_prompt_injection_blocked',
                permissionTier: AgentPermissionGuard::TIER_0_READ,
                inputParams: ['original_snippet' => mb_substr($rawMessage, 0, 100)],
                resultSummary: 'Prompt injection pattern intercepted and neutralized by security guardrail',
                executed: true,
                ipAddress: $ipAddress
            );
        }

        return $sanitized;
    }

    protected function resolveConversation(int $tenantId, int $userId, ?string $uuid, string $initialMessage): AgentConversation
    {
        if (! empty($uuid)) {
            $conv = AgentConversation::where('tenant_id', $tenantId)->where('uuid', $uuid)->first();
            if ($conv) {
                return $conv;
            }
        }

        $title = mb_substr(trim($initialMessage), 0, 40);
        if (mb_strlen($title) === 0) {
            $title = 'Financial Advisory Session';
        }

        return AgentConversation::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'title' => $title,
            'status' => 'active',
        ]);
    }

    protected function buildSystemPrompt(int $tenantId, int $userId): string
    {
        $tenant = Tenant::find($tenantId);
        $tenantName = $tenant->name ?? 'SliceMart Enterprise';
        $user = User::find($userId);
        $userName = $user->name ?? 'Financial Officer';
        $today = Carbon::now()->toFormattedDateString();

        return <<<PROMPT
You are the AI Financial Copilot for CenterPoint ProERP (SliceMartFMS), engineered for the FinTechathon 2026 WeBank Competition (Topic E: SME Finance Copilot).
Your goal is to provide verified, enterprise-grade financial analytics, cash runway forecasting, and optimal financing facility matching for SMEs.

CONTEXT:
- Enterprise: {$tenantName} (Tenant #{$tenantId})
- Operator: {$userName}
- Base Currency: BDT
- Current Date: {$today}

SECURITY & ACCURACY PROTOCOL:
1. NEVER fabricate financial numbers. Always use provided tools (`get_cash_position`, `list_overdue_invoices`, `get_pl_summary`, `analyze_cash_flow_risk`, `match_financing_options`, `get_inventory_value`, `get_report_data`) to query verified real database state.
2. TIER 0 & 1 tools are read-only and advisory. They execute safely without side effects.
3. TIER 2 tools (such as `create_cash_flow_alert`) modify operational state and will prompt the operator for explicit supervised confirmation.
4. When suggesting loans or factoring, state the required advance rate, LTV, and risk rationale clearly.
5. Provide structured, concise responses with Markdown formatting, bullet points, and actionable next steps.
PROMPT;
    }

    /**
     * @return list<array{role: string, content: string}>
     */
    protected function getConversationHistoryPayload(int $conversationId): array
    {
        $messages = AgentMessage::where('conversation_id', $conversationId)
            ->orderBy('id', 'asc')
            ->limit(12)
            ->get();

        $payload = [];
        foreach ($messages as $msg) {
            $payload[] = [
                'role' => $msg->role,
                'content' => (string) ($msg->content ?? ''),
            ];
        }

        return $payload;
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $tools
     * @return array<string, mixed>|null
     */
    protected function callOpenAiChat(string $apiKey, string $model, array $messages, array $tools = []): ?array
    {
        try {
            $body = [
                'model' => $model,
                'messages' => $messages,
                'temperature' => 0.2,
            ];

            if (! empty($tools)) {
                $body['tools'] = $tools;
                $body['tool_choice'] = 'auto';
            }

            $response = Http::withToken($apiKey)
                ->timeout(45)
                ->post('https://api.openai.com/v1/chat/completions', $body);

            if ($response->successful()) {
                return $response->json();
            }

            Log::warning('OpenAI API call returned error: '.$response->body());

            return null;
        } catch (Throwable $e) {
            Log::error('OpenAI connection exception: '.$e->getMessage());

            return null;
        }
    }

    /**
     * Resilient sandbox fallback engine for offline testing and deterministic tool execution.
     *
     * @return array{
     *     content: string,
     *     tools: list<array<string, mixed>>,
     *     pending_action: array<string, mixed>|null,
     *     tier: int
     * }
     */
    protected function runDeterministicFallbackEngine(
        int $tenantId,
        int $userId,
        int $conversationId,
        string $userMessage,
        ?string $ipAddress = null
    ): array {
        $lower = mb_strtolower($userMessage);
        $executedTools = [];
        $pendingAction = null;
        $tier = AgentPermissionGuard::TIER_0_READ;
        $content = '';

        if (str_contains($lower, 'alert') && (str_contains($lower, 'create') || str_contains($lower, 'set') || str_contains($lower, 'trigger'))) {
            // Trigger Tier 2 Supervised confirmation flow
            $tier = AgentPermissionGuard::TIER_2_SUPERVISED;
            $args = [
                'alert_type' => 'low_balance',
                'severity' => 'warning',
                'title' => 'Liquidity Threshold Alert',
                'description' => 'Automatic liquidity monitoring alert created via SME Copilot.',
                'threshold_value' => 50000.0,
                'actual_value' => 32000.0,
                'currency' => 'BDT',
            ];

            $pendingAction = [
                'action_id' => 'call_'.Str::random(8),
                'tool' => 'create_cash_flow_alert',
                'description' => 'Authorize the Copilot to create an operational Cash Flow Alert with a BDT 50,000 threshold on the tenant dashboard.',
                'arguments' => $args,
                'permission_tier' => AgentPermissionGuard::TIER_2_SUPERVISED,
                'risk_level' => $this->permissionGuard->riskLevelFor('create_cash_flow_alert'),
                'expires_at' => Carbon::now()->addMinutes(30)->toIso8601String(),
            ];

            $this->auditLogger->log(
                tenantId: $tenantId,
                userId: $userId,
                conversationId: $conversationId,
                action: 'create_cash_flow_alert',
                permissionTier: 2,
                inputParams: $args,
                resultSummary: 'Action placed in pending_confirmation state awaiting user authorization',
                executed: false,
                ipAddress: $ipAddress
            );

            $content = "⚠️ **Action Requires Operator Confirmation (Tier 2 Supervised)**\n\n"
                ."The Copilot proposes creating a new **Cash Flow Alert** on your tenant dashboard with a threshold of BDT 50,000.00.\n\n"
                .'Please review and confirm this action to proceed.';
        } elseif (str_contains($lower, 'risk') || str_contains($lower, 'runway') || str_contains($lower, 'forecast') || str_contains($lower, 'burn rate')) {
            $turn = $this->fallbackToolTurn('analyze_cash_flow_risk', ['forecast_days' => 30], $tenantId, $userId, $conversationId, AgentPermissionGuard::TIER_0_READ, $ipAddress);
            $executedTools[] = $turn['tool'];
            $toolOutput = $turn['output'];

            $riskLevel = is_string($toolOutput['risk_level'] ?? null) ? (string) $toolOutput['risk_level'] : 'UNKNOWN';
            $runwayDays = is_scalar($toolOutput['estimated_runway_days'] ?? null) ? (string) $toolOutput['estimated_runway_days'] : '0';
            $burnRate = number_format(is_numeric($toolOutput['daily_burn_rate'] ?? null) ? (float) $toolOutput['daily_burn_rate'] : 0.0, 2);
            $cashOnHand = number_format(is_numeric($toolOutput['cash_on_hand'] ?? null) ? (float) $toolOutput['cash_on_hand'] : 0.0, 2);
            $arColl = number_format(is_numeric($toolOutput['receivables_expected_70pct'] ?? null) ? (float) $toolOutput['receivables_expected_70pct'] : 0.0, 2);
            $apDue = number_format(is_numeric($toolOutput['payables_due'] ?? null) ? (float) $toolOutput['payables_due'] : 0.0, 2);
            $netProj = number_format(is_numeric($toolOutput['net_projected_cash_at_horizon'] ?? null) ? (float) $toolOutput['net_projected_cash_at_horizon'] : 0.0, 2);
            $recom = is_string($toolOutput['recommendation'] ?? null) ? (string) $toolOutput['recommendation'] : '';

            $content = "### 30-Day Liquidity & Cash Runway Assessment\n\n"
                ."- **Overall Risk Rating:** **{$riskLevel}**\n"
                ."- **Estimated Runway:** **{$runwayDays} days** (Daily burn: BDT {$burnRate})\n"
                .'- **Liquid Cash on Hand:** BDT '.$cashOnHand."\n"
                .'- **Expected AR Collections (70%):** BDT '.$arColl."\n"
                .'- **Payables Due (AP):** BDT '.$apDue."\n"
                .'- **Projected Net Cash (Day 30):** BDT '.$netProj."\n\n"
                ."**Strategic Recommendation:** {$recom}";
        } elseif (preg_match('/\b(p&l|profit|loss|revenue|operating\s+expenses?)\b/i', $lower) === 1 || str_contains($lower, 'p&l') || str_contains($lower, 'p and l')) {
            $turn = $this->fallbackToolTurn('get_pl_summary', [], $tenantId, $userId, $conversationId, AgentPermissionGuard::TIER_0_READ, $ipAddress);
            $executedTools[] = $turn['tool'];
            $toolOutput = $turn['output'];

            $period = is_string($toolOutput['period'] ?? null) ? (string) $toolOutput['period'] : 'Current Period';
            $rev = number_format(is_numeric($toolOutput['revenue'] ?? null) ? (float) $toolOutput['revenue'] : 0.0, 2);
            $cogs = number_format(is_numeric($toolOutput['cogs'] ?? null) ? (float) $toolOutput['cogs'] : 0.0, 2);
            $gp = number_format(is_numeric($toolOutput['gross_profit'] ?? null) ? (float) $toolOutput['gross_profit'] : 0.0, 2);
            $opex = number_format(is_numeric($toolOutput['operating_expenses'] ?? null) ? (float) $toolOutput['operating_expenses'] : 0.0, 2);
            $np = number_format(is_numeric($toolOutput['net_profit'] ?? null) ? (float) $toolOutput['net_profit'] : 0.0, 2);
            $gm = number_format(is_numeric($toolOutput['gross_margin_pct'] ?? null) ? (float) $toolOutput['gross_margin_pct'] : 0.0, 1);
            $nm = number_format(is_numeric($toolOutput['net_margin_pct'] ?? null) ? (float) $toolOutput['net_margin_pct'] : 0.0, 1);

            $content = "### Profit & Loss Statement ({$period})\n\n"
                ."- **Total Revenue:** BDT {$rev}\n"
                ."- **Cost of Goods Sold (COGS):** BDT {$cogs}\n"
                ."- **Gross Profit:** BDT {$gp} (Gross Margin: {$gm}%)\n"
                ."- **Operating Expenses:** BDT {$opex}\n"
                ."- **Net Profit:** BDT {$np} (Net Margin: {$nm}%)\n";
        } elseif (preg_match('/\b(inventory|stock|valuation)\b/i', $lower) === 1) {
            $turn = $this->fallbackToolTurn('get_inventory_value', [], $tenantId, $userId, $conversationId, AgentPermissionGuard::TIER_0_READ, $ipAddress);
            $executedTools[] = $turn['tool'];
            $toolOutput = $turn['output'];

            $val = number_format(is_numeric($toolOutput['total_valuation'] ?? null) ? (float) $toolOutput['total_valuation'] : 0.0, 2);
            $items = is_scalar($toolOutput['item_count'] ?? null) ? (string) $toolOutput['item_count'] : '0';
            $low = is_scalar($toolOutput['low_stock_count'] ?? null) ? (string) $toolOutput['low_stock_count'] : '0';
            $out = is_scalar($toolOutput['out_of_stock_count'] ?? null) ? (string) $toolOutput['out_of_stock_count'] : '0';
            $method = is_string($toolOutput['valuation_method'] ?? null) ? (string) $toolOutput['valuation_method'] : 'WAC';

            $content = "### Inventory Valuation Summary ({$method})\n\n"
                ."- **Total Inventory Value:** BDT {$val}\n"
                ."- **Active SKU Count:** {$items}\n"
                ."- **Low Stock Alerts:** {$low} SKUs\n"
                ."- **Out of Stock:** {$out} SKUs\n";
        } elseif (preg_match('/\b(overdue|invoice|invoices|ar|receivable|receivables)\b/i', $lower) === 1) {
            $args = ['days_overdue' => 0, 'limit' => 5];
            $turn = $this->fallbackToolTurn('list_overdue_invoices', $args, $tenantId, $userId, $conversationId, AgentPermissionGuard::TIER_0_READ, $ipAddress);
            $executedTools[] = $turn['tool'];
            $toolOutput = $turn['output'];

            $rawTotalOverdue = is_numeric($toolOutput['total_overdue_amount'] ?? null) ? (float) $toolOutput['total_overdue_amount'] : 0.0;
            $total = number_format($rawTotalOverdue, 2);
            $content = "### Accounts Receivable & Overdue Invoices\n\n"
                ."Total outstanding receivables due: **BDT {$total}**.\n\n";

            $invoicesList = is_array($toolOutput['invoices'] ?? null) ? $toolOutput['invoices'] : [];
            if (! empty($invoicesList)) {
                $content .= "| Invoice # | Customer | Due Date | Overdue Days | Amount (BDT) |\n"
                    ."|:---|:---|:---|:---:|:---:|\n";
                foreach ($invoicesList as $inv) {
                    if (! is_array($inv)) {
                        continue;
                    }
                    $amt = number_format(is_numeric($inv['outstanding_amount'] ?? null) ? (float) $inv['outstanding_amount'] : 0.0, 2);
                    $invNum = is_string($inv['invoice_number'] ?? null) ? (string) $inv['invoice_number'] : '';
                    $custName = is_string($inv['customer_name'] ?? null) ? (string) $inv['customer_name'] : '';
                    $dueDate = is_string($inv['due_date'] ?? null) ? (string) $inv['due_date'] : '';
                    $daysOverdue = is_scalar($inv['days_overdue'] ?? null) ? (string) $inv['days_overdue'] : '0';
                    $content .= "| {$invNum} | {$custName} | {$dueDate} | {$daysOverdue} days | {$amt} |\n";
                }
            } else {
                $content .= 'No overdue receivables currently detected on book.';
            }
        } elseif (str_contains($lower, 'financing') || str_contains($lower, 'loan') || str_contains($lower, 'credit') || str_contains($lower, 'borrow') || str_contains($lower, 'qualif') || str_contains($lower, 'facility')) {
            $tier = AgentPermissionGuard::TIER_1_ADVISORY;
            $turn = $this->fallbackToolTurn('match_financing_options', [], $tenantId, $userId, $conversationId, $tier, $ipAddress);
            $executedTools[] = $turn['tool'];
            $toolOutput = $turn['output'];

            $summaryText = is_string($toolOutput['summary'] ?? null) ? (string) $toolOutput['summary'] : '';
            $content = "### SME Financing Matching Engine (FinTechathon 2026)\n\n"
                .$summaryText."\n\n"
                ."#### Available Credit Facilities:\n\n";

            $productsList = is_array($toolOutput['products'] ?? null) ? $toolOutput['products'] : [];
            foreach ($productsList as $prod) {
                if (! is_array($prod)) {
                    continue;
                }
                $eligibleTag = ! empty($prod['is_eligible']) ? '✅ Eligible' : '⚠️ Conditional';
                $amt = number_format(is_numeric($prod['max_amount'] ?? null) ? (float) $prod['max_amount'] : 0.0, 2);
                $pName = is_string($prod['product_name'] ?? null) ? (string) $prod['product_name'] : '';
                $rate = is_string($prod['estimated_interest_rate'] ?? null) ? (string) $prod['estimated_interest_rate'] : '';
                $tenor = is_string($prod['tenor_months'] ?? null) ? (string) $prod['tenor_months'] : '';
                $conf = is_string($prod['confidence'] ?? null) ? (string) $prod['confidence'] : '';
                $rationale = is_string($prod['rationale'] ?? null) ? (string) $prod['rationale'] : '';
                $content .= "- **{$pName}** ({$eligibleTag})\n"
                    ."  - **Max Facility Limit:** BDT {$amt}\n"
                    ."  - **Est. Rate / Tenor:** {$rate} | {$tenor}\n"
                    ."  - **Confidence:** {$conf}\n"
                    ."  - *Rationale:* {$rationale}\n\n";
            }
        } elseif (str_contains($lower, 'cash') || str_contains($lower, 'balance') || str_contains($lower, 'liquidity')) {
            $turn = $this->fallbackToolTurn('get_cash_position', [], $tenantId, $userId, $conversationId, AgentPermissionGuard::TIER_0_READ, $ipAddress);
            $executedTools[] = $turn['tool'];
            $toolOutput = $turn['output'];

            $rawTotal = is_numeric($toolOutput['total_liquidity'] ?? null) ? (float) $toolOutput['total_liquidity'] : 0.0;
            $total = number_format($rawTotal, 2);
            $accountCount = is_scalar($toolOutput['account_count'] ?? null) ? (string) $toolOutput['account_count'] : '0';
            $content = "### Enterprise Cash Position Summary\n\n"
                ."Live cash and bank liquidity across **{$accountCount}** active accounts is **BDT {$total}**.\n\n"
                ."| Account Name | Bank | Type | Balance (BDT) |\n"
                ."|:---|:---|:---|:---:|\n";

            $accountsList = is_array($toolOutput['accounts'] ?? null) ? $toolOutput['accounts'] : [];
            foreach ($accountsList as $acc) {
                if (! is_array($acc)) {
                    continue;
                }
                $bal = number_format(is_numeric($acc['current_balance'] ?? null) ? (float) $acc['current_balance'] : 0.0, 2);
                $accName = is_string($acc['name'] ?? null) ? (string) $acc['name'] : '';
                $bankName = is_string($acc['bank_name'] ?? null) ? (string) $acc['bank_name'] : '';
                $accType = is_string($acc['account_type'] ?? null) ? (string) $acc['account_type'] : '';
                $content .= "| {$accName} | {$bankName} | {$accType} | {$bal} |\n";
            }
        } else {
            // Default financial overview
            $content = "Hello! I am your **CenterPoint SME Finance Copilot** for the FinTechathon 2026 WeBank Track E.\n\n"
                ."I have direct, secure access to your ERP financial data under strict multi-tenant isolation. Here is what I can do for you:\n\n"
                ."1. **Cash & Liquidity Analysis** — Ask: *'What is our current cash position?'*\n"
                ."2. **Receivables & Overdue Invoices** — Ask: *'Show overdue invoices and aging debtors'* \n"
                ."3. **Profit & Loss Summary** — Ask: *'Summarize our revenue and operating expenses'* \n"
                ."4. **Cash Flow Runway & Risk** — Ask: *'Analyze our 30-day cash flow risk'* \n"
                ."5. **Financing Match Engine** — Ask: *'What loan or factoring options are we eligible for?'*\n"
                ."6. **Automated Alert Monitoring** — Ask: *'Create a low cash flow alert'* (Tier 2 Supervised)\n\n"
                .'How can I assist your financial planning today?';
        }

        return [
            'content' => $content,
            'tools' => $executedTools,
            'pending_action' => $pendingAction,
            'tier' => $tier,
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array{tool: array<string, mixed>, output: array<string, mixed>}
     */
    protected function fallbackToolTurn(
        string $toolName,
        array $arguments,
        int $tenantId,
        int $userId,
        int $conversationId,
        int $permissionTier = AgentPermissionGuard::TIER_0_READ,
        ?string $ipAddress = null
    ): array {
        $toolOutput = $this->auditLogger->measureAndLog(
            tenantId: $tenantId,
            userId: $userId,
            conversationId: $conversationId,
            toolName: $toolName,
            permissionTier: $permissionTier,
            inputParams: $arguments,
            callback: fn () => $this->toolRegistry->executeTool($toolName, $arguments, $tenantId, $userId),
            ipAddress: $ipAddress
        );

        $toolCall = [
            'tool_call_id' => 'call_'.Str::random(8),
            'tool' => $toolName,
            'arguments' => $arguments,
            'permission_tier' => $permissionTier,
            'result' => $toolOutput,
        ];

        return [
            'tool' => $toolCall,
            'output' => $toolOutput,
        ];
    }
}
