<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\PurchaseDataProvider;

class ProductPurchaseReportQuery implements ReportQueryInterface
{
    protected PurchaseDataProvider $provider;

    public function __construct(?PurchaseDataProvider $provider = null)
    {
        $this->provider = $provider ?? new PurchaseDataProvider;
    }

    public function columns(): array
    {
        return [
            'sku' => [
                'label' => 'SKU',
                'type' => 'string',
                'sortable' => true,
            ],
            'product_name' => [
                'label' => 'Product Name',
                'type' => 'string',
            ],
            'supplier_name' => [
                'label' => 'Supplier',
                'type' => 'string',
            ],
            'po_number' => [
                'label' => 'PO Number',
                'type' => 'string',
            ],
            'order_date' => [
                'label' => 'Order Date',
                'type' => 'date',
            ],
            'quantity' => [
                'label' => 'Purchased Qty',
                'type' => 'number',
            ],
            'unit_price' => [
                'label' => 'Unit Cost (BDT)',
                'type' => 'currency',
            ],
            'discount_amount' => [
                'label' => 'Discount (BDT)',
                'type' => 'currency',
            ],
            'tax_amount' => [
                'label' => 'Tax (BDT)',
                'type' => 'currency',
            ],
            'line_total' => [
                'label' => 'Line Total (BDT)',
                'type' => 'currency',
                'sortable' => true,
            ],
            'order_status' => [
                'label' => 'PO Status',
                'type' => 'badge',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->productPurchase($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
