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
        $this->provider = $provider ?? new PurchaseDataProvider();
    }

    public function columns(): array
    {
        return array (
  'sku' => 
  array (
    'label' => 'SKU',
    'type' => 'string',
    'sortable' => true,
  ),
  'product_name' => 
  array (
    'label' => 'Product Name',
    'type' => 'string',
  ),
  'supplier_name' => 
  array (
    'label' => 'Supplier',
    'type' => 'string',
  ),
  'po_number' => 
  array (
    'label' => 'PO Number',
    'type' => 'string',
  ),
  'order_date' => 
  array (
    'label' => 'Order Date',
    'type' => 'date',
  ),
  'quantity' => 
  array (
    'label' => 'Purchased Qty',
    'type' => 'number',
  ),
  'unit_price' => 
  array (
    'label' => 'Unit Cost (BDT)',
    'type' => 'currency',
  ),
  'discount_amount' => 
  array (
    'label' => 'Discount (BDT)',
    'type' => 'currency',
  ),
  'tax_amount' => 
  array (
    'label' => 'Tax (BDT)',
    'type' => 'currency',
  ),
  'line_total' => 
  array (
    'label' => 'Line Total (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'order_status' => 
  array (
    'label' => 'PO Status',
    'type' => 'badge',
  ),
);
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
