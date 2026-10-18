<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Resources;

use App\Modules\Inventory\Models\StockBalance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

/**
 * @mixin StockBalance
 */
final class StockBalanceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $expiryDate = null;
        if ($this->relationLoaded('lastMovement') && $this->lastMovement?->expiry_date) {
            $expiryDate = (string) $this->lastMovement->expiry_date;
        } elseif (! empty($this->batch_code)) {
            $expiryDate = DB::table('stock_movements')
                ->where('tenant_id', $this->tenant_id)
                ->where('batch_code', $this->batch_code)
                ->whereNotNull('expiry_date')
                ->value('expiry_date');
        }

        $daysToExpiry = null;
        $shelfLifeStatus = 'unknown';
        if ($expiryDate) {
            $daysToExpiry = (int) round((strtotime((string) $expiryDate) - strtotime('today')) / 86400);
            if ($daysToExpiry < 0) {
                $shelfLifeStatus = 'expired';
            } elseif ($daysToExpiry <= 30) {
                $shelfLifeStatus = 'critical';
            } elseif ($daysToExpiry <= 60) {
                $shelfLifeStatus = 'warning';
            } else {
                $shelfLifeStatus = 'healthy';
            }
        }

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'product_id' => $this->product_id,
            'product_name' => $this->product?->name,
            'product_sku' => $this->product?->sku,
            'variant_id' => $this->variant_id,
            'warehouse_id' => $this->warehouse_id,
            'warehouse_name' => $this->warehouse?->name,
            'warehouse_location_id' => $this->warehouse_location_id,
            'batch_code' => $this->batch_code,
            'expiry_date' => $expiryDate ? (string) $expiryDate : null,
            'days_to_expiry' => $daysToExpiry,
            'shelf_life_status' => $shelfLifeStatus,
            'stock_state' => $this->stock_state,
            'quantity' => $this->quantity,
            'average_cost' => $this->average_cost,
            'total_value' => $this->total_value,
            'last_movement_id' => $this->last_movement_id,
            'last_movement_at' => $this->last_movement_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
