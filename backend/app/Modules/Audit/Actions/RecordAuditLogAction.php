<?php

declare(strict_types=1);

namespace App\Modules\Audit\Actions;

use App\Core\Audit\AuditAction;
use App\Modules\Audit\Models\AuditLog;
use Illuminate\Support\Str;

class RecordAuditLogAction
{
    public function execute(
        AuditAction|string $action,
        ?string $auditableType = null,
        ?int $auditableId = null,
        ?array $before = null,
        ?array $after = null,
        ?array $context = null
    ): AuditLog {
        $user = auth()->user();
        $tenantId = $user?->tenant_id ?? 1;
        $userId = $user?->id;

        $actionVal = $action instanceof AuditAction ? $action->value : $action;

        $changedFields = [];
        if ($before !== null && $after !== null) {
            foreach ($after as $key => $val) {
                if (! array_key_exists($key, $before) || $before[$key] !== $val) {
                    $changedFields[] = $key;
                }
            }
        }

        return AuditLog::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'user_id' => $userId,
            'action' => $actionVal,
            'auditable_type' => $auditableType,
            'auditable_id' => $auditableId,
            'before' => $before,
            'after' => $after,
            'changed_fields' => $changedFields,
            'context' => $context,
            'ip' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }
}
