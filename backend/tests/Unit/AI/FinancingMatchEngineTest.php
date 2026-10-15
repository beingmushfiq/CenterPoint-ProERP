<?php

declare(strict_types=1);

namespace Tests\Unit\AI;

use App\Modules\AI\Services\FinancingMatchEngine;
use Tests\TestCase;

final class FinancingMatchEngineTest extends TestCase
{
    private FinancingMatchEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = new FinancingMatchEngine;
    }

    public function test_gather_metrics_respects_custom_inputs(): void
    {
        $metrics = $this->engine->gatherFinancialMetrics(tenantId: 1, customInputs: [
            'monthly_revenue' => 450000.0,
            'monthly_expenses' => 300000.0,
            'ar_outstanding' => 200000.0,
            'ap_outstanding' => 80000.0,
            'inventory_value' => 500000.0,
            'bank_balance' => 120000.0,
        ]);

        $this->assertEquals(450000.0, $metrics['monthly_revenue']);
        $this->assertEquals(300000.0, $metrics['monthly_expenses']);
        $this->assertEquals(150000.0, $metrics['net_monthly_profit']);
        $this->assertEquals(200000.0, $metrics['ar_outstanding']);
        $this->assertEquals(500000.0, $metrics['inventory_value']);
        $this->assertEquals(120000.0, $metrics['bank_balance']);
    }
}
