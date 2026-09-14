<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Services\AIBrainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $result = $this->brainService->processQuery($validated['query']);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function capabilities(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'name' => 'ProERP Operations AI Brain Agent',
                'mode' => 'Self-Contained / Local Agentic Execution',
                'external_apis_used' => false,
                'tools' => [
                    ['id' => 'QueryBankAccounts', 'description' => 'Extracts live liquid funds and bank balances across all accounts'],
                    ['id' => 'QueryStockLedger', 'description' => 'Calculates on-hand units, low-stock warnings, and absorbed valuation'],
                    ['id' => 'QueryInvoices', 'description' => 'Analyzes billed revenue, unpaid accounts receivable, and aging'],
                    ['id' => 'QueryQcInspections', 'description' => 'Evaluates inspection pass rates and defect quarantine interlocks'],
                    ['id' => 'QueryPurchasingOrders', 'description' => 'Inspects POs, GRN receiving records, and 3-way matching bills'],
                    ['id' => 'QueryDataBin', 'description' => 'Tracks soft-deleted records across 20 entities with 1-click restoration'],
                    ['id' => 'ConsultSystemSop', 'description' => 'Answers questions on FIFO/AVCO costing, RBAC permissions, and accounting'],
                    ['id' => 'DispatchNavigation', 'description' => 'Executes instant deep-link routing with workspace filter presets'],
                ],
                'suggested_prompts' => [
                    'What is our current liquid cash and bank balance?',
                    'Calculate total warehouse inventory valuation',
                    'How many batches failed QC inspections this week?',
                    'List overdue customer accounts receivable',
                    'Explain our 3-way purchase order matching policy',
                    'Check records in the Data Bin',
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
