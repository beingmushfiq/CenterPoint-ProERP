<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\Models\AgentAuditLog;
use Throwable;

class AgentAuditLogger
{
    /**
     * Record an AI Agent action or tool invocation into the audit trail.
     *
     * @param  array<string, mixed>|null  $inputParams
     */
    public function log(
        int $tenantId,
        ?int $userId,
        ?int $conversationId,
        string $action,
        int $permissionTier,
        ?array $inputParams = null,
        ?string $resultSummary = null,
        bool $executed = false,
        ?int $confirmedBy = null,
        ?string $ipAddress = null,
        ?int $durationMs = null
    ): AgentAuditLog {
        return AgentAuditLog::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'conversation_id' => $conversationId,
            'action' => $action,
            'permission_tier' => $permissionTier,
            'input_params' => $inputParams,
            'result_summary' => $resultSummary !== null ? mb_substr($resultSummary, 0, 1000) : null,
            'executed' => $executed,
            'confirmed_by' => $confirmedBy,
            'ip_address' => $ipAddress,
            'duration_ms' => $durationMs,
        ]);
    }

    /**
     * Measure and log an executed tool callback automatically.
     *
     * @param  array<string, mixed>  $inputParams
     * @param  callable(): array<string, mixed>  $callback
     * @return array<string, mixed>
     */
    public function measureAndLog(
        int $tenantId,
        ?int $userId,
        ?int $conversationId,
        string $toolName,
        int $permissionTier,
        array $inputParams,
        callable $callback,
        ?int $confirmedBy = null,
        ?string $ipAddress = null
    ): array {
        $start = microtime(true);
        $executed = false;
        $summary = null;

        try {
            $result = $callback();
            $executed = true;
            $encoded = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
            $summary = is_string($encoded) ? $encoded : null;

            return $result;
        } catch (Throwable $e) {
            $summary = 'ERROR: '.$e->getMessage();
            throw $e;
        } finally {
            $durationMs = (int) round((microtime(true) - $start) * 1000);
            $this->log(
                tenantId: $tenantId,
                userId: $userId,
                conversationId: $conversationId,
                action: $toolName,
                permissionTier: $permissionTier,
                inputParams: $inputParams,
                resultSummary: $summary,
                executed: $executed,
                confirmedBy: $confirmedBy,
                ipAddress: $ipAddress,
                durationMs: $durationMs
            );
        }
    }
}
