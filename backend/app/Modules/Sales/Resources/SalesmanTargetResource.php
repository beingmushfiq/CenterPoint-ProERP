<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\SalesmanTarget;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalesmanTarget
 */
final class SalesmanTargetResource extends JsonResource
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
            'period_month' => $this->period_month,
            'target_name' => $this->target_name,
            'target_amount' => $this->target_amount,
            'achieved_amount' => $this->achieved_amount,
            'achievement_percentage' => $this->achievement_percentage,
            'total_leads' => $this->total_leads,
            'valid_leads' => $this->valid_leads,
            'fake_leads' => $this->fake_leads,
            'converted_leads' => $this->converted_leads,
            'conversion_rate' => $this->total_leads > 0 ? round(($this->converted_leads / $this->total_leads) * 100, 2) : 0,
            'profit_generated' => $this->profit_generated,
            'status' => $this->status,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
