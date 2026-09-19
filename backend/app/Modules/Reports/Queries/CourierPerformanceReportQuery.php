<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\DeliveryDataProvider;

class CourierPerformanceReportQuery implements ReportQueryInterface
{
    protected DeliveryDataProvider $provider;

    public function __construct(?DeliveryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new DeliveryDataProvider();
    }

    public function columns(): array
    {
        return [
            'courier_code' => ['label' => 'Carrier Code', 'type' => 'string'],
            'courier_name' => ['label' => 'Courier Partner', 'type' => 'string', 'sortable' => true],
            'total_assigned' => ['label' => 'Total Parcels Handed', 'type' => 'number', 'sortable' => true],
            'total_delivered' => ['label' => 'Delivered (POD)', 'type' => 'number'],
            'total_returned' => ['label' => 'Returned / RTO', 'type' => 'number'],
            'success_rate' => ['label' => 'Fulfillment SLA %', 'type' => 'percentage', 'sortable' => true],
            'total_cod_collected' => ['label' => 'COD Remitted (BDT)', 'type' => 'currency'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->courierPerformance($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
