<?php

declare(strict_types=1);

namespace App\Modules\Platform\Services;

use App\Models\Tenant;
use App\Models\User;
use App\Modules\AI\Models\AgentConversation;
use App\Modules\AI\Models\AgentMessage;
use App\Modules\AI\Services\AgentAuditLogger;
use App\Modules\AI\Services\AgentPermissionGuard;
use App\Modules\AI\Services\UnifiedLLMClient;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Brain Orchestrator — the unified intelligence layer for the Operations AI Brain.
 *
 * Combines the full 20-tool ERP registry with the battle-tested Copilot agentic
 * pipeline (Tier 0/1/2 supervision, conversation persistence, audit logging).
 * Uses UnifiedLLMClient which respects tenant-level custom LLM configuration.
 */
class BrainOrchestrator
{
    public function __construct(
        protected BrainToolRegistry $toolRegistry,
        protected AgentPermissionGuard $permissionGuard,
        protected AgentAuditLogger $auditLogger,
        protected UnifiedLLMClient $llmClient
    ) {}

    // -----------------------------------------------------------------------
    // Main Chat Entry Point
    // -----------------------------------------------------------------------

    /**
     * @return array{
     *     conversation_uuid: string,
     *     message: string,
     *     tool_calls: list<array<string, mixed>>,
     *     pending_action: array<string, mixed>|null,
     *     tier_used: int,
     *     model_source: string
     * }
     */
    public function chat(
        int $tenantId,
        int $userId,
        ?string $conversationUuid,
        string $userMessage,
        ?string $ipAddress = null
    ): array {
        // Configure LLM client with tenant custom model (falls back to global .env)
        $this->llmClient->configureForTenant($tenantId);
        $modelSource = $this->llmClient->getConfigSource();

        // Guardrail: Input sanitization & prompt injection defense
        $sanitized = $this->sanitizeMessage($tenantId, $userId, $userMessage, $ipAddress);

        // Resolve or create conversation
        $conversation = $this->resolveConversation($tenantId, $userId, $conversationUuid, $sanitized);

        // Persist user message
        AgentMessage::create([
            'conversation_id' => $conversation->id,
            'tenant_id'       => $tenantId,
            'role'            => 'user',
            'content'         => $sanitized,
        ]);

        // Build LLM context
        $systemPrompt   = $this->buildSystemPrompt($tenantId, $userId);
        $recentMessages = $this->getConversationHistory($conversation->id);
        $history        = $this->llmClient->historyToMessages($recentMessages);

        // ── LLM Agentic Loop ────────────────────────────────────────────
        $executedTools  = [];
        $pendingAction  = null;
        $maxTierUsed    = AgentPermissionGuard::TIER_0_READ;
        $assistantContent = '';

        if ($this->llmClient->isConfigured()) {
            $turn = $this->llmClient->messages(
                $systemPrompt,
                $history,
                $this->toolRegistry->getAnthropicToolSchemas()
            );

            if ($turn !== null) {
                $assistantContent = $turn['content'];
                $toolResultBlocks = [];

                foreach ($turn['tool_calls'] as $toolCall) {
                    $toolName  = $toolCall['name'];
                    $toolArgs  = $toolCall['arguments'];
                    $toolUseId = $toolCall['id'] !== '' ? $toolCall['id'] : (string) Str::uuid();
                    $tier      = $this->permissionGuard->getToolTier($toolName);
                    $maxTierUsed = max($maxTierUsed, $tier);

                    if ($this->permissionGuard->requiresConfirmation($toolName)) {
                        $pendingAction = [
                            'action_id'       => $toolUseId,
                            'tool'            => $toolName,
                            'description'     => "Confirm action: {$toolName} with parameters: ".json_encode($toolArgs),
                            'arguments'       => $toolArgs,
                            'permission_tier' => AgentPermissionGuard::TIER_2_SUPERVISED,
                            'risk_level'      => $this->permissionGuard->riskLevelFor($toolName),
                            'expires_at'      => now()->addMinutes(30)->toIso8601String(),
                        ];

                        $this->auditLogger->log(
                            tenantId: $tenantId,
                            userId: $userId,
                            conversationId: $conversation->id,
                            action: $toolName,
                            permissionTier: $tier,
                            inputParams: $toolArgs,
                            resultSummary: 'Brain: action placed in pending_confirmation state',
                            executed: false,
                            ipAddress: $ipAddress
                        );

                        break;
                    }

                    // Execute Tier 0 / Tier 1 tool
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
                        'tool_call_id'   => $toolUseId,
                        'tool'           => $toolName,
                        'arguments'      => $toolArgs,
                        'result'         => $toolOutput,
                        'permission_tier'=> $tier,
                    ];

                    $toolResultBlocks[] = [
                        'tool_use_id' => $toolUseId,
                        'output'      => $toolOutput,
                    ];
                }

                // Follow-up synthesis: ask model to compose answer from tool results
                if (! empty($toolResultBlocks) && $pendingAction === null) {
                    $followUpMessages = array_merge(
                        $history,
                        [$this->llmClient->assistantTurn($turn)],
                        [$this->llmClient->toolResultMessage($toolResultBlocks)]
                    );

                    $followUp = $this->llmClient->messages($systemPrompt, $followUpMessages, []);
                    if ($followUp !== null && $followUp['content'] !== '') {
                        $assistantContent = $followUp['content'];
                    }
                }
            }
        }

