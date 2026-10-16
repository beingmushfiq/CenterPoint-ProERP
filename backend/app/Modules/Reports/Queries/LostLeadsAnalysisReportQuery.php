<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\CRMDataProvider;

class LostLeadsAnalysisReportQuery implements ReportQueryInterface
{
    protected CRMDataProvider $provider;

    public function __construct(?CRMDataProvider $provider = null)
    {
        $this->provider = $provider ?? new CRMDataProvider;
    }

    public function columns(): array
    {
        return [
            'lead_number' => [
                'label' => 'Lead No',
                'type' => 'string',
                'sortable' => true,
            ],
            'contact_name' => [
                'label' => 'Contact Name',
                'type' => 'string',
            ],
            'company_name' => [
                'label' => 'Company Name',
                'type' => 'string',
            ],
            'source' => [
                'label' => 'Acquisition Channel',
                'type' => 'badge',
            ],
            'salesman' => [
                'label' => 'Assigned Rep',
                'type' => 'string',
            ],
            'lost_value' => [
                'label' => 'Forfeited Value (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'lost_reason' => [
                'label' => 'Loss Reason',
                'type' => 'badge',
            ],
            'notes' => [
                'label' => 'Post-Mortem Notes',
                'type' => 'string',
            ],
            'lost_date' => [
                'label' => 'Lost Date',
                'type' => 'date',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->lostLeadsAnalysis($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
