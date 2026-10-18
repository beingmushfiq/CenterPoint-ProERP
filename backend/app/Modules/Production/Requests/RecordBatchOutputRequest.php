<?php

declare(strict_types=1);

namespace App\Modules\Production\Requests;

use App\Models\ProductionBatch;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class RecordBatchOutputRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        // Normalize output_type
        $outputType = $this->input('output_type');
        if ($outputType === 'finished_good') {
            $merge['output_type'] = 'primary';
        } elseif ($outputType === 'byproduct') {
            $merge['output_type'] = 'by_product';
        } elseif (! $this->has('output_type')) {
            $merge['output_type'] = 'primary';
        }

        // Warehouse aliasing
        if (! $this->has('target_warehouse_id') && $this->has('warehouse_id')) {
            $merge['target_warehouse_id'] = $this->input('warehouse_id');
        }

        // Quantity aliasing
        if (! $this->has('quantity') && $this->has('good_quantity')) {
            $merge['quantity'] = $this->input('good_quantity');
        }

        // Resolve batch context for defaults
        $batch = $this->route('productionBatch');

        // Resolve product_id
        $productId = $this->input('product_id');
        if (empty($productId) && $batch instanceof ProductionBatch && $batch->product_id) {
            $productUuid = DB::table('products')->where('id', $batch->product_id)->value('uuid');
            if ($productUuid !== null) {
                $merge['product_id'] = $productUuid;
            }
        } elseif (is_numeric($productId)) {
            $productUuid = DB::table('products')->where('id', (int) $productId)->value('uuid');
            if ($productUuid !== null) {
                $merge['product_id'] = $productUuid;
            }
        }

        // Resolve warehouse uuid if numeric
        $targetWarehouseId = $merge['target_warehouse_id'] ?? $this->input('target_warehouse_id');
        if (is_numeric($targetWarehouseId)) {
            $whUuid = DB::table('warehouses')->where('id', (int) $targetWarehouseId)->value('uuid');
            if ($whUuid !== null) {
                $merge['target_warehouse_id'] = $whUuid;
            }
        }

        // Resolve unit_id
        $unitId = $this->input('unit_id');
        if (empty($unitId)) {
            if ($batch instanceof ProductionBatch && $batch->output_unit_id) {
                $unitUuid = DB::table('units')->where('id', $batch->output_unit_id)->value('uuid');
                if ($unitUuid !== null) {
                    $merge['unit_id'] = $unitUuid;
                }
            }
        } elseif (is_numeric($unitId)) {
            $unitUuid = DB::table('units')->where('id', (int) $unitId)->value('uuid');
            if ($unitUuid !== null) {
                $merge['unit_id'] = $unitUuid;
            }
        }

        // Default batch code
        if (! $this->filled('batch_code') && $batch instanceof ProductionBatch && ! empty($batch->batch_number)) {
            $merge['batch_code'] = $batch->batch_number;
        }

        // Default qc_required
        if (! $this->has('qc_required')) {
            $merge['qc_required'] = true;
        }

        if ($merge !== []) {
            $this->merge($merge);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'uuid'],
            'variant_id' => ['sometimes', 'nullable', 'uuid'],
            'quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4'],
            'unit_id' => ['required', 'uuid'],
            'output_type' => ['required', Rule::in(['primary', 'by_product', 'semi_finished'])],
            'batch_code' => ['sometimes', 'nullable', 'string', 'max:64'],
            'expiry_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'target_warehouse_id' => ['required', 'uuid'],
            'qc_required' => ['sometimes', 'boolean'],
        ];
    }
}
