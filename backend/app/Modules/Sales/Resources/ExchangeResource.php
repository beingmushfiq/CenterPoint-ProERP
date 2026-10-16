<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\Exchange;
use DateTimeInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Exchange
 */
final class ExchangeResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'exchange_number' => $this->exchange_number,
            'original_invoice_id' => $this->original_invoice_id,
            'original_sales_order_id' => $this->original_sales_order_id,
            'party_id' => $this->party_id,
            'warehouse_id' => $this->warehouse_id,
            'pos_session_id' => $this->pos_session_id,
            'exchange_date' => $this->exchange_date instanceof DateTimeInterface ? $this->exchange_date->format('Y-m-d') : (string) $this->exchange_date,
            'reason_code_id' => $this->reason_code_id,
            'exchange_type' => $this->exchange_type,
            'return_subtotal' => (string) $this->return_subtotal,
            'replacement_subtotal' => (string) $this->replacement_subtotal,
            'difference_amount' => (string) $this->difference_amount,
            'difference_settlement' => $this->difference_settlement,
            'status' => $this->status,
            'notes' => $this->notes,
            'approved_by' => $this->approved_by,
            'approved_at' => $this->approved_at?->toIso8601String(),
            'created_by' => $this->created_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),

            // Loaded relations
            'customer_name' => $this->whenLoaded('customer', fn () => $this->customer?->name),
            'warehouse_name' => $this->whenLoaded('warehouse', fn () => $this->warehouse?->name),
            'reason_code_name' => $this->whenLoaded('reasonCode', fn () => $this->reasonCode?->name),

            'return_items' => $this->whenLoaded('returnItems', function () {
                return $this->returnItems->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name,
                    'variant_id' => $item->variant_id,
                    'quantity' => (string) $item->quantity,
                    'unit_id' => $item->unit_id,
                    'unit_price' => (string) $item->unit_price,
                    'line_total' => (string) $item->line_total,
                    'condition' => $item->condition,
                    'restock' => $item->restock,
                    'batch_code' => $item->batch_code,
                    'stock_movement_id' => $item->stock_movement_id,
                ]);
            }),

            'replacement_items' => $this->whenLoaded('replacementItems', function () {
                return $this->replacementItems->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name,
                    'variant_id' => $item->variant_id,
                    'quantity' => (string) $item->quantity,
                    'unit_id' => $item->unit_id,
                    'unit_price' => (string) $item->unit_price,
                    'line_total' => (string) $item->line_total,
                    'batch_code' => $item->batch_code,
                    'stock_movement_id' => $item->stock_movement_id,
                ]);
            }),
        ];
    }
}
