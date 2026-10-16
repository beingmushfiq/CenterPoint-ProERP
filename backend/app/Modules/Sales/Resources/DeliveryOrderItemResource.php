<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\DeliveryOrderItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DeliveryOrderItem
 */
final class DeliveryOrderItemResource extends JsonResource
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
            'product_name' => $this->product?->name,
            'variant_id' => $this->variant_id,
            'batch_code' => $this->batch_code,
            'quantity' => $this->quantity,
            'delivered_quantity' => $this->delivered_quantity,
            'returned_quantity' => $this->returned_quantity,
            'unit_id' => $this->unit_id,
        ];
    }
}
