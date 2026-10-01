<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class BatchExpiryAgingReportQuery implements ReportQueryInterface
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
            'stock_state' => ['label' => 'Stock State', 'type' => 'status_badge'],
            'quantity' => ['label' => 'Qty On-Hand', 'type' => 'number', 'sortable' => true],
            'unit_cost' => ['label' => 'Unit Cost (BDT)', 'type' => 'currency'],
            'total_value' => ['label' => 'Valuation (BDT)', 'type' => 'currency', 'sortable' => true],
            'expiry_date' => ['label' => 'Expiry Date', 'type' => 'date', 'sortable' => true],
            'days_remaining' => ['label' => 'Days Left', 'type' => 'number', 'sortable' => true],
            'expiry_status' => ['label' => 'Expiry Status', 'type' => 'status_badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->batchExpiryAging($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->batchExpirySummary($filters);
    }
}
