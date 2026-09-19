<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class LineWiseProductionReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider();
    }

    public function columns(): array
    {
        return array (
  'line_code' => 
  array (
    'label' => 'Line Code',
    'type' => 'string',
    'sortable' => true,
  ),
  'line_name' => 
  array (
    'label' => 'Production Line',
    'type' => 'string',
  ),
  'capacity' => 
  array (
    'label' => 'Shift Capacity',
    'type' => 'number',
  ),
  'batches_count' => 
  array (
    'label' => 'Batches',
    'type' => 'number',
  ),
  'planned_quantity' => 
  array (
    'label' => 'Planned Target',
    'type' => 'number',
  ),
  'actual_quantity' => 
  array (
    'label' => 'Actual Output',
    'type' => 'number',
    'sortable' => true,
  ),
  'rejected_quantity' => 
  array (
    'label' => 'Scrap Qty',
    'type' => 'number',
  ),
  'efficiency_percentage' => 
  array (
    'label' => 'Efficiency (%)',
    'type' => 'string',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->lineWiseProduction($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
