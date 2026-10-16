<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\SalesDataProvider;

class SalesReturnReportQuery implements ReportQueryInterface
{
    protected SalesDataProvider $provider;

    public function __construct(?SalesDataProvider $provider = null)
    {
        $this->provider = $provider ?? new SalesDataProvider;
    }

    public function columns(): array
    {
        return [
            'return_number' => [
                'label' => 'Return No',
                'type' => 'string',
                'sortable' => true,
            ],
            'return_date' => [
                'label' => 'Date',
                'type' => 'date',
            ],
            'customer_name' => [
                'label' => 'Customer',
                'type' => 'string',
            ],
            'warehouse_name' => [
                'label' => 'Restock Warehouse',
                'type' => 'string',
            ],
            'credit_note_number' => [
                'label' => 'Credit Note No',
                'type' => 'string',
            ],
            'subtotal' => [
                'label' => 'Subtotal (BDT)',
                'type' => 'currency',
            ],
            'tax_amount' => [
                'label' => 'Tax Reversal (BDT)',
                'type' => 'currency',
            ],
            'total_amount' => [
                'label' => 'Refund Total (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'reason' => [
                'label' => 'Return Reason',
                'type' => 'string',
            ],
            'status' => [
                'label' => 'Status',
                'type' => 'badge',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->salesReturn($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
