<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class WarehouseStockReportQuery implements ReportQueryInterface
{
    protected InventoryDataProvider $provider;

    public function __construct(?InventoryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new InventoryDataProvider;
    }

    public function columns(): array
    {
        return [
            'warehouse' => [
                'label' => 'Warehouse',
                'type' => 'string',
                'sortable' => true,
            ],
            'sku' => [
                'label' => 'SKU',
                'type' => 'string',
            ],
            'product_name' => [
                'label' => 'Product Name',
                'type' => 'string',
            ],
            'available_qty' => [
                'label' => 'Available',
                'type' => 'number',
            ],
            'reserved_qty' => [
                'label' => 'Reserved',
                'type' => 'number',
            ],
            'damaged_qty' => [
                'label' => 'Damaged',
                'type' => 'number',
            ],
            'total_qty' => [
                'label' => 'Total On-Hand',
                'type' => 'number',
                'sortable' => true,
            ],
            'total_valuation' => [
                'label' => 'Valuation (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->warehouseStock($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
