<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Resources;

use App\Modules\Delivery\Models\RunSheet;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin RunSheet
 */
class RunSheetResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'run_sheet_number' => $this->run_sheet_number,
            'branch_id' => $this->branch_id,
            'branch_name' => $this->branch?->name,
            'rider_id' => $this->rider_id,
            'rider_name' => $this->rider?->name,
            'run_date' => $this->run_date?->format('Y-m-d'),
            'status' => $this->status,
            'total_stops' => $this->total_stops,
            'completed_stops' => $this->completed_stops,
            'total_cod_expected' => $this->total_cod_expected,
            'total_cod_collected' => $this->total_cod_collected,
            'dispatched_at' => $this->dispatched_at?->toIso8601String(),
            'returned_at' => $this->returned_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'delivery_orders' => $this->whenLoaded('deliveryOrders', function () {
                return $this->deliveryOrders->map(fn ($do) => [
                    'id' => $do->id,
                    'uuid' => $do->uuid,
                    'delivery_number' => $do->delivery_number,
                    'recipient_name' => $do->recipient_name,
                    'recipient_phone' => $do->recipient_phone,
                    'delivery_address' => $do->delivery_address,
                    'cod_amount' => $do->cod_amount,
                    'cod_collected_amount' => $do->cod_collected_amount,
                    'status' => $do->status,
                ]);
            }),
        ];
    }
}
