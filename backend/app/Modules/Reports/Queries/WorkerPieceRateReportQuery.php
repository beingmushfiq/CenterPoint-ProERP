<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\HRDataProvider;

class WorkerPieceRateReportQuery implements ReportQueryInterface
{
    protected HRDataProvider $provider;

    public function __construct(?HRDataProvider $provider = null)
    {
        $this->provider = $provider ?? new HRDataProvider();
    }

    public function columns(): array
    {
        return [
            'employee_code' => ['label' => 'Worker ID', 'type' => 'string', 'sortable' => true],
            'worker_name' => ['label' => 'Worker Name', 'type' => 'string'],
            'logs_count' => ['label' => 'Production Runs', 'type' => 'number'],
            'total_pieces' => ['label' => 'Pieces Completed', 'type' => 'number', 'sortable' => true],
            'total_rejected' => ['label' => 'Defects / Rejects', 'type' => 'number'],
            'total_earnings' => ['label' => 'Piece Pay Accrued (BDT)', 'type' => 'currency', 'sortable' => true],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->workerPieceRate($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
