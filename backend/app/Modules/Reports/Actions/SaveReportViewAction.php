<?php

declare(strict_types=1);

namespace App\Modules\Reports\Actions;

use App\Modules\Reports\Models\ReportDefinition;
use App\Modules\Reports\Models\ReportSavedView;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SaveReportViewAction
{
    public function execute(string $code, string $name, array $filters = [], array $columns = [], bool $isDefault = false): ReportSavedView
    {
        $user = Auth::user();
        $tenantId = $user?->tenant_id ?? 1;
        $userId = $user?->id ?? 1;

        $definition = ReportDefinition::resolveDefinition($code, $tenantId);

        if (!$definition) {
            throw ValidationException::withMessages([
                'code' => ["Report definition with code '{$code}' not found."],
            ]);
        }

        if ($isDefault) {
            ReportSavedView::where('tenant_id', $tenantId)
                ->where('report_definition_id', $definition->id)
                ->where('user_id', $userId)
                ->update(['is_default' => false]);
        }

        return ReportSavedView::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'report_definition_id' => $definition->id,
            'user_id' => $userId,
            'name' => $name,
            'filters' => $filters,
            'columns' => $columns,
            'is_default' => $isDefault,
            'is_shared' => false,
            'created_by' => $userId,
        ]);
    }
}
