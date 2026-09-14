<?php

declare(strict_types=1);

namespace Tests\Feature\Security;

use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_api_responses_contain_hardened_security_headers(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-XSS-Protection', '1; mode=block');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->assertHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
    }

    public function test_customer_token_cannot_access_erp_routes(): void
    {
        $jwtService = app(\App\Core\Auth\JwtService::class);
        $customerToken = $jwtService->issueToken(
            userId: 9999,
            tenantId: 1,
            tokenVersion: 1,
            permVersion: '1',
            scopes: ['storefront:customer']
        );

        $response = $this->withHeader('Authorization', 'Bearer ' . $customerToken)
            ->getJson('/api/v1/auth/me');

        $response->assertStatus(403);
        $this->assertEquals('FORBIDDEN', $response->json('error.code'));
    }
}
