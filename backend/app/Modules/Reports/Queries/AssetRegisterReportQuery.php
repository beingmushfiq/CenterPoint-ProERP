<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\AssetDataProvider;

class AssetRegisterReportQuery implements ReportQueryInterface
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
            'serial_number' => [
                'label' => 'Serial No',
                'type' => 'string',
            ],
            'purchase_date' => [
                'label' => 'Purchase Date',
                'type' => 'date',
            ],
            'purchase_cost' => [
                'label' => 'Purchase Cost (BDT)',
                'type' => 'currency',
            ],
            'current_nbv' => [
                'label' => 'Net Book Value (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'condition' => [
                'label' => 'Condition',
                'type' => 'badge',
            ],
            'status' => [
                'label' => 'Status',
                'type' => 'badge',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->register($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
