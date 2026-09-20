<?php

declare(strict_types=1);

namespace App\Modules\Finance\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Finance\Models\ChartOfAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChartOfAccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ChartOfAccount::query()->with('parent');

        if ($request->filled('account_type')) {
            $query->where('account_type', $request->query('account_type'));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $accounts = $query->orderBy('account_code')->get();

        return response()->json([
            'data' => $accounts,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'required|integer',
            'account_code' => 'required|string|max:64',
            'name' => 'required|string|max:255',
            'account_type' => 'required|string|in:asset,liability,equity,income,expense',
            'account_subtype' => 'required|string|max:64',
            'parent_id' => 'nullable|integer',
            'is_group' => 'nullable|boolean',
            'normal_balance' => 'nullable|string|in:debit,credit',
            'is_active' => 'nullable|boolean',
        ]);

        $account = ChartOfAccount::create([
            ...$validated,
            'is_group' => $validated['is_group'] ?? false,
            'normal_balance' => $validated['normal_balance'] ?? ($validated['account_type'] === 'asset' || $validated['account_type'] === 'expense' ? 'debit' : 'credit'),
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json([
            'data' => $account,
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $account = ChartOfAccount::with(['parent', 'children'])->findOrFail($id);

        return response()->json([
            'data' => $account,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $account = ChartOfAccount::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'account_code' => 'sometimes|string|max:64',
            'account_subtype' => 'sometimes|string|max:64',
            'is_active' => 'nullable|boolean',
        ]);

        $account->update([
            ...$validated,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json([
            'data' => $account,
            'message' => 'Account head updated successfully.',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $account = ChartOfAccount::findOrFail($id);

        if ($account->is_system) {
            return response()->json([
                'success' => false,
                'message' => 'System protected accounts cannot be deleted.',
            ], 422);
        }

        $account->delete();

        return response()->json([
            'success' => true,
            'message' => 'Account head deleted successfully.',
        ]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $tenantId = \App\Core\Tenancy\TenantContext::current()->tenantId();
        $userId = \Illuminate\Support\Facades\Auth::id();

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

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Preload accounts map
        $existingAccounts = ChartOfAccount::query()
            ->where('tenant_id', $tenantId)
            ->get();

        $accountMap = [];
        foreach ($existingAccounts as $acc) {
            $accountMap[strtolower(trim((string) $acc->account_code))] = $acc;
        }

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            \Illuminate\Support\Facades\DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $userId,
                $defaultCompanyId,
                $mode,
                &$accountMap,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $i => $row) {
                    $rowNum = ($chunkIndex * 100) + $i + 1;

                    $code = trim((string) ($row['account_code'] ?? $row['code'] ?? ''));
                    $name = trim((string) ($row['name'] ?? $row['account_name'] ?? ''));

                    if ($code === '' || $name === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => $code === '' ? 'account_code' : 'name',
                            'message' => 'Account code and name are required.',
                        ];
                        continue;
                    }

                    $rawType = strtolower(trim((string) ($row['account_type'] ?? $row['type'] ?? 'asset')));
                    if ($rawType === 'revenue') {
                        $rawType = 'income';
                    }
                    if (!in_array($rawType, ['asset', 'liability', 'equity', 'income', 'expense'], true)) {
                        $rawType = 'asset';
                    }

                    $subType = trim((string) ($row['account_subtype'] ?? $row['subtype'] ?? ucfirst($rawType)));
                    $isGroup = isset($row['is_group']) ? filter_var($row['is_group'], FILTER_VALIDATE_BOOLEAN) : false;

                    $normalBalance = strtolower(trim((string) ($row['normal_balance'] ?? '')));
                    if (!in_array($normalBalance, ['debit', 'credit'], true)) {
                        $normalBalance = in_array($rawType, ['asset', 'expense'], true) ? 'debit' : 'credit';
                    }

                    $isActive = isset($row['is_active']) ? filter_var($row['is_active'], FILTER_VALIDATE_BOOLEAN) : true;

                    // Resolve parent_id if parent_code given
                    $parentId = null;
                    $parentCode = trim((string) ($row['parent_code'] ?? $row['parent_account_code'] ?? ''));
                    if ($parentCode !== '') {
                        $lowerParent = strtolower($parentCode);
                        if (isset($accountMap[$lowerParent])) {
                            $parentId = $accountMap[$lowerParent]->id;
                        }
                    }

                    $lowerCode = strtolower($code);
                    $existing = $accountMap[$lowerCode] ?? null;

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;
                            continue;
                        }

                        // Upsert
                        $existing->update([
                            'name' => $name,
                            'account_type' => $rawType,
                            'account_subtype' => $subType,
                            'parent_id' => $parentId ?? $existing->parent_id,
                            'is_group' => $isGroup,
                            'normal_balance' => $normalBalance,
                            'is_active' => $isActive,
                            'updated_by' => $userId,
                        ]);

                        $updated++;
                        continue;
                    }

                    // Insert
                    $newAccount = new ChartOfAccount();
                    $newAccount->uuid = (string) \Illuminate\Support\Str::uuid();
                    $newAccount->tenant_id = $tenantId;
                    $newAccount->company_id = (int) ($row['company_id'] ?? $defaultCompanyId);
                    $newAccount->account_code = $code;
                    $newAccount->name = $name;
                    $newAccount->account_type = $rawType;
                    $newAccount->account_subtype = $subType;
                    $newAccount->parent_id = $parentId;
                    $newAccount->is_group = $isGroup;
                    $newAccount->normal_balance = $normalBalance;
                    $newAccount->is_system = false;
                    $newAccount->is_active = $isActive;
                    $newAccount->created_by = $userId;
                    $newAccount->updated_by = $userId;
                    $newAccount->save();

                    $accountMap[$lowerCode] = $newAccount;
                    $imported++;
                }
            });
        }

        return response()->json([
            'success' => true,
            'message' => "Chart of Accounts bulk import completed. {$imported} imported, {$updated} updated, {$skipped} skipped.",
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'errors' => $errors,
            ],
        ]);
    }
}

