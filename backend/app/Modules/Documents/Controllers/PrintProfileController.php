<?php

declare(strict_types=1);

namespace App\Modules\Documents\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Documents\Models\PrintProfile;
use App\Modules\Documents\Resources\PrintProfileResource;
use App\Modules\Documents\Services\PrintProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PrintProfileController extends Controller
{
    public function __construct(
        private readonly PrintProfileService $profileService
    ) {}

    public function index(): AnonymousResourceCollection
    {
        $profiles = $this->profileService->getProfiles();

        return PrintProfileResource::collection($profiles);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:128'],
            'paper_size_id' => ['nullable', 'integer'],
            'orientation' => ['nullable', 'string', 'in:portrait,landscape'],
            'margin_top_mm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'margin_bottom_mm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'margin_left_mm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'margin_right_mm' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'scale' => ['nullable', 'numeric', 'min:0.2', 'max:3.0'],
            'copies' => ['nullable', 'integer', 'min:1', 'max:100'],
            'is_printer_friendly' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $userId = (int) ($request->user()?->id ?? 0);
        $profile = $this->profileService->createProfile($validated, $userId);

        return (new PrintProfileResource($profile))
            ->response()
            ->setStatusCode(201);
    }

    public function update(int $id, Request $request): PrintProfileResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $profile = PrintProfile::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:128'],
            'paper_size_id' => ['nullable', 'integer'],
            'orientation' => ['sometimes', 'string', 'in:portrait,landscape'],
            'margin_top_mm' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'margin_bottom_mm' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'margin_left_mm' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'margin_right_mm' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'scale' => ['sometimes', 'numeric', 'min:0.2', 'max:3.0'],
            'copies' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'is_printer_friendly' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $userId = (int) ($request->user()?->id ?? 0);
        $updated = $this->profileService->updateProfile($profile, $validated, $userId);

        return new PrintProfileResource($updated);
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $profile = PrintProfile::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $profile->delete();

        return response()->json(['message' => 'Print profile removed']);
    }
}
