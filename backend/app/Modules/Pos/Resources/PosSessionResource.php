<?php

declare(strict_types=1);

namespace App\Modules\Pos\Resources;

use App\Modules\Pos\Models\PosSession;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PosSession
 */
final class PosSessionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'session_number' => $this->session_number,
            'branch_id' => $this->branch_id,
            'warehouse_id' => $this->warehouse_id,
            'terminal_id' => $this->terminal_id,
            'user_id' => $this->user_id,
            'opened_at' => $this->opened_at->toISOString(),
            'closed_at' => $this->closed_at?->toISOString(),
            'opening_cash' => (string) $this->opening_cash,
            'expected_cash' => (string) $this->expected_cash,
            'counted_cash' => $this->counted_cash !== null ? (string) $this->counted_cash : null,
            'cash_variance' => $this->cash_variance !== null ? (string) $this->cash_variance : null,
            'card_total' => (string) $this->card_total,
            'mobile_total' => (string) $this->mobile_total,
            'credit_total' => (string) $this->credit_total,
            'sales_count' => $this->sales_count,
            'refund_total' => (string) $this->refund_total,
            'status' => $this->status,
            'closed_by' => $this->closed_by,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'terminal' => $this->relationLoaded('terminal') && $this->terminal ? new PosTerminalResource($this->terminal) : null,
        ];
    }
}
