<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\AI\Models\AgentConversation;
use App\Modules\Platform\Services\AIBrainService;
use App\Modules\Platform\Services\BrainOrchestrator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * AI Brain Controller — Operations AI Financial Advisor.
 *
 * Routes:
 *   POST /api/ai-brain/ask            → ask()              (single-turn JSON)
 *   GET  /api/ai-brain/stream         → stream()           (SSE streaming)
 *   POST /api/ai-brain/tool           → callTool()
 *   GET  /api/ai-brain/capabilities   → capabilities()
 *   POST /api/ai-brain/execute        → execute()
 *   GET  /api/ai-brain/conversations  → conversations()    (NEW)
 *   GET  /api/ai-brain/conversations/{uuid}/history → conversationHistory() (NEW)
 *   POST /api/ai-brain/conversations/{uuid}/confirm → confirmAction() (NEW)
 */
class AIBrainController extends Controller
{
    public function __construct(
        protected readonly AIBrainService $brainService,    // legacy deterministic service (kept for backward compat)
        protected readonly BrainOrchestrator $orchestrator  // new LLM-backed orchestrator
    ) {}

    // -----------------------------------------------------------------------
    // Primary Chat Endpoints
    // -----------------------------------------------------------------------

    /**
     * Single-turn non-streaming chat — routes through full agentic orchestrator.
     */
    public function ask(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query'             => 'required|string|max:2000',
            'conversation_uuid' => 'nullable|string|max:50',
        ]);

        $user     = $request->user();
        $tenantId = (int) $user->tenant_id;
        $userId   = (int) $user->id;

        try {
            $result = $this->orchestrator->chat(
                tenantId: $tenantId,
                userId: $userId,
                conversationUuid: $validated['conversation_uuid'] ?? null,
                userMessage: $validated['query'],
                ipAddress: $request->ip()
            );

            return response()->json([
                'success' => true,
                'data'    => [
                    'conversation_uuid' => $result['conversation_uuid'],
                    'answer'            => $result['message'],
                    'thought'           => null,
                    'tool_calls'        => $result['tool_calls'],
                    'pending_action'    => $result['pending_action'],
                    'tier_used'         => $result['tier_used'],
                    'model_source'      => $result['model_source'],
                    'model_name'        => $result['model_name'] ?? null,
                    'metrics'           => [],
                    'actions'           => [],
                ],
            ]);
        } catch (Throwable $e) {
            \Illuminate\Support\Facades\Log::error('AIBrain orchestrator error: '.$e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'query' => $validated['query'],
            ]);

            return response()->json([
                'success' => true,
                'data'    => [
                    'thought' => 'Orchestrator exception — activated resilient fallback.',
                    'answer'  => 'I encountered an issue: '.$e->getMessage().'. Please try rephrasing your question.',
                    'metrics' => [['label' => 'Brain Status', 'value' => 'Fallback Active', 'tone' => 'amber']],
                    'actions' => [
                        ['label' => 'Open Reports', 'type' => 'navigate', 'url' => '/reports'],
                        ['label' => 'Executive Dashboard', 'type' => 'navigate', 'url' => '/dashboard'],
                    ],
                ],
            ]);
        }
    }

    /**
     * SSE streaming chat — pushes tokens in real time.
     */
    public function stream(Request $request): StreamedResponse
    {
        $query            = (string) ($request->input('query') ?? $request->query('query', ''));
        $conversationUuid = (string) ($request->input('conversation_uuid') ?? $request->query('conversation_uuid', ''));
        $user             = $request->user();
        $tenantId         = $user ? (int) $user->tenant_id : 0;
        $userId           = $user ? (int) $user->id : 0;

        if (trim($query) === '') {
            return response()->stream(function (): void {
                echo "event: error\ndata: ".json_encode(['error' => 'Query is required'])."\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }, 400, [
                'Content-Type'  => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'Connection'    => 'keep-alive',
            ]);
        }

        return response()->stream(function () use ($query, $conversationUuid, $tenantId, $userId, $request): void {
            $sendEvent = function (string $event, mixed $data): void {
                $payload = is_string($data) ? $data : json_encode($data);
                echo "event: {$event}\ndata: {$payload}\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            };

            $sendEvent('status', ['stage' => 'analyzing', 'message' => 'Analyzing operational intent...']);
            usleep(25000);

            try {
                $sendEvent('status', ['stage' => 'synthesizing', 'message' => 'Consulting AI Financial Advisor...']);

                $result = $this->orchestrator->chat(
                    tenantId: $tenantId,
                    userId: $userId,
                    conversationUuid: $conversationUuid ?: null,
                    userMessage: $query,
                    ipAddress: $request->ip()
                );

                // Emit tool call events for frontend card rendering
                foreach ($result['tool_calls'] as $tc) {
                    if (! empty($tc['tool']) && ! empty($tc['result'])) {
                        $sendEvent('tool_result', [
                            'tool'   => $tc['tool'],
                            'result' => $tc['result'],
                        ]);
                        usleep(20000);
                    }
                }

                // Emit pending action for Tier 2 confirmation UI
                if ($result['pending_action']) {
                    $sendEvent('pending_action', $result['pending_action']);
                    usleep(15000);
                }

                // Stream answer tokens
                $answer = $result['message'];
                if ($answer !== '') {
                    $words = preg_split('/(\s+)/u', $answer, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [];
                    $chunk = '';
                    foreach ($words as $idx => $token) {
                        if (connection_aborted()) {
                            break;
                        }
                        $chunk .= $token;
                        if ($idx % 4 === 0 || str_ends_with($token, "\n") || $idx === count($words) - 1) {
                            $sendEvent('token', ['delta' => $chunk]);
                            $chunk = '';
                            usleep(10000);
                        }
                    }
                    if ($chunk !== '') {
                        $sendEvent('token', ['delta' => $chunk]);
                    }
                }

                $sendEvent('complete', [
                    'conversation_uuid' => $result['conversation_uuid'],
                    'answer'            => $result['message'],
                    'tool_calls'        => $result['tool_calls'],
                    'pending_action'    => $result['pending_action'],
                    'model_source'      => $result['model_source'],
                    'model_name'        => $result['model_name'] ?? null,
                    'metrics'           => [],
                    'actions'           => [],
                ]);
                $sendEvent('done', '[DONE]');
            } catch (Throwable $e) {
                \Illuminate\Support\Facades\Log::error('AIBrain stream error: '.$e->getMessage());
                $sendEvent('error', ['message' => $e->getMessage()]);
                $sendEvent('done', '[DONE]');
            }
        }, 200, [
            'Content-Type'     => 'text/event-stream',
            'Cache-Control'    => 'no-cache, no-transform',
            'Connection'       => 'keep-alive',
            'X-Accel-Buffering'=> 'no',
        ]);
    }

    // -----------------------------------------------------------------------
    // Conversation Management (NEW)
    // -----------------------------------------------------------------------

    public function conversations(Request $request): JsonResponse
    {
        $user     = $request->user();
        $tenantId = (int) $user->tenant_id;
        $userId   = (int) $user->id;

        $conversations = $this->orchestrator->getConversations($tenantId, $userId);

        return response()->json(['success' => true, 'data' => $conversations]);
    }

    public function conversationHistory(Request $request, string $uuid): JsonResponse
    {
        $user     = $request->user();
        $tenantId = (int) $user->tenant_id;

        /** @var AgentConversation $conversation */
        $conversation = AgentConversation::query()
            ->where('tenant_id', $tenantId)
            ->where('uuid', $uuid)
            ->firstOrFail();

        $data = $this->orchestrator->getConversationHistory($conversation->id, true);

        return response()->json([
            'success' => true,
            'data'    => [
                'conversation' => [
                    'uuid'       => $conversation->uuid,
                    'title'      => $conversation->title,
                    'created_at' => $conversation->created_at,
                ],
                'messages'     => $data['messages'] ?? [],
            ],
        ]);
    }

    public function confirmAction(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'action_id'        => 'required|string',
            'approved'         => 'required|boolean',
            'rejection_reason' => 'nullable|string|max:500',
        ]);

        $user     = $request->user();
        $tenantId = (int) $user->tenant_id;
        $userId   = (int) $user->id;

        try {
            $result = $this->orchestrator->resolveAndConfirmAction(
                tenantId: $tenantId,
                userId: $userId,
                conversationUuid: $uuid,
                actionId: $validated['action_id'],
                approved: (bool) $validated['approved'],
                rejectionReason: $validated['rejection_reason'] ?? null,
                ipAddress: $request->ip()
            );

            return response()->json(['success' => true, 'data' => $result]);
        } catch (Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    // -----------------------------------------------------------------------
    // Legacy Compatibility Endpoints
    // -----------------------------------------------------------------------

    public function callTool(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tool'       => 'required|string',
            'parameters' => 'nullable|array',
        ]);

        try {
            $result = $this->brainService->executeTool(
                $validated['tool'],
                $validated['parameters'] ?? []
            );

            return response()->json(['success' => true, 'data' => $result]);
        } catch (Throwable $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 422);
        }
    }

    public function capabilities(\App\Modules\Platform\Services\BrainToolRegistry $toolRegistry): JsonResponse
    {
        $schemas = $toolRegistry->getOpenAiToolSchemas();
        $toolNames = array_values(array_filter(array_map(fn ($s) => $s['function']['name'] ?? '', $schemas)));

        return response()->json([
            'success' => true,
            'data'    => [
                'name'                     => 'ProERP Operations AI Financial Advisor',
                'version'                  => '2.0',
                'mode'                     => 'LLM-Backed Agentic / Local Deterministic Fallback',
                'streaming_supported'      => true,
                'conversation_persistence' => true,
                'tier_2_supervision'       => true,
                'tools'                    => $toolNames,
                'tool_schemas'             => $schemas,
                'tools_count'              => count($schemas),
                'tool_categories'          => ['Finance', 'Sales', 'Inventory', 'HR/Payroll', 'Production', 'Purchasing', 'QC', 'Reports', 'Navigation', 'Platform'],
                'suggested_prompt_categories' => [
                    [
                        'category' => 'Financial Health',
                        'icon'     => 'DollarSign',
                        'prompts'  => [
                            'What is our current cash runway and daily burn rate?',
                            'Show our profit & loss summary for this month',
                            'Can we meet payroll obligations from current cash?',
                        ],
                    ],
                    [
                        'category' => 'Receivables & Payables',
                        'icon'     => 'TrendingUp',
                        'prompts'  => [
                            'List all overdue customer invoices and aging buckets',
                            'Show our outstanding supplier payables aging',
                            'What is our accounts receivable collection rate?',
                        ],
                    ],
                    [
                        'category' => 'Operations',
                        'icon'     => 'Factory',
                        'prompts'  => [
                            'Show active production batches and QC yield',
                            'What is our total inventory valuation and low-stock alerts?',
                            'List open purchase orders and GRN status',
                        ],
                    ],
                    [
                        'category' => 'Financial Advisory',
                        'icon'     => 'Briefcase',
                        'prompts'  => [
                            'Match working capital financing options to our current financials',
                            'Analyze our 30-day cash flow deficit risk',
                            'What should I prioritize to improve cash position this week?',
                        ],
                    ],
                ],
            ],
        ]);
    }

    public function execute(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action'  => 'required|string',
            'payload' => 'required|array',
        ]);

        $result = $this->brainService->executeAction($validated['action'], $validated['payload']);

        return response()->json(['success' => true, 'data' => $result]);
    }
}
