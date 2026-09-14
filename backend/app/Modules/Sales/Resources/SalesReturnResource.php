<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\SalesReturn;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalesReturn
 */
final class SalesReturnResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'uuid'               => $this->uuid,
            'return_number'      => $this->return_number,
            'invoice_id'         => $this->invoice_id,
            'invoice_number'     => $this->invoice?->invoice_number,
            'sales_order_id'     => $this->sales_order_id,
            'party_id'           => $this->party_id,
            'warehouse_id'       => $this->warehouse_id,
            'return_date'        => $this->return_date,
            'reason_code_id'     => $this->reason_code_id,
            'restock'            => $this->restock,
            'subtotal'           => (string) $this->subtotal,
            'tax_amount'         => (string) $this->tax_amount,
            'total_amount'       => (string) $this->total_amount,
            'refund_method'      => $this->refund_method,
            'credit_note_number' => $this->credit_note_number,
            'status'             => $this->status,
            'approved_at'        => $this->approved_at?->toIso8601String(),
            'approved_by'        => $this->approved_by,
            'created_at'         => $this->created_at?->toIso8601String(),
            'updated_at'         => $this->updated_at?->toIso8601String(),
            'items'              => SalesReturnItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
