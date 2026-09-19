<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class FactoryWiseProductionReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider();
    }

    public function columns(): array
    {
        return array (
  'factory_code' => 
  array (
    'label' => 'Factory Code',
    'type' => 'string',
    'sortable' => true,
  ),
  'factory_name' => 
  array (
    'label' => 'Factory Facility',
    'type' => 'string',
  ),
  'batches_count' => 
  array (
    'label' => 'Batches Run',
    'type' => 'number',
  ),
  'planned_quantity' => 
  array (
    'label' => 'Target Output',
    'type' => 'number',
  ),
  'actual_quantity' => 
  array (
    'label' => 'Manufactured Output',
    'type' => 'number',
    'sortable' => true,
  ),
  'rejected_quantity' => 
  array (
    'label' => 'Scrap Qty',
    'type' => 'number',
  ),
  'achievement_percentage' => 
  array (
    'label' => 'Achievement (%)',
    'type' => 'string',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->factoryWiseProduction($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
