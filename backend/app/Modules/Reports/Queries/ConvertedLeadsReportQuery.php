<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\CRMDataProvider;

class ConvertedLeadsReportQuery implements ReportQueryInterface
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
  'phone' => 
  array (
    'label' => 'Phone',
    'type' => 'string',
  ),
  'source' => 
  array (
    'label' => 'Source Channel',
    'type' => 'badge',
  ),
  'salesman' => 
  array (
    'label' => 'Account Executive',
    'type' => 'string',
  ),
  'deal_value' => 
  array (
    'label' => 'Won Value (BDT)',
    'type' => 'currency',
    'sortable' => true,
  ),
  'converted_at' => 
  array (
    'label' => 'Conversion Date',
    'type' => 'date',
  ),
  'account_name' => 
  array (
    'label' => 'Created Client Account',
    'type' => 'string',
  ),
);
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->convertedLeads($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
