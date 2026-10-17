<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\Platform\Models\TenantAISetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Unified LLM Client — Google Gemini & Multi-Provider Engine.
 *
 * Wire protocol:
 *   - Google Gemini / OpenAI (Default): POST {base_url}/chat/completions with Bearer auth.
 *   - Anthropic: POST {base_url}/v1/messages with x-api-key auth (backward-compatibility).
 *
 * Config resolution order:
 *   1. Tenant-specific setting (tenant_ai_settings table via configureForTenant())
 *   2. Global .env / config/services.php (services.gemini, with services.anthropic fallback)
 */
class UnifiedLLMClient extends AnthropicClient
{
    /** @var array<string, mixed>|null Resolved tenant-level overrides */
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

        return is_string($model) && $model !== '' ? $model : 'gemini-3.5-flash-lite';
    }

    public function getActiveBaseUrl(): string
    {
        $raw = $this->resolveKey('base_url');

        return is_string($raw) && $raw !== ''
            ? rtrim($raw, '/')
            : 'https://generativelanguage.googleapis.com/v1beta/openai';
    }

    public function isAnthropicProtocol(): bool
    {
        $rawBaseUrl = $this->resolveKey('base_url');
        $baseUrl = is_string($rawBaseUrl) ? strtolower($rawBaseUrl) : '';

        return str_contains($baseUrl, 'anthropic') || str_contains($baseUrl, 'agentrouter');
    }

    // -----------------------------------------------------------------------
    // Config Resolution
    // -----------------------------------------------------------------------

    private function resolveKey(string $key): mixed
    {
        if ($this->tenantConfig !== null && isset($this->tenantConfig[$key])) {
            return $this->tenantConfig[$key];
        }

        // If a gemini key is set, prioritize gemini
        $geminiKey = config('services.gemini.key');
        if (is_string($geminiKey) && trim($geminiKey) !== '') {
            $gemini = config("services.gemini.{$key}");
            if ($gemini !== null && $gemini !== '') {
                return $gemini;
            }
        }

        // If anthropic key is set (e.g. legacy or tests), use anthropic
        $anthropicKey = config('services.anthropic.key');
        if (is_string($anthropicKey) && trim($anthropicKey) !== '') {
            $anthropic = config("services.anthropic.{$key}");
            if ($anthropic !== null && $anthropic !== '') {
                return $anthropic;
            }
        }

        return config("services.gemini.{$key}") ?? config("services.anthropic.{$key}");
    }

    // -----------------------------------------------------------------------
    // Public API Implementation
    // -----------------------------------------------------------------------

    public function isConfigured(): bool
    {
        $key = $this->resolveKey('key');

        return is_string($key) && trim($key) !== '';
    }

    /**
     * Build the request body in OpenAI chat completions format (or Anthropic if configured).
     *
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $tools
     * @return array<string, mixed>
     */
    public function buildRequestBody(string $systemPrompt, array $messages, array $tools = []): array
    {
        if ($this->isAnthropicProtocol()) {
            return parent::buildRequestBody($systemPrompt, $messages, $tools);
        }

        $rawModel     = $this->resolveKey('model');
        $rawMaxTokens = $this->resolveKey('max_tokens');

        $model = is_string($rawModel) && $rawModel !== '' ? $rawModel : 'gemini-3.5-flash-lite';
        $maxTokens = is_numeric($rawMaxTokens) ? (int) $rawMaxTokens : 4096;

        $formattedMessages = [];
        if (trim($systemPrompt) !== '') {
            $formattedMessages[] = [
                'role' => 'system',
                'content' => $systemPrompt,
            ];
        }

        foreach ($this->normalizeMessages($messages) as $msg) {
            $formattedMessages[] = $msg;
        }

        $body = [
            'model' => $model,
            'max_tokens' => $maxTokens,
            'messages' => $formattedMessages,
        ];

        $openAiTools = $this->normalizeTools($tools);
        if ($openAiTools !== []) {
            $body['tools'] = $openAiTools;
        }

        return $body;
    }

    /**
     * Perform a single Gemini or Anthropic chat completion turn.
     *
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
        $baseUrl = is_string($rawBaseUrl) && $rawBaseUrl !== ''
            ? rtrim($rawBaseUrl, '/')
            : 'https://generativelanguage.googleapis.com/v1beta/openai';

        $rawKey = $this->resolveKey('key');
        $apiKey = is_string($rawKey) ? trim($rawKey) : '';

        $isAnthropic = $this->isAnthropicProtocol();

        $url = $isAnthropic
            ? (str_ends_with($baseUrl, '/v1/messages') ? $baseUrl : $baseUrl . '/v1/messages')
            : (str_ends_with($baseUrl, '/chat/completions') ? $baseUrl : $baseUrl . '/chat/completions');

        $body = $this->buildRequestBody($systemPrompt, $messages, $tools);

        try {
            $http = Http::timeout(60);

            // Windows SSL resiliency: bypass local certificate errors if configured or in dev
            $noVerify = env('AI_CURL_NO_VERIFY', false)
                || config('app.env') === 'local'
                || config('app.env') === 'testing'
                || PHP_OS_FAMILY === 'Windows';

            if ($noVerify) {
                $http = $http->withoutVerifying();
            }

            if ($isAnthropic) {
                $rawVersion = $this->resolveKey('version');
                $apiVersion = is_string($rawVersion) && $rawVersion !== '' ? $rawVersion : '2023-06-01';

                $response = $http->withHeaders([
                    'x-api-key'         => $apiKey,
                    'anthropic-version' => $apiVersion,
                    'content-type'      => 'application/json',
                ])->post($url, $body);
            } else {
                $response = $http->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type'  => 'application/json',
                ])->post($url, $body);
            }

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
     * Parse OpenAI / Gemini / Anthropic response into orchestrator format.
     *
     * @param  array<string, mixed>  $response
     * @return array{content: string, tool_calls: list<array{id: string, name: string, arguments: array<string, mixed>}>, stop_reason: string}
     */
    public function parseResponse(array $response): array
    {
        // Handle Anthropic-native response blocks if received
        if (isset($response['content']) && is_array($response['content'])) {
            return parent::parseResponse($response);
        }

        $choice = is_array($response['choices'][0] ?? null) ? $response['choices'][0] : [];
        $message = is_array($choice['message'] ?? null) ? $choice['message'] : [];

        $text = is_string($message['content'] ?? null) ? (string) $message['content'] : '';
        $finishReason = is_string($choice['finish_reason'] ?? null) ? (string) $choice['finish_reason'] : 'stop';

        $toolCalls = [];
        if (! empty($message['tool_calls']) && is_array($message['tool_calls'])) {
            foreach ($message['tool_calls'] as $tc) {
                if (! is_array($tc)) {
                    continue;
                }
                $fn = is_array($tc['function'] ?? null) ? $tc['function'] : [];
                $rawArgs = $fn['arguments'] ?? '{}';
                $args = is_array($rawArgs) ? $rawArgs : (json_decode((string) $rawArgs, true) ?? []);

                $toolCalls[] = [
                    'id' => is_string($tc['id'] ?? null) ? (string) $tc['id'] : (string) Str::uuid(),
                    'name' => is_string($fn['name'] ?? null) ? (string) $fn['name'] : '',
                    'arguments' => is_array($args) ? $args : [],
                ];
            }
        }

        return [
            'content' => $text,
            'tool_calls' => $toolCalls,
            'stop_reason' => ! empty($toolCalls) ? 'tool_use' : $finishReason,
            'raw_message' => $message,
        ];
    }

    /**
     * Build assistant turn message to be sent in follow-up.
     *
     * @param  array{content: string, tool_calls: list<array{id: string, name: string, arguments: array<string, mixed>}>, raw_message?: array<string, mixed>}  $turn
     * @return array<string, mixed>
     */
    public function assistantTurn(array $turn): array
    {
        if ($this->isAnthropicProtocol()) {
            return parent::assistantTurn($turn);
        }

        // Gemini thought_signature compliance: reuse raw message if present
        if (! empty($turn['raw_message']) && is_array($turn['raw_message'])) {
            return $turn['raw_message'];
        }

        $msg = [
            'role' => 'assistant',
            'content' => $turn['content'] ?? '',
        ];

        if (! empty($turn['tool_calls'])) {
            $msg['tool_calls'] = [];
            foreach ($turn['tool_calls'] as $call) {
                $args = $call['arguments'];
                $msg['tool_calls'][] = [
                    'id' => $call['id'],
                    'type' => 'function',
                    'function' => [
                        'name' => $call['name'],
                        'arguments' => is_string($args)
                            ? $args
                            : (empty($args) ? '{}' : json_encode($args, JSON_FORCE_OBJECT | JSON_UNESCAPED_UNICODE)),
                    ],
                ];
            }
        }

        return $msg;
    }

    /**
     * Format tool execution outputs.
     * Keeps Anthropic block contract compatibility while allowing normalizeMessages()
     * to unpack into standard role: 'tool' messages for Gemini.
     *
     * @param  list<array{tool_use_id: string, output: mixed}>  $results
     * @return array<string, mixed>
     */
    public function toolResultMessage(array $results): array
    {
        $blocks = [];

        foreach ($results as $result) {
            $blocks[] = [
                'type' => 'tool_result',
                'tool_use_id' => $result['tool_use_id'],
                'content' => json_encode($result['output'], JSON_UNESCAPED_UNICODE),
            ];
        }

        return ['role' => 'user', 'content' => $blocks];
    }

    /**
     * Convert message list and unpack any Anthropic-style blocks or wrapped tools
     * into standard OpenAI chat completion message format.
     *
     * @param  list<array<string, mixed>>  $messages
     * @return list<array<string, mixed>>
     */
    public function normalizeMessages(array $messages): array
    {
        $normalized = [];

        foreach ($messages as $msg) {
            if (! is_array($msg)) {
                continue;
            }

            // Unpack Anthropic tool_result blocks into standard OpenAI role: 'tool'
            if (($msg['role'] ?? '') === 'user' && isset($msg['content']) && is_array($msg['content'])) {
                $hasToolResult = false;
                foreach ($msg['content'] as $block) {
                    if (is_array($block) && ($block['type'] ?? '') === 'tool_result') {
                        $hasToolResult = true;
                        $normalized[] = [
                            'role' => 'tool',
                            'tool_call_id' => (string) ($block['tool_use_id'] ?? ''),
                            'content' => is_string($block['content'] ?? null)
                                ? $block['content']
                                : json_encode($block['content'] ?? '', JSON_UNESCAPED_UNICODE),
                        ];
                    }
                }
                if ($hasToolResult) {
                    continue;
                }
            }

            // Flatten any nested array of messages
            if (isset($msg[0]) && is_array($msg[0])) {
                foreach ($msg as $subMsg) {
                    if (is_array($subMsg)) {
                        $normalized[] = $subMsg;
                    }
                }
                continue;
            }

            $normalized[] = $msg;
        }

        return $normalized;
    }

    /**
     * Normalize tool schemas into standard OpenAI function format.
     * Accepts both OpenAI function schemas and Anthropic input_schema formats.
     *
     * @param  list<array<string, mixed>>  $tools
     * @return list<array<string, mixed>>
     */
    public function normalizeTools(array $tools): array
    {
        $normalized = [];

        foreach ($tools as $tool) {
            if (! is_array($tool)) {
                continue;
            }

            // Already in OpenAI {type: 'function', function: {...}} format
            if (($tool['type'] ?? '') === 'function' && isset($tool['function'])) {
                $item = $tool;
                if (isset($item['function']['parameters']) && is_array($item['function']['parameters'])) {
                    $item['function']['parameters'] = $this->sanitizeSchemaParameters($item['function']['parameters']);
                }
                $normalized[] = $item;
                continue;
            }

            // Anthropic {name, description, input_schema} format -> convert to OpenAI
            $parameters = is_array($tool['input_schema'] ?? null)
                ? $this->sanitizeSchemaParameters($tool['input_schema'])
                : ['type' => 'object', 'properties' => (object) []];

            $normalized[] = [
                'type' => 'function',
                'function' => [
                    'name' => (string) ($tool['name'] ?? ''),
                    'description' => (string) ($tool['description'] ?? ''),
                    'parameters' => $parameters,
                ],
            ];
        }

        return $normalized;
    }

    /**
     * Ensure parameters schema is strictly valid JSON Schema for Gemini and OpenAI:
     * - type 'object' top-level properties must be a JSON object, not an empty array []
     * - nested type 'object' properties must also be an object
     *
     * @param array<string, mixed> $parameters
     * @return array<string, mixed>
     */
    public function sanitizeSchemaParameters(array $parameters): array
    {
        if (($parameters['type'] ?? '') === 'object') {
            if (! isset($parameters['properties']) || $parameters['properties'] === [] || ! is_array($parameters['properties'])) {
                $parameters['properties'] = (object) [];
            } else {
                foreach ($parameters['properties'] as $key => $prop) {
                    if (is_array($prop) && ($prop['type'] ?? '') === 'object') {
                        if (! isset($prop['properties']) || $prop['properties'] === [] || ! is_array($prop['properties'])) {
                            $parameters['properties'][$key]['properties'] = (object) [];
                        }
                    }
                }
            }
            if (! isset($parameters['required']) || ! is_array($parameters['required'])) {
                $parameters['required'] = [];
            }
        }

        return $parameters;
    }

    // -----------------------------------------------------------------------
    // Connection Test
    // -----------------------------------------------------------------------

    /**
     * Perform a minimal test call to Gemini/provider and return latency + model identifier.
     *
     * @return array{success: bool, latency_ms: int, model: string|null, error: string|null}
     */
    public function testConnection(): array
    {
        if (! $this->isConfigured()) {
            return [
                'success' => false,
                'latency_ms' => 0,
                'model' => null,
                'error' => 'No API key configured.',
            ];
        }

        $start = (int) (microtime(true) * 1000);

        $result = $this->messages(
            'You are an AI diagnostic assistant.',
            [['role' => 'user', 'content' => 'Reply with exactly: PING']],
            []
        );

        $latency = (int) (microtime(true) * 1000) - $start;

        if ($result === null) {
            return [
                'success' => false,
                'latency_ms' => $latency,
                'model' => null,
                'error' => 'Connection failed. Check your API key, base URL, and model ID.',
            ];
        }

        $rawModel = $this->resolveKey('model');

        return [
            'success' => true,
            'latency_ms' => $latency,
            'model' => is_string($rawModel) ? $rawModel : 'gemini-3.5-flash-lite',
            'error' => null,
        ];
    }
}
