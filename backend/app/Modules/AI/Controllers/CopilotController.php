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

    /**
     * GET /api/v1/ai/copilot/audit-log
     */
    public function getAuditLog(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = AgentAuditLog::where('tenant_id', $tenantId)->with(['user:id,name,email', 'confirmedByUser:id,name,email']);

        if ($request->has('action')) {
            $query->where('action', $request->query('action'));
        }

        if ($request->has('permission_tier')) {
            $query->where('permission_tier', (int) $request->query('permission_tier'));
        }

        if ($request->has('executed')) {
            $query->where('executed', filter_var($request->query('executed'), FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = $request->integer('per_page', 25);
        $logs = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $logs,
        ]);
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

        $alerts = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $alerts,
        ]);
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
            'data' => $alert,
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

        return response()->json([
            'status' => 'success',
            'data' => $assessment,
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
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $history,
        ]);
    }
}
