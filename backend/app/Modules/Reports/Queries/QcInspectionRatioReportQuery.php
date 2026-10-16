<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\QCDataProvider;

class QcInspectionRatioReportQuery implements ReportQueryInterface
{
    protected QCDataProvider $provider;

    public function __construct(?QCDataProvider $provider = null)
    {
        $this->provider = $provider ?? new QCDataProvider;
    }

    public function columns(): array
    {
        return [
            'inspection_number' => [
                'label' => 'Inspection No',
                'type' => 'string',
                'sortable' => true,
            ],
            'inspection_date' => [
                'label' => 'Date',
                'type' => 'date',
            ],
            'batch_number' => [
                'label' => 'Batch No',
                'type' => 'string',
            ],
            'sku' => [
                'label' => 'SKU',
                'type' => 'string',
            ],
            'product_name' => [
                'label' => 'Product Name',
                'type' => 'string',
            ],
            'inspector' => [
                'label' => 'Inspector',
                'type' => 'string',
            ],
            'sample_size' => [
                'label' => 'Sample Size',
                'type' => 'number',
            ],
            'inspected_quantity' => [
                'label' => 'Inspected Qty',
                'type' => 'number',
            ],
            'passed_quantity' => [
                'label' => 'Passed Qty',
                'type' => 'number',
            ],
            'failed_quantity' => [
                'label' => 'Failed Qty',
                'type' => 'number',
            ],
            'pass_rate_percent' => [
                'label' => 'Pass Rate (%)',
                'type' => 'number',
                'sortable' => true,
            ],
            'result' => [
                'label' => 'Result',
                'type' => 'badge',
            ],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->inspectionRatio($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
