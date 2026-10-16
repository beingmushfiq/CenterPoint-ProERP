<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\FinanceDataProvider;

class GeneralLedgerSummaryReportQuery implements ReportQueryInterface
{
    protected FinanceDataProvider $provider;

    public function __construct(?FinanceDataProvider $provider = null)
    {
        $this->provider = $provider ?? new FinanceDataProvider;
    }

    public function columns(): array
    {
        return [
            'account_code' => ['label' => 'Code', 'type' => 'string', 'sortable' => true],
            'account_name' => ['label' => 'Account Name', 'type' => 'string'],
            'account_type' => ['label' => 'Type', 'type' => 'badge'],
            'normal_balance' => ['label' => 'Normal Balance', 'type' => 'string'],
            'total_debit' => ['label' => 'Total Debits (BDT)', 'type' => 'currency'],
            'total_credit' => ['label' => 'Total Credits (BDT)', 'type' => 'currency'],
            'net_balance' => ['label' => 'Net Balance (BDT)', 'type' => 'currency'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->generalLedger($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
