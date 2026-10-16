<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\QCDataProvider;

class ComplianceAuditTrailReportQuery implements ReportQueryInterface
{
    protected QCDataProvider $provider;

    public function __construct(?QCDataProvider $provider = null)
    {
        $this->provider = $provider ?? new QCDataProvider;
    }

    public function columns(): array
    {
        return [
            'inspection_number' => [
                'label' => 'Inspection / Record No',
                'type' => 'string',
                'sortable' => true,
            ],
            'inspection_date' => [
                'label' => 'Date',
                'type' => 'date',
            ],
            'batch_number' => [
                'label' => 'Batch Reference',
                'type' => 'string',
            ],
            'result' => [
                'label' => 'Audit Result',
                'type' => 'badge',
            ],
            'status' => [
                'label' => 'Record Status',
                'type' => 'badge',
            ],
            'inspector_name' => [
                'label' => 'Auditor / Inspector',
                'type' => 'string',
            ],
            'approver_name' => [
                'label' => 'Authorizing Sign-off',
                'type' => 'string',
            ],
            'approved_at' => [
                'label' => 'Approval Timestamp',
                'type' => 'string',
            ],
            'compliance_status' => [
                'label' => 'Compliance Rating',
                'type' => 'badge',
            ],
            'remarks' => [
                'label' => 'Audit Remarks',
                'type' => 'string',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->complianceAuditTrail($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
