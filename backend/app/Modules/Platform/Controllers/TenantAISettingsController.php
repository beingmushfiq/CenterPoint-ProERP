<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\AI\Services\UnifiedLLMClient;
use App\Modules\Platform\Models\TenantAISetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Throwable;

/**
 * Tenant AI Model Configuration API
 *
 * Routes (tenant-scoped, authenticated):
 *   GET    /api/settings/ai-model         → show current config (masked key)
 *   POST   /api/settings/ai-model         → create or update config
 *   POST   /api/settings/ai-model/test    → test connection
 *   DELETE /api/settings/ai-model         → remove tenant config (fallback to global)
 */
class TenantAISettingsController extends Controller
{
    public function __construct(
        protected readonly UnifiedLLMClient $llmClient
    ) {}

    /**
     * Return the current tenant AI model configuration (masked API key).
     */
    public function show(Request $request): JsonResponse
    {
        $tenantId = (int) $request->user()->tenant_id;

        /** @var TenantAISetting|null $setting */
        $setting = TenantAISetting::where('tenant_id', $tenantId)->first();

        if (! $setting) {
            // Return global/default config as context
            return response()->json([
                'success' => true,
                'data'    => [
                    'configured'       => false,
                    'model_name'       => 'Google Gemini 3.5 Flash Lite',
                    'model_id'         => config('services.gemini.model') ?? config('services.anthropic.model', 'gemini-3.5-flash-lite'),
                    'base_url'         => config('services.gemini.base_url') ?? config('services.anthropic.base_url', 'https://generativelanguage.googleapis.com/v1beta/openai'),
                    'api_key_masked'   => null,
                    'api_key_set'      => ! empty(config('services.gemini.key')),
                    'api_version'      => config('services.anthropic.version', '2023-06-01'),
                    'max_tokens'       => config('services.gemini.max_tokens', 4096),
                    'is_active'        => true,
                    'source'           => 'global',
                ],
            ]);
        }

        assert($setting instanceof TenantAISetting);

        return response()->json([
            'success' => true,
            'data'    => array_merge(
                $setting->toPublicArray(),
                ['configured' => true, 'source' => 'tenant']
            ),
        ]);
    }

    /**
     * Create or update the tenant AI model configuration.
     */
    public function update(Request $request): JsonResponse
    {
        $tenantId = (int) $request->user()->tenant_id;

        $validated = $request->validate([
            'model_name'  => 'nullable|string|max:150',
            'model_id'    => 'required|string|max:250',
            'base_url'    => 'required|url|max:500',
            'api_key'     => 'nullable|string|max:500|min:8',
            'api_version' => 'nullable|string|max:30',
            'max_tokens'  => 'nullable|integer|min:256|max:65536',
            'is_active'   => 'nullable|boolean',
        ]);

        $setting = TenantAISetting::firstOrNew(['tenant_id' => $tenantId]);

        // Fill non-key fields
        $setting->fill(Arr::except($validated, ['api_key']));
        $setting->tenant_id = $tenantId;

        // Only update the encrypted key if a new value was provided
        if (! empty($validated['api_key'])) {
            $setting->api_key = $validated['api_key'];
        }

        $setting->save();

        return response()->json([
            'success' => true,
            'message' => 'AI model configuration saved successfully.',
            'data'    => array_merge($setting->toPublicArray(), ['configured' => true, 'source' => 'tenant']),
        ]);
    }

    /**
     * Test the connection to the configured LLM API.
     */
    public function test(Request $request): JsonResponse
    {
        $tenantId = (int) $request->user()->tenant_id;

        try {
            $this->llmClient->configureForTenant($tenantId);

            if (! $this->llmClient->isConfigured()) {
                return response()->json([
                    'success' => false,
                    'data'    => [
                        'success'    => false,
                        'latency_ms' => 0,
                        'model'      => null,
                        'error'      => 'No API key is configured. Please save your settings first.',
                    ],
                ], 422);
            }

            $result = $this->llmClient->testConnection();

            return response()->json([
                'success' => true,
                'data'    => $result,
            ], $result['success'] ? 200 : 422);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'data'    => [
                    'success'    => false,
                    'latency_ms' => 0,
                    'model'      => null,
                    'error'      => 'Connection test failed: '.$e->getMessage(),
                ],
            ], 422);
        }
    }

    /**
     * Delete the tenant AI config — falls back to global .env.
     */
    public function destroy(Request $request): JsonResponse
    {
        $tenantId = (int) $request->user()->tenant_id;

        TenantAISetting::where('tenant_id', $tenantId)->delete();

        return response()->json([
            'success' => true,
            'message' => 'Custom AI model configuration removed. Reverted to platform default.',
        ]);
    }
}
