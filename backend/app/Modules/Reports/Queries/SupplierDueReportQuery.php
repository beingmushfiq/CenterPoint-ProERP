<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\PurchaseDataProvider;

class SupplierDueReportQuery implements ReportQueryInterface
{
    protected PurchaseDataProvider $provider;

    public function __construct(?PurchaseDataProvider $provider = null)
    {
        $this->provider = $provider ?? new PurchaseDataProvider();
    }

    public function columns(): array
    {
        return [
            'supplier_code' => ['label' => 'Supplier Code', 'type' => 'string', 'sortable' => true],
            'supplier_name' => ['label' => 'Supplier / Vendor', 'type' => 'string'],
            'active_pos' => ['label' => 'Active POs', 'type' => 'number'],
            'total_po_amount' => ['label' => 'Total Committed (BDT)', 'type' => 'currency', 'sortable' => true],
            'received_amount' => ['label' => 'Delivered (BDT)', 'type' => 'currency'],
            'billed_amount' => ['label' => 'Invoiced (BDT)', 'type' => 'currency'],
            'outstanding_due' => ['label' => 'Outstanding Due (BDT)', 'type' => 'currency', 'sortable' => true],
            'status' => ['label' => 'Settlement Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->supplierDue($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
