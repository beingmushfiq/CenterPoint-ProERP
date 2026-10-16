<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class B2bSalesReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider;
    }

    public function columns(): array
    {
        return [
            'order_number' => [
                'label' => 'Invoice / Order No',
                'type' => 'string',
                'sortable' => true,
            ],
            'order_date' => [
                'label' => 'Date',
                'type' => 'date',
            ],
            'customer_name' => [
                'label' => 'Corporate / B2B Client',
                'type' => 'string',
            ],
            'salesperson' => [
                'label' => 'Account Manager',
                'type' => 'string',
            ],
            'branch' => [
                'label' => 'Branch',
                'type' => 'string',
            ],
            'grand_total' => [
                'label' => 'Order Total (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'paid_amount' => [
                'label' => 'Paid (BDT)',
                'type' => 'currency',
            ],
            'due_amount' => [
                'label' => 'Outstanding (BDT)',
                'type' => 'currency',
            ],
            'status' => [
                'label' => 'Fulfillment Status',
                'type' => 'badge',
            ],
            'payment_status' => [
                'label' => 'Payment Status',
                'type' => 'badge',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->b2bSales($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
