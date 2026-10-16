<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\HR\Models\Employee;
use App\Modules\Sales\Models\CrmLead;
use App\Modules\Sales\Models\IncentiveCalculation;
use App\Modules\Sales\Models\IncentivePolicy;
use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Models\SalesmanTarget;

final class SyncSalesmanAchievementAction
{
    public function execute(int $tenantId, ?int $salesmanId, ?int $userId, string $periodMonth): void
    {
        $employeeId = $salesmanId;
        if (! $employeeId && $userId) {
            $emp = Employee::where('tenant_id', $tenantId)->where('user_id', $userId)->first();
            $employeeId = $emp?->id;
        }

        if (! $employeeId) {
            return;
        }

        /** @var SalesmanTarget|null $target */
        $target = SalesmanTarget::where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->where('period_month', $periodMonth)
            ->first();

        if (! $target) {
            return;
        }

        $startOfMonth = "{$periodMonth}-01";
        $endOfMonth = date('Y-m-t', strtotime($startOfMonth));

        $employee = Employee::find($employeeId);

        $salesQuery = Invoice::where('tenant_id', $tenantId)
            ->where('status', '!=', 'void')
            ->whereBetween('invoice_date', [$startOfMonth, $endOfMonth]);

        if ($employee && $employee->user_id) {
            $salesQuery->where(function ($q) use ($employeeId, $employee): void {
                $q->where('salesman_id', $employeeId)
                    ->orWhere('created_by', $employee->user_id);
            });
        } else {
            $salesQuery->where('salesman_id', $employeeId);
        }

        $achieved = (float) $salesQuery->sum('total_amount');
        $target->achieved_amount = (string) $achieved;

        $targetAmt = (float) $target->target_amount;
        $achievementPct = $targetAmt > 0 ? round(($achieved / $targetAmt) * 100, 2) : 0.0;
        $target->achievement_percentage = (string) $achievementPct;

        // Leads metrics
        $leadsQuery = CrmLead::where('tenant_id', $tenantId)
            ->whereBetween('created_at', ["{$startOfMonth} 00:00:00", "{$endOfMonth} 23:59:59"]);

        if ($employee && $employee->user_id) {
            $leadsQuery->where('assigned_to', $employee->user_id);
        }

        $totalLeads = $leadsQuery->count();
        $fakeLeads = (clone $leadsQuery)->where('is_fake', true)->count();
        $validLeads = $totalLeads - $fakeLeads;
        $convertedLeads = (clone $leadsQuery)->whereNotNull('converted_at')->count();

        $target->total_leads = $totalLeads;
        $target->fake_leads = $fakeLeads;
        $target->valid_leads = $validLeads;
        $target->converted_leads = $convertedLeads;
        $target->profit_generated = (string) round($achieved * 0.20, 4);
        $target->save();

        // Check if active incentive policy exists and update draft calculation
        $policy = IncentivePolicy::with('rules')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->first();

        if ($policy) {
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

            IncentiveCalculation::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'employee_id' => $employeeId,
                    'period_month' => $periodMonth,
                ],
                [
                    'salesman_target_id' => $target->id,
                    'incentive_policy_id' => $policy->id,
                    'target_amount' => (string) $targetAmt,
                    'achieved_amount' => (string) $achieved,
                    'achievement_pct' => (string) $achievementPct,
                    'calculated_amount' => (string) round($calculatedAmount, 4),
                    'approved_amount' => (string) round($calculatedAmount, 4),
                    'status' => 'draft',
                    'notes' => "Auto-calculated on {$policy->name} rules",
                ]
            );
        }
    }
}
