<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\AssetDataProvider;

class AssignedAssetsReportQuery implements ReportQueryInterface
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
            'assigned_to' => [
                'label' => 'Assigned Custodian',
                'type' => 'string',
            ],
            'department' => [
                'label' => 'Department',
                'type' => 'string',
            ],
            'branch' => [
                'label' => 'Branch / Location',
                'type' => 'string',
            ],
            'line' => [
                'label' => 'Production Line',
                'type' => 'string',
            ],
            'assigned_date' => [
                'label' => 'Assignment Date',
                'type' => 'date',
            ],
            'condition' => [
                'label' => 'Current Condition',
                'type' => 'badge',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->assignedAssets($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
