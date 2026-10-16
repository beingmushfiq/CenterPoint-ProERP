<?php

declare(strict_types=1);

namespace App\Modules\Assets\Actions;

use App\Modules\Assets\Models\Asset;
use App\Modules\Assets\Models\AssetDepreciationEntry;
use App\Modules\Finance\Actions\PostJournalEntryAction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CalculateDepreciationAction
{
    public function __construct(
        private readonly PostJournalEntryAction $postJournalEntryAction
    ) {}

    /**
     * Calculates depreciation for an asset for a specific period and optionally posts GL.
     *
     * @param array{
     *     asset_id: int,
     *     period_year: int,
     *     period_month: int,
     *     post_to_gl?: bool,
     *     depreciation_expense_account_id?: int,
     *     accumulated_depreciation_account_id?: int,
     * } $data
     */
    public function execute(array $data, int $userId): AssetDepreciationEntry
    {
        return DB::transaction(function () use ($data, $userId): AssetDepreciationEntry {
            $asset = Asset::findOrFail($data['asset_id']);

            // Check if depreciation already posted for this period
            $existing = AssetDepreciationEntry::where('asset_id', $asset->id)
                ->where('period_year', $data['period_year'])
                ->where('period_month', $data['period_month'])
                ->first();

            if ($existing) {
                throw ValidationException::withMessages([
                    'asset_id' => "Depreciation already calculated for Asset #{$asset->asset_code} for period {$data['period_year']}-{$data['period_month']}.",
                ]);
            }

            $purchaseCost = (string) $asset->purchase_cost;
            $salvageValue = (string) $asset->salvage_value;
            $usefulLifeMonths = (int) $asset->useful_life_months > 0 ? (int) $asset->useful_life_months : 60;
            $currentBookValue = (string) $asset->book_value;

            // Straight-line monthly depreciation: (Cost - Salvage) / Useful_Life_Months
            $depreciableBase = bcsub($purchaseCost, $salvageValue, 4);
            if (bccomp($depreciableBase, '0.0000', 4) <= 0) {
                $depreciationAmount = '0.0000';
            } else {
                $monthlyDepr = bcdiv($depreciableBase, (string) $usefulLifeMonths, 4);
                // Ensure we don't depreciate below salvage value
                $maxDepreciation = bcsub($currentBookValue, $salvageValue, 4);
                $depreciationAmount = bccomp($monthlyDepr, $maxDepreciation, 4) > 0 ? $maxDepreciation : $monthlyDepr;
                if (bccomp($depreciationAmount, '0.0000', 4) < 0) {
                    $depreciationAmount = '0.0000';
                }
            }

            $closingBookValue = bcsub($currentBookValue, $depreciationAmount, 4);
            $newAccumulated = bcadd((string) $asset->accumulated_depreciation, $depreciationAmount, 4);

            $journalEntryId = null;

            // Optional or auto GL journal posting
            $deprExpenseAccountId = $data['depreciation_expense_account_id'] ?? null;
            $accumDeprAccountId = $data['accumulated_depreciation_account_id'] ?? null;

            if ($deprExpenseAccountId && $accumDeprAccountId && bccomp($depreciationAmount, '0.0000', 4) > 0) {
                $entryDate = sprintf('%04d-%02d-28', $data['period_year'], $data['period_month']);
                $journal = $this->postJournalEntryAction->execute([
                    'company_id' => $asset->company_id,
                    'entry_date' => $entryDate,
                    'entry_type' => 'system',
                    'source_module' => 'assets',
                    'reference_type' => Asset::class,
                    'reference_id' => $asset->id,
                    'narration' => "Monthly depreciation for {$asset->name} ({$asset->asset_code}) for {$data['period_year']}-{$data['period_month']}",
                    'lines' => [
                        [
                            'account_id' => $deprExpenseAccountId,
                            'debit_amount' => $depreciationAmount,
                            'credit_amount' => '0.0000',
                            'branch_id' => $asset->branch_id,
                            'narration' => "Depreciation Expense for {$asset->asset_code}",
                        ],
                        [
                            'account_id' => $accumDeprAccountId,
                            'debit_amount' => '0.0000',
                            'credit_amount' => $depreciationAmount,
                            'branch_id' => $asset->branch_id,
                            'narration' => "Accumulated Depreciation for {$asset->asset_code}",
                        ],
                    ],
                ], $userId);

                $journalEntryId = $journal->id;
            }

            $entry = AssetDepreciationEntry::create([
                'asset_id' => $asset->id,
                'period_year' => $data['period_year'],
                'period_month' => $data['period_month'],
                'opening_book_value' => $currentBookValue,
                'depreciation_amount' => $depreciationAmount,
                'closing_book_value' => $closingBookValue,
                'journal_entry_id' => $journalEntryId,
                'posted_at' => now(),
                'created_by' => $userId,
            ]);

            // Update asset balances
            $asset->update([
                'accumulated_depreciation' => $newAccumulated,
                'book_value' => $closingBookValue,
                'updated_by' => $userId,
            ]);

            return $entry->load(['asset', 'journalEntry']);
        });
    }
}
