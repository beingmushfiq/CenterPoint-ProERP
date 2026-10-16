<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\SalesReturnItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalesReturnItem
 */
final class SalesReturnItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'quantity' => (string) $this->quantity,
            'unit_id' => $this->unit_id,
            'unit_price' => (string) $this->unit_price,
            'line_total' => (string) $this->line_total,
            'condition' => $this->condition,
            'batch_code' => $this->batch_code,
            'stock_movement_id' => $this->stock_movement_id,
        ];
    }
}
