<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StorePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'party_id' => ['required'],
            'warehouse_id' => ['required'],
            'order_date' => ['required', 'date'],
            'po_number' => ['nullable', 'string', 'max:64'],
            'expected_delivery_date' => ['nullable', 'date'],
            'currency_code' => ['nullable', 'string', 'size:3'],
            'exchange_rate' => ['nullable', 'numeric', 'gt:0'],
            'order_discount_type' => ['nullable', 'string', 'in:flat,percentage'],
            'order_discount_value' => ['nullable', 'numeric', 'gte:0'],
            'discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'terms_and_conditions' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id' => ['nullable'],
            'items.*.unit_price' => ['required', 'numeric', 'gte:0'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.discount_type' => ['nullable', 'string', 'in:flat,percentage'],
            'items.*.discount_value' => ['nullable', 'numeric', 'gte:0'],
            'items.*.discount_percentage' => ['nullable', 'numeric', 'gte:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'items.*.tax_profile_id' => ['nullable', 'integer'],
            'items.*.tax_rate' => ['nullable', 'numeric', 'gte:0'],
            'items.*.expected_date' => ['nullable', 'date'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }
}
