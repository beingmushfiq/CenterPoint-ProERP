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
        $this->provider = $provider ?? new QCDataProvider();
    }

    public function columns(): array
    {
        return array (
  'inspection_number' => 
  array (
    'label' => 'Inspection No',
    'type' => 'string',
    'sortable' => true,
  ),
  'inspection_date' => 
  array (
    'label' => 'Date',
    'type' => 'date',
  ),
  'batch_number' => 
  array (
    'label' => 'Batch No',
    'type' => 'string',
  ),
  'sku' => 
  array (
    'label' => 'SKU',
    'type' => 'string',
  ),
  'product_name' => 
  array (
    'label' => 'Product Name',
    'type' => 'string',
  ),
  'inspector' => 
  array (
    'label' => 'Inspector',
    'type' => 'string',
  ),
  'sample_size' => 
  array (
    'label' => 'Sample Size',
    'type' => 'number',
  ),
  'inspected_quantity' => 
  array (
    'label' => 'Inspected Qty',
    'type' => 'number',
  ),
  'passed_quantity' => 
  array (
    'label' => 'Passed Qty',
    'type' => 'number',
  ),
  'failed_quantity' => 
  array (
    'label' => 'Failed Qty',
    'type' => 'number',
  ),
  'pass_rate_percent' => 
  array (
    'label' => 'Pass Rate (%)',
    'type' => 'number',
    'sortable' => true,
  ),
  'result' => 
  array (
    'label' => 'Result',
    'type' => 'badge',
  ),
);
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
