<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\PurchaseDataProvider;

class PurchaseDetailsReportQuery implements ReportQueryInterface
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
            'order_date' => ['label' => 'PO Date', 'type' => 'date', 'sortable' => true],
            'supplier_name' => ['label' => 'Supplier', 'type' => 'string'],
            'sku' => ['label' => 'Item SKU', 'type' => 'string'],
            'product_name' => ['label' => 'Item Description', 'type' => 'string'],
            'ordered_quantity' => ['label' => 'Ordered Qty', 'type' => 'number', 'sortable' => true],
            'received_quantity' => ['label' => 'Received Qty', 'type' => 'number'],
            'pending_quantity' => ['label' => 'Pending Qty', 'type' => 'number'],
            'unit_price' => ['label' => 'Unit Price (BDT)', 'type' => 'currency'],
            'line_total' => ['label' => 'Line Total (BDT)', 'type' => 'currency'],
            'status' => ['label' => 'Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->orderDetails($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
