<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\InventoryDataProvider;

class WarehouseTransferReportQuery implements ReportQueryInterface
{
    protected InventoryDataProvider $provider;

    public function __construct(?InventoryDataProvider $provider = null)
    {
        $this->provider = $provider ?? new InventoryDataProvider;
    }

    public function columns(): array
    {
        return [
            'transfer_number' => [
                'label' => 'Transfer No',
                'type' => 'string',
                'sortable' => true,
            ],
            'transfer_date' => [
                'label' => 'Date',
                'type' => 'date',
            ],
            'from_warehouse' => [
                'label' => 'Origin Warehouse',
                'type' => 'string',
            ],
            'to_warehouse' => [
                'label' => 'Destination Warehouse',
                'type' => 'string',
            ],
            'status' => [
                'label' => 'Transfer Status',
                'type' => 'badge',
            ],
            'dispatched_by' => [
                'label' => 'Dispatched By',
                'type' => 'string',
            ],
            'dispatched_at' => [
                'label' => 'Dispatched Timestamp',
                'type' => 'string',
            ],
            'received_by' => [
                'label' => 'Received By',
                'type' => 'string',
            ],
            'received_at' => [
                'label' => 'Received Timestamp',
                'type' => 'string',
            ],
            'notes' => [
                'label' => 'Notes',
                'type' => 'string',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->warehouseTransfers($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
