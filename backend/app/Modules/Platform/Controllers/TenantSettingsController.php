<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Settings\SettingService;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TenantSettingsController extends Controller
{
    public function __construct(
        private readonly SettingService $settingService
    ) {}

    /**
     * Get the full settings schema dictionary.
     */
    public function schema(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->settingService->getSchemaDictionary(),
        ]);
    }

    /**
     * Get settings for a specific group.
     */
    public function getGroup(Request $request, string $group): JsonResponse
    {
        $branchId = $request->query('branch_id') ? (int) $request->query('branch_id') : null;
        $userId = $request->query('user_id') ? (int) $request->query('user_id') : null;

        $settings = $this->settingService->getAllGroup($group, $branchId, $userId, true);

        return response()->json([
            'success' => true,
            'data' => [
                'group' => $group,
                'settings' => $settings,
            ],
        ]);
    }

    /**
     * Update settings for a group.
     */
    public function updateGroup(Request $request, string $group): JsonResponse
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'scope' => 'nullable|string|in:tenant,branch,user',
            'scope_id' => 'nullable|integer',
        ]);

        $scope = $validated['scope'] ?? 'tenant';
        $scopeId = $validated['scope_id'] ?? null;
        /** @var \App\Models\User $actor */
        $actor = $request->user();

        $updated = $this->settingService->batchUpdate(
            group: $group,
            values: $validated['settings'],
            scope: $scope,
            scopeId: $scopeId,
            actor: $actor
        );

        return response()->json([
            'success' => true,
            'message' => "Settings for group '{$group}' updated successfully.",
            'data' => [
                'group' => $group,
                'settings' => $updated,
            ],
        ]);
    }

    /**
     * Test live connection for third-party courier or payment gateway.
     */
    public function testConnection(Request $request, string $group): JsonResponse
    {
        $validated = $request->validate([
            'provider' => 'required|string',
            'credentials' => 'nullable|array',
        ]);

        $result = $this->settingService->testConnection(
            providerOrService: $validated['provider'],
            credentials: $validated['credentials'] ?? []
        );

        return response()->json([
            'success' => $result['success'],
            'data' => $result,
        ]);
    }

    /**
     * Reset a settings group back to defaults.
     */
    public function resetGroup(Request $request, string $group): JsonResponse
    {
        $validated = $request->validate([
            'scope' => 'nullable|string|in:tenant,branch,user',
            'scope_id' => 'nullable|integer',
        ]);

        $scope = $validated['scope'] ?? 'tenant';
        $scopeId = $validated['scope_id'] ?? null;
        /** @var \App\Models\User $actor */
        $actor = $request->user();

        $this->settingService->resetGroup($group, $scope, $scopeId, $actor);

        $fresh = $this->settingService->getAllGroup($group, $scope === 'branch' ? $scopeId : null, $scope === 'user' ? $scopeId : null, true);

        return response()->json([
            'success' => true,
            'message' => "Settings for group '{$group}' have been reset to platform defaults.",
            'data' => [
                'group' => $group,
                'settings' => $fresh,
            ],
        ]);
    }

    /**
     * Upload a brand asset (logo, favicon, or icon).
     */
    public function uploadAsset(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:png,jpg,jpeg,svg,ico,webp,gif|max:5120',
            'type' => 'nullable|string|in:logo,favicon,general',
        ]);

        $file = $request->file('file');
        $tenantId = TenantContext::current()->tenantId() ?? 'default';
        $ext = $file->getClientOriginalExtension() ?: 'png';
        $filename = ($request->input('type') ?? 'asset').'_'.time().'_'.substr(md5(uniqid()), 0, 8).'.'.$ext;

        $path = $file->storeAs("branding/{$tenantId}", $filename, 'public');
        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');
        $url = $disk->url($path);

        return response()->json([
            'success' => true,
            'message' => 'Asset uploaded successfully.',
            'data' => [
                'url' => $url,
                'path' => $path,
            ],
        ]);
    }
}
