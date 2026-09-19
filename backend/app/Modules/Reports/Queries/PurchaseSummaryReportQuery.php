<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\PurchaseDataProvider;

class PurchaseSummaryReportQuery implements ReportQueryInterface
{
    protected PurchaseDataProvider $provider;

    public function __construct(?PurchaseDataProvider $provider = null)
    {
        $this->provider = $provider ?? new PurchaseDataProvider();
    }

    public function columns(): array
    {
        return [
            'po_number' => ['label' => 'PO Number', 'type' => 'string', 'sortable' => true],
            'order_date' => ['label' => 'Order Date', 'type' => 'date', 'sortable' => true],
            'expected_date' => ['label' => 'Expected Delivery', 'type' => 'date'],
            'supplier_name' => ['label' => 'Supplier / Vendor', 'type' => 'string'],
            'total_amount' => ['label' => 'Total PO (BDT)', 'type' => 'currency', 'sortable' => true],
            'received_value' => ['label' => 'Received (BDT)', 'type' => 'currency'],
            'billed_value' => ['label' => 'Billed (BDT)', 'type' => 'currency'],
            'payment_terms' => ['label' => 'Terms', 'type' => 'string'],
            'status' => ['label' => 'PO Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->orderSummary($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
