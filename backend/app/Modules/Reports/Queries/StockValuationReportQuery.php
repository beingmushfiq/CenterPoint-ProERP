<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use Illuminate\Support\Facades\DB;

class StockValuationReportQuery implements ReportQueryInterface
{
    public function columns(): array
    {
        return [
            'sku' => ['label' => 'SKU', 'type' => 'string', 'sortable' => true],
            'product_name' => ['label' => 'Product Name', 'type' => 'string'],
            'warehouse_name' => ['label' => 'Warehouse', 'type' => 'string'],
            'quantity_on_hand' => ['label' => 'Qty On Hand', 'type' => 'number'],
            'unit_cost' => ['label' => 'Unit Cost (BDT)', 'type' => 'currency'],
            'total_valuation' => ['label' => 'Total Valuation (BDT)', 'type' => 'currency'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = \App\Core\Tenancy\TenantContext::isBound()
            ? \App\Core\Tenancy\TenantContext::current()->tenantId()
            : (\Illuminate\Support\Facades\Auth::user()?->tenant_id ?? (int) config('app.default_tenant_id', 1));

        $query = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->join('warehouses as w', 'sb.warehouse_id', '=', 'w.id')
            ->where('sb.tenant_id', $tenantId)
            ->select([
                'p.id as product_id',
                'p.sku',
                'p.name as product_name',
                'w.name as warehouse_name',
                'sb.quantity as quantity_on_hand',
                'p.standard_cost as unit_cost',
            ]);

        if (!empty($filters['warehouse_id'])) {
            $query->where('sb.warehouse_id', $filters['warehouse_id']);
        }
        if (!empty($filters['product_id'])) {
            $query->where('sb.product_id', $filters['product_id']);
        }

        $total = $query->count();
        $rows = $query->orderBy('p.name', 'asc')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        $data = $rows->map(function ($row): array {
            $qty = (float) $row->quantity_on_hand;
            $unitCost = (float) ($row->unit_cost ?? 0);
            $valuation = $qty * $unitCost;

            return [
                'sku' => $row->sku,
                'product_name' => $row->product_name,
                'warehouse_name' => $row->warehouse_name,
                'quantity_on_hand' => number_format($qty, 4, '.', ''),
                'unit_cost' => number_format($unitCost, 4, '.', ''),
                'total_valuation' => number_format($valuation, 4, '.', ''),
            ];
        })->toArray();

        return [
            'data' => $data,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    public function summary(array $filters): array
    {
        $tenantId = $filters['tenant_id'] ?? \Illuminate\Support\Facades\Auth::user()?->tenant_id ?? 1;

        $query = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->where('sb.tenant_id', $tenantId);

        if (!empty($filters['warehouse_id'])) {
            $query->where('sb.warehouse_id', $filters['warehouse_id']);
        }

        $stats = $query->selectRaw('
            COUNT(sb.id) as total_items,
            COALESCE(SUM(sb.quantity), 0) as total_units,
            COALESCE(SUM(sb.quantity * p.standard_cost), 0) as total_inventory_valuation
        ')->first();

        return [
            'total_items' => (int) ($stats->total_items ?? 0),
            'total_units' => number_format((float) ($stats->total_units ?? 0), 4, '.', ''),
            'total_inventory_valuation' => number_format((float) ($stats->total_inventory_valuation ?? 0), 4, '.', ''),
        ];
    }
}
