<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\AssetDataProvider;

class AssetMaintenanceLogReportQuery implements ReportQueryInterface
{
    protected AssetDataProvider $provider;

    public function __construct(?AssetDataProvider $provider = null)
    {
        $this->provider = $provider ?? new AssetDataProvider;
    }

    public function columns(): array
    {
        return [
            'order_number' => [
                'label' => 'Order No',
                'type' => 'string',
                'sortable' => true,
            ],
            'asset_tag' => [
                'label' => 'Asset Tag',
                'type' => 'string',
            ],
            'asset_name' => [
                'label' => 'Asset Name',
                'type' => 'string',
            ],
            'maintenance_type' => [
                'label' => 'Type',
                'type' => 'badge',
            ],
            'scheduled_date' => [
                'label' => 'Scheduled Date',
                'type' => 'date',
            ],
            'completed_at' => [
                'label' => 'Completed Date',
                'type' => 'date',
            ],
            'total_cost' => [
                'label' => 'Cost (BDT)',
                'type' => 'currency',
            ],
            'status' => [
                'label' => 'Status',
                'type' => 'badge',
            ],
            'assigned_to' => [
                'label' => 'Technician',
                'type' => 'string',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->maintenanceLog($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
