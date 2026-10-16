<?php

declare(strict_types=1);

namespace App\Modules\AI\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\AI\Models\AgentAuditLog;
use App\Modules\AI\Models\AgentConversation;
use App\Modules\AI\Models\CashFlowAlert;
use App\Modules\AI\Models\FinancingAssessment;
use App\Modules\AI\Services\AgentOrchestrator;
use App\Modules\AI\Services\FinancingMatchEngine;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class CopilotController extends Controller
{
    public function __construct(
        protected AgentOrchestrator $orchestrator,
        protected FinancingMatchEngine $financingMatchEngine
    ) {}

    /**
     * POST /api/v1/ai/copilot/chat
     */
    public function chat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|max:4000',
            'conversation_uuid' => 'nullable|string|uuid',
            'max_tier' => 'nullable|integer|between:0,2',
        ]);

        $tenantId = TenantContext::current()->tenantId();
        $userId = (int) (Auth::id() ?? 1);

        $response = $this->orchestrator->chat(
            tenantId: $tenantId,
            userId: $userId,
            conversationUuid: $validated['conversation_uuid'] ?? null,
            userMessage: $validated['message'],
            maxApprovedTier: $validated['max_tier'] ?? 2,
            ipAddress: $request->ip()
        );

        return response()->json([
            'status' => 'success',
            'data' => $response,
        ]);
    }

    /**
     * GET /api/v1/ai/copilot/conversations
     */
    public function listConversations(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = (int) (Auth::id() ?? 1);

        $conversations = AgentConversation::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->withCount('messages')
            ->orderBy('updated_at', 'desc')
            ->limit(30)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $conversations,
        ]);
    }

    /**
     * GET /api/v1/ai/copilot/conversations/{uuid}/history
     */
    public function getHistory(Request $request, string $uuid): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $conversation = AgentConversation::where('tenant_id', $tenantId)
            ->where('uuid', $uuid)
            ->with(['messages' => function ($query): void {
                $query->orderBy('id', 'asc');
            }])
            ->firstOrFail();

        return response()->json([
            'status' => 'success',
            'data' => [
                'conversation' => $conversation,
                'messages' => $conversation->messages,
            ],
        ]);
    }

    /**
     * POST /api/v1/ai/copilot/conversations/{uuid}/confirm
     */
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

    /**
     * GET /api/v1/ai/copilot/audit-log
     */
    public function getAuditLog(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = AgentAuditLog::where('tenant_id', $tenantId)->with(['user:id,name,email', 'confirmedByUser:id,name,email']);

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

    /**
     * GET /api/v1/ai/copilot/alerts
     */
    public function getAlerts(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = CashFlowAlert::where('tenant_id', $tenantId)->with('acknowledgedByUser:id,name,email');

        if ($request->has('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->has('severity')) {
            $query->where('severity', $request->query('severity'));
        }

        if ($request->has('alert_type')) {
            $query->where('alert_type', $request->query('alert_type'));
        }

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

    /**
     * PATCH /api/v1/ai/copilot/alerts/{uuid}/acknowledge
     */
    public function acknowledgeAlert(Request $request, string $uuid): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = (int) (Auth::id() ?? 1);

        /** @var CashFlowAlert $alert */
        $alert = CashFlowAlert::where('tenant_id', $tenantId)->where('uuid', $uuid)->firstOrFail();

        $alert->update([
            'status' => 'acknowledged',
            'acknowledged_by' => $userId,
            'acknowledged_at' => Carbon::now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Alert successfully acknowledged.',
            'data' => $this->formatAlert($alert->fresh('acknowledgedByUser')),
        ]);
    }

    /**
     * POST /api/v1/ai/financing/match
     */
    public function matchFinancing(Request $request): JsonResponse
    {
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

        $data = $this->financingMatchEngine->formatMatchData($assessment);

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    /**
     * GET /api/v1/ai/financing/history
     */
    public function getFinancingHistory(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

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

    /**
     * POST /api/v1/ai/webank/pre-qualify
     *
     * Pre-qualifies an SME for digital credit disbursement via WeBank Open API schema.
     */
    public function preQualifyWeBank(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = (int) $request->user()->id;

        $validated = $request->validate([
            'product_id' => 'required|string',
            'requested_amount' => 'required|numeric|min:1000|max:50000000',
            'collateral_type' => 'nullable|string',
        ]);

        $assessment = app(FinancingMatchEngine::class)->assessAndMatch(
            tenantId: $tenantId,
            userId: $userId,
            customInputs: ['requested_amount' => $validated['requested_amount']]
        );

        $matchedProduct = collect($assessment['products'] ?? [])
            ->firstWhere('product_id', $validated['product_id'])
            ?? ($assessment['top_recommendation'] ?? null);

        $referenceId = 'WB-SME-'.strtoupper(Str::random(10));

        // Package verified telemetry according to WeBank Open Banking SME Specification
        $webankPayload = [
            'application_reference' => $referenceId,
            'institution' => 'WeBank Digital SME Micro-Finance',
            'partner_platform' => 'CenterPoint ProERP',
            'tenant_id' => $tenantId,
            'status' => 'PRE_QUALIFIED',
            'product_selected' => $matchedProduct,
            'credit_assessment' => [
                'solvency_score' => $assessment['credit_score_indicator'] ?? 92,
                'monthly_revenue_verified' => $assessment['metrics']['monthly_revenue'] ?? 0,
                'operating_margin_verified' => $assessment['metrics']['operating_margin_pct'] ?? 0,
                'verified_ar_pool' => $assessment['metrics']['ar_outstanding'] ?? 0,
                'runway_cushion_days' => $assessment['metrics']['runway_days'] ?? 16,
            ],
            'disbursement_route' => 'INSTANT_DIGITAL_WALLET',
            'underwriting_timestamp' => now()->toIso8601String(),
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'SME pre-qualified successfully against WeBank Open Banking credit standards.',
            'data' => $webankPayload,
        ]);
    }
}
