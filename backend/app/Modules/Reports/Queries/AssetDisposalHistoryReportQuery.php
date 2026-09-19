<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\AssetDataProvider;

class AssetDisposalHistoryReportQuery implements ReportQueryInterface
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
  'disposal_date' => 
  array (
    'label' => 'Disposal Date',
    'type' => 'date',
  ),
  'disposal_type' => 
  array (
    'label' => 'Disposal Method',
    'type' => 'badge',
  ),
  'original_cost' => 
  array (
    'label' => 'Historical Cost (BDT)',
    'type' => 'currency',
  ),
  'nbv_at_disposal' => 
  array (
    'label' => 'NBV at Disposal (BDT)',
    'type' => 'currency',
  ),
  'proceeds' => 
  array (
    'label' => 'Proceeds (BDT)',
    'type' => 'currency',
  ),
  'net_gain_loss' => 
  array (
    'label' => 'Gain / Loss (BDT)',
    'type' => 'currency',
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
        return $this->provider->disposalHistory($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
