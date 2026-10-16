<?php

declare(strict_types=1);

namespace App\Modules\Reports\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Reports\Actions\CreateReportExportAction;
use App\Modules\Reports\Models\ReportExport;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class ReportExportController extends Controller
{
    public function export(string $code, Request $request, CreateReportExportAction $action): JsonResponse
    {
        $format = (string) $request->input('format', 'csv');
        $filters = (array) $request->input('filters', []);

        $export = $action->execute($code, $filters, $format);

        return response()->json([
            'message' => 'Export job accepted and completed successfully.',
            'data' => [
                'uuid' => $export->uuid,
                'status' => $export->status,
                'format' => $export->format,
                'file_path' => $export->file_path,
                'row_count' => $export->row_count,
                'file_size_bytes' => $export->file_size_bytes,
                'download_url' => "/reports/exports/{$export->uuid}/download",
                'expires_at' => $export->expires_at?->toIso8601String(),
            ],
        ], 202);
    }

    public function show(string $uuid): JsonResponse
    {
        $export = ReportExport::where('uuid', $uuid)->firstOrFail();

        return response()->json([
            'data' => [
                'uuid' => $export->uuid,
                'status' => $export->status,
                'format' => $export->format,
                'file_path' => $export->file_path,
                'row_count' => $export->row_count,
                'file_size_bytes' => $export->file_size_bytes,
                'download_url' => "/reports/exports/{$export->uuid}/download",
                'expires_at' => $export->expires_at?->toIso8601String(),
            ],
        ]);
    }

    public function download(string $uuid): Response
    {
        $export = ReportExport::where('uuid', $uuid)->firstOrFail();

        $user = Auth::user();
        if (! $user || (int) $export->tenant_id !== (int) $user->tenant_id) {
            abort(403, 'Unauthorized access to tenant export.');
        }

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('local');
        if (! $disk->exists($export->file_path)) {
            abort(404, 'Export file not found or expired on disk.');
        }

        $fileName = basename($export->file_path);
        $contentType = match (strtolower((string) $export->format)) {
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf' => 'application/pdf',
            default => 'text/csv; charset=UTF-8',
        };

        return $disk->download($export->file_path, $fileName, [
            'Content-Type' => $contentType,
        ]);
    }
}
