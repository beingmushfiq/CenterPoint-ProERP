<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class AgentPermissionGuard
{
    public const TIER_0_READ = 0;

    public const TIER_1_ADVISORY = 1;

    public const TIER_2_SUPERVISED = 2;

    public const TIER_3_DISABLED = 3;

    public const MAX_FINANCING_ADVISORY_LIMIT = 50000000.0; // BDT 50,000,000 cap

    public const TIER_0_TOOLS = [
        'get_cash_position',
        'list_overdue_invoices',
        'get_pl_summary',
        'analyze_cash_flow_risk',
        'get_inventory_value',
        'get_report_data',
    ];

    public const TIER_1_TOOLS = [
        'match_financing_options',
    ];

    public const TIER_2_TOOLS = [
        'create_cash_flow_alert',
    ];

    public const TIER_3_TOOLS = [
        // Prohibited actions (e.g. direct bank transfer, arbitrary database write)
    ];

    /**
     * Return the numerical permission tier for the given tool.
     */
    public function getToolTier(string $toolName): int
    {
        if (in_array($toolName, self::TIER_0_TOOLS, true)) {
            return self::TIER_0_READ;
        }

        if (in_array($toolName, self::TIER_1_TOOLS, true)) {
            return self::TIER_1_ADVISORY;
        }

        if (in_array($toolName, self::TIER_2_TOOLS, true)) {
            return self::TIER_2_SUPERVISED;
        }

        return self::TIER_3_DISABLED;
    }

    /**
     * Determine if a tool is eligible for direct execution without explicit user confirmation.
     */
    public function canExecuteDirectly(string $toolName, int $maxAllowedTier = self::TIER_1_ADVISORY): bool
    {
        $tier = $this->getToolTier($toolName);

        if ($tier === self::TIER_3_DISABLED) {
            return false;
        }

        // Tier 2 always requires explicit interactive confirmation
        if ($tier >= self::TIER_2_SUPERVISED) {
            return false;
        }

        return $tier <= $maxAllowedTier;
    }

    /**
     * Check if the tool requires explicit confirmation from user.
     */
    public function requiresConfirmation(string $toolName): bool
    {
        return $this->getToolTier($toolName) === self::TIER_2_SUPERVISED;
    }

    /**
     * Validate tenant boundary to guarantee no cross-tenant data leakage.
     */
    public function validateTenantBoundary(int $activeTenantId, ?int $requestedTenantId): void
    {
        if ($requestedTenantId !== null && $requestedTenantId !== $activeTenantId) {
            throw new AuthorizationException(
                "Cross-tenant access violation: Current tenant {$activeTenantId} cannot access data for tenant {$requestedTenantId}."
            );
        }
    }

    /**
     * Guardrail 4: Cap financial advisory amounts to prevent runaway proposals.
     */
    public function capFinancialAmount(float $requestedAmount): float
    {
        return min(max(0.0, $requestedAmount), self::MAX_FINANCING_ADVISORY_LIMIT);
    }
}
