<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class RawMaterialStockReportQuery implements ReportQueryInterface
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
    'label' => 'Raw Material SKU',
    'type' => 'string',
    'sortable' => true,
  ),
  'product_name' => 
  array (
    'label' => 'Material Description',
    'type' => 'string',
  ),
  'category' => 
  array (
    'label' => 'Material Category',
    'type' => 'string',
  ),
  'warehouse' => 
  array (
    'label' => 'Storage Warehouse',
    'type' => 'string',
  ),
  'batch_code' => 
  array (
    'label' => 'Lot / Batch No',
    'type' => 'string',
  ),
  'quantity_on_hand' => 
  array (
    'label' => 'Quantity on Hand',
    'type' => 'number',
    'sortable' => true,
  ),
  'unit_cost' => 
  array (
    'label' => 'Unit Cost (BDT)',
    'type' => 'currency',
  ),
  'total_valuation' => 
  array (
    'label' => 'Inventory Value (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->rawMaterialStock($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
