<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\PurchaseDataProvider;

class PurchaseReturnReportQuery implements ReportQueryInterface
{
    protected PurchaseDataProvider $provider;

    public function __construct(?PurchaseDataProvider $provider = null)
    {
        $this->provider = $provider ?? new PurchaseDataProvider;
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
                'label' => 'Return Date',
                'type' => 'date',
            ],
            'supplier_name' => [
                'label' => 'Supplier',
                'type' => 'string',
            ],
            'warehouse_name' => [
                'label' => 'Warehouse',
                'type' => 'string',
            ],
            'debit_note_number' => [
                'label' => 'Debit Note No',
                'type' => 'string',
            ],
            'subtotal' => [
                'label' => 'Subtotal (BDT)',
                'type' => 'currency',
            ],
            'tax_amount' => [
                'label' => 'Tax (BDT)',
                'type' => 'currency',
            ],
            'total_amount' => [
                'label' => 'Total Return Value (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'status' => [
                'label' => 'Return Status',
                'type' => 'badge',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->purchaseReturn($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
