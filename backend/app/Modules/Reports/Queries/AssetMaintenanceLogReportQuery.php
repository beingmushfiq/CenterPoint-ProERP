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
        $this->provider = $provider ?? new AssetDataProvider();
    }

    public function columns(): array
    {
        return array (
  'order_number' => 
  array (
    'label' => 'Order No',
    'type' => 'string',
    'sortable' => true,
  ),
  'asset_tag' => 
  array (
    'label' => 'Asset Tag',
    'type' => 'string',
  ),
  'asset_name' => 
  array (
    'label' => 'Asset Name',
    'type' => 'string',
  ),
  'maintenance_type' => 
  array (
    'label' => 'Type',
    'type' => 'badge',
  ),
  'scheduled_date' => 
  array (
    'label' => 'Scheduled Date',
    'type' => 'date',
  ),
  'completed_at' => 
  array (
    'label' => 'Completed Date',
    'type' => 'date',
  ),
  'total_cost' => 
  array (
    'label' => 'Cost (BDT)',
    'type' => 'currency',
  ),
  'status' => 
  array (
    'label' => 'Status',
    'type' => 'badge',
  ),
  'assigned_to' => 
  array (
    'label' => 'Technician',
    'type' => 'string',
  ),
);
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
