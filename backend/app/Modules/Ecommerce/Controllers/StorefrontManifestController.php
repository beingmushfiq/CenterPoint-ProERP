<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Core\Tenancy\TenantResolver;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\Storefront;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class StorefrontManifestController extends Controller
{
    /**
     * Generate dynamic W3C Web App Manifest for customer storefront PWA.
     * Scoped to storefront routes with tenant branding, shortcuts, and W3C collision prevention.
     */
    public function manifest(Request $request): JsonResponse
    {
        /** @var Storefront|null $storefront */
        $storefront = $request->attributes->get('storefront');

        if (! $storefront) {
            $storefront = TenantResolver::resolveStorefrontFromRequest($request);
        }

        // Fallback resolution by query parameter or first tenant storefront
        if (! $storefront) {
            $subdomain = $request->query('subdomain');
            if ($subdomain) {
                $storefront = Storefront::where('subdomain', $subdomain)->first();
            }
        }

        if (! $storefront) {
            $storefront = Storefront::first();
        }

        $subdomain = $storefront?->subdomain ?? 'store';
        $storeName = $storefront?->name ?? 'Official Store';
        $theme = $storefront?->theme ?? [];
        $primaryColor = $theme['primary_color'] ?? '#10b981';
        $backgroundColor = $theme['background_color'] ?? '#ffffff';

        // Format PWA Name cleanly (avoid "Slice Mart Store Store")
        $baseName = trim(preg_replace('/\s+Store$/i', '', $storeName));
        $pwaName = "{$baseName} Store";
        $shortBase = mb_strlen($baseName) > 12 ? mb_substr($baseName, 0, 12) : $baseName;
        $shortName = "{$shortBase} Store";

        $description = $storefront?->meta_description ?? "Official customer storefront for {$pwaName}. Browse catalog, place direct orders, and track shipments.";

        // Logo Resolution: Storefront custom logo -> Tenant company brand logo -> fallback
        $logoUrl = null;
        if (! empty($theme['logo_url']) && is_string($theme['logo_url'])) {
            $logoUrl = trim($theme['logo_url']);
        } elseif ($storefront?->tenant_id) {
            $logoSetting = Setting::withoutTenantScope()
                ->where('tenant_id', $storefront->tenant_id)
                ->where('group', 'general')
                ->where('key', 'brand_logo_url')
                ->first();
            $rawSettingLogo = $logoSetting?->getTypedValue();
            if ($rawSettingLogo && is_string($rawSettingLogo) && trim($rawSettingLogo) !== '') {
                $logoUrl = trim($rawSettingLogo);
            }
        }

        $resolvedLogo = $logoUrl ?: '/favicon.svg';

        // Detect if accessed via path (/store/:subdomain) or root domain/subdomain
        $isPathBased = str_contains($request->path(), 'store/');
        if ($isPathBased) {
            $startUrl = "/store/{$subdomain}?mode=pwa&source=pwa_storefront";
            $scope = "/store/{$subdomain}/";
            $catalogUrl = "/store/{$subdomain}/products";
            $trackUrl = "/store/{$subdomain}/track";
            $checkoutUrl = "/store/{$subdomain}/checkout";
        } else {
            $startUrl = "/?mode=pwa&source=pwa_storefront";
            $scope = "/";
            $catalogUrl = "/products";
            $trackUrl = "/track";
            $checkoutUrl = "/checkout";
        }

        $manifestData = [
            'id' => '/storefront',
            'name' => $pwaName,
            'short_name' => $shortName,
            'description' => $description,
            'start_url' => $startUrl,
            'scope' => $scope,
            'display' => 'standalone',
            'orientation' => 'any',
            'theme_color' => $primaryColor,
            'background_color' => $backgroundColor,
            'categories' => ['shopping', 'lifestyle', 'business'],
            'icons' => [
                [
                    'src' => $resolvedLogo,
                    'sizes' => 'any',
                    'type' => str_ends_with(strtolower($resolvedLogo), '.svg') ? 'image/svg+xml' : 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src' => "/api/v1/pwa/icon/storefront?size=192&v=" . md5($resolvedLogo),
                    'sizes' => '192x192',
                    'type' => 'image/svg+xml',
                    'purpose' => 'any',
                ],
                [
                    'src' => "/api/v1/pwa/icon/storefront?size=512&maskable=1&v=" . md5($resolvedLogo),
                    'sizes' => '512x512',
                    'type' => 'image/svg+xml',
                    'purpose' => 'maskable',
                ],
                [
                    'src' => '/pwa-icon.svg',
                    'sizes' => '192x192 512x512',
                    'type' => 'image/svg+xml',
                    'purpose' => 'maskable',
                ],
            ],
            'shortcuts' => [
                [
                    'name' => 'Product Catalog',
                    'url' => $catalogUrl,
                    'description' => 'Browse all factory products and collections',
                ],
                [
                    'name' => 'Track Active Order',
                    'url' => $trackUrl,
                    'description' => 'Live parcel tracking and delivery status',
                ],
                [
                    'name' => 'Shopping Cart & Checkout',
                    'url' => $checkoutUrl,
                    'description' => 'View current bag and complete purchase',
                ],
            ],
        ];

        return response()->json($manifestData, 200, [
            'Content-Type' => 'application/manifest+json; charset=utf-8',
            'Cache-Control' => 'public, max-age=300',
        ]);
    }
}
