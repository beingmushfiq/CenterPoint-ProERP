<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\PurchaseDataProvider;

class SupplierPurchaseReportQuery implements ReportQueryInterface
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
            'total_orders' => ['label' => 'Total Orders', 'type' => 'number', 'sortable' => true],
            'total_spend' => ['label' => 'Total Spend (BDT)', 'type' => 'currency', 'sortable' => true],
            'average_po_value' => ['label' => 'Average PO (BDT)', 'type' => 'currency'],
            'received_value' => ['label' => 'Goods Received (BDT)', 'type' => 'currency'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->bySupplier($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
