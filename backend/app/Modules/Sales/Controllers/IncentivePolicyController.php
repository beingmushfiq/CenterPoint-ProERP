<?php

declare(strict_types=1);

namespace App\Modules\Sales\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Sales\Models\IncentiveCalculation;
use App\Modules\Sales\Models\IncentivePolicy;
use App\Modules\Sales\Models\IncentivePolicyRule;
use App\Modules\Sales\Models\SalesmanTarget;
use App\Modules\Sales\Resources\IncentiveCalculationResource;
use App\Modules\Sales\Resources\IncentivePolicyResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

final class IncentivePolicyController extends Controller
{
    public function policies(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $policies = IncentivePolicy::with('rules')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('id')
            ->get();

        return IncentivePolicyResource::collection($policies);
    }

    public function storePolicy(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $validated = $request->validate([
            'name'                => ['required', 'string', 'max:128'],
            'code'                => ['required', 'string', 'max:32'],
            'description'         => ['nullable', 'string'],
            'basis'               => ['required', 'string', 'in:total_revenue,profit,collection'],
            'min_achievement_pct' => ['required', 'numeric', 'min:0', 'max:100'],
            'is_active'           => ['nullable', 'boolean'],
            'rules'               => ['required', 'array', 'min:1'],
            'rules.*.min_pct'     => ['required', 'numeric', 'min:0'],
            'rules.*.max_pct'     => ['required', 'numeric', 'min:0'],
            'rules.*.incentive_type' => ['required', 'string', 'in:percentage,fixed'],
            'rules.*.incentive_value' => ['required', 'numeric', 'min:0'],
        ]);

        return DB::transaction(function () use ($validated, $tenantId) {
            $policy = IncentivePolicy::create([
                'tenant_id'           => $tenantId,
                'name'                => $validated['name'],
                'code'                => $validated['code'],
                'description'         => $validated['description'] ?? null,
                'basis'               => $validated['basis'],
                'min_achievement_pct' => (string) $validated['min_achievement_pct'],
                'is_active'           => $validated['is_active'] ?? true,
                'created_by'          => Auth::id() ? (int) Auth::id() : null,
            ]);

            foreach ($validated['rules'] as $ruleData) {
                IncentivePolicyRule::create([
                    'tenant_id'           => $tenantId,
                    'incentive_policy_id' => $policy->id,
                    'min_pct'             => (string) $ruleData['min_pct'],
                    'max_pct'             => (string) $ruleData['max_pct'],
                    'incentive_type'      => $ruleData['incentive_type'],
                    'incentive_value'     => (string) $ruleData['incentive_value'],
                    'created_by'          => Auth::id() ? (int) Auth::id() : null,
                ]);
            }

            return (new IncentivePolicyResource($policy->load('rules')))->response()->setStatusCode(201);
        });
    }

    public function calculations(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = IncentiveCalculation::with(['employee', 'policy', 'approver'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('period_month')) {
            $query->where('period_month', (string) $request->query('period_month'));
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        $calculations = $query->orderByDesc('id')
            ->paginate((int) $request->query('per_page', '25'));

        return IncentiveCalculationResource::collection($calculations);
    }

    public function calculate(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $validated = $request->validate([
            'period_month' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'policy_id'    => ['nullable', 'integer', 'exists:incentive_policies,id'],
        ]);

        $periodMonth = $validated['period_month'];

        $policy = isset($validated['policy_id'])
            ? IncentivePolicy::with('rules')->where('tenant_id', $tenantId)->findOrFail($validated['policy_id'])
            : IncentivePolicy::with('rules')->where('tenant_id', $tenantId)->where('is_active', true)->first();

        if (!$policy) {
            return response()->json(['message' => 'No active incentive policy configured'], 422);
        }

        $targets = SalesmanTarget::where('tenant_id', $tenantId)
            ->where('period_month', $periodMonth)
            ->get();

        $generated = [];

        DB::transaction(function () use ($targets, $policy, $tenantId, $periodMonth, &$generated) {
            foreach ($targets as $target) {
                $achieved = (float) $target->achieved_amount;
                $targetAmt = (float) $target->target_amount;
                $achievementPct = $targetAmt > 0 ? round(($achieved / $targetAmt) * 100, 2) : 0.0;

                $calculatedAmount = 0.0;

                if ($achievementPct >= (float) $policy->min_achievement_pct) {
                    foreach ($policy->rules as $rule) {
                        if ($achievementPct >= (float) $rule->min_pct && $achievementPct <= (float) $rule->max_pct) {
                            if ($rule->incentive_type === 'percentage') {
                                $calculatedAmount = ($achieved * (float) $rule->incentive_value) / 100;
                            } else {
                                $calculatedAmount = (float) $rule->incentive_value;
                            }
                            break;
                        }
                    }
                }

                $calculation = IncentiveCalculation::updateOrCreate(
                    [
                        'tenant_id'    => $tenantId,
                        'employee_id'  => $target->employee_id,
                        'period_month' => $periodMonth,
                    ],
                    [
                        'salesman_target_id' => $target->id,
                        'incentive_policy_id'=> $policy->id,
                        'target_amount'      => (string) $targetAmt,
                        'achieved_amount'    => (string) $achieved,
                        'achievement_pct'    => (string) $achievementPct,
                        'calculated_amount'  => (string) round($calculatedAmount, 4),
                        'approved_amount'    => (string) round($calculatedAmount, 4),
                        'status'             => 'draft',
                        'notes'              => "Auto-calculated on {$policy->name} rules",
                    ]
                );

                $generated[] = $calculation;
            }
        });

        return response()->json([
            'message' => 'Incentives calculated successfully',
            'count'   => count($generated),
            'period'  => $periodMonth,
        ]);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $calc = IncentiveCalculation::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'approved_amount' => ['nullable', 'numeric', 'min:0'],
            'notes'           => ['nullable', 'string'],
        ]);

        if (isset($validated['approved_amount'])) {
            $calc->approved_amount = (string) $validated['approved_amount'];
        }
        if (isset($validated['notes'])) {
            $calc->notes = $validated['notes'];
        }
        $calc->status = 'approved';
        $calc->approved_by = Auth::id() ? (int) Auth::id() : null;
        $calc->approved_at = now();
        $calc->save();

        return (new IncentiveCalculationResource($calc->load(['employee', 'policy', 'approver'])))->response();
    }

    public function destroyCalculation(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $calc = IncentiveCalculation::where('tenant_id', $tenantId)->findOrFail($id);
        $calc->delete();

        return response()->json([
            'success' => true,
            'message' => 'Incentive calculation removed.',
        ]);
    }

    public function destroyPolicy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $policy = IncentivePolicy::where('tenant_id', $tenantId)->findOrFail($id);
        $policy->delete();

        return response()->json([
            'success' => true,
            'message' => 'Incentive policy moved to Data Bin.',
        ]);
    }
}
