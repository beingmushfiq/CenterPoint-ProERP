<?php

declare(strict_types=1);

namespace App\Modules\Production\Requests;

use App\Models\ProductionBatch;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class RecordBatchInputRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        // Aliasing quantity
        if (! $this->has('quantity') && $this->has('actual_quantity')) {
            $merge['quantity'] = $this->input('actual_quantity');
        }

        // Default source
        if (! $this->has('source')) {
            $merge['source'] = 'material_issue';
        }

        // Product UUID resolution
        $productId = $this->input('product_id');
        if (is_numeric($productId)) {
            $productUuid = DB::table('products')->where('id', (int) $productId)->value('uuid');
            if ($productUuid !== null) {
                $merge['product_id'] = $productUuid;
                $productId = $productUuid;
            }
        }

        // Unit UUID resolution
        $unitId = $this->input('unit_id');
        if (empty($unitId)) {
            // First check product's base_unit_id
            if (! empty($productId)) {
                $baseUnitId = DB::table('products')->where('uuid', $productId)->value('base_unit_id');
                if ($baseUnitId) {
                    $unitUuid = DB::table('units')->where('id', $baseUnitId)->value('uuid');
                    if ($unitUuid !== null) {
                        $merge['unit_id'] = $unitUuid;
                    }
                }
            }

            // Fallback to batch output_unit_id if still empty
            if (empty($merge['unit_id'])) {
                $batch = $this->route('productionBatch');
                if ($batch instanceof ProductionBatch && $batch->output_unit_id) {
                    $unitUuid = DB::table('units')->where('id', $batch->output_unit_id)->value('uuid');
                    if ($unitUuid !== null) {
                        $merge['unit_id'] = $unitUuid;
                    }
                }
            }
        } elseif (is_numeric($unitId)) {
            $unitUuid = DB::table('units')->where('id', (int) $unitId)->value('uuid');
            if ($unitUuid !== null) {
                $merge['unit_id'] = $unitUuid;
            }
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
            'quantity' => ['required', 'numeric', 'gt:0', 'decimal:0,4'],
            'unit_id' => ['required', 'uuid'],
            'source' => ['required', Rule::in(['material_issue', 'manual_count', 'weighbridge', 'carry_forward'])],
            'material_issue_item_id' => ['sometimes', 'nullable', 'uuid'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }
}
