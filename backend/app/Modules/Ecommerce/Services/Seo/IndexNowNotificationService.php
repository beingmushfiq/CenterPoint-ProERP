<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Services\Seo;

use App\Models\Tenant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class IndexNowNotificationService
{
    public function __construct(
        protected SeoMetadataService $seoMetadataService = new SeoMetadataService
    ) {}

    /**
     * Submit single or batch of URLs to IndexNow protocol.
     */
    public function submitUrls(Tenant $tenant, array $urls): array
    {
        $settings = $this->seoMetadataService->getTenantSeoSettings($tenant->id);

        if (empty($settings->indexnow_api_key)) {
            return [
                'success' => false,
                'message' => 'IndexNow API key is not configured for this tenant.',
            ];
        }

        $host = parse_url($this->seoMetadataService->resolveBaseUrl($tenant), PHP_URL_HOST);
        if (! $host) {
            return [
                'success' => false,
                'message' => 'Unable to determine host domain for IndexNow ping.',
            ];
        }

        $cleanUrls = array_values(array_unique(array_filter($urls)));
        if (empty($cleanUrls)) {
            return [
                'success' => false,
                'message' => 'No valid URLs provided for IndexNow submission.',
            ];
        }

        $payload = [
            'host' => $host,
            'key' => $settings->indexnow_api_key,
            'keyLocation' => "https://{$host}/{$settings->indexnow_api_key}.txt",
            'urlList' => array_slice($cleanUrls, 0, 100), // Max 100 per batch
        ];

        try {
            $response = Http::timeout(5)
                ->asJson()
                ->post('https://api.indexnow.org/indexnow', $payload);

            $status = $response->status();
            $success = in_array($status, [200, 202], true);

            if (! $success) {
                Log::warning('IndexNow submission failed', [
                    'tenant_id' => $tenant->id,
                    'status' => $status,
                    'response' => $response->body(),
                ]);
            }

            return [
                'success' => $success,
                'status_code' => $status,
                'submitted_urls_count' => count($payload['urlList']),
                'message' => $success ? 'URLs successfully submitted to IndexNow.' : 'IndexNow responded with status '.$status,
            ];
        } catch (Throwable $e) {
            Log::error('IndexNow exception', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
