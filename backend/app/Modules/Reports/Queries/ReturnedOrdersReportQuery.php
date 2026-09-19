<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\DeliveryDataProvider;

class ReturnedOrdersReportQuery implements ReportQueryInterface
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
            'attempt_count' => ['label' => 'Delivery Attempts', 'type' => 'number'],
            'cod_amount' => ['label' => 'Unrealized Value (BDT)', 'type' => 'currency'],
            'status' => ['label' => 'Return Status', 'type' => 'badge'],
            'return_reason' => ['label' => 'Reason / Notes', 'type' => 'string'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->returnedOrders($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
