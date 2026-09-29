<?php

declare(strict_types=1);

namespace App\Modules\Sales\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreSalesOrderRequest extends FormRequest
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
            'order_date'      => ['required', 'date'],
            'channel'         => ['nullable', 'string', 'in:counter,dealer,phone,field,online'],
            'party_id'        => ['nullable'],
            'lead_id'         => ['nullable', 'integer'],
            'salesman_id'     => ['nullable', 'integer'],
            'customer_name'   => ['nullable', 'string', 'max:255'],
            'customer_phone'  => ['nullable', 'string', 'max:64'],
            'warehouse_id'    => ['nullable', 'integer'],
            'branch_id'       => ['nullable', 'integer'],
            'company_id'      => ['nullable', 'integer'],
            'required_date'   => ['nullable', 'date'],
            'price_list_id'   => ['nullable', 'integer'],
            'currency_code'   => ['nullable', 'string', 'size:3'],
            'order_discount_type'          => ['nullable', 'string', 'in:flat,percentage'],
            'order_discount_value'         => ['nullable', 'numeric', 'gte:0'],
            'discount_amount'              => ['nullable', 'numeric', 'gte:0'],
            'shipping_amount' => ['nullable', 'numeric', 'gte:0'],
            'round_off'       => ['nullable', 'numeric'],
            'delivery_type'   => ['nullable', 'string', 'in:pickup,own_delivery,courier'],
            'salesperson_id'  => ['nullable', 'integer'],
            'notes'           => ['nullable', 'string', 'max:2000'],
            'internal_notes'  => ['nullable', 'string', 'max:2000'],
            'order_number'    => ['nullable', 'string', 'max:64'],
            'items'                        => ['required', 'array', 'min:1'],
            'items.*.product_id'           => ['required'],
            'items.*.quantity'             => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id'              => ['nullable'],
            'items.*.unit_price'           => ['required', 'numeric', 'gte:0'],
            'items.*.variant_id'           => ['nullable', 'integer'],
            'items.*.description'          => ['nullable', 'string', 'max:500'],
            'items.*.discount_type'        => ['nullable', 'string', 'in:flat,percentage'],
            'items.*.discount_value'       => ['nullable', 'numeric', 'gte:0'],
            'items.*.discount_percentage'  => ['nullable', 'numeric', 'gte:0'],
            'items.*.discount_amount'      => ['nullable', 'numeric', 'gte:0'],
            'items.*.tax_profile_id'       => ['nullable', 'integer'],
            'items.*.tax_amount'           => ['nullable', 'numeric', 'gte:0'],
            'items.*.batch_code'           => ['nullable', 'string', 'max:64'],
            'items.*.sort_order'           => ['nullable', 'integer'],
        ];
    }
}
