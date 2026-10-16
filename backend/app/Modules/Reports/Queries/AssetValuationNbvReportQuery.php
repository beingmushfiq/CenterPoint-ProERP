<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\AssetDataProvider;

class AssetValuationNbvReportQuery implements ReportQueryInterface
{
    protected AssetDataProvider $provider;

    public function __construct(?AssetDataProvider $provider = null)
    {
        $this->provider = $provider ?? new AssetDataProvider;
    }

    public function columns(): array
    {
        return [
            'asset_tag' => [
                'label' => 'Asset Tag',
                'type' => 'string',
                'sortable' => true,
            ],
            'name' => [
                'label' => 'Asset Name',
                'type' => 'string',
            ],
            'category' => [
                'label' => 'Category',
                'type' => 'string',
            ],
            'purchase_cost' => [
                'label' => 'Purchase Cost (BDT)',
                'type' => 'currency',
            ],
            'total_depreciation' => [
                'label' => 'Accumulated Dep. (BDT)',
                'type' => 'currency',
            ],
            'current_nbv' => [
                'label' => 'Current NBV (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'depreciation_method' => [
                'label' => 'Method',
                'type' => 'string',
            ],
            'useful_life_months' => [
                'label' => 'Useful Life (Months)',
                'type' => 'number',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->valuationNbv($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
