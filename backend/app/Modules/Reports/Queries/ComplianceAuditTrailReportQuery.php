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
        $this->provider = $provider ?? new QCDataProvider();
    }

    public function columns(): array
    {
        return array (
  'inspection_number' => 
  array (
    'label' => 'Inspection / Record No',
    'type' => 'string',
    'sortable' => true,
  ),
  'inspection_date' => 
  array (
    'label' => 'Date',
    'type' => 'date',
  ),
  'batch_number' => 
  array (
    'label' => 'Batch Reference',
    'type' => 'string',
  ),
  'result' => 
  array (
    'label' => 'Audit Result',
    'type' => 'badge',
  ),
  'status' => 
  array (
    'label' => 'Record Status',
    'type' => 'badge',
  ),
  'inspector_name' => 
  array (
    'label' => 'Auditor / Inspector',
    'type' => 'string',
  ),
  'approver_name' => 
  array (
    'label' => 'Authorizing Sign-off',
    'type' => 'string',
  ),
  'approved_at' => 
  array (
    'label' => 'Approval Timestamp',
    'type' => 'string',
  ),
  'compliance_status' => 
  array (
    'label' => 'Compliance Rating',
    'type' => 'badge',
  ),
  'remarks' => 
  array (
    'label' => 'Audit Remarks',
    'type' => 'string',
  ),
);
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
