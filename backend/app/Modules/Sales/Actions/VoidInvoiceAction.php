<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Models\Invoice;
use DomainException;
use Illuminate\Support\Facades\DB;

final class VoidInvoiceAction
{
    public function execute(Invoice $invoice, int $userId, string $reason): Invoice
    {
        return DB::transaction(function () use ($invoice, $userId, $reason): Invoice {
            if (! in_array($invoice->status, ['draft', 'posted'], true)) {
                throw new DomainException("Invoice [{$invoice->invoice_number}] cannot be voided from status [{$invoice->status}].");
            }

            $invoice->status = 'void';
            $invoice->voided_by = $userId;
            $invoice->voided_at = now();
            $invoice->void_reason = $reason;
            $invoice->save();

            return $invoice->refresh();
        });
    }
}
