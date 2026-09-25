<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sku' => ['sometimes', 'string', 'max:100'],
            'barcode' => ['sometimes', 'nullable', 'string', 'max:100'],
            'name' => ['sometimes', 'string', 'max:191'],
            'description' => ['sometimes', 'nullable', 'string'],
            'type' => ['sometimes', Rule::in(['raw_material', 'semi_finished', 'finished', 'packaging', 'consumable', 'service', 'asset_part'])],
            'category_id' => ['sometimes', 'nullable', 'uuid'],
            'brand_id' => ['sometimes', 'nullable', 'uuid'],
            'base_unit_id' => ['sometimes', 'uuid'],
            'purchase_unit_id' => ['sometimes', 'nullable', 'uuid'],
            'sales_unit_id' => ['sometimes', 'nullable', 'uuid'],
            'is_produced' => ['sometimes', 'boolean'],
            'is_purchased' => ['sometimes', 'boolean'],
            'is_sold' => ['sometimes', 'boolean'],
            'is_stock_tracked' => ['sometimes', 'boolean'],
            'has_variants' => ['sometimes', 'boolean'],
            'tracking_mode' => ['sometimes', Rule::in(['none', 'batch', 'serial', 'batch_and_serial'])],
            'shelf_life_days' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'opening_stock' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'warehouse_id' => ['sometimes', 'nullable', 'string'],
            'reorder_level' => ['sometimes', 'nullable', 'numeric', 'decimal:0,4'],
            'reorder_quantity' => ['sometimes', 'nullable', 'numeric', 'decimal:0,4'],
            'standard_cost' => ['sometimes', 'numeric', 'decimal:0,4'],
            'default_sale_price' => ['sometimes', 'numeric', 'decimal:0,4'],
            'tax_profile_id' => ['sometimes', 'nullable', 'uuid'],
            'weight' => ['sometimes', 'nullable', 'numeric', 'decimal:0,4'],
            'dimensions' => ['sometimes', 'nullable', 'array'],
            'is_online' => ['sometimes', 'boolean'],
            'online_slug' => ['sometimes', 'nullable', 'string', 'max:191'],
            'online_meta' => ['sometimes', 'nullable', 'array'],
            'status' => ['sometimes', Rule::in(['active', 'discontinued', 'draft'])],
        ];
    }
}
