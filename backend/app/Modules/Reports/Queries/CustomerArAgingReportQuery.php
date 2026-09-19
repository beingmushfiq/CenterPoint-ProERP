<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\FinanceDataProvider;

class CustomerArAgingReportQuery implements ReportQueryInterface
{
    protected FinanceDataProvider $provider;

    public function __construct(?FinanceDataProvider $provider = null)
    {
        $this->provider = $provider ?? new FinanceDataProvider();
    }

    public function columns(): array
    {
        return [
            'customer_code' => ['label' => 'Customer Code', 'type' => 'string', 'sortable' => true],
            'customer_name' => ['label' => 'Customer Name', 'type' => 'string'],
            'current_30' => ['label' => '0-30 Days (BDT)', 'type' => 'currency'],
            'days_31_60' => ['label' => '31-60 Days (BDT)', 'type' => 'currency'],
            'days_61_90' => ['label' => '61-90 Days (BDT)', 'type' => 'currency'],
            'days_over_90' => ['label' => 'Over 90 Days (BDT)', 'type' => 'currency'],
            'total_due' => ['label' => 'Total Outstanding (BDT)', 'type' => 'currency', 'sortable' => true],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->customerArAging($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
