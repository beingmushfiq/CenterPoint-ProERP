<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class StockValuationReportQuery implements ReportQueryInterface
{
    protected InventoryDataProvider $provider;

    public function __construct(?InventoryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new InventoryDataProvider;
    }

    public function columns(): array
    {
        return [
            'sku' => ['label' => 'SKU', 'type' => 'string', 'sortable' => true],
            'product_name' => ['label' => 'Product Name', 'type' => 'string'],
            'category' => ['label' => 'Category', 'type' => 'string'],
            'product_type' => ['label' => 'Type', 'type' => 'badge'],
            'warehouse_name' => ['label' => 'Warehouse', 'type' => 'string'],
            'batch_code' => ['label' => 'Batch #', 'type' => 'string'],
            'quantity_on_hand' => ['label' => 'Qty On Hand', 'type' => 'number'],
            'unit_cost' => ['label' => 'Unit Cost (BDT)', 'type' => 'currency'],
            'total_valuation' => ['label' => 'Total Valuation (BDT)', 'type' => 'currency'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->valuation($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
