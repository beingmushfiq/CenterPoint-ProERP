<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\DeliveryDataProvider;

class PendingDeliveriesReportQuery implements ReportQueryInterface
{
    protected DeliveryDataProvider $provider;

    public function __construct(?DeliveryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new DeliveryDataProvider();
    }

    public function columns(): array
    {
        return [
            'delivery_number' => ['label' => 'Consignment / Tracking #', 'type' => 'string', 'sortable' => true],
            'order_number' => ['label' => 'Sales Order #', 'type' => 'string'],
            'recipient_name' => ['label' => 'Customer / Recipient', 'type' => 'string'],
            'recipient_phone' => ['label' => 'Phone', 'type' => 'string'],
            'warehouse_name' => ['label' => 'Origin Warehouse', 'type' => 'string'],
            'courier_name' => ['label' => 'Courier Partner', 'type' => 'string'],
            'delivery_type' => ['label' => 'Method', 'type' => 'badge'],
            'cod_amount' => ['label' => 'COD Value (BDT)', 'type' => 'currency'],
            'scheduled_date' => ['label' => 'Scheduled Date', 'type' => 'date'],
            'status' => ['label' => 'Dispatch Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->pendingDispatches($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
