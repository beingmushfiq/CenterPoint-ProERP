<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\Platform\Models\TenantAISetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Unified LLM Client — Anthropic Messages API compatible.
 *
 * Resolution order for every config key:
 *   1. Tenant-specific setting (tenant_ai_settings table, loaded via configureForTenant())
 *   2. Global .env / config/services.php fallback
 *
 * Extends AnthropicClient to retain full backward compatibility with all
 * existing Copilot code that already depends on AnthropicClient.
 */
class UnifiedLLMClient extends AnthropicClient
{
    /** @var array<string, mixed>|null  Resolved tenant-level overrides */
    private ?array $tenantConfig = null;

    // -----------------------------------------------------------------------
    // Tenant Resolution
    // -----------------------------------------------------------------------

    /**
     * Hydrate tenant-level config from DB.
     * Call this at the start of every orchestrator chat() invocation.
     */
    public function configureForTenant(int $tenantId): void
    {
        $setting = TenantAISetting::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->first();

        if ($setting instanceof TenantAISetting && $setting->isUsable()) {
            $this->tenantConfig = $setting->toClientConfig();
        } else {
            $this->tenantConfig = null;
        }
    }

    /**
     * Reset to global .env config (useful in tests / after tenant logout).
     */
    public function resetToGlobal(): void
    {
        $this->tenantConfig = null;
    }

    /**
     * Returns which config source is active.
     */
    public function getConfigSource(): string
    {
        return $this->tenantConfig !== null ? 'tenant' : 'global';
    }

    public function getActiveModelName(): string
    {
        if ($this->tenantConfig !== null && ! empty($this->tenantConfig['model_name'])) {
            return (string) $this->tenantConfig['model_name'];
        }

        $model = $this->resolveKey('model');

        return is_string($model) && $model !== '' ? $model : 'claude-3-7-sonnet-latest';
    }

    public function getActiveBaseUrl(): string
    {
        $raw = $this->resolveKey('base_url');

        return is_string($raw) && $raw !== '' ? rtrim($raw, '/') : 'https://api.anthropic.com';
    }

    // -----------------------------------------------------------------------
    // Config Resolution (overrides AnthropicClient internal lookups)
    // -----------------------------------------------------------------------

    private function resolveKey(string $key): mixed
    {
        if ($this->tenantConfig !== null && isset($this->tenantConfig[$key])) {
            return $this->tenantConfig[$key];
        }

        return config("services.anthropic.{$key}");
    }

    // -----------------------------------------------------------------------
    // Overrides of AnthropicClient public API
    // -----------------------------------------------------------------------

    public function isConfigured(): bool
    {
        $key = $this->resolveKey('key');

        return is_string($key) && trim($key) !== '';
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $tools
     * @return array{content: string, tool_calls: list<array{id: string, name: string, arguments: array<string, mixed>}>, stop_reason: string}|null
     */
    public function messages(string $systemPrompt, array $messages, array $tools = []): ?array
    {
        if (! $this->isConfigured()) {
            return null;
        }

        $rawBaseUrl = $this->resolveKey('base_url');
        $baseUrl    = rtrim(is_string($rawBaseUrl) && $rawBaseUrl !== '' ? $rawBaseUrl : 'https://api.anthropic.com', '/');

        $rawKey  = $this->resolveKey('key');
        $apiKey  = is_string($rawKey) ? $rawKey : '';

        $rawVersion = $this->resolveKey('version');
        $apiVersion = is_string($rawVersion) && $rawVersion !== '' ? $rawVersion : '2023-06-01';

        $rawModel     = $this->resolveKey('model');
        $rawMaxTokens = $this->resolveKey('max_tokens');

        $body = [
            'model'      => is_string($rawModel) && $rawModel !== '' ? $rawModel : 'claude-3-7-sonnet-latest',
            'max_tokens' => is_numeric($rawMaxTokens) ? (int) $rawMaxTokens : 4096,
            'system'     => $systemPrompt,
            'messages'   => $messages,
        ];

        if ($tools !== []) {
            $body['tools'] = $tools;
        }

        try {
            $response = Http::withHeaders([
                'x-api-key'         => $apiKey,
                'anthropic-version' => $apiVersion,
                'content-type'      => 'application/json',
            ])
                ->timeout(60)
                ->post($baseUrl.'/v1/messages', $body);

            if (! $response->successful()) {
                Log::warning('[UnifiedLLMClient] API error ('.$this->getConfigSource().' config): '.$response->body());

                return null;
            }

            /** @var array<string, mixed> $json */
            $json = $response->json();

            return $this->parseResponse($json);
        } catch (Throwable $e) {
            Log::error('[UnifiedLLMClient] Connection exception ('.$this->getConfigSource().' config): '.$e->getMessage());

            return null;
        }
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $tools
     * @return array{content: string, tool_calls: list<array{id: string, name: string, arguments: array<string, mixed>}>, stop_reason: string}|null
     */
    public function buildRequestBody(string $systemPrompt, array $messages, array $tools = []): array
    {
        $rawModel     = $this->resolveKey('model');
        $rawMaxTokens = $this->resolveKey('max_tokens');

        $body = [
            'model'      => is_string($rawModel) && $rawModel !== '' ? $rawModel : 'claude-3-7-sonnet-latest',
            'max_tokens' => is_numeric($rawMaxTokens) ? (int) $rawMaxTokens : 4096,
            'system'     => $systemPrompt,
            'messages'   => $messages,
        ];

        if ($tools !== []) {
            $body['tools'] = $tools;
        }

        return $body;
    }

    // -----------------------------------------------------------------------
    // Connection Test
    // -----------------------------------------------------------------------

    /**
     * Perform a minimal test call and return latency + model identifier.
     *
     * @return array{success: bool, latency_ms: int, model: string|null, error: string|null}
     */
    public function testConnection(): array
    {
        if (! $this->isConfigured()) {
            return [
                'success'    => false,
                'latency_ms' => 0,
                'model'      => null,
                'error'      => 'No API key configured.',
            ];
        }

        $start = (int) (microtime(true) * 1000);

        $result = $this->messages(
            'You are a test assistant.',
            [['role' => 'user', 'content' => 'Reply with exactly: PING']],
            []
        );

        $latency = (int) (microtime(true) * 1000) - $start;

        if ($result === null) {
            return [
                'success'    => false,
                'latency_ms' => $latency,
                'model'      => null,
                'error'      => 'Connection failed. Check your API key, base URL, and model ID.',
            ];
        }

        $rawModel = $this->resolveKey('model');

        return [
            'success'    => true,
            'latency_ms' => $latency,
            'model'      => is_string($rawModel) ? $rawModel : null,
            'error'      => null,
        ];
    }
}
