<?php

declare(strict_types=1);

namespace App\Modules\Documents\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Documents\Resources\DocumentTemplateResource;
use App\Modules\Documents\Services\TemplateResolverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DocumentResolveController extends Controller
{
    public function __construct(
        private readonly TemplateResolverService $resolverService
    ) {}

    public function resolve(Request $request): JsonResponse
    {
        $request->validate([
            'document_type' => ['required', 'string'],
            'template_id' => ['nullable', 'integer'],
            'branch_id' => ['nullable', 'integer'],
            'company_id' => ['nullable', 'integer'],
        ]);

        $template = $this->resolverService->resolve(
            (string) $request->query('document_type'),
            $request->filled('template_id') ? (int) $request->query('template_id') : null,
            $request->filled('branch_id') ? (int) $request->query('branch_id') : null,
            $request->filled('company_id') ? (int) $request->query('company_id') : null
        );

        if (! $template) {
            return response()->json([
                'data' => null,
                'message' => 'No active template found for document type '.$request->query('document_type'),
            ], 404);
        }

        return (new DocumentTemplateResource($template))->response();
    }
}
