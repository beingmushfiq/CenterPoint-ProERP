<?php

declare(strict_types=1);

namespace App\Modules\Sales\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreDeliveryOrderRequest extends FormRequest
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
            'sales_order_id' => ['required', 'integer'],
            'warehouse_id' => ['required', 'integer'],
            'recipient_name' => ['required', 'string', 'max:255'],
            'recipient_phone' => ['required', 'string', 'max:64'],
            'delivery_type' => ['nullable', 'string', 'in:own_delivery,courier,pickup'],
            'invoice_id' => ['nullable', 'integer'],
            'party_id' => ['nullable', 'integer'],
            'delivery_address_id' => ['nullable', 'integer'],
            'scheduled_date' => ['nullable', 'date'],
            'cod_amount' => ['nullable', 'numeric', 'gte:0'],
            'delivery_charge' => ['nullable', 'numeric', 'gte:0'],
            'special_instructions' => ['nullable', 'string', 'max:2000'],
            'delivery_number' => ['nullable', 'string', 'max:64'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id' => ['required', 'integer'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.batch_code' => ['nullable', 'string', 'max:64'],
            'items.*.sales_order_item_id' => ['nullable', 'integer'],
        ];
    }
}
