<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Inventory\Actions\RecordStockMovementAction;
use App\Modules\Sales\Models\Exchange;
use App\Modules\Sales\Models\Invoice;
use Illuminate\Support\Facades\DB;

final class ApproveExchangeAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement
    ) {}

    public function execute(Exchange $exchange, int $userId): Exchange
    {
        return DB::transaction(function () use ($exchange, $userId): Exchange {
            if ($exchange->status !== 'draft') {
                throw new \DomainException("Exchange [{$exchange->exchange_number}] is already {$exchange->status}.");
            }

            $exchange->loadMissing(['returnItems', 'replacementItems']);

            // Step 1: Record stock IN for returned items (only if restockable and in good condition)
            foreach ($exchange->returnItems as $item) {
                if ($item->restock && $item->condition === 'good') {
                    /** @var numeric-string $qty */
                    $qty = (string) $item->quantity;

                    $movement = $this->recordStockMovement->execute([
                        'tenant_id'      => $exchange->tenant_id,
                        'warehouse_id'   => $exchange->warehouse_id,
                        'product_id'     => $item->product_id,
                        'variant_id'     => $item->variant_id,
                        'movement_type'  => 'exchange_return',
                        'direction'      => 'in',
                        'quantity'       => $qty,
                        'unit_id'        => $item->unit_id,
                        'unit_cost'      => (string) $item->unit_price,
                        'reference_type' => 'exchange',
                        'reference_id'   => $exchange->id,
                        'moved_at'       => $exchange->exchange_date,
                        'created_by'     => $userId,
                    ]);

                    $item->stock_movement_id = $movement->id;
                    $item->save();
                }
            }

            // Step 2: Record stock OUT for replacement items dispatched to customer
            foreach ($exchange->replacementItems as $item) {
                /** @var numeric-string $qty */
                $qty = (string) $item->quantity;

                $movement = $this->recordStockMovement->execute([
                    'tenant_id'      => $exchange->tenant_id,
                    'warehouse_id'   => $exchange->warehouse_id,
                    'product_id'     => $item->product_id,
                    'variant_id'     => $item->variant_id,
                    'movement_type'  => 'exchange_dispatch',
                    'direction'      => 'out',
                    'quantity'       => $qty,
                    'unit_id'        => $item->unit_id,
                    'unit_cost'      => (string) $item->unit_price,
                    'reference_type' => 'exchange',
                    'reference_id'   => $exchange->id,
                    'moved_at'       => $exchange->exchange_date,
                    'created_by'     => $userId,
                ]);

                $item->stock_movement_id = $movement->id;
                $item->save();
            }

            // Step 3: Correlate and dynamically update linked Sales Invoice
            if ($exchange->original_invoice_id) {
                /** @var Invoice|null $invoice */
                $invoice = Invoice::query()->find($exchange->original_invoice_id);
                if ($invoice) {
                    $diffAmount = (float) $exchange->difference_amount;

                    if ($exchange->difference_settlement === 'customer_paid') {
                        // Customer paid the upgrade delta: both total and paid amount increment
                        $invoice->total_amount = (string) round((float) $invoice->total_amount + $diffAmount, 4);
                        $invoice->paid_amount  = (string) round((float) $invoice->paid_amount + $diffAmount, 4);
                    } elseif ($exchange->difference_settlement === 'top_up') {
                        // Upgrade difference added to invoice receivable
                        $invoice->total_amount = (string) round((float) $invoice->total_amount + $diffAmount, 4);
                    } elseif ($exchange->difference_settlement === 'refund') {
                        // Store refund: reduce invoice total
                        $invoice->total_amount = (string) max(0.0, round((float) $invoice->total_amount + $diffAmount, 4));
                    }

                    // Append exchange correlation note
                    $prevNotes = $invoice->void_reason ?? '';
                    $exchangeNote = sprintf(
                        '[Exchange %s linked on %s: Diff %s Tk (%s)]',
                        $exchange->exchange_number,
                        now()->toDateString(),
                        $exchange->difference_amount,
                        $exchange->difference_settlement
                    );
                    $invoice->void_reason = trim($prevNotes . ' ' . $exchangeNote);
                    $invoice->save();
                }
            }

            // Step 4: Mark approved
            $exchange->status      = 'approved';
            $exchange->approved_by = $userId;
            $exchange->approved_at = now();
            $exchange->save();

            return $exchange->refresh()->load([
                'returnItems.product',
                'replacementItems.product',
                'customer',
                'warehouse',
                'reasonCode',
            ]);
        });
    }
}
