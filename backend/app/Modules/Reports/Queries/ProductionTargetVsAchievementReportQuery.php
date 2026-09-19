<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use App\Modules\Reports\DataProviders\ProductionDataProvider;

class ProductionTargetVsAchievementReportQuery implements ReportQueryInterface
{
    protected ProductionDataProvider $provider;

    public function __construct(?ProductionDataProvider $provider = null)
    {
        $this->provider = $provider ?? new ProductionDataProvider();
    }

    public function columns(): array
    {
        return [
            'line_code' => ['label' => 'Line Code', 'type' => 'string', 'sortable' => true],
            'line_name' => ['label' => 'Production Line', 'type' => 'string'],
            'daily_capacity' => ['label' => 'Rated Daily Capacity', 'type' => 'number'],
            'batches_count' => ['label' => 'Batches Executed', 'type' => 'number'],
            'target_quantity' => ['label' => 'Target Qty', 'type' => 'number'],
            'achieved_quantity' => ['label' => 'Achieved Qty', 'type' => 'number', 'sortable' => true],
            'variance_quantity' => ['label' => 'Variance (+/-)', 'type' => 'number'],
            'achievement_percent' => ['label' => 'Achievement Rate %', 'type' => 'percentage'],
            'status' => ['label' => 'Line Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->provider->targetVsAchievement($filters, $page, $perPage);
    }

    public function summary(array $filters): array
    {
        return $this->provider->summary($filters);
    }
}
