<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class SlowMovingStockReportQuery implements ReportQueryInterface
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
            'product_name' => ['label' => 'Product Name', 'type' => 'string', 'sortable' => true],
            'category' => ['label' => 'Category', 'type' => 'string'],
            'warehouse' => ['label' => 'Warehouse', 'type' => 'string'],
            'batch_code' => ['label' => 'Batch Code', 'type' => 'string'],
            'stock_state' => ['label' => 'State', 'type' => 'status_badge'],
            'quantity' => ['label' => 'Idle Quantity', 'type' => 'number', 'sortable' => true],
            'unit_cost' => ['label' => 'Unit Cost (BDT)', 'type' => 'currency'],
            'total_value' => ['label' => 'Tied-up Capital (BDT)', 'type' => 'currency', 'sortable' => true],
            'last_movement_at' => ['label' => 'Last Activity Date', 'type' => 'date', 'sortable' => true],
            'days_idle' => ['label' => 'Days Idle', 'type' => 'number', 'sortable' => true],
            'risk_level' => ['label' => 'Aging Risk Tier', 'type' => 'status_badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->slowMovingStock($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->slowMovingSummary($filters);
    }
}
