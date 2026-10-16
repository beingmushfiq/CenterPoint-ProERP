<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Actions;

use App\Modules\Delivery\Models\CodReconciliation;
use App\Modules\Delivery\Models\RunSheet;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReconcileCodAction
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function execute(array $data): CodReconciliation
    {
        return DB::transaction(function () use ($data): CodReconciliation {
            $expected = (string) ($data['expected_amount'] ?? '0.0000');
            $received = (string) ($data['received_amount'] ?? '0.0000');
            $variance = bcsub($received, $expected, 4);

            /** @var CodReconciliation $rec */
            $rec = CodReconciliation::create([
                'tenant_id' => $data['tenant_id'],
                'uuid' => (string) Str::uuid(),
                'reconciliation_number' => $data['reconciliation_number'] ?? ('REC-COD-'.date('Ymd').'-'.strtoupper(Str::random(5))),
                'source_type' => $data['source_type'] ?? 'run_sheet',
                'source_id' => $data['source_id'],
                'period_start' => $data['period_start'] ?? date('Y-m-d'),
                'period_end' => $data['period_end'] ?? date('Y-m-d'),
                'expected_amount' => $expected,
                'received_amount' => $received,
                'variance_amount' => $variance,
                'status' => $variance === '0.0000' ? 'reconciled' : 'disputed',
                'reconciled_by' => $data['reconciled_by'] ?? null,
                'reconciled_at' => now(),
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['created_by'] ?? null,
            ]);

            // If source is run_sheet, update run_sheet status
            if ($rec->source_type === 'run_sheet') {
                $sheet = RunSheet::find($rec->source_id);
                if ($sheet) {
                    $sheet->update([
                        'status' => 'reconciled',
                        'reconciled_by' => $rec->reconciled_by,
                        'reconciled_at' => now(),
                    ]);
                }
            }

            return $rec;
        });
    }
}
