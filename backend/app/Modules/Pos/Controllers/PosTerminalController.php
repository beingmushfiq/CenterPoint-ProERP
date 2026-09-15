<?php

declare(strict_types=1);

namespace App\Modules\Pos\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Pos\Models\PosTerminal;
use App\Modules\Pos\Requests\StorePosTerminalRequest;
use App\Modules\Pos\Resources\PosTerminalResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PosTerminalController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = PosTerminal::where('tenant_id', $tenantId);

        if ($request->filled('branch_id')) {
            $query->where('branch_id', (int) $request->query('branch_id'));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where(function ($q) use ($search): void {
                $q->where('code', 'like', "%{$search}%")
                  ->orWhere('name', 'like', "%{$search}%");
            });
        }

        $terminals = $query->orderBy('name')
            ->paginate((int) $request->query('per_page', 25));

        return PosTerminalResource::collection($terminals);
    }

    public function store(StorePosTerminalRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        $terminal = PosTerminal::create([
            ...$validated,
            'tenant_id'  => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new PosTerminalResource($terminal))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): PosTerminalResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $terminal = PosTerminal::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new PosTerminalResource($terminal);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $terminal = PosTerminal::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'code' => 'nullable|string|max:50',
            'name' => 'nullable|string|max:191',
            'branch_id' => 'nullable|integer',
            'default_warehouse_id' => 'nullable|integer',
            'printer_config' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);

        $terminal->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Terminal updated successfully.',
            'data' => new PosTerminalResource($terminal->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function toggleActive(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $terminal = PosTerminal::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $terminal->update([
            'is_active' => ! $terminal->is_active,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Terminal status toggled successfully.',
            'data' => new PosTerminalResource($terminal->fresh()),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $terminal = PosTerminal::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $terminal->delete();

        return response()->json([
            'success' => true,
            'message' => 'Terminal deleted successfully.',
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }
}
