<?php

declare(strict_types=1);

namespace App\Modules\Sales\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreSalesReturnRequest extends FormRequest
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
            'return_date' => ['required', 'date'],
            'warehouse_id' => ['required', 'integer'],
            'reason_code_id' => ['required', 'integer'],
            'invoice_id' => ['nullable', 'integer'],
            'sales_order_id' => ['nullable', 'integer'],
            'party_id' => ['nullable', 'integer'],
            'restock' => ['nullable', 'boolean'],
            'refund_method' => ['nullable', 'string', 'in:cash,bank,credit_note,exchange'],
            'credit_note_number' => ['nullable', 'string', 'max:64'],
            'return_number' => ['nullable', 'string', 'max:64'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id' => ['required', 'integer'],
            'items.*.unit_price' => ['required', 'numeric', 'gte:0'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.condition' => ['nullable', 'string', 'in:good,damaged'],
            'items.*.batch_code' => ['nullable', 'string', 'max:64'],
        ];
    }
}
