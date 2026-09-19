<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesByCustomerReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return [
            'customer_name' => ['label' => 'Customer Name', 'type' => 'string', 'sortable' => true],
            'phone' => ['label' => 'Phone', 'type' => 'string'],
            'tier' => ['label' => 'Tier', 'type' => 'badge'],
            'total_orders' => ['label' => 'Orders', 'type' => 'number', 'sortable' => true],
            'total_spend' => ['label' => 'Total Spend (BDT)', 'type' => 'currency', 'sortable' => true],
            'total_paid' => ['label' => 'Total Paid (BDT)', 'type' => 'currency'],
            'total_due' => ['label' => 'Outstanding Due (BDT)', 'type' => 'currency'],
            'average_order_value' => ['label' => 'Avg Order Value (BDT)', 'type' => 'currency'],
            'last_order_date' => ['label' => 'Last Order', 'type' => 'date'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->byCustomer($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
