<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\CRMDataProvider;

class FakeLeadsAuditReportQuery implements ReportQueryInterface
{
    protected CRMDataProvider $provider;

    public function __construct(?CRMDataProvider $provider = null)
    {
        $this->provider = $provider ?? new CRMDataProvider();
    }

    public function columns(): array
    {
        return [
            'lead_number' => ['label' => 'Lead #', 'type' => 'string', 'sortable' => true],
            'contact_name' => ['label' => 'Contact Name', 'type' => 'string'],
            'phone' => ['label' => 'Phone', 'type' => 'string'],
            'source' => ['label' => 'Source', 'type' => 'badge'],
            'assigned_rep' => ['label' => 'Claiming Representative', 'type' => 'string'],
            'auditor_name' => ['label' => 'Flagged By', 'type' => 'string'],
            'validated_at' => ['label' => 'Audit Date', 'type' => 'datetime'],
            'audit_reason' => ['label' => 'Audit Reason / Notes', 'type' => 'string'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->fakeLeadsAudit($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
