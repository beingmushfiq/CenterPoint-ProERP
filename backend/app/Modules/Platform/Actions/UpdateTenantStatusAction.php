<?php

declare(strict_types=1);

namespace App\Modules\Platform\Actions;

use App\Core\Actions\Action;
use App\Models\AuditLog;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Action to update tenant status (active, suspended, past_due, cancelled, archived).
 */
class UpdateTenantStatusAction extends Action
{
    /**
     * @param  array{tenant_id: int, status: string, reason?: string|null}  $input
     * @return array<string, mixed>
     */
    public function execute(array $input): array
    {
        $tenantId = (int) $input['tenant_id'];
        $newStatus = trim(strtolower((string) $input['status']));
        $reason = trim((string) ($input['reason'] ?? ''));

        $allowed = ['active', 'trial', 'past_due', 'suspended', 'cancelled', 'pending', 'archived'];
        if (! in_array($newStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ['Status must be one of: '.implode(', ', $allowed)],
            ]);
        }

        $tenant = Tenant::findOrFail($tenantId);
        $oldStatus = $tenant->status;

        $updates = ['status' => $newStatus];
        if ($newStatus === 'suspended') {
            $updates['suspended_at'] = Carbon::now();
        } elseif ($newStatus === 'archived') {
            $updates['archived_at'] = Carbon::now();
            $updates['suspended_at'] = Carbon::now();
        } elseif ($newStatus === 'active') {
            $updates['suspended_at'] = null;
            $updates['archived_at'] = null;
            if ($tenant->activated_at === null) {
                $updates['activated_at'] = Carbon::now();
            }
        }

        $tenant->update($updates);

        Cache::forget("t{$tenant->id}:tenant:profile");
        Cache::forget("tenant:{$tenant->id}:profile");

        // Record platform audit log
        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => Auth::id(),
            'action' => \App\Core\Audit\AuditAction::Updated,
            'auditable_type' => 'Tenant',
            'auditable_id' => $tenant->id,
            'ip' => request()->ip() ?? '127.0.0.1',
            'user_agent' => request()->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'before' => ['status' => $oldStatus],
            'after' => [
                'status' => $newStatus,
                'reason' => $reason,
                'suspended_at' => $tenant->suspended_at?->toIso8601String(),
                'archived_at' => $tenant->archived_at?->toIso8601String(),
            ],
        ]);

        return [
            'id' => $tenant->id,
            'uuid' => $tenant->uuid,
            'slug' => $tenant->slug,
            'status' => $tenant->status,
            'suspended_at' => $tenant->suspended_at?->toIso8601String(),
            'activated_at' => $tenant->activated_at?->toIso8601String(),
            'archived_at' => $tenant->archived_at?->toIso8601String(),
        ];
    }
}
