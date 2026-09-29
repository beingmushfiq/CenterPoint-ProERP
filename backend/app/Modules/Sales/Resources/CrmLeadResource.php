<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\CrmLead;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CrmLead
 */
final class CrmLeadResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'uuid'                => $this->uuid,
            'lead_number'         => $this->lead_number,
            'name'                => $this->name,
            'company_name'        => $this->company_name,
            'phone'               => $this->phone,
            'email'               => $this->email,
            'source'              => $this->source,
            'stage'               => $this->stage,
            'is_fake'             => (bool) $this->is_fake,
            'validation_notes'    => $this->validation_notes,
            'validated_by'        => $this->validated_by,
            'validator_name'      => $this->validator?->name,
            'validated_at'        => $this->validated_at?->toIso8601String(),
            'assigned_to'         => $this->assigned_to,
            'assigned_user_name'  => $this->assignedUser?->name,
            'expected_value'      => $this->expected_value,
            'expected_close_date' => $this->expected_close_date?->toDateString(),
            'lost_reason_id'      => $this->lost_reason_id,
            'lost_reason_name'    => $this->lostReason?->name,
            'converted_party_id'  => $this->converted_party_id,
            'converted_party_name'=> $this->convertedParty?->name,
            'converted_at'        => $this->converted_at?->toIso8601String(),
            'notes'               => $this->notes,
            'created_at'          => $this->created_at?->toIso8601String(),
            'updated_at'          => $this->updated_at?->toIso8601String(),
            'activities'          => $this->whenLoaded('activities', function () {
                return $this->activities->map(function ($act) {
                    return [
                        'id'                 => $act->id,
                        'uuid'               => $act->uuid,
                        'type'               => $act->type,
                        'title'              => $act->title,
                        'description'        => $act->description,
                        'due_at'             => $act->due_at?->toIso8601String(),
                        'completed_at'       => $act->completed_at?->toIso8601String(),
                        'outcome'            => $act->outcome,
                        'assigned_to'        => $act->assigned_to,
                        'assigned_user_name' => $act->assignedUser?->name,
                        'created_at'         => $act->created_at?->toIso8601String(),
                    ];
                });
            }),
            'orders'              => $this->whenLoaded('orders', function () {
                return $this->orders->map(function ($order) {
                    return [
                        'id'             => $order->id,
                        'order_number'   => $order->order_number,
                        'total_amount'   => (string) $order->total_amount,
                        'status'         => $order->status,
                        'payment_status' => $order->payment_status,
                        'created_at'     => $order->created_at?->toIso8601String(),
                    ];
                });
            }),
        ];
    }
}
