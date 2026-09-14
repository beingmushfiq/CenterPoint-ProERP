<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
final class ProductResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid, 'product_id' => $this->id, 'sku' => $this->sku, 'barcode' => $this->barcode, 'name' => $this->name, 'description' => $this->description,
            'type' => $this->type, 'category_id' => $this->category?->uuid, 'category_name' => $this->category?->name, 'category' => $this->category ? ['id' => $this->category->uuid, 'name' => $this->category->name, 'code' => $this->category->code] : null, 'brand_id' => $this->brand?->uuid, 'brand_name' => $this->brand?->name,
            'base_unit_id' => $this->baseUnit->uuid, 'unit_id' => $this->base_unit_id, 'purchase_unit_id' => $this->purchaseUnit?->uuid, 'sales_unit_id' => $this->salesUnit?->uuid,
            'is_produced' => $this->is_produced, 'is_purchased' => $this->is_purchased, 'is_sold' => $this->is_sold, 'is_stock_tracked' => $this->is_stock_tracked, 'has_variants' => $this->has_variants,
            'stock_quantity' => $this->is_stock_tracked ? (float) ($this->stock_quantity ?? ($this->relationLoaded('stockBalances') ? $this->stockBalances->where('stock_state', 'available')->sum('quantity') : $this->stockBalances()->where('stock_state', 'available')->sum('quantity'))) : null,
            'tracking_mode' => $this->tracking_mode, 'shelf_life_days' => $this->shelf_life_days, 'reorder_level' => $this->reorder_level, 'reorder_quantity' => $this->reorder_quantity,
            'standard_cost' => $this->standard_cost, 'default_sale_price' => $this->default_sale_price, 'tax_profile_id' => $this->taxProfile?->uuid, 'weight' => $this->weight,
            'dimensions' => $this->dimensions, 'is_online' => $this->is_online, 'online_slug' => $this->online_slug, 'online_meta' => $this->online_meta, 'status' => $this->status,
            'image_url' => $this->image_url,
            'images' => $this->relationLoaded('images') ? $this->images->map(static fn ($img) => [
                'id' => $img->id,
                'path' => $img->path,
                'url' => $img->url,
                'is_primary' => (bool) $img->is_primary,
                'sort_order' => (int) $img->sort_order,
                'alt_key' => $img->alt_key,
                'variant_id' => $img->variant_id,
            ])->values()->all() : [],
            'created_at' => $this->created_at?->toIso8601String(), 'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
