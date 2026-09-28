<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Models\TenantDomain;
use App\Modules\Ecommerce\Services\TenantDomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class PlatformDomainController extends Controller
{
    public function __construct(
        private readonly TenantDomainService $domainService
    ) {}

    /**
     * List all registered tenant custom domains across the platform.
     */
    public function index(Request $request): JsonResponse
    {
        $query = TenantDomain::withoutTenantScope()
            ->with(['tenant:id,name,slug,status'])
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('verification_status', $request->query('status'));
        }

        if ($request->filled('ssl_status')) {
            $query->where('ssl_status', $request->query('ssl_status'));
        }

        if ($request->filled('search')) {
            $search = '%'.trim((string) $request->query('search')).'%';
            $query->where(function ($q) use ($search): void {
                $q->where('domain', 'like', $search)
                    ->orWhereHas('tenant', function ($tq) use ($search): void {
                        $tq->where('name', 'like', $search)
                            ->orWhere('slug', 'like', $search);
                    });
            });
        }

        $domains = $query->paginate((int) $request->query('per_page', 25));

        return response()->json([
            'success' => true,
            'data' => $domains->items(),
            'meta' => [
                'current_page' => $domains->currentPage(),
                'per_page' => $domains->perPage(),
                'total' => $domains->total(),
                'last_page' => $domains->lastPage(),
            ],
        ]);
    }

    /**
     * Show details of a specific tenant domain.
     */
    public function show(int $id): JsonResponse
    {
        $domain = TenantDomain::withoutTenantScope()
            ->with(['tenant:id,name,slug,status'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $domain,
        ]);
    }

    /**
     * Trigger manual verification from Platform Admin side.
     */
    public function verify(Request $request, int $id): JsonResponse
    {
        /** @var TenantDomain $domain */
        $domain = TenantDomain::withoutTenantScope()->findOrFail($id);

        $result = $this->domainService->verifyDomain($domain, $request->user());

        return response()->json([
            'success' => $result['success'],
            'message' => $result['message'],
            'data' => $result['domain'],
        ], $result['success'] ? 200 : 422);
    }

    /**
     * Suspend or toggle domain status.
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'verification_status' => 'required|string|in:pending,verified,failed,suspended',
            'ssl_status' => 'nullable|string|in:pending,active,failed,not_required',
        ]);

        /** @var TenantDomain $domain */
        $domain = TenantDomain::withoutTenantScope()->findOrFail($id);

        $domain->update([
            'verification_status' => $validated['verification_status'],
            'ssl_status' => $validated['ssl_status'] ?? $domain->ssl_status,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Domain '{$domain->domain}' status updated.",
            'data' => $domain->fresh(),
        ]);
    }

    /**
     * Remove or release a custom domain.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        /** @var TenantDomain $domain */
        $domain = TenantDomain::withoutTenantScope()->findOrFail($id);

        try {
            $this->domainService->removeDomain($domain, $request->user());

            return response()->json([
                'success' => true,
                'message' => 'Custom domain removed successfully.',
            ]);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CANNOT_REMOVE_DOMAIN',
                    'message' => $e->getMessage(),
                ],
            ], 422);
        }
    }
}
