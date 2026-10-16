<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Models\Invoice;
use DomainException;
use Illuminate\Support\Facades\DB;

final class ApproveInvoiceAction
{
    public function __construct(
        private readonly SyncSalesmanAchievementAction $syncAchievement = new SyncSalesmanAchievementAction
    ) {}

    public function execute(Invoice $invoice, int $userId): Invoice
    {
        return DB::transaction(function () use ($invoice, $userId): Invoice {
            if ($invoice->status !== 'draft') {
                throw new DomainException("Invoice [{$invoice->invoice_number}] cannot be posted from status [{$invoice->status}].");
            }

            $invoice->status = 'posted';
            $invoice->posted_by = $userId;
            $invoice->posted_at = now();
            $invoice->save();

            $month = $invoice->invoice_date ? \Carbon\Carbon::parse((string) $invoice->invoice_date)->format('Y-m') : now()->format('Y-m');
            $this->syncAchievement->execute(
                (int) $invoice->tenant_id,
                $invoice->salesman_id ? (int) $invoice->salesman_id : null,
                $invoice->created_by ? (int) $invoice->created_by : $userId,
                $month
            );

            return $invoice->refresh();
        });
    }
}
