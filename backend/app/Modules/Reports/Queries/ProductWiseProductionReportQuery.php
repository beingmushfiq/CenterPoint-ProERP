<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class ProductWiseProductionReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider();
    }

    public function columns(): array
    {
        return array (
  'sku' => 
  array (
    'label' => 'SKU',
    'type' => 'string',
    'sortable' => true,
  ),
  'product_name' => 
  array (
    'label' => 'Product Name',
    'type' => 'string',
  ),
  'batches_count' => 
  array (
    'label' => 'Batches',
    'type' => 'number',
  ),
  'planned_quantity' => 
  array (
    'label' => 'Planned Qty',
    'type' => 'number',
  ),
  'actual_quantity' => 
  array (
    'label' => 'Produced Qty',
    'type' => 'number',
    'sortable' => true,
  ),
  'rejected_quantity' => 
  array (
    'label' => 'Rejected Qty',
    'type' => 'number',
  ),
  'yield_percentage' => 
  array (
    'label' => 'Average Yield (%)',
    'type' => 'string',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->productWiseProduction($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
