<?php

declare(strict_types=1);

namespace App\Modules\Production\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class StoreProductionPlanRequest extends FormRequest
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
            'company_id' => ['required'],
            'factory_id' => ['required'],
            'plan_number' => ['required', 'string', 'max:64'],
            'plan_date' => ['required', 'date'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'source' => ['required', Rule::in(['manual', 'forecast', 'sales_order', 'mrp'])],
            'status' => ['sometimes', Rule::in(['draft', 'approved', 'in_progress', 'completed', 'cancelled'])],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required'],
            'items.*.bill_of_material_id' => ['required'],
            'items.*.planned_quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id' => ['required'],
            'items.*.production_line_id' => ['sometimes', 'nullable'],
            'items.*.scheduled_date' => ['sometimes', 'nullable'],
            'items.*.sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $user = $this->user();
        $tenantId = $user ? (int) $user->tenant_id : null;

        // Auto-resolve company_id
        if (! $this->filled('company_id') && $tenantId !== null) {
            $companyUuid = DB::table('companies')
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->value('uuid')
                ?? DB::table('companies')->where('tenant_id', $tenantId)->value('uuid');

            if ($companyUuid !== null) {
                $this->merge(['company_id' => $companyUuid]);
            }
        }

        // Auto-resolve factory_id
        if (! $this->filled('factory_id') && $tenantId !== null) {
            $factoryUuid = $user?->default_factory_id
                ? DB::table('factories')->where('id', $user->default_factory_id)->value('uuid')
                : DB::table('factories')->where('tenant_id', $tenantId)->where('is_active', true)->value('uuid');

            if ($factoryUuid !== null) {
                $this->merge(['factory_id' => $factoryUuid]);
            }
        }

        // Auto-resolve dates from start_date / end_date
        $startDate = $this->input('period_start') ?? $this->input('start_date') ?? $this->input('plan_date') ?? now()->toDateString();
        $endDate = $this->input('period_end') ?? $this->input('end_date') ?? now()->addDays(7)->toDateString();

        if (! $this->filled('plan_date')) {
            $this->merge(['plan_date' => $startDate]);
        }
        if (! $this->filled('period_start')) {
            $this->merge(['period_start' => $startDate]);
        }
        if (! $this->filled('period_end')) {
            $this->merge(['period_end' => $endDate]);
        }

        // Notes / Title
        if (! $this->filled('notes') && $this->filled('title')) {
            $this->merge(['notes' => $this->input('title')]);
        }

        // Default source
        if (! $this->filled('source')) {
            $this->merge(['source' => 'manual']);
        }

        // Process items
        if ($this->has('items') && is_array($this->input('items'))) {
            $items = $this->input('items');
            foreach ($items as &$item) {
                if (is_array($item)) {
                    if (empty($item['bill_of_material_id']) && ! empty($item['bom_id'])) {
                        $item['bill_of_material_id'] = $item['bom_id'];
                    }

                    // Resolve unit_id from BOM output_unit_id or Product base_unit_id
                    if (empty($item['unit_id']) && ! empty($item['bill_of_material_id']) && $tenantId !== null) {
                        $bom = DB::table('bill_of_materials')
                            ->where('tenant_id', $tenantId)
                            ->where(function ($q) use ($item): void {
                                $q->where('uuid', $item['bill_of_material_id']);
                                if (is_numeric($item['bill_of_material_id'])) {
                                    $q->orWhere('id', (int) $item['bill_of_material_id']);
                                }
                            })
                            ->first();

                        if ($bom && $bom->output_unit_id) {
                            $unitUuid = DB::table('units')->where('id', $bom->output_unit_id)->value('uuid');
                            if ($unitUuid) {
                                $item['unit_id'] = $unitUuid;
                            }
                        }
                    }

                    if (empty($item['unit_id']) && ! empty($item['product_id']) && $tenantId !== null) {
                        $prod = DB::table('products')
                            ->where('tenant_id', $tenantId)
                            ->where(function ($q) use ($item): void {
                                $q->where('uuid', $item['product_id']);
                                if (is_numeric($item['product_id'])) {
                                    $q->orWhere('id', (int) $item['product_id']);
                                }
                            })
                            ->first();

                        if ($prod && $prod->base_unit_id) {
                            $unitUuid = DB::table('units')->where('id', $prod->base_unit_id)->value('uuid');
                            if ($unitUuid) {
                                $item['unit_id'] = $unitUuid;
                            }
                        }
                    }

                    if (empty($item['unit_id']) && $tenantId !== null) {
                        $item['unit_id'] = DB::table('units')->where('tenant_id', $tenantId)->value('uuid');
                    }
                }
            }
            unset($item);
            $this->merge(['items' => $items]);
        }
    }
}
