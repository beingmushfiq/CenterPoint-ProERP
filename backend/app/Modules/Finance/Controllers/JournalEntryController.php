<?php

declare(strict_types=1);

namespace App\Modules\Finance\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Finance\Actions\PostJournalEntryAction;
use App\Modules\Finance\Models\JournalEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JournalEntryController extends Controller
{
    public function __construct(
        private readonly PostJournalEntryAction $postJournalEntryAction
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = JournalEntry::query()->with('lines.account');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('start_date')) {
            $query->where('entry_date', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->where('entry_date', '<=', $request->query('end_date'));
        }

        $entries = $query->orderByDesc('entry_date')->orderByDesc('id')->paginate(20);

        return response()->json($entries);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'required|integer',
            'entry_number' => 'nullable|string|max:64',
            'entry_date' => 'required|date',
            'entry_type' => 'nullable|string|in:manual,system',
            'source_module' => 'nullable|string|max:64',
            'narration' => 'nullable|string',
            'lines' => 'required|array|min:2',
            'lines.*.account_id' => 'required|integer',
            'lines.*.debit_amount' => 'nullable|numeric|min:0',
            'lines.*.credit_amount' => 'nullable|numeric|min:0',
            'lines.*.branch_id' => 'nullable|integer',
            'lines.*.cost_center_code' => 'nullable|string|max:64',
            'lines.*.party_id' => 'nullable|integer',
            'lines.*.narration' => 'nullable|string',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $entry = $this->postJournalEntryAction->execute($validated, $userId);

        return response()->json([
            'data' => $entry,
            'message' => 'Journal entry posted successfully to General Ledger.',
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $entry = JournalEntry::with(['lines.account', 'lines.party', 'postedBy'])->findOrFail($id);

        return response()->json([
            'data' => $entry,
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

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Preload Chart of Accounts
        $accounts = \App\Modules\Finance\Models\ChartOfAccount::query()
            ->where('tenant_id', $tenantId)
            ->get();
        $accountMap = [];
        foreach ($accounts as $acc) {
            $accountMap[strtolower(trim((string) $acc->account_code))] = $acc;
            $accountMap[strtolower(trim((string) $acc->name))] = $acc;
            $accountMap[(string) $acc->id] = $acc;
        }

        // Group rows by entry_number or reference
        $groupedEntries = [];
        $singleOpeningKey = 'JE-OPEN-' . date('Ymd');

        foreach ($rows as $index => $row) {
            $rowNum = $index + 1;
            $entryKey = trim((string) ($row['entry_number'] ?? $row['reference'] ?? $row['voucher_no'] ?? ''));
            if ($entryKey === '') {
                $entryKey = $singleOpeningKey;
            }

            if (!isset($groupedEntries[$entryKey])) {
                $groupedEntries[$entryKey] = [
                    'entry_number' => $entryKey,
                    'entry_date' => !empty($row['entry_date']) ? (string) $row['entry_date'] : (!empty($row['date']) ? (string) $row['date'] : now()->format('Y-m-d')),
                    'narration' => !empty($row['narration']) ? (string) $row['narration'] : (!empty($row['description']) ? (string) $row['description'] : 'Opening Balances Migration'),
                    'entry_type' => !empty($row['entry_type']) ? (string) $row['entry_type'] : 'manual',
                    'company_id' => (int) ($row['company_id'] ?? $defaultCompanyId),
                    'lines' => [],
                    'first_row_num' => $rowNum,
                ];
            }

            $groupedEntries[$entryKey]['lines'][] = [
                'row_num' => $rowNum,
                'data' => $row,
            ];
        }

        foreach ($groupedEntries as $entryKey => $entryData) {
            $lines = $entryData['lines'];
            $totalDebit = '0.0000';
            $totalCredit = '0.0000';
            $processedLines = [];
            $entryHasError = false;

            foreach ($lines as $lineItem) {
                $rowNum = $lineItem['row_num'];
                $r = $lineItem['data'];

                $accKey = trim((string) ($r['account_code'] ?? $r['account'] ?? $r['account_id'] ?? ''));
                if ($accKey === '') {
                    $errors[] = [
                        'row' => $rowNum,
                        'field' => 'account_code',
                        'message' => 'Account code is required.',
                    ];
                    $entryHasError = true;
                    continue;
                }

                $lowerAccKey = strtolower($accKey);
                if (!isset($accountMap[$lowerAccKey])) {
                    $errors[] = [
                        'row' => $rowNum,
                        'field' => 'account_code',
                        'message' => "Account '{$accKey}' not found in Chart of Accounts.",
                    ];
                    $entryHasError = true;
                    continue;
                }
                $account = $accountMap[$lowerAccKey];

                $drRaw = $r['debit_amount'] ?? $r['debit'] ?? 0;
                $crRaw = $r['credit_amount'] ?? $r['credit'] ?? 0;

                $dr = (is_numeric($drRaw) && (float) $drRaw >= 0) ? number_format((float) $drRaw, 4, '.', '') : '0.0000';
                $cr = (is_numeric($crRaw) && (float) $crRaw >= 0) ? number_format((float) $crRaw, 4, '.', '') : '0.0000';

                if (bccomp($dr, '0.0000', 4) === 0 && bccomp($cr, '0.0000', 4) === 0) {
                    $errors[] = [
                        'row' => $rowNum,
                        'field' => 'debit_amount',
                        'message' => 'Either Debit or Credit must be greater than zero.',
                    ];
                    $entryHasError = true;
                    continue;
                }

                $totalDebit = bcadd($totalDebit, $dr, 4);
                $totalCredit = bcadd($totalCredit, $cr, 4);

                $processedLines[] = [
                    'account_id' => $account->id,
                    'debit_amount' => $dr,
                    'credit_amount' => $cr,
                    'narration' => !empty($r['description']) ? (string) $r['description'] : (!empty($r['narration']) ? (string) $r['narration'] : null),
                ];
            }

            if ($entryHasError) {
                continue;
            }

            if (count($processedLines) < 2) {
                $errors[] = [
                    'row' => $entryData['first_row_num'],
                    'field' => 'lines',
                    'message' => "Journal entry '{$entryKey}' must have at least 2 lines.",
                ];
                continue;
            }

            // Strict Accounting Check: Debit must equal Credit
            if (bccomp($totalDebit, $totalCredit, 4) !== 0) {
                $errors[] = [
                    'row' => $entryData['first_row_num'],
                    'field' => 'balance',
                    'message' => "Journal entry '{$entryKey}' is out of balance. Total Debits: {$totalDebit}, Total Credits: {$totalCredit}.",
                ];
                continue;
            }

            \Illuminate\Support\Facades\DB::transaction(function () use (
                $tenantId,
                $userId,
                $entryKey,
                $entryData,
                $totalDebit,
                $totalCredit,
                $processedLines,
                $mode,
                &$imported,
                &$updated,
                &$skipped
            ): void {
                $existing = JournalEntry::query()
                    ->where('tenant_id', $tenantId)
                    ->where('entry_number', $entryKey)
                    ->first();

                if ($existing) {
                    if ($mode === 'skip') {
                        $skipped++;
                        return;
                    }

                    // Upsert: update header and replace lines
                    $existing->update([
                        'entry_date' => $entryData['entry_date'],
                        'narration' => $entryData['narration'],
                        'total_debit' => $totalDebit,
                        'total_credit' => $totalCredit,
                        'updated_by' => $userId,
                    ]);

                    \App\Modules\Finance\Models\JournalLine::where('journal_entry_id', $existing->id)->delete();

                    foreach ($processedLines as $idx => $line) {
                        \App\Modules\Finance\Models\JournalLine::create([
                            'uuid' => (string) \Illuminate\Support\Str::uuid(),
                            'tenant_id' => $tenantId,
                            'journal_entry_id' => $existing->id,
                            'account_id' => $line['account_id'],
                            'debit_amount' => $line['debit_amount'],
                            'credit_amount' => $line['credit_amount'],
                            'narration' => $line['narration'],
                            'sort_order' => $idx + 1,
                            'created_by' => $userId,
                            'updated_by' => $userId,
                        ]);
                    }

                    $updated++;
                    return;
                }

                // Insert new journal entry
                $journalEntry = new JournalEntry();
                $journalEntry->uuid = (string) \Illuminate\Support\Str::uuid();
                $journalEntry->tenant_id = $tenantId;
                $journalEntry->company_id = $entryData['company_id'];
                $journalEntry->entry_number = $entryKey;
                $journalEntry->entry_date = $entryData['entry_date'];
                $journalEntry->entry_type = $entryData['entry_type'];
                $journalEntry->source_module = 'opening_migration';
                $journalEntry->narration = $entryData['narration'];
                $journalEntry->total_debit = $totalDebit;
                $journalEntry->total_credit = $totalCredit;
                $journalEntry->status = 'posted';
                $journalEntry->posted_by = $userId;
                $journalEntry->posted_at = now();
                $journalEntry->created_by = $userId;
                $journalEntry->updated_by = $userId;
                $journalEntry->save();

                foreach ($processedLines as $idx => $line) {
                    \App\Modules\Finance\Models\JournalLine::create([
                        'uuid' => (string) \Illuminate\Support\Str::uuid(),
                        'tenant_id' => $tenantId,
                        'journal_entry_id' => $journalEntry->id,
                        'account_id' => $line['account_id'],
                        'debit_amount' => $line['debit_amount'],
                        'credit_amount' => $line['credit_amount'],
                        'narration' => $line['narration'],
                        'sort_order' => $idx + 1,
                        'created_by' => $userId,
                        'updated_by' => $userId,
                    ]);
                }

                $imported++;
            });
        }

        return response()->json([
            'success' => true,
            'message' => "Journal entries bulk import completed. {$imported} imported, {$updated} updated, {$skipped} skipped.",
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'errors' => $errors,
            ],
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $entry = JournalEntry::findOrFail($id);
        $entry->delete();

        return response()->json([
            'success' => true,
            'message' => 'Journal entry moved to Data Bin successfully',
        ]);
    }
}

