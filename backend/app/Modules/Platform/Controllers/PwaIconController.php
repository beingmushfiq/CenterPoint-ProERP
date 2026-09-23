<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Tenancy\TenantResolver;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\Storefront;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class PwaIconController extends Controller
{
    /**
     * Generate compliant, adaptive SVG PWA icons (192x192, 512x512, maskable)
     * embedding the tenant's provided logo with safe-zone padding.
     */
    public function icon(Request $request, string $scope): Response
    {
        $size = max(64, min(1024, (int) ($request->query('size') ?? 192)));
        $isMaskable = $request->boolean('maskable');
        $isStorefront = strtolower($scope) === 'storefront';

        $tenant = TenantResolver::resolveFromRequest($request);
        if (! $tenant) {
            $tenant = Tenant::where('status', '!=', 'suspended')->first();
        }

        $tenantId = $tenant?->id;
        $logoUrl = null;
        $name = 'Operations';
        $themeColor = '#0F172A';
        $bgColor = '#0F172A';

        if ($isStorefront) {
            $storefront = TenantResolver::resolveStorefrontFromRequest($request);
            if (! $storefront && $tenantId) {
                $storefront = Storefront::where('tenant_id', $tenantId)->first();
            }
            if (! $storefront) {
                $storefront = Storefront::first();
            }

            $theme = $storefront?->theme ?? [];
            $themeColor = $theme['primary_color'] ?? '#10b981';
            $bgColor = $theme['background_color'] ?? '#09090b';
            $name = $storefront?->name ?? $tenant?->name ?? 'Store';

            // Inherit: storefront custom logo -> tenant brand logo -> null
            $logoUrl = $theme['logo_url'] ?? null;
            if (! $logoUrl && $tenantId) {
                $setting = Setting::withoutTenantScope()
                    ->where('tenant_id', $tenantId)
                    ->where('group', 'general')
                    ->where('key', 'brand_logo_url')
                    ->first();
                $logoUrl = $setting?->getTypedValue() ?: null;
            }
        } else {
            // ERP Scope
            $name = $tenant?->name ?? 'ERP';
            $themeColor = '#2563eb';
            $bgColor = '#0F172A';

            if ($tenantId) {
                $nameSetting = Setting::withoutTenantScope()
                    ->where('tenant_id', $tenantId)
                    ->where('group', 'general')
                    ->where('key', 'company_legal_name')
                    ->first();
                $configuredName = $nameSetting?->getTypedValue();
                if ($configuredName && is_string($configuredName)) {
                    $name = trim($configuredName);
                }

                $setting = Setting::withoutTenantScope()
                    ->where('tenant_id', $tenantId)
                    ->where('group', 'general')
                    ->where('key', 'brand_logo_url')
                    ->first();
                $logoUrl = $setting?->getTypedValue() ?: null;
            }
        }

        $initial = strtoupper(mb_substr($name, 0, 1));
        $escapedName = htmlspecialchars($name, ENT_QUOTES | ENT_XML1, 'UTF-8');

        // Safe zone padding for maskable icons (Android adaptive icons safe area is central 80%)
        if ($isMaskable) {
            $padRatio = 0.15;
            $innerX = round($size * $padRatio);
            $innerY = round($size * $padRatio);
            $innerWidth = round($size * (1 - ($padRatio * 2)));
            $innerHeight = round($size * (1 - ($padRatio * 2)));
            $radius = 0; // Maskable icons should fill the full rectangle so the OS can apply its squircle/circle
        } else {
            $padRatio = 0.08;
            $innerX = round($size * $padRatio);
            $innerY = round($size * $padRatio);
            $innerWidth = round($size * (1 - ($padRatio * 2)));
            $innerHeight = round($size * (1 - ($padRatio * 2)));
            $radius = round($size * 0.18);
        }

        if ($logoUrl && is_string($logoUrl) && trim($logoUrl) !== '') {
            $escapedLogoUrl = htmlspecialchars(trim($logoUrl), ENT_QUOTES | ENT_XML1, 'UTF-8');

            $svg = <<<SVG
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{$size}" height="{$size}" viewBox="0 0 {$size} {$size}">
    <rect width="{$size}" height="{$size}" rx="{$radius}" fill="{$bgColor}"/>
    <image xlink:href="{$escapedLogoUrl}" href="{$escapedLogoUrl}" x="{$innerX}" y="{$innerY}" width="{$innerWidth}" height="{$innerHeight}" preserveAspectRatio="xMidYMid meet"/>
</svg>
SVG;
        } else {
            // Branded SVG fallback with gradient and letter badge
            $fontSize = round($size * 0.42);
            $fontY = round($size * 0.62);

            $svg = <<<SVG
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{$size}" height="{$size}" viewBox="0 0 {$size} {$size}">
    <defs>
        <linearGradient id="pwaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="{$themeColor}"/>
            <stop offset="100%" stop-color="{$bgColor}"/>
        </linearGradient>
    </defs>
    <rect width="{$size}" height="{$size}" rx="{$radius}" fill="url(#pwaGrad)"/>
    <text x="50%" y="{$fontY}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="{$fontSize}" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="-0.02em">{$initial}</text>
</svg>
SVG;
        }

        return new Response(trim($svg), 200, [
            'Content-Type' => 'image/svg+xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
