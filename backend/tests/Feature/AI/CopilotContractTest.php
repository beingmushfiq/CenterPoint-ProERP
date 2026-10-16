<?php

declare(strict_types=1);

namespace Tests\Feature\AI;

use Tests\TestCase;

final class CopilotContractTest extends TestCase
{
    public function test_anthropic_service_config_is_registered(): void
    {
        $this->assertIsArray(config('services.anthropic'));
        $this->assertSame('https://agentrouter.org', config('services.anthropic.base_url'));
        $this->assertSame('deepseek-v4-flash', config('services.anthropic.model'));
        $this->assertSame('2023-06-01', config('services.anthropic.version'));
        $this->assertSame(2000, config('services.anthropic.max_tokens'));
    }

    public function test_anthropic_client_builds_messages_request_body(): void
    {
        $client = new \App\Modules\AI\Services\AnthropicClient();

        $body = $client->buildRequestBody(
            systemPrompt: 'You are the copilot.',
            messages: [
                ['role' => 'user', 'content' => 'What is our cash position?'],
            ],
            tools: [
                [
                    'name' => 'get_cash_position',
                    'description' => 'Live liquidity.',
                    'input_schema' => ['type' => 'object', 'properties' => [], 'required' => []],
                ],
            ]
        );

        $this->assertSame('deepseek-v4-flash', $body['model']);
        $this->assertSame(2000, $body['max_tokens']);
        $this->assertSame('You are the copilot.', $body['system']);
        $this->assertSame('get_cash_position', $body['tools'][0]['name']);
        $this->assertArrayHasKey('input_schema', $body['tools'][0]);
        $this->assertArrayNotHasKey('type', $body['tools'][0]);
    }

    public function test_anthropic_client_parses_text_and_tool_use_blocks(): void
    {
        $client = new \App\Modules\AI\Services\AnthropicClient();

        $parsed = $client->parseResponse([
            'stop_reason' => 'tool_use',
            'content' => [
                ['type' => 'text', 'text' => 'Let me check your ledger.'],
                [
                    'type' => 'tool_use',
                    'id' => 'toolu_01',
                    'name' => 'get_cash_position',
                    'input' => ['account_type' => 'bank'],
                ],
            ],
        ]);

        $this->assertSame('Let me check your ledger.', $parsed['content']);
        $this->assertCount(1, $parsed['tool_calls']);
        $this->assertSame('toolu_01', $parsed['tool_calls'][0]['id']);
        $this->assertSame('get_cash_position', $parsed['tool_calls'][0]['name']);
        $this->assertSame(['account_type' => 'bank'], $parsed['tool_calls'][0]['arguments']);
        $this->assertSame('tool_use', $parsed['stop_reason']);
    }

    public function test_anthropic_client_formats_tool_results_as_user_blocks(): void
    {
        $client = new \App\Modules\AI\Services\AnthropicClient();

        $message = $client->toolResultMessage([
            ['tool_use_id' => 'toolu_01', 'output' => ['total_liquidity' => 900000]],
            ['tool_use_id' => 'toolu_02', 'output' => ['error' => 'none']],
        ]);

        $this->assertSame('user', $message['role']);
        $this->assertSame('tool_result', $message['content'][0]['type']);
        $this->assertSame('toolu_01', $message['content'][0]['tool_use_id']);
        $this->assertSame('{"total_liquidity":900000}', $message['content'][0]['content']);
        $this->assertSame('toolu_02', $message['content'][1]['tool_use_id']);
    }
}
