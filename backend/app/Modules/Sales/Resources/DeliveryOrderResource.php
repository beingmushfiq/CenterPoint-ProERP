<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\DeliveryOrder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DeliveryOrder
 */
final class DeliveryOrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'delivery_number' => $this->delivery_number,
            'sales_order_id' => $this->sales_order_id,
            'invoice_id' => $this->invoice_id,
            'party_id' => $this->party_id,
            'party_name' => $this->party?->name,
            'warehouse_id' => $this->warehouse_id,
            'warehouse_name' => $this->warehouse?->name,
            'recipient_name' => $this->recipient_name,
            'recipient_phone' => $this->recipient_phone,
            'delivery_type' => $this->delivery_type,
            'scheduled_date' => $this->scheduled_date?->toDateString(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'status' => $this->status,
            'cod_amount' => $this->cod_amount,
            'cod_collected_amount' => $this->cod_collected_amount,
            'cod_status' => $this->cod_status,
            'delivery_charge' => $this->delivery_charge,
            'package_count' => $this->package_count,
            'attempt_count' => $this->attempt_count,
            'special_instructions' => $this->special_instructions,
            'items' => DeliveryOrderItemResource::collection($this->whenLoaded('items')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
