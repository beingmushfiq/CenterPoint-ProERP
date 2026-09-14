<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Core\Audit\AuditAction;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Storefront;
use App\Models\StorefrontPage;
use App\Modules\Ecommerce\Services\StorefrontDefaultTemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class StorefrontPageBuilderController extends Controller
{
    public function __construct(
        private readonly StorefrontDefaultTemplateService $templateService
    ) {}

    /**
     * Tenant Admin: List all CMS pages
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $storefront = $this->getTenantStorefront($tenantId);

        $pages = StorefrontPage::where('tenant_id', $tenantId)
            ->where('storefront_id', $storefront->id)
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();

        if ($pages->isEmpty()) {
            $this->seedDefaultPages($tenantId, $storefront->id);
            $pages = StorefrontPage::where('tenant_id', $tenantId)
                ->where('storefront_id', $storefront->id)
                ->orderBy('sort_order')
                ->orderBy('title')
                ->get();
        }

        return response()->json([
            'success' => true,
            'data' => $pages,
        ]);
    }

    /**
     * Seed standard default CMS pages for storefront
     */
    public function seedDefaultPages(int $tenantId, int $storefrontId): void
    {
        $this->templateService->seedDefaultPages($tenantId, $storefrontId);
    }

    /**
     * Tenant Admin: Seed or reset standard preset pages
     */
    public function seedDefaults(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $storefront = $this->getTenantStorefront($tenantId);

        $this->seedDefaultPages($tenantId, $storefront->id);

        $pages = StorefrontPage::where('tenant_id', $tenantId)
            ->where('storefront_id', $storefront->id)
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Default storefront pages seeded successfully.',
            'data' => $pages,
        ]);
    }

    /**
     * Tenant Admin: Create a new page
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $storefront = $this->getTenantStorefront($tenantId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:128',
            'page_type' => 'nullable|string|in:home,content,policy,contact,faq,custom,warranty,shipping,lab',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string',
            'status' => 'nullable|string|in:draft,published',
            'blocks' => 'nullable|array',
        ]);

        $slug = ! empty($validated['slug'])
            ? Str::slug($validated['slug'])
            : Str::slug($validated['title']);

        // Prevent duplicate slugs
        $existing = StorefrontPage::where('tenant_id', $tenantId)
            ->where('storefront_id', $storefront->id)
            ->where('slug', $slug)
            ->first();

        if ($existing) {
            $slug .= '-'.Str::random(4);
        }

        $page = StorefrontPage::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'storefront_id' => $storefront->id,
            'title' => $validated['title'],
            'slug' => $slug,
            'page_type' => $validated['page_type'] ?? 'custom',
            'meta_title' => $validated['meta_title'] ?? $validated['title'],
            'meta_description' => $validated['meta_description'] ?? null,
            'status' => $validated['status'] ?? 'draft',
            'published_at' => ($validated['status'] ?? 'draft') === 'published' ? now() : null,
            'blocks' => $validated['blocks'] ?? [],
            'sort_order' => StorefrontPage::where('tenant_id', $tenantId)->count() + 1,
            'created_by' => $request->user()?->id,
        ]);

        $audit = new AuditLog;
        $audit->uuid = (string) Str::uuid();
        $audit->tenant_id = $tenantId;
        $audit->user_id = $request->user()?->id;
        $audit->action = AuditAction::Created;
        $audit->auditable_type = StorefrontPage::class;
        $audit->auditable_id = $page->id;
        $audit->after = ['title' => $page->title, 'slug' => $page->slug];
        $audit->created_at = now();
        $audit->save();

        return response()->json([
            'success' => true,
            'message' => 'Storefront page created successfully.',
            'data' => $page,
        ], 201);
    }

    /**
     * Tenant Admin: Get single page with blocks
     */
    public function show(Request $request, string|int $idOrSlug): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $storefront = $this->getTenantStorefront($tenantId);

        $query = StorefrontPage::where('tenant_id', $tenantId)
            ->where('storefront_id', $storefront->id);

        if (is_numeric($idOrSlug)) {
            $query->where('id', (int) $idOrSlug);
        } else {
            $query->where('slug', $idOrSlug);
        }

        $page = $query->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $page,
        ]);
    }

    /**
     * Tenant Admin: Update page details & content blocks
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $page = StorefrontPage::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'slug' => 'sometimes|required|string|max:128',
            'page_type' => 'sometimes|string|in:home,content,policy,contact,faq,custom,warranty,shipping,lab',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string',
            'status' => 'sometimes|string|in:draft,published',
            'blocks' => 'sometimes|array',
            'sort_order' => 'nullable|integer',
        ]);

        if (isset($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        if (isset($validated['status'])) {
            if ($validated['status'] === 'published' && $page->status !== 'published') {
                $page->published_at = now();
            } elseif ($validated['status'] === 'draft') {
                $page->published_at = null;
            }
        }

        $page->update($validated);

        $audit = new AuditLog;
        $audit->uuid = (string) Str::uuid();
        $audit->tenant_id = $tenantId;
        $audit->user_id = $request->user()?->id;
        $audit->action = AuditAction::Updated;
        $audit->auditable_type = StorefrontPage::class;
        $audit->auditable_id = $page->id;
        $audit->after = ['title' => $page->title, 'status' => $page->status];
        $audit->created_at = now();
        $audit->save();

        return response()->json([
            'success' => true,
            'message' => 'Page updated successfully.',
            'data' => $page,
        ]);
    }

    /**
     * Tenant Admin: Delete page
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $page = StorefrontPage::where('tenant_id', $tenantId)->findOrFail($id);

        if ($page->slug === 'home') {
            return response()->json([
                'success' => false,
                'message' => 'The storefront homepage cannot be deleted.',
            ], 422);
        }

        $page->delete();

        return response()->json([
            'success' => true,
            'message' => 'Page deleted successfully.',
        ]);
    }

    /**
     * Public Storefront: Get published page by slug for customer website
     */
    public function getPublicPage(Request $request, string $slug): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $page = StorefrontPage::where('tenant_id', $tenantId)
            ->where('slug', $slug)
            ->where('status', 'published')
            ->first();

        if (! $page) {
            return response()->json([
                'success' => false,
                'message' => "Page '{$slug}' not found or not published.",
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'title' => $page->title,
                'slug' => $page->slug,
                'page_type' => $page->page_type,
                'meta_title' => $page->meta_title ?? $page->title,
                'meta_description' => $page->meta_description,
                'blocks' => $page->blocks ?? [],
                'published_at' => $page->published_at,
            ],
        ]);
    }

    private function getTenantStorefront(int $tenantId): Storefront
    {
        $tenant = TenantContext::current()->tenant();

        return Storefront::firstOrCreate(
            ['tenant_id' => $tenantId],
            [
                'uuid' => (string) Str::uuid(),
                'name' => $tenant['name'] ?? 'Storefront',
                'subdomain' => $tenant['slug'] ?? 'store-'.$tenantId,
                'status' => 'live',
                'currency' => $tenant['currency_code'] ?? 'USD',
            ]
        );
    }
}
