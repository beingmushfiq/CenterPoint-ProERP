<?php

declare(strict_types=1);

namespace App\Modules\Sales\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreExchangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'exchange_date' => ['required', 'date'],
            'warehouse_id' => ['required', 'integer', 'min:1'],
            'reason_code_id' => ['required', 'integer', 'min:1'],
            'original_invoice_id' => ['nullable', 'integer', 'min:1'],
            'original_sales_order_id' => ['nullable', 'integer', 'min:1'],
            'party_id' => ['nullable', 'integer', 'min:1'],
            'pos_session_id' => ['nullable', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:2000'],

            'return_items' => ['required', 'array', 'min:1'],
            'return_items.*.product_id' => ['required', 'integer', 'min:1'],
            'return_items.*.quantity' => ['required', 'numeric', 'min:0.0001'],
            'return_items.*.unit_id' => ['required', 'integer', 'min:1'],
            'return_items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'return_items.*.variant_id' => ['nullable', 'integer', 'min:1'],
            'return_items.*.condition' => ['nullable', 'string', 'in:good,damaged,defective'],
            'return_items.*.restock' => ['nullable', 'boolean'],
            'return_items.*.batch_code' => ['nullable', 'string', 'max:64'],

            'replacement_items' => ['required', 'array', 'min:1'],
            'replacement_items.*.product_id' => ['required', 'integer', 'min:1'],
            'replacement_items.*.quantity' => ['required', 'numeric', 'min:0.0001'],
            'replacement_items.*.unit_id' => ['required', 'integer', 'min:1'],
            'replacement_items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'replacement_items.*.variant_id' => ['nullable', 'integer', 'min:1'],
            'replacement_items.*.batch_code' => ['nullable', 'string', 'max:64'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'return_items.required' => 'At least one return item is required.',
            'replacement_items.required' => 'At least one replacement item is required.',
        ];
    }
}
