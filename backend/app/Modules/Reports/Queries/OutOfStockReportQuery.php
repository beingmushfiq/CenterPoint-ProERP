<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class OutOfStockReportQuery implements ReportQueryInterface
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
  'category' => 
  array (
    'label' => 'Category',
    'type' => 'string',
  ),
  'current_stock' => 
  array (
    'label' => 'Available Stock',
    'type' => 'number',
    'sortable' => true,
  ),
  'reorder_level' => 
  array (
    'label' => 'Reorder Point',
    'type' => 'number',
  ),
  'unit_cost' => 
  array (
    'label' => 'Unit Cost (BDT)',
    'type' => 'currency',
  ),
  'stock_status' => 
  array (
    'label' => 'Deficit Status',
    'type' => 'badge',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->outOfStock($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
