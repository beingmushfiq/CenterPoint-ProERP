<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Translates between the Copilot's internal message/tool model and the
 * Anthropic Messages API (POST {base_url}/v1/messages).
 */
class AnthropicClient
{
    public function isConfigured(): bool
    {
        $key = config('services.anthropic.key');

        return is_string($key) && trim($key) !== '';
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $tools
     * @return array<string, mixed>
     */
    public function buildRequestBody(string $systemPrompt, array $messages, array $tools = []): array
    {
        $rawModel = config('services.anthropic.model');
        $rawMaxTokens = config('services.anthropic.max_tokens');

        $body = [
            'model' => is_string($rawModel) && $rawModel !== '' ? $rawModel : 'claude-3-7-sonnet-latest',
            'max_tokens' => is_numeric($rawMaxTokens) ? (int) $rawMaxTokens : 4096,
            'system' => $systemPrompt,
            'messages' => $messages,
        ];

        if ($tools !== []) {
            $body['tools'] = $tools;
        }

        return $body;
    }

    /**
     * Perform a single Messages API turn.
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

        $rawBaseUrl = config('services.anthropic.base_url');
        $baseUrl = rtrim(is_string($rawBaseUrl) && $rawBaseUrl !== '' ? $rawBaseUrl : 'https://api.anthropic.com', '/');

        $rawKey = config('services.anthropic.key');
        $apiKey = is_string($rawKey) ? $rawKey : '';

        $rawVersion = config('services.anthropic.version');
        $apiVersion = is_string($rawVersion) && $rawVersion !== '' ? $rawVersion : '2023-06-01';

        try {
            $response = Http::withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => $apiVersion,
                'content-type' => 'application/json',
            ])
                ->timeout(45)
                ->post($baseUrl.'/v1/messages', $this->buildRequestBody($systemPrompt, $messages, $tools));

            if (! $response->successful()) {
                Log::warning('Anthropic API call returned error: '.$response->body());

                return null;
            }

            /** @var array<string, mixed> $json */
            $json = $response->json();

            return $this->parseResponse($json);
        } catch (Throwable $e) {
            Log::error('Anthropic connection exception: '.$e->getMessage());

            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $response
     * @return array{content: string, tool_calls: list<array{id: string, name: string, arguments: array<string, mixed>}>, stop_reason: string}
     */
    public function parseResponse(array $response): array
    {
        $text = '';
        $toolCalls = [];
        $blocks = is_array($response['content'] ?? null) ? $response['content'] : [];

        foreach ($blocks as $block) {
            if (! is_array($block)) {
                continue;
            }

            if (($block['type'] ?? null) === 'text' && is_string($block['text'] ?? null)) {
                $text .= (string) $block['text'];
            }

            if (($block['type'] ?? null) === 'tool_use') {
                $input = is_array($block['input'] ?? null) ? $block['input'] : [];
                $toolCalls[] = [
                    'id' => is_string($block['id'] ?? null) ? (string) $block['id'] : '',
                    'name' => is_string($block['name'] ?? null) ? (string) $block['name'] : '',
                    'arguments' => $input,
                ];
            }
        }

        return [
            'content' => $text,
            'tool_calls' => $toolCalls,
            'stop_reason' => is_string($response['stop_reason'] ?? null) ? (string) $response['stop_reason'] : 'end_turn',
        ];
    }

    /**
     * Build the assistant turn that must be echoed back before tool results.
     *
     * @param  array{content: string, tool_calls: list<array{id: string, name: string, arguments: array<string, mixed>}>}  $turn
     * @return array<string, mixed>
     */
    public function assistantTurn(array $turn): array
    {
        $blocks = [];

        if ($turn['content'] !== '') {
            $blocks[] = ['type' => 'text', 'text' => $turn['content']];
        }

        foreach ($turn['tool_calls'] as $call) {
            $blocks[] = [
                'type' => 'tool_use',
                'id' => $call['id'],
                'name' => $call['name'],
                'input' => $call['arguments'],
            ];
        }

        return ['role' => 'assistant', 'content' => $blocks];
    }

    /**
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
     * Convert stored string-content history turns to Anthropic message shape.
     *
     * @param  list<array{role: string, content: string}>  $history
     * @return list<array<string, mixed>>
     */
    public function historyToMessages(array $history): array
    {
        $messages = [];

        foreach ($history as $turn) {
            $role = $turn['role'] === 'assistant' ? 'assistant' : 'user';
            $messages[] = ['role' => $role, 'content' => (string) $turn['content']];
        }

        return $messages;
    }
}
