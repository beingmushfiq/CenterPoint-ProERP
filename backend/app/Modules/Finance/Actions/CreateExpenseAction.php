<?php

declare(strict_types=1);

namespace App\Modules\Finance\Actions;

use App\Core\Exceptions\AppException;
use App\Modules\Finance\Models\BankAccount;
use App\Modules\Finance\Models\Expense;
use App\Modules\Finance\Models\ExpenseCategory;
use App\Modules\Finance\Models\ExpensePaymentSplit;
use Illuminate\Support\Facades\DB;

class CreateExpenseAction
{
    public function __construct(
        private readonly PostJournalEntryAction $postJournalEntryAction
    ) {}

    /**
     * @param array{
     *     company_id: int,
     *     branch_id: int,
     *     expense_category_id: int,
     *     expense_date: string,
     *     payee_type: string,
     *     payee_id?: int,
     *     payee_name: string,
     *     description?: string,
     *     amount: float|string,
     *     tax_amount?: float|string,
     *     payment_method: string,
     *     bank_account_id?: int,
     *     reference_number?: string,
     *     cost_center_code?: string,
     *     splits?: list<array{
     *         method: string,
     *         amount: numeric-string|float|int,
     *         bank_account_id?: int|null,
     *         mobile_provider?: string|null,
     *         mobile_number?: string|null,
     *         transaction_ref?: string|null,
     *         cheque_number?: string|null,
     *         cheque_date?: string|null,
     *         notes?: string|null
     *     }>
     * } $data
     */
    public function execute(array $data, int $userId): Expense
    {
        return DB::transaction(function () use ($data, $userId): Expense {
            $amount = (string) $data['amount'];
            $taxAmount = (string) ($data['tax_amount'] ?? '0.0000');
            $totalAmount = bcadd($amount, $taxAmount, 4);

            $expenseNumber = 'EXP-' . date('Ym') . '-' . str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT);

            $category = ExpenseCategory::findOrFail($data['expense_category_id']);
            $expenseAccountId = $category->chart_of_account_id;

            $bankAccountId = $data['bank_account_id'] ?? null;
            $creditAccountId = null;
            if ($bankAccountId) {
                $bankAccount = BankAccount::findOrFail($bankAccountId);
                $creditAccountId = $bankAccount->chart_of_account_id;
            }

            $primaryMethod = $data['payment_method'];
            if (!empty($data['splits']) && is_array($data['splits']) && count($data['splits']) > 1) {
                $primaryMethod = 'split';
            } elseif (!empty($data['splits']) && is_array($data['splits']) && count($data['splits']) === 1) {
                $primaryMethod = (string) $data['splits'][0]['method'];
            }

            $tenantId = (int) ($category->tenant_id ?? 1);

            $expense = Expense::create([
                'expense_number' => $expenseNumber,
                'company_id' => $data['company_id'],
                'branch_id' => $data['branch_id'],
                'expense_category_id' => $data['expense_category_id'],
                'expense_date' => $data['expense_date'],
                'payee_type' => $data['payee_type'],
                'payee_id' => $data['payee_id'] ?? null,
                'payee_name' => $data['payee_name'],
                'description' => $data['description'] ?? null,
                'amount' => $amount,
                'tax_amount' => $taxAmount,
                'total_amount' => $totalAmount,
                'payment_method' => $primaryMethod,
                'bank_account_id' => $bankAccountId,
                'reference_number' => $data['reference_number'] ?? null,
                'status' => 'approved',
                'approved_by' => $userId,
                'approved_at' => now(),
                'cost_center_code' => $data['cost_center_code'] ?? null,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            // Save splits
            if (!empty($data['splits']) && is_array($data['splits'])) {
                foreach ($data['splits'] as $split) {
                    ExpensePaymentSplit::create([
                        'tenant_id'       => $tenantId,
                        'expense_id'      => $expense->id,
                        'method'          => (string) $split['method'],
                        'amount'          => (string) $split['amount'],
                        'bank_account_id' => !empty($split['bank_account_id']) ? (int) $split['bank_account_id'] : null,
                        'mobile_provider' => $split['mobile_provider'] ?? null,
                        'mobile_number'   => $split['mobile_number'] ?? null,
                        'transaction_ref' => $split['transaction_ref'] ?? null,
                        'cheque_number'   => $split['cheque_number'] ?? null,
                        'cheque_date'     => $split['cheque_date'] ?? null,
                        'notes'           => $split['notes'] ?? null,
                    ]);
                }
            } else {
                ExpensePaymentSplit::create([
                    'tenant_id'       => $tenantId,
                    'expense_id'      => $expense->id,
                    'method'          => $data['payment_method'],
                    'amount'          => $totalAmount,
                    'bank_account_id' => $bankAccountId,
                    'transaction_ref' => $data['reference_number'] ?? null,
                    'notes'           => $data['description'] ?? null,
                ]);
            }

            // Auto-post double entry if both GL accounts are configured
            if ($expenseAccountId && $creditAccountId) {
                $journal = $this->postJournalEntryAction->execute([
                    'company_id' => $data['company_id'],
                    'entry_date' => $data['expense_date'],
                    'entry_type' => 'system',
                    'source_module' => 'expenses',
                    'reference_type' => Expense::class,
                    'reference_id' => $expense->id,
                    'narration' => "Auto GL for expense {$expenseNumber}: {$data['payee_name']}",
                    'lines' => [
                        [
                            'account_id' => $expenseAccountId,
                            'debit_amount' => $totalAmount,
                            'credit_amount' => '0.0000',
                            'branch_id' => $data['branch_id'],
                            'cost_center_code' => $data['cost_center_code'] ?? null,
                            'narration' => $data['description'] ?? 'Expense debit',
                        ],
                        [
                            'account_id' => $creditAccountId,
                            'debit_amount' => '0.0000',
                            'credit_amount' => $totalAmount,
                            'branch_id' => $data['branch_id'],
                            'cost_center_code' => $data['cost_center_code'] ?? null,
                            'narration' => "Payment via {$primaryMethod}",
                        ],
                    ],
                ], $userId);

                $expense->update(['journal_entry_id' => $journal->id]);
            }

            return $expense->load(['category', 'branch', 'bankAccount', 'journalEntry', 'splits']);
        });
    }
}
