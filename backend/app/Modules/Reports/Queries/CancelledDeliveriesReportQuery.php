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
        $this->provider = $provider ?? new DeliveryDataProvider();
    }

    public function columns(): array
    {
        return array (
  'delivery_number' => 
  array (
    'label' => 'Shipment Waybill No',
    'type' => 'string',
    'sortable' => true,
  ),
  'scheduled_date' => 
  array (
    'label' => 'Scheduled Date',
    'type' => 'date',
  ),
  'recipient_name' => 
  array (
    'label' => 'Recipient Name',
    'type' => 'string',
  ),
  'phone' => 
  array (
    'label' => 'Phone',
    'type' => 'string',
  ),
  'delivery_type' => 
  array (
    'label' => 'Delivery Service',
    'type' => 'badge',
  ),
  'courier_name' => 
  array (
    'label' => 'Courier Partner',
    'type' => 'string',
  ),
  'attempts' => 
  array (
    'label' => 'Delivery Attempts',
    'type' => 'number',
  ),
  'status' => 
  array (
    'label' => 'Shipment Status',
    'type' => 'badge',
  ),
  'reason' => 
  array (
    'label' => 'Failure / Cancellation Reason',
    'type' => 'string',
  ),
  'instructions' => 
  array (
    'label' => 'Special Delivery Notes',
    'type' => 'string',
  ),
);
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
