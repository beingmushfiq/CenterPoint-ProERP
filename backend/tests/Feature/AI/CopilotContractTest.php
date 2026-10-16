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
}
