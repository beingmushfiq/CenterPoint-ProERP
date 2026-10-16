<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\DeliveryDataProvider;

class CancelledDeliveriesReportQuery implements ReportQueryInterface
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
                'label' => 'Shipment Waybill No',
                'type' => 'string',
                'sortable' => true,
            ],
            'scheduled_date' => [
                'label' => 'Scheduled Date',
                'type' => 'date',
            ],
            'recipient_name' => [
                'label' => 'Recipient Name',
                'type' => 'string',
            ],
            'phone' => [
                'label' => 'Phone',
                'type' => 'string',
            ],
            'delivery_type' => [
                'label' => 'Delivery Service',
                'type' => 'badge',
            ],
            'courier_name' => [
                'label' => 'Courier Partner',
                'type' => 'string',
            ],
            'attempts' => [
                'label' => 'Delivery Attempts',
                'type' => 'number',
            ],
            'status' => [
                'label' => 'Shipment Status',
                'type' => 'badge',
            ],
            'reason' => [
                'label' => 'Failure / Cancellation Reason',
                'type' => 'string',
            ],
            'instructions' => [
                'label' => 'Special Delivery Notes',
                'type' => 'string',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->cancelledDeliveries($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
