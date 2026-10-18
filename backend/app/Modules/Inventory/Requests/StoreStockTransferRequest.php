<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Requests;

use App\Core\Tenancy\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

final class StoreStockTransferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $tenantId = TenantContext::current()->tenantId();
        $merge = [];

        $fromWh = $this->input('from_warehouse_id');
        if ($fromWh !== null && !is_numeric($fromWh)) {
            $fromId = DB::table('warehouses')->where('tenant_id', $tenantId)->where('uuid', (string) $fromWh)->value('id');
            if ($fromId) {
                $merge['from_warehouse_id'] = $fromId;
            }
        } elseif (is_numeric($fromWh)) {
            $merge['from_warehouse_id'] = (int) $fromWh;
        }

        $toWh = $this->input('to_warehouse_id');
        if ($toWh !== null && !is_numeric($toWh)) {
            $toId = DB::table('warehouses')->where('tenant_id', $tenantId)->where('uuid', (string) $toWh)->value('id');
            if ($toId) {
                $merge['to_warehouse_id'] = $toId;
            }
        } elseif (is_numeric($toWh)) {
            $merge['to_warehouse_id'] = (int) $toWh;
        }

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
            'from_warehouse_id' => ['required', 'integer'],
            'to_warehouse_id' => ['required', 'integer', 'different:from_warehouse_id'],
            'transfer_date' => ['required', 'date'],
            'transfer_number' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.sent_quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_id' => ['required', 'integer'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.batch_code' => ['nullable', 'string', 'max:64'],
        ];
    }
}
