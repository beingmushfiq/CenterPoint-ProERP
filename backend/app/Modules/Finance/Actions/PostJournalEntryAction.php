<?php

declare(strict_types=1);

namespace App\Modules\Finance\Actions;

use App\Modules\Finance\Models\JournalEntry;
use App\Modules\Finance\Models\JournalLine;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PostJournalEntryAction
{
    /**
     * @param array{
     *     company_id: int,
     *     entry_number?: string,
     *     entry_date: string,
     *     entry_type?: string,
     *     source_module?: string,
     *     reference_type?: string,
     *     reference_id?: int,
     *     narration?: string,
     *     lines: array<int, array{
     *         account_id: int,
     *         debit_amount?: float|string,
     *         credit_amount?: float|string,
     *         branch_id?: int,
     *         cost_center_code?: string,
     *         party_id?: int,
     *         narration?: string,
     *     }>
     * } $data
     */
    public function execute(array $data, int $userId): JournalEntry
    {
        return DB::transaction(function () use ($data, $userId): JournalEntry {
            $lines = $data['lines'] ?? [];
            if (empty($lines)) {
                throw ValidationException::withMessages(['lines' => 'A journal entry must contain at least two lines.']);
            }

            // Period Lock Check: Verify whether entry_date falls in a closed payroll/accounting period
            $entryDate = $data['entry_date'];
            $isClosed = DB::table('payroll_periods')
                ->where('period_start', '<=', $entryDate)
                ->where('period_end', '>=', $entryDate)
                ->where(function ($q): void {
                    $q->where('status', 'closed')
                        ->orWhereNotNull('locked_at');
                })
                ->exists();

            if ($isClosed) {
                throw ValidationException::withMessages(['entry_date' => "Accounting period for date {$entryDate} is closed and immutable."]);
            }

            $totalDebit = '0.0000';
            $totalCredit = '0.0000';

            foreach ($lines as $line) {
                $dr = (string) ($line['debit_amount'] ?? '0.0000');
                $cr = (string) ($line['credit_amount'] ?? '0.0000');
                $totalDebit = bcadd($totalDebit, $dr, 4);
                $totalCredit = bcadd($totalCredit, $cr, 4);
            }

            // Debit must equal credit exact to 4 decimal places
            if (bccomp($totalDebit, $totalCredit, 4) !== 0) {
                throw ValidationException::withMessages([
                    'lines' => "Journal entry is out of balance. Total Debits: {$totalDebit}, Total Credits: {$totalCredit}",
                ]);
            }

            if (bccomp($totalDebit, '0.0000', 4) <= 0) {
                throw ValidationException::withMessages(['lines' => 'Journal entry total must be greater than zero.']);
            }

            $entryNumber = $data['entry_number'] ?? ('JE-'.date('Ym').'-'.str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT));

            $journalEntry = JournalEntry::create([
                'company_id' => $data['company_id'],
                'entry_number' => $entryNumber,
                'entry_date' => $data['entry_date'],
                'entry_type' => $data['entry_type'] ?? 'manual',
                'source_module' => $data['source_module'] ?? 'general_ledger',
                'reference_type' => $data['reference_type'] ?? null,
                'reference_id' => $data['reference_id'] ?? null,
                'narration' => $data['narration'] ?? null,
                'total_debit' => $totalDebit,
                'total_credit' => $totalCredit,
                'status' => 'posted',
                'posted_by' => $userId,
                'posted_at' => now(),
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $sortOrder = 1;
            foreach ($lines as $line) {
                JournalLine::create([
                    'journal_entry_id' => $journalEntry->id,
                    'account_id' => $line['account_id'],
                    'debit_amount' => (string) ($line['debit_amount'] ?? '0.0000'),
                    'credit_amount' => (string) ($line['credit_amount'] ?? '0.0000'),
                    'branch_id' => $line['branch_id'] ?? null,
                    'cost_center_code' => $line['cost_center_code'] ?? null,
                    'party_id' => $line['party_id'] ?? null,
                    'narration' => $line['narration'] ?? null,
                    'sort_order' => $sortOrder++,
                    'created_by' => $userId,
                    'updated_by' => $userId,
                ]);
            }

            return $journalEntry->load('lines.account');
        });
    }
}
