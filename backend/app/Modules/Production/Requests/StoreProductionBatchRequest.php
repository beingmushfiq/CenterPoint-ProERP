<?php

declare(strict_types=1);

namespace App\Modules\Production\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class StoreProductionBatchRequest extends FormRequest
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
            'batch_number' => ['required', 'string', 'max:64'],
            'production_plan_item_id' => ['sometimes', 'nullable', 'uuid'],
            'factory_id' => ['required', 'uuid'],
            'production_line_id' => ['sometimes', 'nullable', 'uuid'],
            'product_id' => ['required', 'uuid'],
            'bill_of_material_id' => ['required', 'uuid'],
            'shift_id' => ['sometimes', 'nullable', 'uuid'],
            'batch_date' => ['required', 'date_format:Y-m-d'],
            'planned_quantity' => ['required', 'numeric', 'gt:0'],
            'output_unit_id' => ['required', 'uuid'],
            'status' => ['sometimes', Rule::in(['draft', 'scheduled', 'in_progress', 'completed', 'closed', 'cancelled'])],
            'supervisor_id' => ['sometimes', 'nullable', 'uuid'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        // Alias bom_id -> bill_of_material_id
        if (! $this->has('bill_of_material_id') && $this->has('bom_id')) {
            $merge['bill_of_material_id'] = $this->input('bom_id');
        }

        // Alias target_quantity -> planned_quantity
        if (! $this->has('planned_quantity') && $this->has('target_quantity')) {
            $merge['planned_quantity'] = $this->input('target_quantity');
        }

        // Alias scheduled_start -> batch_date, or fallback to today
        if (! $this->has('batch_date')) {
            $merge['batch_date'] = $this->input('scheduled_start') ?? now()->toDateString();
        }

        // Auto-resolve factory_id if missing
        if (! $this->has('factory_id') || empty($this->input('factory_id'))) {
            $user = $this->user();
            $tenantId = $user?->tenant_id;
            $factoryUuid = null;
            if ($user?->default_factory_id) {
                $factoryUuid = DB::table('factories')->where('id', $user->default_factory_id)->value('uuid');
            }
            if (! $factoryUuid && $tenantId) {
                $factoryUuid = DB::table('factories')->where('tenant_id', $tenantId)->where('is_active', true)->value('uuid');
            }
            if (! $factoryUuid && $tenantId) {
                $factoryUuid = DB::table('factories')->where('tenant_id', $tenantId)->value('uuid');
            }
            if ($factoryUuid) {
                $merge['factory_id'] = $factoryUuid;
            }
        }

        // Auto-resolve output_unit_id from BOM or Product if missing
        if (! $this->has('output_unit_id') || empty($this->input('output_unit_id'))) {
            $bomId = $merge['bill_of_material_id'] ?? $this->input('bill_of_material_id') ?? $this->input('bom_id');
            $unitUuid = null;
            if ($bomId) {
                $unitId = DB::table('bill_of_materials')->where('uuid', $bomId)->value('output_unit_id');
                if (! $unitId && is_numeric($bomId)) {
                    $unitId = DB::table('bill_of_materials')->where('id', (int) $bomId)->value('output_unit_id');
                }
                if ($unitId) {
                    $unitUuid = DB::table('units')->where('id', $unitId)->value('uuid');
                }
            }
            if (! $unitUuid) {
                $productId = $this->input('product_id');
                if ($productId) {
                    $baseUnitId = DB::table('products')->where('uuid', $productId)->value('base_unit_id');
                    if (! $baseUnitId && is_numeric($productId)) {
                        $baseUnitId = DB::table('products')->where('id', (int) $productId)->value('base_unit_id');
                    }
                    if ($baseUnitId) {
                        $unitUuid = DB::table('units')->where('id', $baseUnitId)->value('uuid');
                    }
                }
            }
            if ($unitUuid) {
                $merge['output_unit_id'] = $unitUuid;
            }
        }

        if (! empty($merge)) {
            $this->merge($merge);
        }
    }
}
