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
        $this->provider = $provider ?? new AssetDataProvider();
    }

    public function columns(): array
    {
        return array (
  'asset_tag' => 
  array (
    'label' => 'Asset Tag',
    'type' => 'string',
    'sortable' => true,
  ),
  'name' => 
  array (
    'label' => 'Asset Name',
    'type' => 'string',
  ),
  'category' => 
  array (
    'label' => 'Category',
    'type' => 'string',
  ),
  'serial_number' => 
  array (
    'label' => 'Serial No',
    'type' => 'string',
  ),
  'purchase_date' => 
  array (
    'label' => 'Purchase Date',
    'type' => 'date',
  ),
  'purchase_cost' => 
  array (
    'label' => 'Purchase Cost (BDT)',
    'type' => 'currency',
  ),
  'current_nbv' => 
  array (
    'label' => 'Net Book Value (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'condition' => 
  array (
    'label' => 'Condition',
    'type' => 'badge',
  ),
  'status' => 
  array (
    'label' => 'Status',
    'type' => 'badge',
  ),
);
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
