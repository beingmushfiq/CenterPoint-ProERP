<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\TenantNotFoundLog;
use App\Models\TenantRedirect;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TenantRedirectController extends Controller
{
    protected function getTenantId(Request $request): int
    {
        if (TenantContext::isBound()) {
            return TenantContext::current()->tenantId();
        }
        return (int) ($request->attributes->get('tenant_id') ?? $request->user()?->tenant_id ?? Auth::user()?->tenant_id ?? 1);
    }

    /**
     * List all redirects for current tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->getTenantId($request);

        $query = TenantRedirect::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('created_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search): void {
                $q->where('source_path', 'like', "%{$search}%")
                    ->orWhere('target_path', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%");
            });
        }

        $redirects = $query->paginate((int) ($request->query('per_page') ?? 25));

        return response()->json([
            'success' => true,
            'data' => $redirects->items(),
            'meta' => [
                'current_page' => $redirects->currentPage(),
                'last_page' => $redirects->lastPage(),
                'per_page' => $redirects->perPage(),
                'total' => $redirects->total(),
            ],
        ]);
    }

    /**
     * Create a new redirect.
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->getTenantId($request);

        $validated = $request->validate([
            'source_path' => 'required|string|max:512',
            'target_path' => 'required|string|max:512',
            'status_code' => 'nullable|integer|in:301,302,307,308',
            'is_active' => 'nullable|boolean',
            'notes' => 'nullable|string|max:500',
        ]);

        $sourcePath = '/' . ltrim(trim($validated['source_path']), '/');

        $exists = TenantRedirect::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('source_path', $sourcePath)
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'A redirect rule for this source path already exists.',
            ], 422);
        }

        $redirect = TenantRedirect::create([
            'tenant_id' => $tenantId,
            'source_path' => $sourcePath,
            'target_path' => trim($validated['target_path']),
            'status_code' => $validated['status_code'] ?? 301,
            'is_active' => $validated['is_active'] ?? true,
            'notes' => $validated['notes'] ?? null,
            'created_by' => $request->user()?->id ?? Auth::id(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Redirect created successfully.',
            'data' => $redirect,
        ], 201);
    }

    /**
     * Update an existing redirect.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->getTenantId($request);
        $redirect = TenantRedirect::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->findOrFail($id);

        $validated = $request->validate([
            'source_path' => 'sometimes|required|string|max:512',
            'target_path' => 'sometimes|required|string|max:512',
            'status_code' => 'sometimes|integer|in:301,302,307,308',
            'is_active' => 'sometimes|boolean',
            'notes' => 'nullable|string|max:500',
        ]);

        if (isset($validated['source_path'])) {
            $validated['source_path'] = '/' . ltrim(trim($validated['source_path']), '/');
        }

        $redirect->update(array_merge($validated, ['updated_by' => $request->user()?->id ?? Auth::id()]));

        return response()->json([
            'success' => true,
            'message' => 'Redirect updated successfully.',
            'data' => $redirect,
        ]);
    }

    /**
     * Delete a redirect.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->getTenantId($request);
        $redirect = TenantRedirect::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->findOrFail($id);

        $redirect->delete();

        return response()->json([
            'success' => true,
            'message' => 'Redirect deleted successfully.',
        ]);
    }

    /**
     * List 404 Not Found hit logs for this tenant.
     */
    public function notFoundLogs(Request $request): JsonResponse
    {
        $tenantId = $this->getTenantId($request);

        $query = TenantNotFoundLog::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('hit_count')
            ->orderByDesc('last_seen_at');

        if ($request->has('unresolved_only') && $request->boolean('unresolved_only')) {
            $query->where('is_resolved', false);
        }

        $logs = $query->paginate((int) ($request->query('per_page') ?? 25));

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /**
     * 1-Click resolve a 404 by creating a 301 redirect.
     */
    public function resolveNotFound(Request $request, int $id): JsonResponse
    {
        $tenantId = $this->getTenantId($request);
        $log = TenantNotFoundLog::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->findOrFail($id);

        $request->validate([
            'target_path' => 'required|string|max:512',
            'status_code' => 'nullable|integer|in:301,302',
        ]);

        $sourcePath = '/' . ltrim(trim($log->path), '/');

        $redirect = TenantRedirect::updateOrCreate(
            ['tenant_id' => $tenantId, 'source_path' => $sourcePath],
            [
                'target_path' => trim($request->input('target_path')),
                'status_code' => $request->input('status_code', 301),
                'is_active' => true,
                'notes' => "Auto-resolved from 404 log (hits: {$log->hit_count})",
                'created_by' => $request->user()?->id ?? Auth::id(),
            ]
        );

        $log->update([
            'is_resolved' => true,
            'resolved_redirect_id' => $redirect->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => '404 successfully resolved to 301 redirect.',
            'data' => [
                'log' => $log,
                'redirect' => $redirect,
            ],
        ]);
    }
}
