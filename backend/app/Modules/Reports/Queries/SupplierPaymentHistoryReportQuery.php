<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\PurchaseDataProvider;

class SupplierPaymentHistoryReportQuery implements ReportQueryInterface
{
    protected PurchaseDataProvider $provider;

    public function __construct(?PurchaseDataProvider $provider = null)
    {
        $this->provider = $provider ?? new PurchaseDataProvider;
    }

    public function columns(): array
    {
        return [
            'payment_number' => [
                'label' => 'Payment Voucher No',
                'type' => 'string',
                'sortable' => true,
            ],
            'payment_date' => [
                'label' => 'Date Paid',
                'type' => 'date',
            ],
            'supplier_name' => [
                'label' => 'Supplier Name',
                'type' => 'string',
            ],
            'payment_method' => [
                'label' => 'Payment Mode',
                'type' => 'badge',
            ],
            'reference_number' => [
                'label' => 'Ref / Cheque No',
                'type' => 'string',
            ],
            'amount' => [
                'label' => 'Total Paid (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'allocated_amount' => [
                'label' => 'Allocated (BDT)',
                'type' => 'currency',
            ],
            'unallocated_amount' => [
                'label' => 'Unallocated (BDT)',
                'type' => 'currency',
            ],
            'status' => [
                'label' => 'Status',
                'type' => 'badge',
            ],
            'notes' => [
                'label' => 'Remarks',
                'type' => 'string',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->supplierPaymentHistory($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