        // ── Deterministic Fallback (offline / unconfigured) ─────────────
        if (empty($assistantContent) && empty($executedTools) && $pendingAction === null) {
            $fallback         = $this->runDeterministicFallback($tenantId, $userId, $conversation->id, $sanitized, $ipAddress);
            $assistantContent = $fallback['content'];
            $executedTools    = $fallback['tools'];
            $pendingAction    = $fallback['pending_action'];
            $maxTierUsed      = $fallback['tier'];
        }

        // Persist assistant message
        AgentMessage::create([
            'conversation_id' => $conversation->id,
            'tenant_id'       => $tenantId,
            'role'            => 'assistant',
            'content'         => $assistantContent,
            'tool_calls'      => ! empty($executedTools) ? $executedTools : null,
            'metadata'        => [
                'tier_used'         => $maxTierUsed,
                'has_pending_action'=> $pendingAction !== null,
                'pending_action'    => $pendingAction,
                'model_source'      => $modelSource,
            ],
        ]);

        return [
            'conversation_uuid' => $conversation->uuid,
            'message'           => $assistantContent,
            'tool_calls'        => $executedTools,
            'pending_action'    => $pendingAction,
            'tier_used'         => $maxTierUsed,
            'model_source'      => $modelSource,
        ];
    }

    // -----------------------------------------------------------------------
    // Conversation History
    // -----------------------------------------------------------------------

    /**
     * @return list<array<string, mixed>>
     */
    public function getConversations(int $tenantId, int $userId): array
    {
        return AgentConversation::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->where('context_type', 'brain')
            ->orderByDesc('updated_at')
            ->limit(30)
            ->get(['id', 'uuid', 'title', 'created_at', 'updated_at'])
            ->toArray();
    }

    /**
     * @return array{conversation: AgentConversation, messages: list<AgentMessage>}
     */
    public function getConversationHistory(int $conversationId, bool $full = false): array
    {
        if ($full) {
            $messages = AgentMessage::where('conversation_id', $conversationId)
                ->orderBy('id', 'asc')
                ->get()
                ->toArray();

            return ['messages' => $messages];
        }

        // Return role/content pairs for LLM context
        return AgentMessage::where('conversation_id', $conversationId)
            ->orderBy('id', 'asc')
            ->limit(14)
            ->get(['role', 'content'])
            ->toArray();
    }

    // -----------------------------------------------------------------------
    // Tier 2 Confirmation
    // -----------------------------------------------------------------------

    /**
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
        $conversation = AgentConversation::where('tenant_id', $tenantId)
            ->where('uuid', $conversationUuid)
            ->firstOrFail();

        $message = AgentMessage::where('conversation_id', $conversation->id)
            ->where('role', 'assistant')
            ->orderBy('id', 'desc')
            ->get()
            ->first(function (AgentMessage $candidate) use ($actionId): bool {
                $metadata = is_array($candidate->metadata) ? $candidate->metadata : [];
                $pending  = $metadata['pending_action'] ?? null;
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
                    'pending_action'     => array_merge($pending, [
                        'status'           => 'REJECTED',
                        'rejection_reason' => $rejectionReason,
                    ]),
                ]),
            ]);

            $this->auditLogger->log(
                tenantId: $tenantId,
                userId: $userId,
                conversationId: $conversation->id,
                action: is_string($pending['tool'] ?? null) ? $pending['tool'] : 'unknown',
                permissionTier: AgentPermissionGuard::TIER_2_SUPERVISED,
                inputParams: is_array($pending['arguments'] ?? null) ? $pending['arguments'] : [],
                resultSummary: 'Brain: operator rejected action: '.($rejectionReason ?? 'no reason'),
                executed: false,
                ipAddress: $ipAddress
            );

            return ['executed' => false, 'action_id' => $actionId, 'reason' => $rejectionReason ?? 'Action rejected.'];
        }

        $toolName = is_string($pending['tool'] ?? null) ? (string) $pending['tool'] : '';
        $toolArgs = is_array($pending['arguments'] ?? null) ? $pending['arguments'] : [];
        $tier     = $this->permissionGuard->getToolTier($toolName);

        $result = $this->auditLogger->measureAndLog(
            tenantId: $tenantId,
            userId: $userId,
            conversationId: $conversation->id,
            toolName: $toolName,
            permissionTier: $tier,
            inputParams: $toolArgs,
            callback: fn () => $this->toolRegistry->executeTool($toolName, $toolArgs, $tenantId, $userId, $userId),
            confirmedBy: $userId,
            ipAddress: $ipAddress
        );

        $message->update([
            'metadata' => array_merge($metadata, [
                'has_pending_action' => false,
                'pending_action'     => array_merge($pending, ['status' => 'CONFIRMED']),
            ]),
        ]);

        AgentMessage::create([
            'conversation_id' => $conversation->id,
            'tenant_id'       => $tenantId,
            'role'            => 'assistant',
            'content'         => "✅ Operator confirmed and executed action: **{$toolName}**.",
            'tool_calls'      => [['tool' => $toolName, 'arguments' => $toolArgs, 'permission_tier' => $tier, 'result' => $result, 'confirmed' => true]],
            'metadata'        => ['action_confirmed' => true, 'confirmed_by' => $userId],
        ]);

        return ['executed' => true, 'action_id' => $actionId, 'result' => $result];
    }

    // -----------------------------------------------------------------------
    // System Prompt — Financial Advisor + Operations Expert
    // -----------------------------------------------------------------------

    protected function buildSystemPrompt(int $tenantId, int $userId): string
    {
        $tenant     = Tenant::find($tenantId);
        $tenantName = $tenant?->name ?? 'Your Enterprise';
        $user       = User::find($userId);
        $userName   = $user?->name ?? 'Operator';
        $today      = Carbon::now()->toFormattedDateString();
        $currency   = 'BDT';

        return <<<PROMPT
You are the **Operations AI Financial Advisor** for CenterPoint ProERP — a senior, proactive intelligence layer with full access to the entire ERP platform.

## IDENTITY & ROLE
- You are not just a query responder. You are a **proactive Financial Advisor** and **ERP Operations Expert**.
- You have verified, real-time read access to: Sales, Finance (Cash/AR/AP), Inventory, Production, HR/Payroll, Purchasing, QC, Reports, and Platform modules.
- Your default currency is {$currency}. Always format numbers with comma separators and 2 decimal places.
- Today's date: {$today}

## CONTEXT
- Enterprise: **{$tenantName}** (Tenant #{$tenantId})
- Operator: **{$userName}**

## FINANCIAL ADVISORY MANDATE
1. When analyzing finances, ALWAYS look at the **complete picture**: cash + AR + AP + payroll + inventory.
2. **Proactively flag risks** you detect — e.g., if cash runway is < 30 days AND payroll is due, say so unprompted.
3. Give **specific, actionable recommendations** — not generic advice. Name amounts, dates, and concrete next steps.
4. For financing recommendations, always include eligibility scores and specific product names.
5. Clearly state your confidence level when data is limited.

## TOOL USAGE RULES
- **NEVER fabricate financial numbers.** Always call a tool to get real data from the database.
- If a tool returns empty or zero data, report that honestly — do not estimate.
- Call multiple tools in sequence when a question spans multiple modules (e.g., cash + payroll + AR for liquidity analysis).
- Use `get_report_data` for complex cross-module reports.
- Use `dispatch_navigation` when the user wants to go to a specific module.

## PERMISSION TIERS
- **Tier 0** (auto-execute): All read/analysis operations — cash, AR, AP, inventory, sales, payroll, QC, production.
- **Tier 1** (advisory): Financing recommendations, payroll alerts — present findings clearly.
- **Tier 2** (supervised): State mutations like `create_cash_flow_alert` — require explicit operator confirmation before executing.

## RESPONSE FORMAT
- Use **markdown** with bold numbers, headers, and bullet points.
- Lead with the most critical insight.
- End with 1–3 specific recommended actions.
- Keep responses concise but complete. Prefer data tables for comparative data.
PROMPT;
    }

    // -----------------------------------------------------------------------
    // Internal Helpers
    // -----------------------------------------------------------------------

    protected function resolveConversation(int $tenantId, int $userId, ?string $uuid, string $initialMessage): AgentConversation
    {
        if (! empty($uuid)) {
            $conv = AgentConversation::where('tenant_id', $tenantId)->where('uuid', $uuid)->first();
            if ($conv) {
                return $conv;
            }
        }

        $title = mb_substr(trim($initialMessage), 0, 50);
        if (mb_strlen($title) === 0) {
            $title = 'Operations Advisory Session';
        }

        return AgentConversation::create([
            'tenant_id'    => $tenantId,
            'user_id'      => $userId,
            'title'        => $title,
            'status'       => 'active',
            'context_type' => 'brain',
        ]);
    }

    public function sanitizeMessage(int $tenantId, int $userId, string $raw, ?string $ipAddress): string
    {
        $sanitized = mb_substr(trim($raw), 0, 2000);

        $patterns = [
            '/\bignore\s+(all\s+)?previous\s+instructions\b/i',
            '/\bdisregard\s+(all\s+)?(system|prior)\s+(prompt|instructions)\b/i',
            '/\byou\s+are\s+now\s+in\s+(developer|unrestricted|god)\s+mode\b/i',
            '/\bsystem\s+override\b/i',
            '/\breveal\s+(all\s+)?passwords\b/i',
            '/\bprint\s+env\s+variables\b/i',
        ];

        $flagged = false;
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $sanitized)) {
                $flagged   = true;
                $sanitized = (string) preg_replace($pattern, '[SECURITY_BLOCKED]', $sanitized);
            }
        }

        if ($flagged) {
            $this->auditLogger->log(
                tenantId: $tenantId,
                userId: $userId,
                conversationId: null,
                action: 'brain_security_prompt_injection_blocked',
                permissionTier: AgentPermissionGuard::TIER_0_READ,
                inputParams: ['snippet' => mb_substr($raw, 0, 100)],
                resultSummary: 'Prompt injection intercepted by Brain security guardrail',
                executed: true,
                ipAddress: $ipAddress
            );
        }

        return $sanitized;
    }

    /**
     * Deterministic fallback when LLM is not configured / offline.
     * Routes to the existing SliceMartBrainService for backward compatibility.
     *
     * @return array{content: string, tools: list<array<string, mixed>>, pending_action: array<string, mixed>|null, tier: int}
     */
    protected function runDeterministicFallback(
        int $tenantId,
        int $userId,
        int $conversationId,
        string $userMessage,
        ?string $ipAddress
    ): array {
        $lower   = mb_strtolower($userMessage);
        $tools   = [];
        $pending = null;
        $tier    = AgentPermissionGuard::TIER_0_READ;
        $content = '';

        // Financial advisory quick-dispatch
        if (str_contains($lower, 'payroll') && str_contains($lower, 'can') || str_contains($lower, 'payroll alert')) {
            $result = $this->toolRegistry->executeTool('get_payroll_alert', [], $tenantId, $userId);
            $tools[]   = ['tool' => 'get_payroll_alert', 'result' => $result, 'permission_tier' => AgentPermissionGuard::TIER_1_ADVISORY];
            $content   = "### Payroll Cash Coverage Analysis\n\n"
                ."- **Payroll Due:** BDT ".number_format((float) ($result['payroll_due'] ?? 0), 2)."\n"
                ."- **Cash Available:** BDT ".number_format((float) ($result['cash_available'] ?? 0), 2)."\n"
                ."- **Gap:** BDT ".number_format((float) ($result['cash_gap'] ?? 0), 2)."\n"
                ."- **Risk:** ".strtoupper((string) ($result['risk'] ?? 'unknown'))."\n\n"
                ."**Recommendation:** ".(string) ($result['recommendation'] ?? '');
        } elseif (str_contains($lower, 'cash') || str_contains($lower, 'balance') || str_contains($lower, 'liquidity') || str_contains($lower, 'runway')) {
            $result  = $this->toolRegistry->executeTool('get_cash_position', [], $tenantId, $userId);
            $tools[] = ['tool' => 'get_cash_position', 'result' => $result, 'permission_tier' => AgentPermissionGuard::TIER_0_READ];
            $content = "### Cash Position Summary\n\n"
                ."Total liquid cash: **BDT ".number_format((float) ($result['total_liquid_cash'] ?? 0), 2)."**\n"
                ."Runway: **".(string) ($result['runway_days'] ?? 0)." days** | Daily burn: BDT ".number_format((float) ($result['daily_burn_rate'] ?? 0), 2);
        } elseif (str_contains($lower, 'sales') || str_contains($lower, 'revenue')) {
            $result  = $this->toolRegistry->executeTool('get_sales_summary', [], $tenantId, $userId);
            $tools[] = ['tool' => 'get_sales_summary', 'result' => $result, 'permission_tier' => AgentPermissionGuard::TIER_0_READ];
            $content = "### Sales Summary\n\n"
                ."Revenue: **BDT ".number_format((float) ($result['total_revenue'] ?? 0), 2)."**\n"
                ."Collected: BDT ".number_format((float) ($result['collected_cash'] ?? 0), 2)." | Open AR: BDT ".number_format((float) ($result['open_ar'] ?? 0), 2);
        } elseif (preg_match('/\b(overdue|invoice|receivable|ar)\b/i', $lower)) {
            $result  = $this->toolRegistry->executeTool('list_overdue_invoices', ['limit' => 5], $tenantId, $userId);
            $tools[] = ['tool' => 'list_overdue_invoices', 'result' => $result, 'permission_tier' => AgentPermissionGuard::TIER_0_READ];
            $content = "### Overdue Receivables\n\nTotal overdue: **BDT ".number_format((float) ($result['total_overdue'] ?? 0), 2)."**";
        } elseif (preg_match('/\b(stock|inventory|warehouse)\b/i', $lower)) {
            $result  = $this->toolRegistry->executeTool('get_stock_level', [], $tenantId, $userId);
            $tools[] = ['tool' => 'get_stock_level', 'result' => $result, 'permission_tier' => AgentPermissionGuard::TIER_0_READ];
            $content = "### Inventory Valuation\n\nTotal value: **BDT ".number_format((float) ($result['total_valuation'] ?? 0), 2)."** | Items: ".(string) ($result['item_count'] ?? 0)." | Low stock: ".(string) ($result['low_stock_count'] ?? 0);
        } elseif (preg_match('/\b(payroll|salary|wages|hr|staff)\b/i', $lower)) {
            $result  = $this->toolRegistry->executeTool('get_payroll_summary', [], $tenantId, $userId);
            $tools[] = ['tool' => 'get_payroll_summary', 'result' => $result, 'permission_tier' => AgentPermissionGuard::TIER_0_READ];
            $content = "### Payroll Summary — ".(string) ($result['period'] ?? 'Current Period')."\n\nGross: **BDT ".number_format((float) ($result['gross_wages'] ?? 0), 2)."** | Net Pay: BDT ".number_format((float) ($result['net_pay'] ?? 0), 2)." | Staff: ".(string) ($result['employee_count'] ?? 0);
        } elseif (preg_match('/\b(production|batch|manufacturing|shopfloor)\b/i', $lower)) {
            $result  = $this->toolRegistry->executeTool('get_production_status', [], $tenantId, $userId);
            $tools[] = ['tool' => 'get_production_status', 'result' => $result, 'permission_tier' => AgentPermissionGuard::TIER_0_READ];
            $content = "### Production Status\n\nIn progress: **".(string) ($result['in_progress'] ?? 0)." batches** | Completed today: ".(string) ($result['completed_today'] ?? 0);
        } elseif (preg_match('/\b(p&l|profit|loss|margin)\b/i', $lower)) {
            $result  = $this->toolRegistry->executeTool('get_pl_summary', [], $tenantId, $userId);
            $tools[] = ['tool' => 'get_pl_summary', 'result' => $result, 'permission_tier' => AgentPermissionGuard::TIER_0_READ];
            $content = "### Profit & Loss Summary\n\nRevenue: **BDT ".number_format((float) ($result['total_revenue'] ?? 0), 2)."** | Net Income: BDT ".number_format((float) ($result['net_operating_income'] ?? 0), 2)." | Net Margin: ".(string) ($result['net_margin_pct'] ?? 0)."%";
        } else {
            $content = "Hello! I'm your **Operations AI Financial Advisor** for CenterPoint ProERP.\n\n"
                ."I have real-time access to all ERP modules. Try asking:\n\n"
                ."- 💰 *'What is our cash runway and burn rate?'*\n"
                ."- 📊 *'Show this month's P&L summary'*\n"
                ."- 📦 *'What is our inventory valuation?'*\n"
                ."- 👥 *'Can we meet payroll from current cash?'*\n"
                ."- ⚠️ *'List overdue customer invoices'*\n"
                ."- 🏭 *'Show active production batches'*\n"
                ."- 💼 *'Match financing options for working capital'*";
        }

        return ['content' => $content, 'tools' => $tools, 'pending_action' => $pending, 'tier' => $tier];
    }
}
