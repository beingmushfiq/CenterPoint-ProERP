<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesPerformanceReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider();
    }

    public function columns(): array
    {
        return [
            'order_number' => ['label' => 'Order Number', 'type' => 'string', 'sortable' => true],
            'order_date' => ['label' => 'Date', 'type' => 'date', 'sortable' => true],
            'channel' => ['label' => 'Channel', 'type' => 'badge'],
            'customer_name' => ['label' => 'Customer', 'type' => 'string'],
            'salesperson' => ['label' => 'Salesperson', 'type' => 'string'],
            'branch' => ['label' => 'Branch', 'type' => 'string'],
            'subtotal' => ['label' => 'Subtotal (BDT)', 'type' => 'currency'],
            'tax_amount' => ['label' => 'Tax (BDT)', 'type' => 'currency'],
            'grand_total' => ['label' => 'Grand Total (BDT)', 'type' => 'currency'],
            'paid_amount' => ['label' => 'Paid (BDT)', 'type' => 'currency'],
            'due_amount' => ['label' => 'Due (BDT)', 'type' => 'currency'],
            'payment_status' => ['label' => 'Payment Status', 'type' => 'badge'],
            'status' => ['label' => 'Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->performance($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
