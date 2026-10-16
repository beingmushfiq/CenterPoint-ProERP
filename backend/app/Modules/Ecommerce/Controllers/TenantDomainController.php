<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Modules\Ecommerce\Services\TenantDomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class TenantDomainController extends Controller
{
    public function __construct(
        private readonly TenantDomainService $domainService
    ) {}

    /**
     * List all registered domains for the active tenant.
     */
    public function index(): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $tenant = Tenant::findOrFail($tenantId);

        // Ensure default platform subdomain exists
        $this->domainService->ensurePlatformSubdomain($tenant);

        $domains = TenantDomain::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('is_primary')
            ->orderBy('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $domains,
        ]);
    }

    /**
     * Register a new custom domain for the tenant.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string|max:255',
            'type' => 'nullable|string|in:custom_primary,custom_alias',
        ]);

        $tenantId = TenantContext::current()->tenantId();
        $tenant = Tenant::findOrFail($tenantId);

        try {
            $domain = $this->domainService->addDomain(
                tenant: $tenant,
                domain: $validated['domain'],
                type: $validated['type'] ?? 'custom_alias',
                actor: $request->user()
            );

            return response()->json([
                'success' => true,
                'message' => "Domain '{$domain->domain}' added successfully. Please configure the required DNS records to complete verification.",
                'data' => $domain,
            ], 201);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_DOMAIN',
                    'message' => $e->getMessage(),
                ],
            ], 422);
        }
    }

    /**
     * Trigger DNS verification for a domain.
     */
    public function verify(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        /** @var TenantDomain $domain */
        $domain = TenantDomain::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $allowDevOverride = (bool) $request->input('dev_override', false);
        $result = $this->domainService->verifyDomain($domain, $request->user(), $allowDevOverride);

        return response()->json([
            'success' => $result['success'],
            'message' => $result['message'],
            'data' => $result['domain'],
            'diagnostics' => $result['diagnostics'] ?? null,
        ], $result['success'] ? 200 : 422);
    }

    /**
     * Set a verified custom domain as primary.
     */
    public function setPrimary(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        /** @var TenantDomain $domain */
        $domain = TenantDomain::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        try {
            $this->domainService->setPrimaryDomain($domain, $request->user());

            return response()->json([
                'success' => true,
                'message' => "Domain '{$domain->domain}' is now the primary storefront domain.",
                'data' => $domain->fresh(),
            ]);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CANNOT_SET_PRIMARY',
                    'message' => $e->getMessage(),
                ],
            ], 422);
        }
    }

    /**
     * Remove a custom domain.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        /** @var TenantDomain $domain */
        $domain = TenantDomain::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

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
