<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\IncentiveCalculation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin IncentiveCalculation
 */
final class IncentiveCalculationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'employee_id' => $this->employee_id,
            'employee_name' => $this->employee?->display_name ?? ($this->employee ? "{$this->employee->first_name} {$this->employee->last_name}" : null),
            'employee_code' => $this->employee?->employee_code,
            'salesman_target_id' => $this->salesman_target_id,
            'incentive_policy_id' => $this->incentive_policy_id,
            'policy_name' => $this->policy?->name,
            'period_month' => $this->period_month,
            'target_amount' => $this->target_amount,
            'achieved_amount' => $this->achieved_amount,
            'achievement_pct' => $this->achievement_pct,
            'calculated_amount' => $this->calculated_amount,
            'approved_amount' => $this->approved_amount,
            'status' => $this->status,
            'approved_by' => $this->approved_by,
            'approver_name' => $this->approver?->name,
            'approved_at' => $this->approved_at?->toIso8601String(),
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
