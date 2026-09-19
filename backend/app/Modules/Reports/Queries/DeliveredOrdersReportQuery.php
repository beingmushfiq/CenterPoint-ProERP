<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\DeliveryDataProvider;

class DeliveredOrdersReportQuery implements ReportQueryInterface
{
    protected DeliveryDataProvider $provider;

    public function __construct(?DeliveryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new DeliveryDataProvider();
    }

    public function columns(): array
    {
        return [
            'delivery_number' => ['label' => 'Consignment #', 'type' => 'string', 'sortable' => true],
            'order_number' => ['label' => 'Order #', 'type' => 'string'],
            'recipient_name' => ['label' => 'Recipient', 'type' => 'string'],
            'courier_name' => ['label' => 'Courier Partner', 'type' => 'string'],
            'delivered_at' => ['label' => 'Delivered Date/Time', 'type' => 'datetime'],
            'cod_amount' => ['label' => 'Invoiced (BDT)', 'type' => 'currency'],
            'cod_collected_amount' => ['label' => 'COD Collected (BDT)', 'type' => 'currency'],
            'cod_status' => ['label' => 'Settlement Status', 'type' => 'badge'],
            'pod_received_by' => ['label' => 'POD Signee', 'type' => 'string'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->deliveredOrders($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
