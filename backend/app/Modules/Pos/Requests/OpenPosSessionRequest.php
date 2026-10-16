<?php

declare(strict_types=1);

namespace App\Modules\Pos\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class OpenPosSessionRequest extends FormRequest
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
            'terminal_id' => ['required', 'integer'],
            'branch_id' => ['required', 'integer'],
            'warehouse_id' => ['required', 'integer'],
            'opening_cash' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'session_number' => ['nullable', 'string', 'max:64'],
        ];
    }
}
