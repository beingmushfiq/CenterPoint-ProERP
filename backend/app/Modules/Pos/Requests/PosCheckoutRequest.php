<?php

declare(strict_types=1);

namespace App\Modules\Pos\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class PosCheckoutRequest extends FormRequest
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
            'pos_session_id' => ['required', 'integer'],
            'party_id' => ['nullable', 'integer'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:64'],
            'order_date' => ['nullable', 'date'],
            'discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'order_discount_type' => ['nullable', 'string', 'in:flat,percentage'],
            'order_discount_value' => ['nullable', 'numeric', 'gte:0'],
            'round_off' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id' => ['required', 'integer'],
            'items.*.unit_price' => ['required', 'numeric', 'gte:0'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'items.*.discount_type' => ['nullable', 'string', 'in:flat,percentage'],
            'items.*.discount_value' => ['nullable', 'numeric', 'gte:0'],
            'items.*.discount_percentage' => ['nullable', 'numeric', 'gte:0'],
            'items.*.tax_profile_id' => ['nullable', 'integer'],
            'items.*.tax_amount' => ['nullable', 'numeric', 'gte:0'],
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.method' => ['required', 'string', 'in:cash,card,mobile_banking,credit_adjustment'],
            'payments.*.amount' => ['required', 'numeric', 'gt:0'],
            'payments.*.change_given' => ['nullable', 'numeric', 'gte:0'],
        ];
    }
}
