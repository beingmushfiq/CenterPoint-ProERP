<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class StockLedgerReportQuery implements ReportQueryInterface
{
    protected InventoryDataProvider $provider;

    public function __construct(?InventoryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new InventoryDataProvider();
    }

    public function columns(): array
    {
        return [
            'movement_number' => ['label' => 'Entry #', 'type' => 'string', 'sortable' => true],
            'date' => ['label' => 'Timestamp', 'type' => 'datetime', 'sortable' => true],
            'sku' => ['label' => 'SKU', 'type' => 'string'],
            'product_name' => ['label' => 'Product Name', 'type' => 'string'],
            'warehouse' => ['label' => 'Warehouse', 'type' => 'string'],
            'type' => ['label' => 'Transaction Type', 'type' => 'badge'],
            'direction' => ['label' => 'Flow', 'type' => 'badge'],
            'quantity' => ['label' => 'Quantity', 'type' => 'number'],
            'unit_cost' => ['label' => 'Unit Cost (BDT)', 'type' => 'currency'],
            'total_cost' => ['label' => 'Total Cost (BDT)', 'type' => 'currency'],
            'balance_after' => ['label' => 'Balance After', 'type' => 'number'],
            'operator' => ['label' => 'Authorized By', 'type' => 'string'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->ledger($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
