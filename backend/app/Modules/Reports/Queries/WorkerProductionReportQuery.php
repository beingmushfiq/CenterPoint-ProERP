<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class WorkerProductionReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider();
    }

    public function columns(): array
    {
        return [
            'date' => ['label' => 'Date', 'type' => 'date', 'sortable' => true],
            'employee_code' => ['label' => 'Worker Code', 'type' => 'string'],
            'worker_name' => ['label' => 'Operator Name', 'type' => 'string'],
            'product_sku' => ['label' => 'SKU', 'type' => 'string'],
            'product_name' => ['label' => 'Product / Garment', 'type' => 'string'],
            'batch_number' => ['label' => 'Batch #', 'type' => 'string'],
            'line_name' => ['label' => 'Line', 'type' => 'string'],
            'quantity_produced' => ['label' => 'Output Qty (Pcs)', 'type' => 'number', 'sortable' => true],
            'quantity_rejected' => ['label' => 'Rejects (Pcs)', 'type' => 'number'],
            'piece_rate' => ['label' => 'Piece Rate (BDT)', 'type' => 'currency'],
            'earnings' => ['label' => 'Total Accrued (BDT)', 'type' => 'currency'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->workerProduction($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
