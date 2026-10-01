<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\PurchaseDataProvider;

class SupplierScorecardReportQuery implements ReportQueryInterface
{
    protected PurchaseDataProvider $provider;

    public function __construct(?PurchaseDataProvider $provider = null)
    {
        $this->provider = $provider ?? new PurchaseDataProvider();
    }

    public function columns(): array
    {
        return [
            'supplier_code' => ['label' => 'Supplier Code', 'type' => 'string', 'sortable' => true],
            'supplier_name' => ['label' => 'Supplier Name', 'type' => 'string', 'sortable' => true],
            'total_orders' => ['label' => 'Orders Placed', 'type' => 'number', 'sortable' => true],
            'total_spend' => ['label' => 'Total Spend (BDT)', 'type' => 'currency', 'sortable' => true],
            'on_time_rate' => ['label' => 'On-Time Rate %', 'type' => 'percentage', 'sortable' => true],
            'in_full_rate' => ['label' => 'In-Full Rate %', 'type' => 'percentage', 'sortable' => true],
            'otif_rate' => ['label' => 'Composite OTIF %', 'type' => 'percentage', 'sortable' => true],
            'avg_lead_time_days' => ['label' => 'Avg Lead Time (Days)', 'type' => 'number', 'sortable' => true],
            'rejection_rate' => ['label' => 'Rejection Rate %', 'type' => 'percentage', 'sortable' => true],
            'performance_tier' => ['label' => 'Performance Tier', 'type' => 'status_badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->supplierScorecard($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->supplierScorecardSummary($filters);
    }
}
