<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class FinishedGoodsStockReportQuery implements ReportQueryInterface
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
    'label' => 'Finished SKU',
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
  'warehouse' => 
  array (
    'label' => 'Warehouse',
    'type' => 'string',
  ),
  'batch_code' => 
  array (
    'label' => 'Production Batch',
    'type' => 'string',
  ),
  'quantity_on_hand' => 
  array (
    'label' => 'Available Quantity',
    'type' => 'number',
    'sortable' => true,
  ),
  'unit_cost' => 
  array (
    'label' => 'Standard Cost (BDT)',
    'type' => 'currency',
  ),
  'total_valuation' => 
  array (
    'label' => 'Total Valuation (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->finishedGoodsStock($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
