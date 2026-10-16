<?php

declare(strict_types=1);

namespace App\Modules\Assets\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Assets\Actions\CalculateDepreciationAction;
use App\Modules\Assets\Models\AssetDepreciationEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetDepreciationController extends Controller
{
    public function __construct(
        private readonly CalculateDepreciationAction $calculateDepreciationAction
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = AssetDepreciationEntry::query()->with(['asset', 'journalEntry']);

        if ($request->filled('asset_id')) {
            $query->where('asset_id', $request->query('asset_id'));
        }

        if ($request->filled('period_year')) {
            $query->where('period_year', $request->query('period_year'));
        }

        $entries = $query->orderByDesc('period_year')->orderByDesc('period_month')->paginate(20);

        return response()->json($entries);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'asset_id' => 'required|integer',
            'period_year' => 'required|integer|min:2020|max:2099',
            'period_month' => 'required|integer|min:1|max:12',
            'post_to_gl' => 'nullable|boolean',
            'depreciation_expense_account_id' => 'nullable|integer',
            'accumulated_depreciation_account_id' => 'nullable|integer',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $entry = $this->calculateDepreciationAction->execute($validated, $userId);

        return response()->json([
            'data' => $entry,
            'message' => 'Depreciation calculated and recorded successfully.',
        ], 201);
    }
}
