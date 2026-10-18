<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Requests;

use App\Core\Tenancy\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

final class ReceiveStockTransferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $tenantId = TenantContext::current()->tenantId();
        $items = $this->input('items');

        if (is_array($items) && !empty($items)) {
            $preparedItems = [];
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $itemId = $item['item_id'] ?? $item['id'] ?? null;
                if ($itemId !== null && !is_numeric($itemId)) {
                    $resolved = DB::table('stock_transfer_items')->where('tenant_id', $tenantId)->where('uuid', (string) $itemId)->value('id');
                    if ($resolved) {
                        $item['item_id'] = $resolved;
                    }
                } elseif (is_numeric($itemId)) {
                    $item['item_id'] = (int) $itemId;
                }

                $preparedItems[] = $item;
            }
            $this->merge(['items' => $preparedItems]);
        }
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'items' => ['nullable', 'array'],
            'items.*.item_id' => ['required', 'integer'],
            'items.*.received_quantity' => ['required', 'numeric', 'gte:0'],
            'items.*.damaged_quantity' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
