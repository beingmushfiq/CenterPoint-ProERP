<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Storefront;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class StorefrontManifestController extends Controller
{
    /**
     * Generate dynamic W3C Web App Manifest for customer storefront PWA.
     * Scoped strictly to /store/{subdomain}/ with tenant branding and shortcuts.
     */
    public function manifest(Request $request): JsonResponse
    {
        /** @var Storefront|null $storefront */
        $storefront = $request->attributes->get('storefront');

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
        $description = $storefront?->meta_description ?? "Official customer storefront for {$storeName}. Browse hardware, place direct orders, and track shipments.";
        $logoUrl = $theme['logo_url'] ?? '/favicon.svg';

        $manifestData = [
            'id' => "/store/{$subdomain}/",
            'name' => "{$storeName} Store",
            'short_name' => $storeName,
            'description' => $description,
            'start_url' => "/store/{$subdomain}",
            'scope' => "/store/{$subdomain}/",
            'display' => 'standalone',
            'orientation' => 'any',
            'theme_color' => $primaryColor,
            'background_color' => '#09090b',
            'categories' => ['shopping', 'lifestyle', 'business'],
            'icons' => [
                [
                    'src' => $logoUrl,
                    'sizes' => 'any',
                    'type' => 'image/svg+xml',
                    'purpose' => 'any',
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
                    'name' => 'Hardware Catalog',
                    'url' => "/store/{$subdomain}/products",
                    'description' => 'Browse hardware and acoustic instruments',
                ],
                [
                    'name' => 'Custom Hardware Lab',
                    'url' => "/store/{$subdomain}/pages/custom-lab",
                    'description' => 'Interactive studio finish configurator',
                ],
                [
                    'name' => 'Track Active Order',
                    'url' => "/store/{$subdomain}/track",
                    'description' => 'Live shock-sensor parcel telemetry',
                ],
                [
                    'name' => '2-Year Precision Care',
                    'url' => "/store/{$subdomain}/pages/warranty-support",
                    'description' => 'Advance replacement & serial diagnostic',
                ],
            ],
        ];

        return response()->json($manifestData, 200, [
            'Content-Type' => 'application/manifest+json; charset=utf-8',
            'Cache-Control' => 'public, max-age=300',
        ]);
    }
}
