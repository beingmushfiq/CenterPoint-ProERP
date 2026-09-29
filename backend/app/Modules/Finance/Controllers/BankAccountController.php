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
    }

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

    public function __construct(
        private readonly \App\Modules\Finance\Actions\PostJournalEntryAction $postJournalEntryAction
    ) {}

    public function deposit(Request $request, int $id): JsonResponse
    {
        $account = BankAccount::findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'credit_account_id' => 'required|integer|exists:chart_of_accounts,id',
            'date' => 'nullable|date',
            'payment_method' => 'nullable|string|max:64',
            'reference_number' => 'nullable|string|max:128',
            'narration' => 'nullable|string|max:500',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $amount = (float) $validated['amount'];
        $date = $validated['date'] ?? date('Y-m-d');
        $creditAccountId = (int) $validated['credit_account_id'];
        $paymentMethod = $validated['payment_method'] ?? 'cash';
        $ref = $validated['reference_number'] ?? ('DEP-' . date('Ymd') . '-' . str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT));
        $narration = $validated['narration'] ?? "Money Deposit into {$account->name}";

        return \Illuminate\Support\Facades\DB::transaction(function () use ($account, $amount, $date, $creditAccountId, $paymentMethod, $ref, $narration, $userId): JsonResponse {
            // Update balance
            $currentBal = (float) ($account->current_balance ?? 0.0);
            $newBal = $currentBal + $amount;
            $account->current_balance = number_format($newBal, 4, '.', '');
            $account->updated_by = $userId;
            $account->save();

            // Post balanced GL Journal Entry
            // Dr: Bank COA (increases asset)
            // Cr: Source COA (reduces receivable or increases income/equity)
            $journalData = [
                'company_id' => $account->company_id,
                'entry_date' => $date,
                'entry_type' => 'manual',
                'source_module' => 'finance_deposit',
                'narration' => $narration,
                'lines' => [
                    [
                        'account_id' => $account->chart_of_account_id,
                        'debit_amount' => number_format($amount, 4, '.', ''),
                        'credit_amount' => '0.0000',
                        'narration' => "Dr: Deposit into {$account->name}",
                    ],
                    [
                        'account_id' => $creditAccountId,
                        'debit_amount' => '0.0000',
                        'credit_amount' => number_format($amount, 4, '.', ''),
                        'narration' => "Cr: Funds recognized for {$account->name}",
                    ],
                ],
            ];

            $journalEntry = $this->postJournalEntryAction->execute($journalData, $userId);

            // Record Bank Transaction
            $txn = new \App\Modules\Finance\Models\BankTransaction();
            $txn->uuid = (string) \Illuminate\Support\Str::uuid();
            $txn->tenant_id = $account->tenant_id;
            $txn->bank_account_id = $account->id;
            $txn->transaction_date = $date;
            $txn->direction = 'in';
            $txn->transaction_type = 'deposit';
            $txn->amount = number_format($amount, 4, '.', '');
            $txn->running_balance = number_format($newBal, 4, '.', '');
            $txn->reference_number = $ref;
            $txn->journal_entry_id = $journalEntry->id;
            $txn->description = $narration;
            $txn->reconciliation_status = 'unreconciled';
            $txn->created_by = $userId;
            $txn->updated_by = $userId;
            $txn->save();

            return response()->json([
                'success' => true,
                'message' => 'Deposit processed and posted to General Ledger.',
                'data' => [
                    'account' => $account->load('chartOfAccount'),
                    'journal_entry' => $journalEntry,
                    'transaction' => $txn,
                ],
            ]);
        });
    }

    public function withdraw(Request $request, int $id): JsonResponse
    {
        $account = BankAccount::findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'debit_account_id' => 'required|integer|exists:chart_of_accounts,id',
            'date' => 'nullable|date',
            'payment_method' => 'nullable|string|max:64',
            'reference_number' => 'nullable|string|max:128',
            'narration' => 'nullable|string|max:500',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $amount = (float) $validated['amount'];
        $date = $validated['date'] ?? date('Y-m-d');
        $debitAccountId = (int) $validated['debit_account_id'];
        $paymentMethod = $validated['payment_method'] ?? 'cash';
        $ref = $validated['reference_number'] ?? ('WTH-' . date('Ymd') . '-' . str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT));
        $narration = $validated['narration'] ?? "Money Withdrawal from {$account->name}";

        return \Illuminate\Support\Facades\DB::transaction(function () use ($account, $amount, $date, $debitAccountId, $paymentMethod, $ref, $narration, $userId): JsonResponse {
            // Update balance
            $currentBal = (float) ($account->current_balance ?? 0.0);
            $newBal = $currentBal - $amount;
            $account->current_balance = number_format($newBal, 4, '.', '');
            $account->updated_by = $userId;
            $account->save();

            // Post balanced GL Journal Entry
            // Dr: Destination COA (increases expense or reduces liability/drawings)
            // Cr: Bank COA (decreases asset)
            $journalData = [
                'company_id' => $account->company_id,
                'entry_date' => $date,
                'entry_type' => 'manual',
                'source_module' => 'finance_withdrawal',
                'narration' => $narration,
                'lines' => [
                    [
                        'account_id' => $debitAccountId,
                        'debit_amount' => number_format($amount, 4, '.', ''),
                        'credit_amount' => '0.0000',
                        'narration' => "Dr: Withdrawal application from {$account->name}",
                    ],
                    [
                        'account_id' => $account->chart_of_account_id,
                        'debit_amount' => '0.0000',
                        'credit_amount' => number_format($amount, 4, '.', ''),
                        'narration' => "Cr: Paid out from {$account->name}",
                    ],
                ],
            ];

            $journalEntry = $this->postJournalEntryAction->execute($journalData, $userId);

            // Record Bank Transaction
            $txn = new \App\Modules\Finance\Models\BankTransaction();
            $txn->uuid = (string) \Illuminate\Support\Str::uuid();
            $txn->tenant_id = $account->tenant_id;
            $txn->bank_account_id = $account->id;
            $txn->transaction_date = $date;
            $txn->direction = 'out';
            $txn->transaction_type = 'withdrawal';
            $txn->amount = number_format($amount, 4, '.', '');
            $txn->running_balance = number_format($newBal, 4, '.', '');
            $txn->reference_number = $ref;
            $txn->journal_entry_id = $journalEntry->id;
            $txn->description = $narration;
            $txn->reconciliation_status = 'unreconciled';
            $txn->created_by = $userId;
            $txn->updated_by = $userId;
            $txn->save();

            return response()->json([
                'success' => true,
                'message' => 'Withdrawal processed and posted to General Ledger.',
                'data' => [
                    'account' => $account->load('chartOfAccount'),
                    'journal_entry' => $journalEntry,
                    'transaction' => $txn,
                ],
            ]);
        });
    }

    public function transfer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_account_id' => 'required|integer|exists:chart_of_accounts,id',
            'to_account_id' => 'required|integer|exists:chart_of_accounts,id|different:from_account_id',
            'amount' => 'required|numeric|min:0.01',
            'date' => 'nullable|date',
            'purpose' => 'nullable|string|max:500',
            'reference_number' => 'nullable|string|max:128',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $fromCoaId = (int) $validated['from_account_id'];
        $toCoaId = (int) $validated['to_account_id'];
        $amount = (float) $validated['amount'];
        $date = $validated['date'] ?? date('Y-m-d');
        $purpose = $validated['purpose'] ?? 'Internal Transfer';
        $ref = $validated['reference_number'] ?? ('TRF-' . date('Ymd') . '-' . str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT));

        $fromCoa = \App\Modules\Finance\Models\ChartOfAccount::findOrFail($fromCoaId);
        $toCoa = \App\Modules\Finance\Models\ChartOfAccount::findOrFail($toCoaId);

        return \Illuminate\Support\Facades\DB::transaction(function () use ($fromCoa, $toCoa, $amount, $date, $purpose, $ref, $userId): JsonResponse {
            /** @var BankAccount|null $fromBank */
            $fromBank = BankAccount::where('chart_of_account_id', $fromCoa->id)->first();
            /** @var BankAccount|null $toBank */
            $toBank = BankAccount::where('chart_of_account_id', $toCoa->id)->first();

            if ($fromBank instanceof BankAccount) {
                $cur = (float) ($fromBank->current_balance ?? 0.0);
                $fromBank->current_balance = number_format($cur - $amount, 4, '.', '');
                $fromBank->updated_by = $userId;
                $fromBank->save();
            }

            if ($toBank instanceof BankAccount) {
                $cur = (float) ($toBank->current_balance ?? 0.0);
                $toBank->current_balance = number_format($cur + $amount, 4, '.', '');
                $toBank->updated_by = $userId;
                $toBank->save();
            }

            // Post balanced GL Journal Entry
            // Dr: Destination Account (increases)
            // Cr: Source Account (decreases)
            $narration = "Internal Fund Transfer: {$amount} from {$fromCoa->name} to {$toCoa->name}. {$purpose}";
            $journalData = [
                'company_id' => $fromCoa->company_id,
                'entry_date' => $date,
                'entry_type' => 'manual',
                'source_module' => 'finance_transfer',
                'narration' => $narration,
                'lines' => [
                    [
                        'account_id' => $toCoa->id,
                        'debit_amount' => number_format($amount, 4, '.', ''),
                        'credit_amount' => '0.0000',
                        'narration' => "Dr: Transfer into {$toCoa->name}",
                    ],
                    [
                        'account_id' => $fromCoa->id,
                        'debit_amount' => '0.0000',
                        'credit_amount' => number_format($amount, 4, '.', ''),
                        'narration' => "Cr: Transfer debited from {$fromCoa->name}",
                    ],
                ],
            ];

            $journalEntry = $this->postJournalEntryAction->execute($journalData, $userId);

            // Record Bank Transactions if applicable
            $outTxn = null;
            $inTxn = null;

            if ($fromBank) {
                $outTxn = new \App\Modules\Finance\Models\BankTransaction();
                $outTxn->uuid = (string) \Illuminate\Support\Str::uuid();
                $outTxn->tenant_id = $fromBank->tenant_id;
                $outTxn->bank_account_id = $fromBank->id;
                $outTxn->transaction_date = $date;
                $outTxn->direction = 'out';
                $outTxn->transaction_type = 'transfer_out';
                $outTxn->amount = number_format($amount, 4, '.', '');
                $outTxn->running_balance = $fromBank->current_balance;
                $outTxn->reference_number = $ref;
                $outTxn->journal_entry_id = $journalEntry->id;
                $outTxn->description = "Transfer to {$toCoa->name}: {$purpose}";
                $outTxn->reconciliation_status = 'unreconciled';
                $outTxn->created_by = $userId;
                $outTxn->updated_by = $userId;
                $outTxn->save();
            }

            if ($toBank) {
                $inTxn = new \App\Modules\Finance\Models\BankTransaction();
                $inTxn->uuid = (string) \Illuminate\Support\Str::uuid();
                $inTxn->tenant_id = $toBank->tenant_id;
                $inTxn->bank_account_id = $toBank->id;
                $inTxn->transaction_date = $date;
                $inTxn->direction = 'in';
                $inTxn->transaction_type = 'transfer_in';
                $inTxn->amount = number_format($amount, 4, '.', '');
                $inTxn->running_balance = $toBank->current_balance;
                $inTxn->reference_number = $ref;
                $inTxn->related_transaction_id = $outTxn?->id;
                $inTxn->journal_entry_id = $journalEntry->id;
                $inTxn->description = "Transfer from {$fromCoa->name}: {$purpose}";
                $inTxn->reconciliation_status = 'unreconciled';
                $inTxn->created_by = $userId;
                $inTxn->updated_by = $userId;
                $inTxn->save();

                if ($outTxn) {
                    $outTxn->related_transaction_id = $inTxn->id;
                    $outTxn->save();
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Internal transfer processed successfully and auto-balanced in General Ledger.',
                'data' => [
                    'from_bank' => $fromBank instanceof BankAccount ? $fromBank->load('chartOfAccount') : null,
                    'to_bank' => $toBank instanceof BankAccount ? $toBank->load('chartOfAccount') : null,
                    'journal_entry' => $journalEntry,
                ],
            ]);
        });
    }
}

