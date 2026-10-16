<?php

declare(strict_types=1);

namespace App\Modules\Assets\Actions;

use App\Modules\Assets\Models\Asset;
use App\Modules\Assets\Models\AssetCategory;
use Illuminate\Support\Facades\DB;

class CreateAssetAction
{
    /**
     * @param array{
     *     asset_code?: string,
     *     name: string,
     *     asset_category_id: int,
     *     company_id: int,
     *     branch_id: int,
     *     purchase_cost: float|string,
     *     salvage_value?: float|string,
     *     useful_life_months?: int,
     *     depreciation_method?: string,
     *     purchase_date?: string,
     *     serial_number?: string,
     *     assigned_employee_id?: int,
     *     status?: string,
     * } $data
     */
    public function execute(array $data, int $userId): Asset
    {
        return DB::transaction(function () use ($data, $userId): Asset {
            $category = AssetCategory::findOrFail($data['asset_category_id']);

            $cost = (string) $data['purchase_cost'];
            $salvage = (string) ($data['salvage_value'] ?? '0.0000');
            $code = $data['asset_code'] ?? ('AST-'.date('Ym').'-'.str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT));

            return Asset::create([
                'asset_code' => $code,
                'name' => $data['name'],
                'asset_category_id' => $category->id,
                'company_id' => $data['company_id'],
                'branch_id' => $data['branch_id'],
                'purchase_cost' => $cost,
                'salvage_value' => $salvage,
                'accumulated_depreciation' => '0.0000',
                'book_value' => $cost,
                'useful_life_months' => $data['useful_life_months'] ?? $category->default_useful_life_months,
                'depreciation_method' => $data['depreciation_method'] ?? $category->default_depreciation_method,
                'purchase_date' => $data['purchase_date'] ?? date('Y-m-d'),
                'serial_number' => $data['serial_number'] ?? null,
                'assigned_employee_id' => $data['assigned_employee_id'] ?? null,
                'status' => $data['status'] ?? 'in_use',
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);
        });
    }
}
