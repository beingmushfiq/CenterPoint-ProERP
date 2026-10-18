<?php

declare(strict_types=1);

namespace App\Modules\Pos\Requests;

use App\Core\Tenancy\TenantContext;
use App\Modules\Pos\Models\PosSession;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

final class PosCheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $tenantId = TenantContext::current()->tenantId();

        // 1. Resolve pos_session_id if string UUID or fallback to active open session
        $sessionId = $this->input('pos_session_id');
        $resolvedSessionId = null;

        if ($sessionId !== null && !is_numeric($sessionId)) {
            $resolvedSessionId = PosSession::where('tenant_id', $tenantId)
                ->where('uuid', (string) $sessionId)
                ->value('id');
        } elseif (is_numeric($sessionId)) {
            $resolvedSessionId = (int) $sessionId;
        }

        if (! $resolvedSessionId) {
            $resolvedSessionId = PosSession::where('tenant_id', $tenantId)
                ->where('status', 'open')
                ->latest('opened_at')
                ->value('id');
        }

        $merge = [];
        if ($resolvedSessionId) {
            $merge['pos_session_id'] = $resolvedSessionId;
        }

        // 2. Resolve items product_id, unit_id, variant_id if UUIDs or string numbers
        $items = $this->input('items');
        if (is_array($items)) {
            $preparedItems = [];
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $productId = $item['product_id'] ?? null;
                if ($productId !== null && !is_numeric($productId)) {
                    $pid = DB::table('products')->where('tenant_id', $tenantId)->where('uuid', (string) $productId)->value('id');
                    if ($pid) {
                        $item['product_id'] = $pid;
                    }
                } elseif (is_numeric($productId)) {
                    $item['product_id'] = (int) $productId;
                }

                $unitId = $item['unit_id'] ?? null;
                if ($unitId !== null && !is_numeric($unitId)) {
                    $uid = DB::table('units')->where('tenant_id', $tenantId)->where('uuid', (string) $unitId)->value('id');
                    if ($uid) {
                        $item['unit_id'] = $uid;
                    }
                } elseif (is_numeric($unitId)) {
                    $item['unit_id'] = (int) $unitId;
                }

                if (isset($item['variant_id']) && !is_numeric($item['variant_id'])) {
                    $vid = DB::table('product_variants')->where('tenant_id', $tenantId)->where('uuid', (string) $item['variant_id'])->value('id');
                    $item['variant_id'] = $vid ?: null;
                }

                $preparedItems[] = $item;
            }
            $merge['items'] = $preparedItems;
        }

        // 3. Resolve party_id if UUID
        $partyId = $this->input('party_id');
        if ($partyId !== null && !is_numeric($partyId)) {
            $resolvedPartyId = DB::table('parties')->where('tenant_id', $tenantId)->where('uuid', (string) $partyId)->value('id');
            if ($resolvedPartyId) {
                $merge['party_id'] = $resolvedPartyId;
            }
        }

        if (!empty($merge)) {
            $this->merge($merge);
        }
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'pos_session_id' => ['required', 'integer'],
            'party_id' => ['nullable', 'integer'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:64'],
            'order_date' => ['nullable', 'date'],
            'discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'order_discount_type' => ['nullable', 'string', 'in:flat,percentage'],
            'order_discount_value' => ['nullable', 'numeric', 'gte:0'],
            'round_off' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id' => ['required', 'integer'],
            'items.*.unit_price' => ['required', 'numeric', 'gte:0'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'gte:0'],
            'items.*.discount_type' => ['nullable', 'string', 'in:flat,percentage'],
            'items.*.discount_value' => ['nullable', 'numeric', 'gte:0'],
            'items.*.discount_percentage' => ['nullable', 'numeric', 'gte:0'],
            'items.*.tax_profile_id' => ['nullable', 'integer'],
            'items.*.tax_amount' => ['nullable', 'numeric', 'gte:0'],
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.method' => ['required', 'string', 'in:cash,card,mobile_banking,credit_adjustment'],
            'payments.*.amount' => ['required', 'numeric', 'gt:0'],
            'payments.*.change_given' => ['nullable', 'numeric', 'gte:0'],
        ];
    }
}
