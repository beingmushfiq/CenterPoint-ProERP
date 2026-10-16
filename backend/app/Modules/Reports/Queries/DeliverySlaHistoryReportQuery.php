<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\DeliveryDataProvider;

class DeliverySlaHistoryReportQuery implements ReportQueryInterface
{
    protected DeliveryDataProvider $provider;

    public function __construct(?DeliveryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new DeliveryDataProvider;
    }

    public function columns(): array
    {
        return [
            'delivery_number' => [
                'label' => 'Shipment Tracking No',
                'type' => 'string',
                'sortable' => true,
            ],
            'recipient_name' => [
                'label' => 'Customer',
                'type' => 'string',
            ],
            'delivery_type' => [
                'label' => 'Service Tier',
                'type' => 'badge',
            ],
            'courier_name' => [
                'label' => 'Logistics Provider',
                'type' => 'string',
            ],
            'scheduled_date' => [
                'label' => 'Committed Date',
                'type' => 'date',
            ],
            'delivered_at' => [
                'label' => 'Actual Delivery',
                'type' => 'string',
            ],
            'attempts' => [
                'label' => 'Attempt Count',
                'type' => 'number',
            ],
            'sla_adherence' => [
                'label' => 'SLA Fulfillment',
                'type' => 'badge',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->deliverySlaHistory($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
