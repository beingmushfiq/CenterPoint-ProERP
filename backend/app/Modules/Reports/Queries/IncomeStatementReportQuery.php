<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\FinanceDataProvider;

class IncomeStatementReportQuery implements ReportQueryInterface
{
    protected FinanceDataProvider $provider;

    public function __construct(?FinanceDataProvider $provider = null)
    {
        $this->provider = $provider ?? new FinanceDataProvider();
    }

    public function columns(): array
    {
        return [
            'account_code' => ['label' => 'Account Code', 'type' => 'string', 'sortable' => true],
            'account_name' => ['label' => 'Account Name', 'type' => 'string'],
            'type' => ['label' => 'Account Type', 'type' => 'badge'],
            'classification' => ['label' => 'Classification', 'type' => 'badge'],
            'amount' => ['label' => 'Net Balance (BDT)', 'type' => 'currency'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->incomeStatement($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
