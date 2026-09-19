<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\QCDataProvider;

class DefectCategorizationReportQuery implements ReportQueryInterface
{
    protected QCDataProvider $provider;

    public function __construct(?QCDataProvider $provider = null)
    {
        $this->provider = $provider ?? new QCDataProvider();
    }

    public function columns(): array
    {
        return array (
  'defect_code' => 
  array (
    'label' => 'Defect Code',
    'type' => 'string',
    'sortable' => true,
  ),
  'defect_reason' => 
  array (
    'label' => 'Defect Reason / Flaw',
    'type' => 'string',
  ),
  'severity' => 
  array (
    'label' => 'Severity',
    'type' => 'badge',
  ),
  'quantity' => 
  array (
    'label' => 'Defect Qty',
    'type' => 'number',
    'sortable' => true,
  ),
  'inspection_number' => 
  array (
    'label' => 'Inspection No',
    'type' => 'string',
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
  'product_name' => 
  array (
    'label' => 'Product Name',
    'type' => 'string',
  ),
  'notes' => 
  array (
    'label' => 'Notes',
    'type' => 'string',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->defectCategorization($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
