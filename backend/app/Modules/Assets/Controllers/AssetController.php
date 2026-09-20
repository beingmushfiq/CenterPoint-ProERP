<?php

declare(strict_types=1);

namespace App\Modules\Assets\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Assets\Actions\CreateAssetAction;
use App\Modules\Assets\Models\Asset;
use App\Modules\Assets\Models\AssetCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetController extends Controller
{
    public function __construct(
        private readonly CreateAssetAction $createAssetAction
    ) {}

    public function categories(Request $request): JsonResponse
    {
        $categories = AssetCategory::query()->where('is_active', true)->get();

        return response()->json([
            'data' => $categories,
        ]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:64',
            'name' => 'required|string|max:255',
            'default_depreciation_method' => 'nullable|string|in:none,straight_line,declining_balance',
            'default_useful_life_months' => 'nullable|integer|min:1',
            'default_salvage_percentage' => 'nullable|numeric|min:0',
        ]);

        $category = AssetCategory::create([
            ...$validated,
            'is_active' => true,
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json([
            'data' => $category,
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Asset::query()->with(['category', 'branch', 'assignedEmployee']);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('category_id')) {
            $query->where('asset_category_id', $request->query('category_id'));
        }

        $assets = $query->orderBy('name')->paginate(20);

        return response()->json($assets);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'asset_code' => 'nullable|string|max:64',
            'name' => 'required|string|max:255',
            'asset_category_id' => 'required|integer',
            'company_id' => 'required|integer',
            'branch_id' => 'required|integer',
            'purchase_cost' => 'required|numeric|min:0',
            'salvage_value' => 'nullable|numeric|min:0',
            'useful_life_months' => 'nullable|integer|min:1',
            'depreciation_method' => 'nullable|string|in:none,straight_line,declining_balance',
            'purchase_date' => 'nullable|date',
            'serial_number' => 'nullable|string|max:128',
            'assigned_employee_id' => 'nullable|integer',
            'status' => 'nullable|string',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $asset = $this->createAssetAction->execute($validated, $userId);

        return response()->json([
            'data' => $asset->load(['category', 'branch', 'assignedEmployee']),
            'message' => 'Asset registered successfully.',
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $asset = Asset::with(['category', 'branch', 'assignedEmployee', 'depreciationEntries', 'maintenanceOrders'])->findOrFail($id);

        return response()->json([
            'data' => $asset,
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $asset = Asset::findOrFail($id);
        $asset->delete();

        return response()->json([
            'success' => true,
            'message' => 'Asset moved to Data Bin successfully',
        ]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $tenantId = \App\Core\Tenancy\TenantContext::current()->tenantId();
        $userId = (int) (\Illuminate\Support\Facades\Auth::id() ?? 1);

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['required', 'array'],
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $defaultCompanyId = \Illuminate\Support\Facades\DB::table('companies')
            ->where('tenant_id', $tenantId)
            ->value('id') ?? 1;

        $defaultBranchId = \Illuminate\Support\Facades\DB::table('branches')
            ->where('tenant_id', $tenantId)
            ->value('id') ?? 1;

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Preload categories
        $categories = AssetCategory::query()->where('tenant_id', $tenantId)->get();
        $categoryMap = [];
        foreach ($categories as $cat) {
            $categoryMap[strtolower(trim((string) $cat->code))] = $cat;
            $categoryMap[strtolower(trim((string) $cat->name))] = $cat;
            $categoryMap[(string) $cat->id] = $cat;
        }

        // Preload assets for tenant
        $existingAssets = Asset::query()->where('tenant_id', $tenantId)->get();
        $assetMap = [];
        foreach ($existingAssets as $ast) {
            if ($ast->asset_code) {
                $assetMap[strtolower(trim((string) $ast->asset_code))] = $ast;
            }
        }

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            \Illuminate\Support\Facades\DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $userId,
                $defaultCompanyId,
                $defaultBranchId,
                &$categoryMap,
                &$assetMap,
                $mode,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $i => $row) {
                    $rowNum = ($chunkIndex * 100) + $i + 1;

                    $name = trim((string) ($row['name'] ?? $row['asset_name'] ?? ''));
                    if ($name === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'name',
                            'message' => 'Asset name is required.',
                        ];
                        continue;
                    }

                    $code = trim((string) ($row['asset_code'] ?? $row['code'] ?? ''));
                    if ($code === '') {
                        $code = 'AST-' . date('Ym') . '-' . str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT);
                    }

                    // Resolve or auto-create category
                    $catKey = trim((string) ($row['category'] ?? $row['category_name'] ?? $row['category_code'] ?? $row['asset_category_id'] ?? 'Equipment'));
                    $lowerCatKey = strtolower($catKey);
                    $category = $categoryMap[$lowerCatKey] ?? null;

                    if (!$category) {
                        $category = AssetCategory::create([
                            'uuid' => (string) \Illuminate\Support\Str::uuid(),
                            'tenant_id' => $tenantId,
                            'code' => strtoupper(\Illuminate\Support\Str::slug($catKey, '_')),
                            'name' => ucwords(str_replace(['_', '-'], ' ', $catKey)),
                            'default_depreciation_method' => 'straight_line',
                            'default_useful_life_months' => 60,
                            'default_salvage_percentage' => '10.00',
                            'is_active' => true,
                            'created_by' => $userId,
                            'updated_by' => $userId,
                        ]);
                        $categoryMap[$lowerCatKey] = $category;
                        $categoryMap[strtolower($category->code)] = $category;
                    }

                    $costRaw = $row['purchase_cost'] ?? $row['cost'] ?? 0;
                    $cost = (is_numeric($costRaw) && (float) $costRaw >= 0) ? (float) $costRaw : 0.00;
                    $costStr = number_format($cost, 4, '.', '');

                    $salvageRaw = $row['salvage_value'] ?? 0;
                    $salvage = (is_numeric($salvageRaw) && (float) $salvageRaw >= 0) ? (float) $salvageRaw : 0.00;
                    $salvageStr = number_format($salvage, 4, '.', '');

                    // Useful life in months
                    $months = 60;
                    if (!empty($row['useful_life_months']) && is_numeric($row['useful_life_months'])) {
                        $months = (int) $row['useful_life_months'];
                    } elseif (!empty($row['useful_life_years']) && is_numeric($row['useful_life_years'])) {
                        $months = (int) ($row['useful_life_years'] * 12);
                    }

                    $depMethod = strtolower(trim((string) ($row['depreciation_method'] ?? 'straight_line')));
                    if (!in_array($depMethod, ['none', 'straight_line', 'declining_balance'], true)) {
                        $depMethod = 'straight_line';
                    }

                    $purchaseDate = !empty($row['purchase_date']) ? (string) $row['purchase_date'] : now()->format('Y-m-d');
                    $status = !empty($row['status']) ? strtolower(trim((string) $row['status'])) : 'in_use';
                    $serial = !empty($row['serial_number']) ? (string) $row['serial_number'] : null;
                    $model = !empty($row['model']) ? (string) $row['model'] : null;
                    $manufacturer = !empty($row['manufacturer']) ? (string) $row['manufacturer'] : null;

                    $lowerCode = strtolower($code);
                    $existing = $assetMap[$lowerCode] ?? null;

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;
                            continue;
                        }

                        // Upsert
                        $existing->update([
                            'name' => $name,
                            'asset_category_id' => $category->id,
                            'purchase_cost' => $costStr,
                            'salvage_value' => $salvageStr,
                            'useful_life_months' => $months,
                            'depreciation_method' => $depMethod,
                            'purchase_date' => $purchaseDate,
                            'status' => $status,
                            'serial_number' => $serial ?? $existing->serial_number,
                            'model' => $model ?? $existing->getAttribute('model'),
                            'manufacturer' => $manufacturer ?? $existing->manufacturer,
                            'updated_by' => $userId,
                        ]);

                        $updated++;
                        continue;
                    }

                    // Insert
                    $asset = new Asset();
                    $asset->uuid = (string) \Illuminate\Support\Str::uuid();
                    $asset->tenant_id = $tenantId;
                    $asset->company_id = (int) ($row['company_id'] ?? $defaultCompanyId);
                    $asset->branch_id = (int) ($row['branch_id'] ?? $defaultBranchId);
                    $asset->asset_code = $code;
                    $asset->name = $name;
                    $asset->asset_category_id = $category->id;
                    $asset->purchase_cost = $costStr;
                    $asset->salvage_value = $salvageStr;
                    $asset->accumulated_depreciation = '0.0000';
                    $asset->book_value = $costStr;
                    $asset->useful_life_months = $months;
                    $asset->depreciation_method = $depMethod;
                    $asset->purchase_date = $purchaseDate;
                    $asset->serial_number = $serial;
                    $asset->setAttribute('model', $model);
                    $asset->manufacturer = $manufacturer;
                    $asset->status = $status;
                    $asset->created_by = $userId;
                    $asset->updated_by = $userId;
                    $asset->save();

                    $assetMap[$lowerCode] = $asset;
                    $imported++;
                }
            });
        }

        return response()->json([
            'success' => true,
            'message' => "Fixed Assets bulk import completed. {$imported} imported, {$updated} updated, {$skipped} skipped.",
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'errors' => $errors,
            ],
        ]);
    }
}

