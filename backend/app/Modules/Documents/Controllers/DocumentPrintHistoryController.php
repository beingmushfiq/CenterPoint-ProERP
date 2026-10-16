<?php

declare(strict_types=1);

namespace App\Modules\Documents\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Documents\Resources\DocumentPrintHistoryResource;
use App\Modules\Documents\Services\PrintHistoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class DocumentPrintHistoryController extends Controller
{
    public function __construct(
        private readonly PrintHistoryService $historyService
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = [
            'document_type' => $request->query('document_type'),
            'action' => $request->query('action'),
            'q' => $request->query('q'),
        ];

        $perPage = (int) $request->query('per_page', 25);
        $paginated = $this->historyService->getPaginatedHistory($filters, $perPage);

        return DocumentPrintHistoryResource::collection($paginated);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'document_type' => ['required', 'string', 'max:64'],
            'document_id' => ['required', 'integer'],
            'document_number' => ['required', 'string', 'max:128'],
            'template_id' => ['nullable', 'integer'],
            'template_version' => ['nullable', 'integer'],
            'print_profile_id' => ['nullable', 'integer'],
            'action' => ['required', 'string', 'in:print,pdf,reprint'],
            'copies' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $userId = (int) ($request->user()?->id ?? 0);
        $ip = $request->ip();
        $ua = $request->userAgent();

        $history = $this->historyService->recordHistory($validated, $userId, $ip, $ua);

        return (new DocumentPrintHistoryResource($history))
            ->response()
            ->setStatusCode(201);
    }
}
