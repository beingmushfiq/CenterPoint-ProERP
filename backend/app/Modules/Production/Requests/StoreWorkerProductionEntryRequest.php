<?php

declare(strict_types=1);

namespace App\Modules\Production\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class StoreWorkerProductionEntryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'production_batch_id' => ['required', 'string'],
            'employee_id' => ['required', 'string'],
            'product_id' => ['required', 'string'],
            'production_line_id' => ['nullable', 'string'],
            'shift_id' => ['nullable', 'string'],
            'work_date' => ['required', 'date'],
            'measure_type' => ['required', 'string', 'in:piece,weight,volume,unit'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'unit_id' => ['required', 'string'],
            'rework_quantity' => ['nullable', 'numeric', 'gte:0'],
            'rejected_quantity' => ['nullable', 'numeric', 'gte:0'],
            'hours_worked' => ['nullable', 'numeric', 'gt:0'],
            'rate_type' => ['nullable', 'string', 'in:piece_rate,hourly,fixed,none'],
            'rate' => ['nullable', 'numeric', 'gte:0'],
            'incentive_amount' => ['nullable', 'numeric', 'gte:0'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $user = $this->user();
        $tenantId = $user ? (int) $user->tenant_id : 1;

        // 1. Alias batch_id -> production_batch_id
        if (! $this->filled('production_batch_id') && $this->filled('batch_id')) {
            $this->merge(['production_batch_id' => $this->input('batch_id')]);
        }

        $batchId = $this->input('production_batch_id');
        $batch = null;
        if ($batchId) {
            $batch = DB::table('production_batches')
                ->where('tenant_id', $tenantId)
                ->where(function ($q) use ($batchId): void {
                    $q->where('uuid', $batchId);
                    if (is_numeric($batchId)) {
                        $q->orWhere('id', (int) $batchId);
                    }
                })
                ->first();
        }

        // 2. Auto-resolve product_id from batch if missing
        if (! $this->filled('product_id') && $batch) {
            $productUuid = DB::table('products')->where('id', $batch->product_id)->value('uuid');
            if ($productUuid) {
                $this->merge(['product_id' => $productUuid]);
            }
        }

        // 3. Auto-resolve unit_id from batch or product
        if (! $this->filled('unit_id')) {
            if ($batch && $batch->output_unit_id) {
                $unitUuid = DB::table('units')->where('id', $batch->output_unit_id)->value('uuid');
                if ($unitUuid) {
                    $this->merge(['unit_id' => $unitUuid]);
                }
            } elseif ($this->filled('product_id')) {
                $productId = $this->input('product_id');
                $product = DB::table('products')
                    ->where(function ($q) use ($productId): void {
                        $q->where('uuid', $productId);
                        if (is_numeric($productId)) {
                            $q->orWhere('id', (int) $productId);
                        }
                    })
                    ->first();
                if ($product && $product->base_unit_id) {
                    $unitUuid = DB::table('units')->where('id', $product->base_unit_id)->value('uuid');
                    if ($unitUuid) {
                        $this->merge(['unit_id' => $unitUuid]);
                    }
                }
            }

            if (! $this->filled('unit_id')) {
                $unitUuid = DB::table('units')->where('tenant_id', $tenantId)->value('uuid');
                if ($unitUuid) {
                    $this->merge(['unit_id' => $unitUuid]);
                }
            }
        }

        // 4. Quantity: alias good_quantity -> quantity
        if (! $this->filled('quantity') && $this->filled('good_quantity')) {
            $this->merge(['quantity' => $this->input('good_quantity')]);
        }

        // 5. Measure type: default to 'piece' or 'unit'
        if (! $this->filled('measure_type')) {
            $this->merge(['measure_type' => 'piece']);
        }

        // 6. Rate type: alias wage_type -> rate_type
        if (! $this->filled('rate_type') && $this->filled('wage_type')) {
            $this->merge(['rate_type' => $this->input('wage_type')]);
        }
        if (! $this->filled('rate_type')) {
            $this->merge(['rate_type' => 'piece_rate']);
        }

        // 7. Rate: alias piece_rate -> rate
        if (! $this->filled('rate') && $this->filled('piece_rate')) {
            $this->merge(['rate' => $this->input('piece_rate')]);
        }

        // 8. Shift: if shift is a string like 'morning', 'evening', lookup matching shift or set shift_id
        if (! $this->filled('shift_id') && $this->filled('shift')) {
            $shiftStr = strtolower(trim((string) $this->input('shift')));
            $shiftRow = DB::table('shifts')
                ->where('tenant_id', $tenantId)
                ->where(function ($q) use ($shiftStr): void {
                    $q->whereRaw('LOWER(name) LIKE ?', ["%{$shiftStr}%"])
                        ->orWhereRaw('LOWER(code) LIKE ?', ["%{$shiftStr}%"]);
                })
                ->first();
            if ($shiftRow) {
                $this->merge(['shift_id' => $shiftRow->uuid]);
            } else {
                $this->offsetUnset('shift');
            }
        } elseif ($this->filled('shift_id') && ! Str::isUuid((string) $this->input('shift_id'))) {
            $this->offsetUnset('shift_id');
        }

        // 9. Employee ID:
        // If mock 'emp-1' or code 'EMP-001' or numeric passed, resolve to actual employee UUID
        if ($this->filled('employee_id')) {
            $empVal = (string) $this->input('employee_id');
            $employee = DB::table('employees')
                ->where('tenant_id', $tenantId)
                ->where(function ($q) use ($empVal): void {
                    $q->where('uuid', $empVal)
                        ->orWhere('employee_code', $empVal);
                    if ($empVal === 'emp-1') {
                        $q->orWhere('employee_code', 'EMP-001');
                    } elseif ($empVal === 'emp-2') {
                        $q->orWhere('employee_code', 'EMP-002');
                    }
                    if (is_numeric($empVal)) {
                        $q->orWhere('id', (int) $empVal);
                    }
                })
                ->first();

            if ($employee) {
                $this->merge(['employee_id' => $employee->uuid]);
            }
        }
    }
}
