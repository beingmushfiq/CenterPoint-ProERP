<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Models\Payment;
use App\Modules\Sales\Models\PaymentAllocation;
use App\Modules\Sales\Models\PaymentSplit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RecordPaymentAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     direction: string,
     *     party_id?: int|null,
     *     company_id?: int|null,
     *     branch_id?: int|null,
     *     payment_date: string,
     *     method: string,
     *     bank_account_id?: int|null,
     *     reference_number?: string|null,
     *     amount: string,
     *     currency_code?: string,
     *     notes?: string|null,
     *     received_by?: int|null,
     *     created_by?: int|null,
     *     payment_number?: string,
     *     allocations?: list<array{
     *         allocatable_type: string,
     *         allocatable_id: int,
     *         amount: string
     *     }>,
     *     splits?: list<array{
     *         method: string,
     *         amount: numeric-string|float|int,
     *         bank_account_id?: int|null,
     *         mobile_provider?: string|null,
     *         mobile_number?: string|null,
     *         transaction_ref?: string|null,
     *         cheque_number?: string|null,
     *         cheque_date?: string|null,
     *         card_last4?: string|null,
     *         notes?: string|null
     *     }>
     * } $data
     */
    public function execute(array $data): Payment
    {
        return DB::transaction(function () use ($data): Payment {
            $paymentNumber = $data['payment_number'] ?? ('PAY-' . date('Ymd') . '-' . strtoupper(Str::random(6)));

            /** @var numeric-string $amount */
            $amount = is_numeric($data['amount']) ? (string) $data['amount'] : '0.0000';

            // Calculate allocated_amount from provided allocations
            /** @var numeric-string $allocatedAmount */
            $allocatedAmount = '0.0000';
            foreach ($data['allocations'] ?? [] as $alloc) {
                /** @var numeric-string $allocAmt */
                $allocAmt = is_numeric($alloc['amount']) ? (string) $alloc['amount'] : '0.0000';
                $allocatedAmount = bcadd($allocatedAmount, $allocAmt, 4);
            }
            /** @var numeric-string $unallocated */
            $unallocated = bcsub($amount, $allocatedAmount, 4);

            $primaryMethod = $data['method'];
            if (!empty($data['splits']) && is_array($data['splits']) && count($data['splits']) > 1) {
                $primaryMethod = 'split';
            } elseif (!empty($data['splits']) && is_array($data['splits']) && count($data['splits']) === 1) {
                $primaryMethod = (string) $data['splits'][0]['method'];
            }

            $payment = Payment::create([
                'tenant_id'          => $data['tenant_id'],
                'payment_number'     => $paymentNumber,
                'direction'          => $data['direction'],
                'party_id'           => $data['party_id'] ?? null,
                'company_id'         => $data['company_id'] ?? null,
                'branch_id'          => $data['branch_id'] ?? null,
                'payment_date'       => $data['payment_date'],
                'method'             => $primaryMethod,
                'bank_account_id'    => $data['bank_account_id'] ?? null,
                'reference_number'   => $data['reference_number'] ?? null,
                'amount'             => $amount,
                'allocated_amount'   => $allocatedAmount,
                'unallocated_amount' => $unallocated,
                'currency_code'      => $data['currency_code'] ?? 'BDT',
                'status'             => 'posted',
                'received_by'        => $data['received_by'] ?? null,
                'posted_at'          => now(),
                'notes'              => $data['notes'] ?? null,
                'created_by'         => $data['created_by'] ?? null,
            ]);

            foreach ($data['allocations'] ?? [] as $alloc) {
                /** @var numeric-string $allocAmt */
                $allocAmt = is_numeric($alloc['amount']) ? (string) $alloc['amount'] : '0.0000';

                PaymentAllocation::create([
                    'tenant_id'        => $data['tenant_id'],
                    'payment_id'       => $payment->id,
                    'allocatable_type' => $alloc['allocatable_type'],
                    'allocatable_id'   => $alloc['allocatable_id'],
                    'amount'           => $allocAmt,
                    'created_by'       => $data['created_by'] ?? null,
                ]);

                if ($alloc['allocatable_type'] === 'invoice') {
                    $inv = \App\Modules\Sales\Models\Invoice::where('tenant_id', $data['tenant_id'])->find($alloc['allocatable_id']);
                    if ($inv) {
                        $curPaid = (string) ($inv->paid_amount ?? '0');
                        $newPaid = bcadd($curPaid, $allocAmt, 4);
                        $newStatus = bccomp($newPaid, (string) $inv->total_amount, 4) >= 0 ? 'paid' : 'partially_paid';
                        $inv->update(['paid_amount' => $newPaid, 'status' => $newStatus]);
                    }
                } elseif ($alloc['allocatable_type'] === 'purchase_bill') {
                    $pb = \App\Modules\Purchasing\Models\PurchaseBill::where('tenant_id', $data['tenant_id'])->find($alloc['allocatable_id']);
                    if ($pb) {
                        $curPaid = (string) ($pb->paid_amount ?? '0');
                        $newPaid = bcadd($curPaid, $allocAmt, 4);
                        $newStatus = bccomp($newPaid, (string) $pb->total_amount, 4) >= 0 ? 'paid' : 'partial';
                        $pb->update(['paid_amount' => $newPaid, 'status' => $newStatus]);
                    }
                }
            }

            // Save splits
            if (!empty($data['splits']) && is_array($data['splits'])) {
                foreach ($data['splits'] as $split) {
                    PaymentSplit::create([
                        'tenant_id'       => $data['tenant_id'],
                        'payment_id'      => $payment->id,
                        'method'          => (string) $split['method'],
                        'amount'          => (string) $split['amount'],
                        'bank_account_id' => !empty($split['bank_account_id']) ? (int) $split['bank_account_id'] : null,
                        'mobile_provider' => $split['mobile_provider'] ?? null,
                        'mobile_number'   => $split['mobile_number'] ?? null,
                        'transaction_ref' => $split['transaction_ref'] ?? null,
                        'cheque_number'   => $split['cheque_number'] ?? null,
                        'cheque_date'     => $split['cheque_date'] ?? null,
                        'card_last4'      => $split['card_last4'] ?? null,
                        'notes'           => $split['notes'] ?? null,
                    ]);
                }
            } else {
                // Ensure default 1 split record exists for consistent multi-split querying
                PaymentSplit::create([
                    'tenant_id'       => $data['tenant_id'],
                    'payment_id'      => $payment->id,
                    'method'          => $data['method'],
                    'amount'          => $amount,
                    'bank_account_id' => $data['bank_account_id'] ?? null,
                    'transaction_ref' => $data['reference_number'] ?? null,
                    'notes'           => $data['notes'] ?? null,
                ]);
            }

            return $payment->load(['allocations', 'party', 'splits']);
        });
    }
}
