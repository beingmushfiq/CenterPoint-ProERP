<?php

declare(strict_types=1);

namespace App\Modules\Reports\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Reports\Actions\SaveReportViewAction;
use App\Modules\Reports\Models\ReportDefinition;
use App\Modules\Reports\Models\ReportSavedView;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ReportSavedViewController extends Controller
{
    public function index(string $code): JsonResponse
    {
        $user = Auth::user();
        $tenantId = $user?->tenant_id ?? 1;
        $userId = $user?->id ?? 1;

        $definition = ReportDefinition::resolveDefinition($code, $tenantId);
        if (!$definition) {
            abort(404, "Report definition with code '{$code}' not found.");
        }

        $allIds = array_unique(array_filter([
            $definition->id,
            ...ReportDefinition::withoutTenantScope()
                ->where('canonical_code', $definition->code)
                ->pluck('id')
                ->all(),
        ]));

        $views = ReportSavedView::whereIn('report_definition_id', $allIds)
            ->where(function ($q) use ($userId): void {
                $q->where('user_id', $userId)->orWhere('is_shared', true);
            })
            ->orderBy('is_default', 'desc')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $views,
        ]);
    }

    public function store(string $code, Request $request, SaveReportViewAction $action): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'filters' => 'nullable|array',
            'columns' => 'nullable|array',
            'is_default' => 'nullable|boolean',
        ]);

        $view = $action->execute(
            $code,
            $validated['name'],
            $validated['filters'] ?? [],
            $validated['columns'] ?? [],
            $validated['is_default'] ?? false
        );

        return response()->json([
            'message' => 'Report view saved successfully.',
            'data' => $view,
        ], 201);
    }
}
