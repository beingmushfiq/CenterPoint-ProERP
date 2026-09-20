<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Tenancy\TenantResolver;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ErpManifestController extends Controller
{
    /**
     * Generate dynamic W3C Web App Manifest for Operations Console ERP PWA.
     * Scoped to operations routes with tenant branding and manufacturing shortcuts.
     */
    public function manifest(Request $request): JsonResponse
    {
        $tenant = TenantResolver::resolveFromRequest($request);

        // Fallback for local development or direct testing
        if (! $tenant) {
            $tenantId = $request->query('tenant_id');
            if ($tenantId) {
                $tenant = Tenant::find((int) $tenantId);
            }
        }

        if (! $tenant) {
            $tenant = Tenant::where('status', '!=', 'suspended')->first();
        }

        $tenantId = $tenant?->id;

        // Resolve Company Name from Settings -> Tenant Model -> Default
        $companyName = 'Operations Console';
        $logoUrl = null;
        $faviconUrl = null;

        if ($tenantId) {
            $nameSetting = Setting::withoutTenantScope()
                ->where('tenant_id', $tenantId)
                ->where('group', 'general')
                ->where('key', 'company_legal_name')
                ->first();

            $configuredName = $nameSetting?->getTypedValue();
            if ($configuredName && is_string($configuredName) && trim($configuredName) !== '') {
                $companyName = trim($configuredName);
            } elseif ($tenant && ! empty($tenant->name)) {
                $companyName = trim($tenant->name);
            }

            $logoSetting = Setting::withoutTenantScope()
                ->where('tenant_id', $tenantId)
                ->where('group', 'general')
                ->where('key', 'brand_logo_url')
                ->first();
            $rawLogo = $logoSetting?->getTypedValue();
            if ($rawLogo && is_string($rawLogo) && trim($rawLogo) !== '') {
                $logoUrl = trim($rawLogo);
            } elseif (! empty($tenant->branding['logo_url'])) {
                $logoUrl = (string) $tenant->branding['logo_url'];
            }

            $faviconSetting = Setting::withoutTenantScope()
                ->where('tenant_id', $tenantId)
                ->where('group', 'general')
                ->where('key', 'brand_favicon_url')
                ->first();
            $rawFavicon = $faviconSetting?->getTypedValue();
            if ($rawFavicon && is_string($rawFavicon) && trim($rawFavicon) !== '') {
                $faviconUrl = trim($rawFavicon);
            }
        }

        // Clean redundant suffixes (e.g. "Acme ERP" -> "Acme ERP", not "Acme ERP ERP")
        $baseName = trim(preg_replace('/\s+ERP$/i', '', $companyName));
        $erpName = "{$baseName} ERP";
        $shortBase = mb_strlen($baseName) > 12 ? mb_substr($baseName, 0, 12) : $baseName;
        $shortName = "{$shortBase} ERP";

        $description = "Enterprise Manufacturing, Inventory, Multi-Warehouse & Business Operations Platform for {$companyName}";

        // Icon resolution
        $resolvedLogo = $logoUrl ?: $faviconUrl ?: '/favicon.svg';

        $manifestData = [
            'id' => '/erp',
            'name' => $erpName,
            'short_name' => $shortName,
            'description' => $description,
            'start_url' => '/dashboard?mode=pwa&source=pwa_erp',
            'scope' => '/',
            'display' => 'standalone',
            'orientation' => 'any',
            'theme_color' => '#0F172A',
            'background_color' => '#0F172A',
            'categories' => ['business', 'productivity', 'utilities'],
            'icons' => [
                [
                    'src' => $resolvedLogo,
                    'sizes' => 'any',
                    'type' => str_ends_with(strtolower($resolvedLogo), '.svg') ? 'image/svg+xml' : 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src' => "/api/v1/pwa/icon/erp?size=192&v=" . md5($resolvedLogo),
                    'sizes' => '192x192',
                    'type' => 'image/svg+xml',
                    'purpose' => 'any',
                ],
                [
                    'src' => "/api/v1/pwa/icon/erp?size=512&maskable=1&v=" . md5($resolvedLogo),
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
                    'name' => 'Operations Dashboard',
                    'url' => '/dashboard',
                    'description' => 'Business, Production & Operations Command Center',
                ],
                [
                    'name' => 'Production Floor',
                    'url' => '/production',
                    'description' => 'Active Batch Runs, Work Orders & QC',
                ],
                [
                    'name' => 'Warehouse Inventory',
                    'url' => '/inventory',
                    'description' => 'Stock Valuation, Lots & Materials Movement',
                ],
                [
                    'name' => 'Point of Sale & Orders',
                    'url' => '/pos',
                    'description' => 'Create B2B Wholesale / Counter Sales Order',
                ],
            ],
        ];

        return response()->json($manifestData, 200, [
            'Content-Type' => 'application/manifest+json; charset=utf-8',
            'Cache-Control' => 'public, max-age=300',
        ]);
    }
}
