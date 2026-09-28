<?php

declare(strict_types=1);

namespace App\Modules\Sales\Resources;

use App\Modules\Sales\Models\PaymentSplit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PaymentSplit
 */
final class PaymentSplitResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'payment_id'      => $this->payment_id,
            'method'          => $this->method,
            'amount'          => $this->amount,
            'bank_account_id' => $this->bank_account_id,
            'bank_name'       => $this->bankAccount?->bank_name,
            'account_number'  => $this->bankAccount?->account_number,
            'mobile_provider' => $this->mobile_provider,
            'mobile_number'   => $this->mobile_number,
            'transaction_ref' => $this->transaction_ref,
            'cheque_number'   => $this->cheque_number,
            'cheque_date'     => $this->cheque_date?->toDateString(),
            'card_last4'      => $this->card_last4,
            'notes'           => $this->notes,
            'created_at'      => $this->created_at?->toIso8601String(),
        ];
    }
}
