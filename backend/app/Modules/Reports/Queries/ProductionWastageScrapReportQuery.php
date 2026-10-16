<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class ProductionWastageScrapReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider;
    }

    public function columns(): array
    {
        return [
            'wastage_number' => [
                'label' => 'Wastage No',
                'type' => 'string',
                'sortable' => true,
            ],
            'recorded_at' => [
                'label' => 'Date Logged',
                'type' => 'string',
            ],
            'batch_number' => [
                'label' => 'Batch Reference',
                'type' => 'string',
            ],
            'sku' => [
                'label' => 'Material SKU',
                'type' => 'string',
            ],
            'product_name' => [
                'label' => 'Material Name',
                'type' => 'string',
            ],
            'stage' => [
                'label' => 'Process Stage',
                'type' => 'string',
            ],
            'scrap_quantity' => [
                'label' => 'Scrap Qty',
                'type' => 'number',
                'sortable' => true,
            ],
            'estimated_cost' => [
                'label' => 'Loss Cost (BDT)',
                'type' => 'currency',
            ],
            'is_recoverable' => [
                'label' => 'Recoverable?',
                'type' => 'badge',
            ],
            'recovered_quantity' => [
                'label' => 'Recovered Qty',
                'type' => 'number',
            ],
            'reason' => [
                'label' => 'Loss Reason',
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
        return $this->provider->productionWastageScrap($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
