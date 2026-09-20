<?php

declare(strict_types=1);

namespace App\Modules\Finance\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Finance\Actions\CreateExpenseAction;
use App\Modules\Finance\Actions\RollupProductionCostAction;
use App\Modules\Finance\Models\BankAccount;
use App\Modules\Finance\Models\Expense;
use App\Modules\Finance\Models\ExpenseCategory;
use App\Modules\Finance\Models\ProductCost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BankAccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $accounts = BankAccount::query()->with('chartOfAccount')->orderBy('account_name')->get();

        return response()->json([
            'data' => $accounts,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'required|integer',
            'account_name' => 'required|string|max:255',
            'account_number' => 'required|string|max:128',
            'bank_name' => 'required|string|max:255',
            'branch_name' => 'nullable|string|max:255',
            'chart_of_account_id' => 'required|integer',
            'currency_code' => 'nullable|string|size:3',
            'opening_balance' => 'nullable|numeric',
        ]);

        $account = BankAccount::create([
            ...$validated,
            'currency_code' => $validated['currency_code'] ?? 'BDT',
            'opening_balance' => (string) ($validated['opening_balance'] ?? '0.0000'),
            'current_balance' => (string) ($validated['opening_balance'] ?? '0.0000'),
            'is_active' => true,
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json([
            'data' => $account,
        ], 201);
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

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Preload bank accounts for tenant
        $bankAccounts = BankAccount::query()
            ->where('tenant_id', $tenantId)
            ->get();

        $bankMap = [];
        foreach ($bankAccounts as $ba) {
            $bankMap[strtolower(trim((string) $ba->account_number))] = $ba;
            $bankMap[strtolower(trim((string) $ba->account_name))] = $ba;
            $bankMap[(string) $ba->id] = $ba;
        }

        // If no bank account exists in tenant, create a default one with cash/bank COA
        if ($bankAccounts->isEmpty()) {
            $coa = \App\Modules\Finance\Models\ChartOfAccount::firstOrCreate(
                ['tenant_id' => $tenantId, 'account_code' => '1010'],
                [
                    'uuid' => (string) \Illuminate\Support\Str::uuid(),
                    'company_id' => $defaultCompanyId,
                    'name' => 'Main Operating Bank Account',
                    'account_type' => 'asset',
                    'account_subtype' => 'Cash & Bank',
                    'normal_balance' => 'debit',
                    'is_active' => true,
                    'created_by' => $userId,
                    'updated_by' => $userId,
                ]
            );

            $defaultBank = BankAccount::create([
                'uuid' => (string) \Illuminate\Support\Str::uuid(),
                'tenant_id' => $tenantId,
                'company_id' => $defaultCompanyId,
                'account_name' => 'Primary Operational Bank',
                'account_number' => 'OP-DEFAULT-01',
                'bank_name' => 'Primary Treasury Bank',
                'branch_name' => 'Head Office',
                'chart_of_account_id' => $coa->id,
                'currency_code' => 'BDT',
                'opening_balance' => '0.0000',
                'current_balance' => '0.0000',
                'is_active' => true,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $bankMap[strtolower($defaultBank->account_number)] = $defaultBank;
            $bankMap[strtolower($defaultBank->account_name)] = $defaultBank;
            $bankAccounts->push($defaultBank);
        }

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            \Illuminate\Support\Facades\DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $userId,
                $defaultCompanyId,
                $bankMap,
                $bankAccounts,
                $mode,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $i => $row) {
                    $rowNum = ($chunkIndex * 100) + $i + 1;

                    // Resolve bank account
                    $bankKey = trim((string) ($row['bank_account'] ?? $row['account_number'] ?? $row['bank_name'] ?? ''));
                    $bankAccount = null;
                    if ($bankKey !== '') {
                        $bankAccount = $bankMap[strtolower($bankKey)] ?? null;
                    }
                    if (!$bankAccount) {
                        $bankAccount = $bankAccounts->first();
                    }

                    if (!$bankAccount) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'bank_account',
                            'message' => 'No valid bank account found.',
                        ];
                        continue;
                    }

                    $date = !empty($row['transaction_date']) ? (string) $row['transaction_date'] : (!empty($row['date']) ? (string) $row['date'] : now()->format('Y-m-d'));
                    $ref = trim((string) ($row['reference_number'] ?? $row['reference'] ?? $row['cheque_no'] ?? $row['txn_id'] ?? ''));
                    $desc = trim((string) ($row['description'] ?? $row['particulars'] ?? $row['narration'] ?? 'Bank Statement Entry'));

                    // Determine amount and transaction_type
                    $withdrawal = $row['withdrawal'] ?? $row['debit'] ?? null;
                    $deposit = $row['deposit'] ?? $row['credit'] ?? null;
                    $rawAmount = $row['amount'] ?? null;

                    $type = 'deposit';
                    $amount = 0.00;

                    if ($withdrawal !== null && is_numeric($withdrawal) && (float) $withdrawal > 0) {
                        $type = 'withdrawal';
                        $amount = (float) $withdrawal;
                    } elseif ($deposit !== null && is_numeric($deposit) && (float) $deposit > 0) {
                        $type = 'deposit';
                        $amount = (float) $deposit;
                    } elseif ($rawAmount !== null && is_numeric($rawAmount)) {
                        $numericAmt = (float) $rawAmount;
                        if ($numericAmt < 0) {
                            $type = 'withdrawal';
                            $amount = abs($numericAmt);
                        } else {
                            $type = 'deposit';
                            $amount = $numericAmt;
                        }
                    }

                    if ($amount <= 0) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'amount',
                            'message' => 'Transaction amount must be greater than zero.',
                        ];
                        continue;
                    }

                    $balanceAfter = isset($row['balance_after']) && is_numeric($row['balance_after'])
                        ? number_format((float) $row['balance_after'], 4, '.', '')
                        : null;

                    // Check for existing transaction by reference
                    $existing = null;
                    if ($ref !== '') {
                        $existing = \App\Modules\Finance\Models\BankTransaction::query()
                            ->where('tenant_id', $tenantId)
                            ->where('bank_account_id', $bankAccount->id)
                            ->where('reference_number', $ref)
                            ->first();
                    }

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;
                            continue;
                        }

                        // Upsert
                        $existing->update([
                            'transaction_date' => $date,
                            'transaction_type' => $type,
                            'amount' => number_format($amount, 4, '.', ''),
                            'balance_after' => $balanceAfter ?? $existing->balance_after,
                            'description' => $desc,
                            'updated_by' => $userId,
                        ]);

                        $updated++;
                        continue;
                    }

                    // Insert
                    $txn = new \App\Modules\Finance\Models\BankTransaction();
                    $txn->uuid = (string) \Illuminate\Support\Str::uuid();
                    $txn->tenant_id = $tenantId;
                    $txn->bank_account_id = $bankAccount->id;
                    $txn->transaction_date = $date;
                    $txn->direction = in_array($type, ['withdrawal', 'payment', 'expense', 'transfer_out']) ? 'out' : 'in';
                    $txn->transaction_type = $type;
                    $txn->amount = number_format($amount, 4, '.', '');
                    $txn->running_balance = $balanceAfter ?? '0.0000';
                    $txn->balance_after = $balanceAfter ?? '0.0000';
                    $txn->reference_number = $ref !== '' ? $ref : 'TXN-' . date('Ymd') . '-' . str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT);
                    $txn->description = $desc;
                    $txn->reconciliation_status = isset($row['reconciled']) && filter_var($row['reconciled'], FILTER_VALIDATE_BOOLEAN) ? 'reconciled' : 'unreconciled';
                    $txn->created_by = $userId;
                    $txn->updated_by = $userId;
                    $txn->save();

                    $imported++;
                }
            });
        }

        return response()->json([
            'success' => true,
            'message' => "Bank statement bulk import completed. {$imported} imported, {$updated} updated, {$skipped} skipped.",
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'errors' => $errors,
            ],
        ]);
    public function show(int $id): JsonResponse
    {
        $account = BankAccount::query()->with('chartOfAccount')->findOrFail($id);

        return response()->json([
            'data' => $account,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $account = BankAccount::findOrFail($id);

        $validated = $request->validate([
            'account_name' => 'sometimes|string|max:255',
            'account_number' => 'sometimes|string|max:128',
            'bank_name' => 'sometimes|string|max:255',
            'branch_name' => 'nullable|string|max:255',
            'routing_number' => 'nullable|string|max:64',
            'swift_code' => 'nullable|string|max:64',
            'currency_code' => 'nullable|string|size:3',
            'is_active' => 'nullable|boolean',
        ]);

        $account->update([
            ...$validated,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json([
            'data' => $account,
            'message' => 'Bank account updated successfully.',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $account = BankAccount::findOrFail($id);
        $account->delete();

        return response()->json([
            'success' => true,
            'message' => 'Bank account deleted successfully.',
        ]);
    }
}

