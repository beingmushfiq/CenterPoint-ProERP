<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Payment
 */
final class PaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'uuid'               => $this->uuid,
            'payment_number'     => $this->payment_number,
            'direction'          => $this->direction,
            'party_id'           => $this->party_id,
            'party_name'         => $this->party?->name,
            'payment_date'       => $this->payment_date?->toDateString(),
            'method'             => $this->method,
            'reference_number'   => $this->reference_number,
            'amount'             => $this->amount,
            'allocated_amount'   => $this->allocated_amount,
            'unallocated_amount' => $this->unallocated_amount,
            'currency_code'      => $this->currency_code,
            'status'             => $this->status,
            'notes'              => $this->notes,
            'posted_at'          => $this->posted_at?->toIso8601String(),
            'allocations'        => PaymentAllocationResource::collection($this->whenLoaded('allocations')),
            'splits'             => PaymentSplitResource::collection($this->whenLoaded('splits')),
            'created_at'         => $this->created_at?->toIso8601String(),
        ];
    }
}
