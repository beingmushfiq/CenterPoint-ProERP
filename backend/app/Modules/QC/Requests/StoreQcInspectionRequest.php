<?php

declare(strict_types=1);

namespace App\Modules\QC\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreQcInspectionRequest extends FormRequest
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
            'inspection_number' => ['required', 'string', 'max:64'],
            'production_batch_id' => ['nullable', 'string', 'uuid'],
            'batch_id' => ['nullable', 'string'],
            'product_id' => ['nullable', 'string'],
            'inspection_type' => ['nullable', 'string'],
            'production_output_id' => ['nullable', 'string', 'uuid'],
            'inspection_date' => ['required', 'date_format:Y-m-d'],
            'inspector_id' => ['required', 'string', 'uuid'],
            'sample_size' => ['required', 'numeric', 'gte:0', 'regex:/^\d+(\.\d{1,4})?$/'],
            'inspected_quantity' => ['required', 'numeric', 'gt:0', 'regex:/^\d+(\.\d{1,4})?$/'],
            'passed_quantity' => ['required', 'numeric', 'gte:0', 'regex:/^\d+(\.\d{1,4})?$/'],
            'failed_quantity' => ['nullable', 'numeric', 'gte:0', 'regex:/^\d+(\.\d{1,4})?$/'],
            'rejected_quantity' => ['nullable', 'numeric', 'gte:0', 'regex:/^\d+(\.\d{1,4})?$/'],
            'rework_quantity' => ['nullable', 'numeric', 'gte:0', 'regex:/^\d+(\.\d{1,4})?$/'],
            'scrap_quantity' => ['nullable', 'numeric', 'gte:0', 'regex:/^\d+(\.\d{1,4})?$/'],
            'result' => ['required', 'string', 'in:pass,fail,partial,hold'],
            'notes' => ['nullable', 'string'],

            // Nested inspection results
            'results' => ['nullable', 'array'],
            'results.*.qc_parameter_id' => ['required', 'string', 'uuid'],
            'results.*.value_numeric' => ['nullable', 'numeric', 'regex:/^-?\d+(\.\d{1,4})?$/'],
            'results.*.value_boolean' => ['nullable', 'boolean'],
            'results.*.value_text' => ['nullable', 'string'],
            'results.*.is_within_spec' => ['required', 'boolean'],
            'results.*.notes' => ['nullable', 'string'],

            // Nested defects
            'defects' => ['nullable', 'array'],
            'defects.*.defect_reason_id' => ['required', 'string', 'uuid'],
            'defects.*.quantity' => ['required', 'numeric', 'gt:0', 'regex:/^\d+(\.\d{1,4})?$/'],
            'defects.*.severity' => ['nullable', 'string', 'in:minor,major,critical'],
            'defects.*.notes' => ['nullable', 'string'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $tenantId = \App\Core\Tenancy\TenantContext::current()?->tenantId();
        $merges = [];

        // 1. Auto-generate inspection_number if missing
        if (! $this->filled('inspection_number')) {
            $datePrefix = date('Ymd');
            $randomSuffix = strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
            $merges['inspection_number'] = "QC-{$datePrefix}-{$randomSuffix}";
        }

        // 2. Map batch_id to production_batch_id
        if (! $this->filled('production_batch_id') && $this->filled('batch_id')) {
            $merges['production_batch_id'] = $this->input('batch_id');
        }

        // 3. Map rejected_quantity to failed_quantity
        if (! $this->filled('failed_quantity') && $this->filled('rejected_quantity')) {
            $merges['failed_quantity'] = $this->input('rejected_quantity');
        }

        // 4. Default inspected_quantity to sample_size if not given
        if (! $this->filled('inspected_quantity') && $this->filled('sample_size')) {
            $merges['inspected_quantity'] = $this->input('sample_size');
        }

        // 5. Auto-calculate result if missing
        if (! $this->filled('result')) {
            $failed = (float) ($this->input('failed_quantity') ?? $this->input('rejected_quantity') ?? 0);
            $passed = (float) ($this->input('passed_quantity') ?? 0);
            if ($failed > 0 && $passed > 0) {
                $merges['result'] = 'partial';
            } elseif ($failed > 0) {
                $merges['result'] = 'fail';
            } else {
                $merges['result'] = 'pass';
            }
        }

        // 6. Resolve inspector_id if missing
        if (! $this->filled('inspector_id')) {
            /** @var \App\Models\User|null $user */
            $user = $this->user();
            $employee = null;
            if ($user !== null) {
                $employee = \App\Models\Employee::where('tenant_id', $tenantId ?? $user->tenant_id)
                    ->where('user_id', $user->id)
                    ->first();
            }
            if ($employee === null) {
                $employee = \App\Models\Employee::where('tenant_id', $tenantId ?? 1)->first();
            }
            if ($employee !== null) {
                $merges['inspector_id'] = $employee->uuid;
            }
        }

        // 7. Normalize nested results if present
        if ($this->has('results') && is_array($this->input('results'))) {
            $mappedResults = [];
            foreach ($this->input('results') as $r) {
                if (! is_array($r) || empty($r['qc_parameter_id'])) {
                    continue;
                }
                $val = $r['measured_value'] ?? $r['value_numeric'] ?? null;
                $mappedResults[] = [
                    'qc_parameter_id' => $r['qc_parameter_id'],
                    'value_numeric' => is_numeric($val) ? (string) $val : null,
                    'value_text' => is_string($val) && ! is_numeric($val) ? $val : ($r['value_text'] ?? null),
                    'value_boolean' => $r['value_boolean'] ?? null,
                    'is_within_spec' => $r['is_within_spec'] ?? ($r['is_passed'] ?? true),
                    'notes' => $r['notes'] ?? ($r['remarks'] ?? null),
                ];
            }
            $merges['results'] = $mappedResults;
        }

        if ($merges !== []) {
            $this->merge($merges);
        }
    }
}
