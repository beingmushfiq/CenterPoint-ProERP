<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class CurrentStockReportQuery implements ReportQueryInterface
{
    protected InventoryDataProvider $provider;

    public function __construct(?InventoryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new InventoryDataProvider();
    }

    public function columns(): array
    {
        return [
            'sku' => ['label' => 'SKU', 'type' => 'string', 'sortable' => true],
            'product_name' => ['label' => 'Product Name', 'type' => 'string'],
            'warehouse' => ['label' => 'Warehouse', 'type' => 'string'],
            'available_qty' => ['label' => 'Available', 'type' => 'number'],
            'reserved_qty' => ['label' => 'Reserved', 'type' => 'number'],
            'damaged_qty' => ['label' => 'Damaged', 'type' => 'number'],
            'total_on_hand' => ['label' => 'Total On-Hand', 'type' => 'number', 'sortable' => true],
            'reorder_level' => ['label' => 'Reorder Point', 'type' => 'number'],
            'status' => ['label' => 'Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->currentStock($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
