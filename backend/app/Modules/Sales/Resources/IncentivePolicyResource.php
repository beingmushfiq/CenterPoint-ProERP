<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\IncentivePolicy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin IncentivePolicy
 */
final class IncentivePolicyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'basis' => $this->basis,
            'min_achievement_pct' => $this->min_achievement_pct,
            'is_active' => (bool) $this->is_active,
            'rules' => $this->rules->map(fn ($r) => [
                'id' => $r->id,
                'min_pct' => $r->min_pct,
                'max_pct' => $r->max_pct,
                'incentive_type' => $r->incentive_type,
                'incentive_value' => $r->incentive_value,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
