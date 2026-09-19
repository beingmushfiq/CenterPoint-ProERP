<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class ProductionWastageScrapReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider();
    }

    public function columns(): array
    {
        return array (
  'wastage_number' => 
  array (
    'label' => 'Wastage No',
    'type' => 'string',
    'sortable' => true,
  ),
  'recorded_at' => 
  array (
    'label' => 'Date Logged',
    'type' => 'string',
  ),
  'batch_number' => 
  array (
    'label' => 'Batch Reference',
    'type' => 'string',
  ),
  'sku' => 
  array (
    'label' => 'Material SKU',
    'type' => 'string',
  ),
  'product_name' => 
  array (
    'label' => 'Material Name',
    'type' => 'string',
  ),
  'stage' => 
  array (
    'label' => 'Process Stage',
    'type' => 'string',
  ),
  'scrap_quantity' => 
  array (
    'label' => 'Scrap Qty',
    'type' => 'number',
    'sortable' => true,
  ),
  'estimated_cost' => 
  array (
    'label' => 'Loss Cost (BDT)',
    'type' => 'currency',
  ),
  'is_recoverable' => 
  array (
    'label' => 'Recoverable?',
    'type' => 'badge',
  ),
  'recovered_quantity' => 
  array (
    'label' => 'Recovered Qty',
    'type' => 'number',
  ),
  'reason' => 
  array (
    'label' => 'Loss Reason',
    'type' => 'string',
  ),
  'notes' => 
  array (
    'label' => 'Notes',
    'type' => 'string',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->productionWastageScrap($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
