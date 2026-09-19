<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Platform\Actions\GenerateTenantDataExportAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TenantDataExportController extends Controller
{
    public function export(Request $request, GenerateTenantDataExportAction $action): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $result = $action->execute($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Tenant data export generated successfully.',
            'data' => [
                'export_id' => $result['uuid'],
                'file_name' => $result['file_name'],
                'file_size_bytes' => $result['file_size_bytes'],
                'stats' => $result['stats'],
                'generated_at' => $result['generated_at'],
                'download_url' => url("/api/v1/tenant/export/{$result['uuid']}/download"),
            ],
        ]);
    }

    public function download(string $exportUuid, Request $request): StreamedResponse|JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $tenant = TenantContext::current()->tenant();
        $slug = $tenant['slug'] ?? 'export';

        $fileName = "tenant_export_{$slug}_{$exportUuid}.json";
        $filePath = "exports/{$tenantId}/{$fileName}";

        if (! Storage::disk('local')->exists($filePath)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'EXPORT_NOT_FOUND',
                    'message' => 'Requested tenant export file does not exist or has expired.',
                ],
            ], 404);
        }

        return Storage::disk('local')->download($filePath, $fileName, [
            'Content-Type' => 'application/json',
        ]);
    }
}
