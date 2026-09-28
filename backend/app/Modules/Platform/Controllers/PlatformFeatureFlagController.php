<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\FeatureFlag;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlatformFeatureFlagController extends Controller
{
    /**
     * List all platform feature flags.
     */
    public function index(Request $request): JsonResponse
    {
        $query = FeatureFlag::with('tenant:id,name,slug');

        if ($request->filled('scope')) {
            $scope = $request->input('scope');
            if ($scope === 'global') {
                $query->whereNull('tenant_id');
            } elseif ($scope === 'tenant') {
                $query->whereNotNull('tenant_id');
            }
        }

        if ($request->filled('tenant_id')) {
            $query->where('tenant_id', (int) $request->input('tenant_id'));
        }

        if ($request->filled('search')) {
            $search = '%'.trim((string) $request->input('search')).'%';
            $query->where(function ($q) use ($search): void {
                $q->where('key', 'like', $search)
                    ->orWhere('description', 'like', $search);
            });
        }

        $flags = $query->orderBy('key')->orderBy('tenant_id')->get();

        return response()->json([
            'success' => true,
            'data' => $flags,
            'meta' => [
                'total' => $flags->count(),
                'global_count' => $flags->whereNull('tenant_id')->count(),
                'tenant_count' => $flags->whereNotNull('tenant_id')->count(),
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Create a new global or tenant-scoped feature flag.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'key' => 'required|string|max:128',
            'tenant_id' => 'nullable|integer|exists:tenants,id',
            'enabled' => 'nullable|boolean',
            'rollout_percentage' => 'nullable|numeric|min:0|max:100',
            'description' => 'required|string|max:255',
            'conditions' => 'nullable|array',
        ]);

        $key = strtolower(trim($validated['key']));
        $tenantId = $validated['tenant_id'] ?? null;

        // Ensure uniqueness
        $existing = FeatureFlag::where('key', $key)
            ->where(function ($q) use ($tenantId): void {
                if ($tenantId === null) {
                    $q->whereNull('tenant_id');
                } else {
                    $q->where('tenant_id', $tenantId);
                }
            })->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => "Feature flag '{$key}' already exists for this scope.",
            ], 422);
        }

        $flag = FeatureFlag::create([
            'uuid' => (string) Str::uuid(),
            'key' => $key,
            'tenant_id' => $tenantId,
            'enabled' => $validated['enabled'] ?? false,
            'rollout_percentage' => $validated['rollout_percentage'] ?? null,
            'description' => $validated['description'],
            'conditions' => $validated['conditions'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Created,
            'auditable_type' => 'FeatureFlag',
            'auditable_id' => $flag->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => ['key' => $flag->key, 'enabled' => $flag->enabled, 'tenant_id' => $tenantId],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Feature flag '{$flag->key}' created.",
            'data' => $flag->load('tenant:id,name,slug'),
        ], 201);
    }

    /**
     * Update an existing feature flag.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $flag = FeatureFlag::findOrFail($id);

        $validated = $request->validate([
            'enabled' => 'nullable|boolean',
            'rollout_percentage' => 'nullable|numeric|min:0|max:100',
            'description' => 'nullable|string|max:255',
            'conditions' => 'nullable|array',
        ]);

        $oldEnabled = $flag->enabled;
        $flag->update(array_filter($validated, fn ($v) => $v !== null));

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Updated,
            'auditable_type' => 'FeatureFlag',
            'auditable_id' => $flag->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'before' => ['enabled' => $oldEnabled],
            'after' => ['enabled' => $flag->enabled, 'rollout_percentage' => $flag->rollout_percentage],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Feature flag '{$flag->key}' updated.",
            'data' => $flag->fresh()->load('tenant:id,name,slug'),
        ]);
    }

    /**
     * Delete a feature flag.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $flag = FeatureFlag::findOrFail($id);
        $key = $flag->key;
        $flag->delete();

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Deleted,
            'auditable_type' => 'FeatureFlag',
            'auditable_id' => $id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'before' => ['key' => $key],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Feature flag '{$key}' deleted.",
        ]);
    }
}
