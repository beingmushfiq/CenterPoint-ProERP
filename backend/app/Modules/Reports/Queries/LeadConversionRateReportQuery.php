<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\CRMDataProvider;

class LeadConversionRateReportQuery implements ReportQueryInterface
{
    protected CRMDataProvider $provider;

    public function __construct(?CRMDataProvider $provider = null)
    {
        $this->provider = $provider ?? new CRMDataProvider();
    }

    public function columns(): array
    {
        return [
            'source_channel' => ['label' => 'Acquisition Channel', 'type' => 'string', 'sortable' => true],
            'total_leads' => ['label' => 'Total Inquiries', 'type' => 'number', 'sortable' => true],
            'converted_leads' => ['label' => 'Won / Converted', 'type' => 'number'],
            'lost_leads' => ['label' => 'Lost / Disqualified', 'type' => 'number'],
            'fake_leads' => ['label' => 'Fraud / Fake', 'type' => 'number'],
            'conversion_rate' => ['label' => 'Conversion Rate %', 'type' => 'percentage', 'sortable' => true],
            'pipeline_value' => ['label' => 'Total Pipeline Value (BDT)', 'type' => 'currency'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->conversionRates($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
