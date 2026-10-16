<?php

declare(strict_types=1);

namespace App\Modules\QC\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreQcParameterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:128'],
            'type' => ['required', 'string', 'in:numeric,boolean,select,text'],
            'product_id' => ['nullable', 'string', 'uuid'],
            'unit_id' => ['nullable', 'string', 'uuid'],
            'min_value' => ['nullable', 'numeric', 'regex:/^-?\d+(\.\d{1,4})?$/'],
            'max_value' => ['nullable', 'numeric', 'regex:/^-?\d+(\.\d{1,4})?$/'],
            'options' => ['nullable', 'array'],
            'is_mandatory' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'code' => ['nullable', 'string'],
            'category' => ['nullable', 'string'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (! $this->has('type') && $this->has('data_type')) {
            $this->merge(['type' => $this->input('data_type')]);
        }

        if ($this->input('type') !== 'numeric') {
            $this->merge([
                'min_value' => null,
                'max_value' => null,
            ]);
        }
    }
}
