<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class DailySalesReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider;
    }

    public function columns(): array
    {
        return [
            'order_date' => [
                'label' => 'Date',
                'type' => 'date',
                'sortable' => true,
            ],
            'orders_count' => [
                'label' => 'Orders Count',
                'type' => 'number',
            ],
            'subtotal' => [
                'label' => 'Gross Sales (BDT)',
                'type' => 'currency',
            ],
            'discount_amount' => [
                'label' => 'Discounts (BDT)',
                'type' => 'currency',
            ],
            'tax_amount' => [
                'label' => 'Tax (BDT)',
                'type' => 'currency',
            ],
            'total_revenue' => [
                'label' => 'Net Revenue (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'collected_amount' => [
                'label' => 'Collected (BDT)',
                'type' => 'currency',
            ],
            'due_amount' => [
                'label' => 'Receivable Due (BDT)',
                'type' => 'currency',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->dailySales($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
