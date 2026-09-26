<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Resources\InvoiceItemResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Invoice
 */
final class InvoiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'uuid'             => $this->uuid,
            'invoice_number'   => $this->invoice_number,
            'sales_order_id'   => $this->sales_order_id,
            'party_id'         => $this->party_id,
            'customer_name'    => $this->customer?->name,
            'invoice_date'     => $this->invoice_date?->toDateString(),
            'due_date'         => $this->due_date?->toDateString(),
            'subtotal'         => $this->subtotal,
            'discount_amount'  => $this->discount_amount,
            'tax_amount'       => $this->tax_amount,
            'shipping_amount'  => $this->shipping_amount,
            'round_off'        => $this->round_off,
            'total_amount'     => $this->total_amount,
            'paid_amount'      => $this->paid_amount,
            'status'           => $this->status,
            'printed_count'    => $this->printed_count,
            'posted_at'        => $this->posted_at?->toIso8601String(),
            'voided_at'        => $this->voided_at?->toIso8601String(),
            'void_reason'      => $this->void_reason,
            'items'            => InvoiceItemResource::collection($this->whenLoaded('items')),
            'exchanges_count'  => $this->exchanges_count ?? ($this->relationLoaded('exchanges') ? $this->exchanges->count() : 0),
            'has_exchanges'    => ($this->exchanges_count ?? ($this->relationLoaded('exchanges') ? $this->exchanges->count() : 0)) > 0,
            'created_at'       => $this->created_at?->toIso8601String(),
        ];
    }
}
