<?php

declare(strict_types=1);

namespace App\Modules\Reports\Actions;

use App\Modules\Reports\Models\ReportDefinition;
use App\Modules\Reports\Models\ReportExport;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CreateReportExportAction
{
    public function __construct(
        protected RunReportQueryAction $queryAction
    ) {}

    public function execute(string $code, array $filters = [], string $format = 'csv'): ReportExport
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        $tenantId = $user?->tenant_id ?? 1;
        $userId = $user?->id ?? 1;

        $definition = ReportDefinition::resolveDefinition($code, $tenantId);

        if (!$definition) {
            throw ValidationException::withMessages([
                'code' => ["Report definition with code '{$code}' not found."],
            ]);
        }

        // 1. Run actual query against live database (fetch up to 10,000 records for export)
        $queryResult = $this->queryAction->execute($code, $filters, 1, 10000);
        $columns = $queryResult['columns'] ?? [];
        $rows = $queryResult['data'] ?? [];

        // 2. Build real CSV stream
        $csvHandle = fopen('php://temp', 'r+');
        // Prepend UTF-8 BOM for Microsoft Excel / Sheets compatibility
        fputs($csvHandle, "\xEF\xBB\xBF");

        $headerKeys = array_keys($columns);
        $headerLabels = [];
        foreach ($columns as $col) {
            $headerLabels[] = is_array($col) ? ($col['label'] ?? 'Field') : (string) $col;
        }

        if (!empty($headerLabels)) {
            fputcsv($csvHandle, $headerLabels);
        }

        $rowCount = 0;
        foreach ($rows as $row) {
            $rowValues = [];
            foreach ($headerKeys as $key) {
                $val = $row[$key] ?? '';
                if (is_array($val) || is_object($val)) {
                    $val = json_encode($val, JSON_UNESCAPED_UNICODE);
                }
                $rowValues[] = (string) $val;
            }
            fputcsv($csvHandle, $rowValues);
            $rowCount++;
        }

        rewind($csvHandle);
        $csvContent = (string) stream_get_contents($csvHandle);
        fclose($csvHandle);

        // 3. Save to storage/app/exports/{tenantId}/
        $uuid = (string) Str::uuid();
        $timestamp = date('Ymd_His');
        $fileName = "{$definition->code}_{$timestamp}_{$uuid}.csv";
        $storageRelPath = "exports/{$tenantId}/{$fileName}";

        Storage::disk('local')->put($storageRelPath, $csvContent);
        $fileSize = strlen($csvContent);

        // 4. Create immutable database record
        $export = ReportExport::create([
            'tenant_id' => $tenantId,
            'uuid' => $uuid,
            'report_definition_id' => $definition->id,
            'requested_by' => $userId,
            'filters' => $filters,
            'format' => strtolower($format),
            'row_count' => $rowCount,
            'file_path' => $storageRelPath,
            'file_size_bytes' => $fileSize,
            'status' => 'completed',
            'expires_at' => now()->addDays(7),
            'created_by' => $userId,
        ]);

        return $export;
    }
}
