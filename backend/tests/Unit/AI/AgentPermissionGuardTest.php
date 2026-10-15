<?php

declare(strict_types=1);

namespace Tests\Unit\AI;

use App\Modules\AI\Services\AgentPermissionGuard;
use PHPUnit\Framework\TestCase;

final class AgentPermissionGuardTest extends TestCase
{
    private AgentPermissionGuard $guard;

    protected function setUp(): void
    {
        parent::setUp();
        $this->guard = new AgentPermissionGuard;
    }

    public function test_read_tools_are_tier_0(): void
    {
        $this->assertSame(0, $this->guard->getToolTier('get_cash_position'));
        $this->assertSame(0, $this->guard->getToolTier('list_overdue_invoices'));
        $this->assertSame(0, $this->guard->getToolTier('get_pl_summary'));
        $this->assertSame(0, $this->guard->getToolTier('analyze_cash_flow_risk'));
        $this->assertSame(0, $this->guard->getToolTier('get_inventory_value'));
        $this->assertSame(0, $this->guard->getToolTier('get_report_data'));
    }

    public function test_financing_match_is_tier_1(): void
    {
        $this->assertSame(1, $this->guard->getToolTier('match_financing_options'));
    }

    public function test_alert_creation_is_tier_2_supervised(): void
    {
        $this->assertSame(2, $this->guard->getToolTier('create_cash_flow_alert'));
        $this->assertTrue($this->guard->requiresConfirmation('create_cash_flow_alert'));
        $this->assertFalse($this->guard->canExecuteDirectly('create_cash_flow_alert', 1));
    }

    public function test_unknown_or_prohibited_tools_are_tier_3_disabled(): void
    {
        $this->assertSame(3, $this->guard->getToolTier('execute_raw_wire_transfer'));
        $this->assertFalse($this->guard->canExecuteDirectly('execute_raw_wire_transfer', 2));
    }
}
