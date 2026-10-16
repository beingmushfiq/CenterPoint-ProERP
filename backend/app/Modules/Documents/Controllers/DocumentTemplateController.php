<?php

declare(strict_types=1);

namespace App\Modules\Documents\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Documents\Models\DocumentTemplate;
use App\Modules\Documents\Resources\DocumentTemplateResource;
use App\Modules\Documents\Resources\DocumentTemplateVersionResource;
use App\Modules\Documents\Services\TemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class DocumentTemplateController extends Controller
{
    public function __construct(
        private readonly TemplateService $templateService
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = DocumentTemplate::with(['activeVersion', 'paperSize', 'printProfile'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('document_type')) {
            $query->where('document_type', (string) $request->query('document_type'));
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        } else {
            $query->where('status', '!=', 'archived');
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where('name', 'like', "%{$search}%");
        }

        $templates = $query->orderBy('document_type')
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();

        return DocumentTemplateResource::collection($templates);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'document_type' => ['required', 'string', 'max:64'],
            'company_id' => ['nullable', 'integer'],
            'branch_id' => ['nullable', 'integer'],
            'paper_size_id' => ['nullable', 'integer'],
            'print_profile_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'in:active,draft,archived'],
            'is_default' => ['nullable', 'boolean'],
            'layout_config' => ['nullable', 'array'],
        ]);

        $userId = (int) ($request->user()?->id ?? 0);
        $template = $this->templateService->createTemplate($validated, $userId);

        return (new DocumentTemplateResource($template))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): DocumentTemplateResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $template = DocumentTemplate::with(['activeVersion', 'paperSize', 'printProfile', 'versions'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new DocumentTemplateResource($template);
    }

    public function update(int $id, Request $request): DocumentTemplateResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $template = DocumentTemplate::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'document_type' => ['sometimes', 'string', 'max:64'],
            'company_id' => ['nullable', 'integer'],
            'branch_id' => ['nullable', 'integer'],
            'paper_size_id' => ['nullable', 'integer'],
            'print_profile_id' => ['nullable', 'integer'],
            'status' => ['sometimes', 'string', 'in:active,draft,archived'],
            'is_default' => ['sometimes', 'boolean'],
            'change_summary' => ['nullable', 'string', 'max:255'],
            'layout_config' => ['nullable', 'array'],
        ]);

        $userId = (int) ($request->user()?->id ?? 0);
        $updated = $this->templateService->updateTemplate($template, $validated, $userId);

        return new DocumentTemplateResource($updated);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $template = DocumentTemplate::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $template->update(['status' => 'archived']);
        $template->delete();

        return response()->json(['message' => 'Template archived successfully']);
    }

    public function setDefault(int $id, Request $request): DocumentTemplateResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $template = DocumentTemplate::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $userId = (int) ($request->user()?->id ?? 0);
        $updated = $this->templateService->setDefault($template, $userId);

        return new DocumentTemplateResource($updated);
    }

    public function duplicate(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $template = DocumentTemplate::with('activeVersion')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $userId = (int) ($request->user()?->id ?? 0);
        $cloned = $this->templateService->duplicateTemplate($template, (string) $request->input('name'), $userId);

        return (new DocumentTemplateResource($cloned))
            ->response()
            ->setStatusCode(201);
    }

    public function versions(int $id): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $template = DocumentTemplate::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $versions = $template->versions()->orderByDesc('version')->get();

        return DocumentTemplateVersionResource::collection($versions);
    }

    public function activateVersion(int $id, int $version, Request $request): DocumentTemplateResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $template = DocumentTemplate::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $userId = (int) ($request->user()?->id ?? 0);
        $updated = $this->templateService->activateVersion($template, $version, $userId);

        return new DocumentTemplateResource($updated);
    }
}
