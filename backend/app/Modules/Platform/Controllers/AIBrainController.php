<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Services\AIBrainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class AIBrainController extends Controller
{
    public function __construct(
        protected readonly AIBrainService $brainService
    ) {}

    public function ask(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => 'required|string|max:1000',
        ]);

        try {
            $result = $this->brainService->processQuery($validated['query']);
        } catch (Throwable $e) {
            \Illuminate\Support\Facades\Log::error('AIBrain processing error: '.$e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'query' => $validated['query'],
            ]);

            $result = [
                'thought' => 'Encountered a processing exception in local evaluation ➔ Activated resilient fallback agent.',
                'answer' => 'I encountered an obstacle executing that query: '.$e->getMessage().".\n\nYou can rephrase or use the shortcuts below to navigate directly to the desired module.",
                'metrics' => [
                    ['label' => 'Brain Status', 'value' => 'Online (Fallback)', 'tone' => 'amber'],
                    ['label' => 'Execution Mode', 'value' => '100% Local', 'tone' => 'success'],
                ],
                'actions' => [
                    ['label' => 'Open Reports Workspace', 'type' => 'navigate', 'url' => '/reports'],
                    ['label' => 'Open Executive Dashboard', 'type' => 'navigate', 'url' => '/dashboard'],
                    ['label' => 'Warehouse Stock Ledger', 'type' => 'navigate', 'url' => '/inventory'],
                ],
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function stream(Request $request): StreamedResponse
    {
        $query = (string) ($request->input('query') ?? $request->query('query', ''));
        if (trim($query) === '') {
            return response()->stream(function () {
                echo "event: error\ndata: " . json_encode(['error' => 'Query is required']) . "\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }, 400, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'Connection' => 'keep-alive',
            ]);
        }

        return response()->stream(function () use ($query) {
            $sendEvent = function (string $event, mixed $data): void {
                $payload = is_string($data) ? $data : json_encode($data);
                echo "event: {$event}\ndata: {$payload}\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            };

            // 1. Initial status
            $sendEvent('status', ['stage' => 'analyzing', 'message' => 'Analyzing operational intent...']);
            usleep(30000);

            try {
                // 2. Intent & Tool Detection
                $toolCall = $this->brainService->detectTool($query);
                if ($toolCall) {
                    $sendEvent('status', ['stage' => 'tool_dispatch', 'message' => "Executing ERP Tool: {$toolCall['name']}..."]);
                    $sendEvent('tool_call', $toolCall);
                    usleep(40000);

                    // Execute tool
                    $toolResult = $this->brainService->executeTool($toolCall['name'], $toolCall['parameters'] ?? []);
                    $sendEvent('tool_result', $toolResult);
                    usleep(30000);
                }

                // 3. Process complete query
                $sendEvent('status', ['stage' => 'synthesizing', 'message' => 'Synthesizing operational intelligence...']);
                $result = $this->brainService->processQuery($query);

                // Stream Thought
                if (!empty($result['thought'])) {
                    $sendEvent('thought', ['thought' => $result['thought']]);
                    usleep(25000);
                }

                // Stream Answer Tokens
                $answer = $result['answer'] ?? '';
                if ($answer !== '') {
                    $words = preg_split('/(\s+)/u', $answer, -1, PREG_SPLIT_DELIM_CAPTURE);
                    $chunk = '';
                    foreach ($words as $idx => $token) {
                        if (connection_aborted()) {
                            break;
                        }
                        $chunk .= $token;
                        if ($idx % 3 === 0 || str_ends_with($token, "\n") || $idx === count($words) - 1) {
                            $sendEvent('token', ['delta' => $chunk]);
                            $chunk = '';
                            usleep(12000);
                        }
                    }
                    if ($chunk !== '') {
                        $sendEvent('token', ['delta' => $chunk]);
                    }
                }

                // 4. Send complete payload with metrics & actions
                $sendEvent('complete', $result);
                $sendEvent('done', '[DONE]');

            } catch (Throwable $e) {
                \Illuminate\Support\Facades\Log::error('AIBrain streaming error: ' . $e->getMessage());
                $sendEvent('error', ['message' => $e->getMessage()]);
                $sendEvent('done', '[DONE]');
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    public function callTool(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tool' => 'required|string',
            'parameters' => 'nullable|array',
        ]);

        try {
            $result = $this->brainService->executeTool(
                $validated['tool'],
                $validated['parameters'] ?? []
            );

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    public function capabilities(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'name' => 'ProERP Operations AI Brain Agent',
                'mode' => 'Self-Contained / Local Agentic Execution',
                'streaming_supported' => true,
                'external_apis_used' => false,
                'tool_schemas' => $this->brainService->getToolSchemas(),
                'tools' => [
                    ['id' => 'get_sales_summary', 'description' => 'Calculates billed revenue, collected payments, open receivables, and order volumes.'],
                    ['id' => 'get_stock_level', 'description' => 'Extracts total physical inventory valuation, on-hand units, and low-stock replenishment alerts.'],
                    ['id' => 'get_overdue_invoices', 'description' => 'Analyzes past-due accounts receivable with aging buckets (0-30, 31-60, 60+ days) and debtor details.'],
                    ['id' => 'get_production_status', 'description' => 'Tracks live shopfloor manufacturing batches, planned vs actual output, and QC yield pass-rate.'],
                    ['id' => 'QueryBankAccounts', 'description' => 'Extracts live liquid funds and bank balances across all accounts'],
                    ['id' => 'QueryStockLedger', 'description' => 'Calculates on-hand units, low-stock warnings, and absorbed valuation'],
                    ['id' => 'QueryInvoices', 'description' => 'Analyzes billed revenue, unpaid accounts receivable, and aging'],
                    ['id' => 'QueryQcInspections', 'description' => 'Evaluates inspection pass rates and defect quarantine interlocks'],
                    ['id' => 'QueryPurchasingOrders', 'description' => 'Inspects POs, GRN receiving records, and 3-way matching bills'],
                    ['id' => 'QueryDataBin', 'description' => 'Tracks soft-deleted records across 20 entities with 1-click restoration'],
                    ['id' => 'ConsultSystemSop', 'description' => 'Answers questions on FIFO/AVCO costing, RBAC permissions, and accounting'],
                    ['id' => 'DispatchNavigation', 'description' => 'Executes instant deep-link routing with workspace filter presets'],
                ],
                'suggested_prompt_categories' => [
                    [
                        'category' => 'Commercial & Sales',
                        'icon' => 'TrendingUp',
                        'prompts' => [
                            'What is our total sales revenue and collected cash this month?',
                            'Show our top selling products and recent customer sales orders',
                            'What are our open customer orders awaiting fulfillment?',
                        ],
                    ],
                    [
                        'category' => 'Warehouse & Inventory',
                        'icon' => 'Package',
                        'prompts' => [
                            'Calculate total warehouse inventory valuation and show low-stock items',
                            'List all raw materials below safety stock reorder levels',
                            'What is our absorbed stock valuation by warehouse location?',
                        ],
                    ],
                    [
                        'category' => 'Finance & Receivables',
                        'icon' => 'DollarSign',
                        'prompts' => [
                            'List overdue customer accounts receivable and aging breakdown',
                            'What is our current liquid cash and bank balance across all accounts?',
                            'Summarize unallocated customer payments and credit memos',
                        ],
                    ],
                    [
                        'category' => 'Factory & Quality',
                        'icon' => 'Factory',
                        'prompts' => [
                            'Show active shopfloor batches and quality inspection pass yield',
                            'How many batches failed QC inspections this week?',
                            'What is the status of our current production work orders?',
                        ],
                    ],
                ],
                'suggested_prompts' => [
                    'What is our total sales revenue and collected cash this month?',
                    'Calculate total warehouse inventory valuation and show low-stock items',
                    'List overdue customer accounts receivable and aging breakdown',
                    'Show active shopfloor batches and quality inspection pass yield',
                    'What is our current liquid cash and bank balance?',
                    'Explain our 3-way purchase order matching policy',
                ],
            ],
        ]);
    }

    public function execute(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|string',
            'payload' => 'required|array',
        ]);

        $result = $this->brainService->executeAction($validated['action'], $validated['payload']);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }
}
