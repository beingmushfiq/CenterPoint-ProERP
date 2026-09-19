<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class ProductionEfficiencyReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider();
    }

    public function columns(): array
    {
        return array (
  'batch_number' => 
  array (
    'label' => 'Batch No',
    'type' => 'string',
    'sortable' => true,
  ),
  'batch_date' => 
  array (
    'label' => 'Date',
    'type' => 'date',
  ),
  'sku' => 
  array (
    'label' => 'SKU',
    'type' => 'string',
  ),
  'product_name' => 
  array (
    'label' => 'Product Name',
    'type' => 'string',
  ),
  'line_name' => 
  array (
    'label' => 'Line',
    'type' => 'string',
  ),
  'planned_quantity' => 
  array (
    'label' => 'Planned Qty',
    'type' => 'number',
  ),
  'actual_quantity' => 
  array (
    'label' => 'Actual Output',
    'type' => 'number',
  ),
  'yield_percentage' => 
  array (
    'label' => 'Yield (%)',
    'type' => 'string',
    'sortable' => true,
  ),
  'variance_percentage' => 
  array (
    'label' => 'Variance (%)',
    'type' => 'string',
  ),
  'efficiency_rating' => 
  array (
    'label' => 'Performance Band',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->productionEfficiency($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
