<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class LowStockReportQuery implements ReportQueryInterface
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
            'current_stock' => ['label' => 'Current Stock', 'type' => 'number', 'sortable' => true],
            'reorder_level' => ['label' => 'Safety Threshold', 'type' => 'number'],
            'suggested_reorder_qty' => ['label' => 'Suggested Reorder', 'type' => 'number'],
            'deficit' => ['label' => 'Stock Deficit', 'type' => 'number'],
            'unit_cost' => ['label' => 'Standard Cost (BDT)', 'type' => 'currency'],
            'restock_cost' => ['label' => 'Estimated Restock Cost (BDT)', 'type' => 'currency'],
            'status' => ['label' => 'Alert Severity', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->lowStock($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
