<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\CRMDataProvider;

class LostLeadsAnalysisReportQuery implements ReportQueryInterface
{
    protected CRMDataProvider $provider;

    public function __construct(?CRMDataProvider $provider = null)
    {
        $this->provider = $provider ?? new CRMDataProvider();
    }

    public function columns(): array
    {
        return array (
  'lead_number' => 
  array (
    'label' => 'Lead No',
    'type' => 'string',
    'sortable' => true,
  ),
  'contact_name' => 
  array (
    'label' => 'Contact Name',
    'type' => 'string',
  ),
  'company_name' => 
  array (
    'label' => 'Company Name',
    'type' => 'string',
  ),
  'source' => 
  array (
    'label' => 'Acquisition Channel',
    'type' => 'badge',
  ),
  'salesman' => 
  array (
    'label' => 'Assigned Rep',
    'type' => 'string',
  ),
  'lost_value' => 
  array (
    'label' => 'Forfeited Value (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'lost_reason' => 
  array (
    'label' => 'Loss Reason',
    'type' => 'badge',
  ),
  'notes' => 
  array (
    'label' => 'Post-Mortem Notes',
    'type' => 'string',
  ),
  'lost_date' => 
  array (
    'label' => 'Lost Date',
    'type' => 'date',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->lostLeadsAnalysis($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
