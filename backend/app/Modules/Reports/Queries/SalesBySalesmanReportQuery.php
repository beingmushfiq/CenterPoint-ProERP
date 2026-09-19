<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesBySalesmanReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return [
            'salesperson' => ['label' => 'Salesperson', 'type' => 'string', 'sortable' => true],
            'email' => ['label' => 'Email', 'type' => 'string'],
            'orders_count' => ['label' => 'Total Orders', 'type' => 'number', 'sortable' => true],
            'total_revenue' => ['label' => 'Revenue Generated (BDT)', 'type' => 'currency', 'sortable' => true],
            'total_collected' => ['label' => 'Cash Collected (BDT)', 'type' => 'currency'],
            'average_order_value' => ['label' => 'Avg Deal Size (BDT)', 'type' => 'currency'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->bySalesman($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
