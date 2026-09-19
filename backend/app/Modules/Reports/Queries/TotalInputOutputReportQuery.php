<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class TotalInputOutputReportQuery implements ReportQueryInterface
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
    'label' => 'Batch Date',
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
  'input_quantity' => 
  array (
    'label' => 'Total Input Qty',
    'type' => 'number',
  ),
  'output_quantity' => 
  array (
    'label' => 'Total Output Qty',
    'type' => 'number',
    'sortable' => true,
  ),
  'variance_quantity' => 
  array (
    'label' => 'Variance Qty',
    'type' => 'number',
  ),
  'yield_percentage' => 
  array (
    'label' => 'Mass Yield (%)',
    'type' => 'string',
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
        return $this->provider->totalInputOutput($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
