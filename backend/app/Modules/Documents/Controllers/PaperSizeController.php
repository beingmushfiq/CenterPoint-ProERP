<?php

declare(strict_types=1);

namespace App\Modules\Documents\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Documents\Models\PaperSize;
use App\Modules\Documents\Resources\PaperSizeResource;
use App\Modules\Documents\Services\PaperSizeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PaperSizeController extends Controller
{
    public function __construct(
        private readonly PaperSizeService $paperSizeService
    ) {}

    public function index(): AnonymousResourceCollection
    {
        $sizes = $this->paperSizeService->getAllAvailable();

        return PaperSizeResource::collection($sizes);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:128'],
            'width_mm' => ['required', 'numeric', 'min:10', 'max:2000'],
            'height_mm' => ['nullable', 'numeric', 'min:10', 'max:2000'],
            'unit' => ['nullable', 'string', 'in:mm,inch'],
            'orientation_default' => ['nullable', 'string', 'in:portrait,landscape'],
            'margin_top_mm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'margin_bottom_mm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'margin_left_mm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'margin_right_mm' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $userId = (int) ($request->user()?->id ?? 0);
        $size = $this->paperSizeService->createCustom($validated, $userId);

        return (new PaperSizeResource($size))
            ->response()
            ->setStatusCode(201);
    }

    public function update(int $id, Request $request): PaperSizeResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $size = PaperSize::where('tenant_id', $tenantId)
            ->where('is_builtin', false)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:128'],
            'width_mm' => ['sometimes', 'numeric', 'min:10', 'max:2000'],
            'height_mm' => ['nullable', 'numeric', 'min:10', 'max:2000'],
            'unit' => ['sometimes', 'string', 'in:mm,inch'],
            'orientation_default' => ['sometimes', 'string', 'in:portrait,landscape'],
            'margin_top_mm' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'margin_bottom_mm' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'margin_left_mm' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'margin_right_mm' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $validated['updated_by'] = (int) ($request->user()?->id ?? 0);
        $size->update($validated);

        return new PaperSizeResource($size);
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $size = PaperSize::where('tenant_id', $tenantId)
            ->where('is_builtin', false)
            ->where('id', $id)
            ->firstOrFail();

        $size->delete();

        return response()->json(['message' => 'Custom paper size removed']);
    }
}
