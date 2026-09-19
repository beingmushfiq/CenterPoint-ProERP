<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class DamagedStockReportQuery implements ReportQueryInterface
{
    protected InventoryDataProvider $provider;

    public function __construct(?InventoryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new InventoryDataProvider();
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
  'warehouse' => 
  array (
    'label' => 'Warehouse',
    'type' => 'string',
  ),
  'batch_code' => 
  array (
    'label' => 'Lot / Batch No',
    'type' => 'string',
  ),
  'damaged_quantity' => 
  array (
    'label' => 'Damaged Units',
    'type' => 'number',
    'sortable' => true,
  ),
  'unit_cost' => 
  array (
    'label' => 'Unit Cost (BDT)',
    'type' => 'currency',
  ),
  'damaged_valuation' => 
  array (
    'label' => 'Loss Exposure (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'condition' => 
  array (
    'label' => 'Status',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->damagedStock($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
