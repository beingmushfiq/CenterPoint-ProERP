<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class StockMovementReportQuery implements ReportQueryInterface
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
            'total_in' => ['label' => 'Total Inflow', 'type' => 'number'],
            'total_out' => ['label' => 'Total Outflow', 'type' => 'number'],
            'net_change' => ['label' => 'Net Movement', 'type' => 'number'],
            'transaction_count' => ['label' => 'Total Transactions', 'type' => 'number', 'sortable' => true],
            'last_movement' => ['label' => 'Latest Movement', 'type' => 'datetime'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->movement($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
