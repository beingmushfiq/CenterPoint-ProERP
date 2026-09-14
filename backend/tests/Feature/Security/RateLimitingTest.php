<?php

declare(strict_types=1);

namespace Tests\Feature\Security;

use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class RateLimitingTest extends TestCase
{
    public function test_api_rate_limiter_is_registered(): void
    {
        $limiter = RateLimiter::limiter('api');
        $this->assertNotNull($limiter);
    }

    public function test_login_rate_limiter_is_registered(): void
    {
        $limiter = RateLimiter::limiter('login');
        $this->assertNotNull($limiter);
    }

    public function test_storefront_rate_limiter_is_registered(): void
    {
        $limiter = RateLimiter::limiter('storefront');
        $this->assertNotNull($limiter);
    }

    public function test_webhooks_rate_limiter_is_registered(): void
    {
        $limiter = RateLimiter::limiter('webhooks');
        $this->assertNotNull($limiter);
    }

    public function test_platform_login_rate_limiter_is_registered(): void
    {
        $limiter = RateLimiter::limiter('platform_login');
        $this->assertNotNull($limiter);
    }

    public function test_customer_login_rate_limiter_is_registered(): void
    {
        $limiter = RateLimiter::limiter('customer_login');
        $this->assertNotNull($limiter);
    }

    public function test_customer_register_rate_limiter_is_registered(): void
    {
        $limiter = RateLimiter::limiter('customer_register');
        $this->assertNotNull($limiter);
    }

    public function test_storefront_checkout_rate_limiter_is_registered(): void
    {
        $limiter = RateLimiter::limiter('storefront_checkout');
        $this->assertNotNull($limiter);
    }

    public function test_errors_ingest_rate_limiter_is_registered(): void
    {
        $limiter = RateLimiter::limiter('errors_ingest');
        $this->assertNotNull($limiter);
    }
}
