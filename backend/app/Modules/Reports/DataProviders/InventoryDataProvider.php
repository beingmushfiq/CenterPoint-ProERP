<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class InventoryDataProvider extends BaseDataProvider
{
    /**
     * Stock valuation and cost aging per product and warehouse.
     */
    public function valuation(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->join('warehouses as w', 'sb.warehouse_id', '=', 'w.id')
            ->leftJoin('categories as c', 'p.category_id', '=', 'c.id')
            ->where('sb.tenant_id', $tenantId)
            ->where('sb.quantity', '>', 0)
            ->select([
                'p.id as product_id',
                'p.sku',
                'p.name as product_name',
                'p.type as product_type',
                DB::raw("COALESCE(c.name, 'Uncategorized') as category_name"),
                'w.name as warehouse_name',
                'sb.batch_code',
                'sb.quantity as quantity_on_hand',
                DB::raw('COALESCE(sb.average_cost, p.standard_cost, 0) as unit_cost'),
                DB::raw('COALESCE(sb.total_value, (sb.quantity * COALESCE(p.standard_cost, 0))) as total_valuation'),
            ]);

        $this->applyBalanceFilters($query, $filters);

        $total = $query->count();

        $rows = $query
            ->orderBy('total_valuation', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'category' => $row->category_name,
                    'product_type' => ucfirst(str_replace('_', ' ', $row->product_type ?? 'standard')),
                    'warehouse_name' => $row->warehouse_name,
                    'batch_code' => $row->batch_code ?? '—',
                    'quantity_on_hand' => (float) $row->quantity_on_hand,
                    'unit_cost' => (float) $row->unit_cost,
                    'total_valuation' => (float) $row->total_valuation,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Current stock on hand across warehouses with stock state breakdown.
     */
    public function currentStock(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->join('warehouses as w', 'sb.warehouse_id', '=', 'w.id')
            ->where('sb.tenant_id', $tenantId)
            ->groupBy(['p.id', 'p.sku', 'p.name', 'w.id', 'w.name', 'p.reorder_level'])
            ->select([
                'p.id as product_id',
                'p.sku',
                'p.name as product_name',
                'w.name as warehouse_name',
                'p.reorder_level',
                DB::raw("SUM(CASE WHEN sb.stock_state = 'available' THEN sb.quantity ELSE 0 END) as available_qty"),
                DB::raw("SUM(CASE WHEN sb.stock_state = 'reserved' THEN sb.quantity ELSE 0 END) as reserved_qty"),
                DB::raw("SUM(CASE WHEN sb.stock_state = 'damaged' THEN sb.quantity ELSE 0 END) as damaged_qty"),
                DB::raw('SUM(sb.quantity) as total_on_hand'),
            ]);

        $this->applyBalanceFilters($query, $filters);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_on_hand', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $onHand = (float) $row->total_on_hand;
                $reorder = (float) ($row->reorder_level ?? 0);
                $status = 'healthy';
                if ($onHand <= 0) {
                    $status = 'out_of_stock';
                } elseif ($reorder > 0 && $onHand <= $reorder) {
                    $status = 'low_stock';
                }

                return [
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'warehouse' => $row->warehouse_name,
                    'available_qty' => (float) $row->available_qty,
                    'reserved_qty' => (float) $row->reserved_qty,
                    'damaged_qty' => (float) $row->damaged_qty,
                    'total_on_hand' => $onHand,
                    'reorder_level' => $reorder,
                    'status' => $status,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Perpetual stock ledger audit trail from stock_movements.
     */
    public function ledger(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('stock_movements as sm')
            ->join('products as p', 'sm.product_id', '=', 'p.id')
            ->join('warehouses as w', 'sm.warehouse_id', '=', 'w.id')
            ->leftJoin('users as u', 'sm.created_by', '=', 'u.id')
            ->where('sm.tenant_id', $tenantId)
            ->select([
                'sm.id',
                'sm.uuid',
                'sm.movement_number',
                'sm.moved_at',
                'p.sku',
                'p.name as product_name',
                'w.name as warehouse_name',
                'sm.movement_type',
                'sm.direction',
                'sm.quantity',
                'sm.unit_cost',
                'sm.total_cost',
                'sm.balance_after',
                'sm.reference_type',
                'u.name as operator_name',
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('sm.moved_at', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('sm.moved_at', '<=', $filters['end_date']);
        }
        if (!empty($filters['warehouse_id'])) {
            $query->where('sm.warehouse_id', $filters['warehouse_id']);
        }
        if (!empty($filters['product_id'])) {
            $query->where('sm.product_id', $filters['product_id']);
        }
        if (!empty($filters['movement_type'])) {
            $query->where('sm.movement_type', $filters['movement_type']);
        }
        if (!empty($filters['direction'])) {
            $query->where('sm.direction', $filters['direction']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('sm.moved_at', 'desc')
            ->orderBy('sm.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'movement_number' => $row->movement_number,
                    'date' => $row->moved_at,
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'warehouse' => $row->warehouse_name,
                    'type' => ucfirst(str_replace('_', ' ', $row->movement_type)),
                    'direction' => strtoupper($row->direction),
                    'quantity' => (float) $row->quantity,
                    'unit_cost' => (float) $row->unit_cost,
                    'total_cost' => (float) $row->total_cost,
                    'balance_after' => (float) $row->balance_after,
                    'operator' => $row->operator_name ?? 'System',
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Stock movement velocity (inflow vs outflow summary).
     */
    public function movement(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('stock_movements as sm')
            ->join('products as p', 'sm.product_id', '=', 'p.id')
            ->where('sm.tenant_id', $tenantId)
            ->groupBy(['p.id', 'p.sku', 'p.name'])
            ->select([
                'p.id as product_id',
                'p.sku',
                'p.name as product_name',
                DB::raw("SUM(CASE WHEN sm.direction = 'in' THEN sm.quantity ELSE 0 END) as total_in"),
                DB::raw("SUM(CASE WHEN sm.direction = 'out' THEN sm.quantity ELSE 0 END) as total_out"),
                DB::raw('COUNT(sm.id) as total_transactions'),
                DB::raw('MAX(sm.moved_at) as last_movement_at'),
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('sm.moved_at', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('sm.moved_at', '<=', $filters['end_date']);
        }

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_transactions', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $in = (float) $row->total_in;
                $out = (float) $row->total_out;
                $net = $in - $out;

                return [
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'total_in' => $in,
                    'total_out' => $out,
                    'net_change' => $net,
                    'transaction_count' => (int) $row->total_transactions,
                    'last_movement' => $row->last_movement_at,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Low stock items approaching or below reorder threshold.
     */
    public function lowStock(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('products as p')
            ->leftJoin('stock_balances as sb', function ($join) use ($tenantId) {
                $join->on('p.id', '=', 'sb.product_id')
                    ->where('sb.tenant_id', '=', $tenantId);
            })
            ->leftJoin('warehouses as w', 'sb.warehouse_id', '=', 'w.id')
            ->where('p.tenant_id', $tenantId)
            ->where('p.is_stock_tracked', true)
            ->whereNull('p.deleted_at')
            ->groupBy(['p.id', 'p.sku', 'p.name', 'p.reorder_level', 'p.reorder_quantity', 'p.standard_cost'])
            ->havingRaw('COALESCE(SUM(sb.quantity), 0) <= COALESCE(p.reorder_level, 0)')
            ->select([
                'p.id as product_id',
                'p.sku',
                'p.name as product_name',
                'p.reorder_level',
                'p.reorder_quantity',
                'p.standard_cost',
                DB::raw('COALESCE(SUM(sb.quantity), 0) as current_stock'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('current_stock', 'asc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $stock = (float) $row->current_stock;
                $reorder = (float) ($row->reorder_level ?? 0);
                $deficit = max(0, $reorder - $stock);

                return [
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'current_stock' => $stock,
                    'reorder_level' => $reorder,
                    'suggested_reorder_qty' => (float) ($row->reorder_quantity ?? $deficit),
                    'deficit' => $deficit,
                    'unit_cost' => (float) $row->standard_cost,
                    'restock_cost' => (float) (($row->reorder_quantity ?? $deficit) * (float) $row->standard_cost),
                    'status' => $stock <= 0 ? 'critical_out_of_stock' : 'low_stock_warning',
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Completely out-of-stock items that have zero or negative stock.
     */
    public function outOfStock(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('products as p')
            ->leftJoin('stock_balances as sb', function ($join) use ($tenantId) {
                $join->on('p.id', '=', 'sb.product_id')
                    ->where('sb.tenant_id', '=', $tenantId);
            })
            ->leftJoin('categories as c', 'p.category_id', '=', 'c.id')
            ->where('p.tenant_id', $tenantId)
            ->where('p.is_stock_tracked', true)
            ->whereNull('p.deleted_at')
            ->groupBy(['p.id', 'p.sku', 'p.name', 'c.name', 'p.reorder_level', 'p.standard_cost'])
            ->havingRaw('COALESCE(SUM(sb.quantity), 0) <= 0')
            ->select([
                'p.id as product_id',
                'p.sku',
                'p.name as product_name',
                DB::raw("COALESCE(c.name, 'Uncategorized') as category_name"),
                'p.reorder_level',
                'p.standard_cost',
                DB::raw('COALESCE(SUM(sb.quantity), 0) as current_stock'),
            ]);

        if (!empty($filters['category_id'])) {
            $query->where('p.category_id', $filters['category_id']);
        }

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('p.name', 'asc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'category' => $row->category_name,
                    'current_stock' => (float) $row->current_stock,
                    'reorder_level' => (float) ($row->reorder_level ?? 0),
                    'unit_cost' => (float) $row->standard_cost,
                    'stock_status' => 'Out of Stock',
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Stock distribution grouped per warehouse.
     */
    public function warehouseStock(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('stock_balances as sb')
            ->join('warehouses as w', 'sb.warehouse_id', '=', 'w.id')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->where('sb.tenant_id', $tenantId)
            ->where('sb.quantity', '>', 0)
            ->groupBy(['w.id', 'w.name', 'p.id', 'p.sku', 'p.name', 'p.standard_cost'])
            ->select([
                'w.name as warehouse_name',
                'p.sku',
                'p.name as product_name',
                DB::raw("SUM(CASE WHEN sb.stock_state = 'available' THEN sb.quantity ELSE 0 END) as available_qty"),
                DB::raw("SUM(CASE WHEN sb.stock_state = 'reserved' THEN sb.quantity ELSE 0 END) as reserved_qty"),
                DB::raw("SUM(CASE WHEN sb.stock_state = 'damaged' THEN sb.quantity ELSE 0 END) as damaged_qty"),
                DB::raw('SUM(sb.quantity) as total_qty'),
                DB::raw('SUM(COALESCE(sb.total_value, (sb.quantity * COALESCE(p.standard_cost, 0)))) as total_valuation'),
            ]);

        $this->applyBalanceFilters($query, $filters);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('w.name', 'asc')
            ->orderBy('total_valuation', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'warehouse' => $row->warehouse_name,
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'available_qty' => (float) $row->available_qty,
                    'reserved_qty' => (float) $row->reserved_qty,
                    'damaged_qty' => (float) $row->damaged_qty,
                    'total_qty' => (float) $row->total_qty,
                    'total_valuation' => (float) $row->total_valuation,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Inter-warehouse transfer log and status.
     */
    public function warehouseTransfers(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('stock_transfers as st')
            ->join('warehouses as wf', 'st.from_warehouse_id', '=', 'wf.id')
            ->join('warehouses as wt', 'st.to_warehouse_id', '=', 'wt.id')
            ->leftJoin('users as ud', 'st.dispatched_by', '=', 'ud.id')
            ->leftJoin('users as ur', 'st.received_by', '=', 'ur.id')
            ->where('st.tenant_id', $tenantId)
            ->whereNull('st.deleted_at')
            ->select([
                'st.id',
                'st.transfer_number',
                'st.transfer_date',
                'wf.name as from_warehouse',
                'wt.name as to_warehouse',
                'st.status',
                DB::raw("COALESCE(ud.name, '—') as dispatched_by_name"),
                'st.dispatched_at',
                DB::raw("COALESCE(ur.name, '—') as received_by_name"),
                'st.received_at',
                'st.notes',
            ]);

        if (!empty($filters['status'])) {
            $query->where('st.status', $filters['status']);
        }
        if (!empty($filters['from_warehouse_id'])) {
            $query->where('st.from_warehouse_id', $filters['from_warehouse_id']);
        }
        if (!empty($filters['to_warehouse_id'])) {
            $query->where('st.to_warehouse_id', $filters['to_warehouse_id']);
        }
        if (!empty($filters['start_date'])) {
            $query->where('st.transfer_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('st.transfer_date', '<=', $filters['end_date']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('st.transfer_date', 'desc')
            ->orderBy('st.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'transfer_number' => $row->transfer_number,
                    'transfer_date' => $row->transfer_date,
                    'from_warehouse' => $row->from_warehouse,
                    'to_warehouse' => $row->to_warehouse,
                    'status' => ucfirst(str_replace('_', ' ', $row->status ?? 'pending')),
                    'dispatched_by' => $row->dispatched_by_name,
                    'dispatched_at' => $row->dispatched_at ?? '—',
                    'received_by' => $row->received_by_name,
                    'received_at' => $row->received_at ?? '—',
                    'notes' => $row->notes ?? '—',
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Raw materials stock valuation and balances.
     */
    public function rawMaterialStock(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->join('warehouses as w', 'sb.warehouse_id', '=', 'w.id')
            ->leftJoin('categories as c', 'p.category_id', '=', 'c.id')
            ->where('sb.tenant_id', $tenantId)
            ->where('p.type', 'raw_material')
            ->where('sb.quantity', '>', 0)
            ->select([
                'p.sku',
                'p.name as product_name',
                DB::raw("COALESCE(c.name, 'Raw Materials') as category_name"),
                'w.name as warehouse_name',
                'sb.batch_code',
                'sb.quantity as quantity_on_hand',
                DB::raw('COALESCE(sb.average_cost, p.standard_cost, 0) as unit_cost'),
                DB::raw('COALESCE(sb.total_value, (sb.quantity * COALESCE(p.standard_cost, 0))) as total_valuation'),
            ]);

        $this->applyBalanceFilters($query, $filters);

        $total = $query->count();

        $rows = $query
            ->orderBy('total_valuation', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'category' => $row->category_name,
                    'warehouse' => $row->warehouse_name,
                    'batch_code' => $row->batch_code ?? '—',
                    'quantity_on_hand' => (float) $row->quantity_on_hand,
                    'unit_cost' => (float) $row->unit_cost,
                    'total_valuation' => (float) $row->total_valuation,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Finished goods stock valuation and balances.
     */
    public function finishedGoodsStock(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->join('warehouses as w', 'sb.warehouse_id', '=', 'w.id')
            ->leftJoin('categories as c', 'p.category_id', '=', 'c.id')
            ->where('sb.tenant_id', $tenantId)
            ->whereIn('p.type', ['finished_goods', 'standard'])
            ->where('sb.quantity', '>', 0)
            ->select([
                'p.sku',
                'p.name as product_name',
                DB::raw("COALESCE(c.name, 'Finished Goods') as category_name"),
                'w.name as warehouse_name',
                'sb.batch_code',
                'sb.quantity as quantity_on_hand',
                DB::raw('COALESCE(sb.average_cost, p.standard_cost, 0) as unit_cost'),
                DB::raw('COALESCE(sb.total_value, (sb.quantity * COALESCE(p.standard_cost, 0))) as total_valuation'),
            ]);

        $this->applyBalanceFilters($query, $filters);

        $total = $query->count();

        $rows = $query
            ->orderBy('total_valuation', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'category' => $row->category_name,
                    'warehouse' => $row->warehouse_name,
                    'batch_code' => $row->batch_code ?? '—',
                    'quantity_on_hand' => (float) $row->quantity_on_hand,
                    'unit_cost' => (float) $row->unit_cost,
                    'total_valuation' => (float) $row->total_valuation,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Damaged or rejected stock inventory tracking.
     */
    public function damagedStock(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->join('warehouses as w', 'sb.warehouse_id', '=', 'w.id')
            ->where('sb.tenant_id', $tenantId)
            ->where('sb.stock_state', 'damaged')
            ->where('sb.quantity', '>', 0)
            ->select([
                'p.sku',
                'p.name as product_name',
                'w.name as warehouse_name',
                'sb.batch_code',
                'sb.quantity as damaged_qty',
                DB::raw('COALESCE(sb.average_cost, p.standard_cost, 0) as unit_cost'),
                DB::raw('COALESCE(sb.total_value, (sb.quantity * COALESCE(p.standard_cost, 0))) as damaged_value'),
            ]);

        $this->applyBalanceFilters($query, $filters);

        $total = $query->count();

        $rows = $query
            ->orderBy('damaged_value', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'warehouse' => $row->warehouse_name,
                    'batch_code' => $row->batch_code ?? '—',
                    'damaged_quantity' => (float) $row->damaged_qty,
                    'unit_cost' => (float) $row->unit_cost,
                    'damaged_valuation' => (float) $row->damaged_value,
                    'condition' => 'Damaged / Write-off Candidate',
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Compute top-level summary metrics across the tenant's inventory.
     */
    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

        $balanceStats = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->where('sb.tenant_id', $tenantId)
            ->select([
                DB::raw('COUNT(DISTINCT sb.product_id) as total_skus'),
                DB::raw('COALESCE(SUM(sb.quantity), 0) as total_quantity'),
                DB::raw('COALESCE(SUM(COALESCE(sb.total_value, (sb.quantity * COALESCE(p.standard_cost, 0)))), 0) as total_valuation'),
            ])
            ->first();

        $lowStockCount = DB::table('products as p')
            ->leftJoin('stock_balances as sb', function ($join) use ($tenantId) {
                $join->on('p.id', '=', 'sb.product_id')
                    ->where('sb.tenant_id', '=', $tenantId);
            })
            ->where('p.tenant_id', $tenantId)
            ->where('p.is_stock_tracked', true)
            ->whereNull('p.deleted_at')
            ->groupBy(['p.id', 'p.reorder_level'])
            ->havingRaw('COALESCE(SUM(sb.quantity), 0) <= COALESCE(p.reorder_level, 0)')
            ->select('p.id')
            ->get()
            ->count();

        return [
            'total_valuation' => (float) ($balanceStats->total_valuation ?? 0),
            'total_quantity' => (float) ($balanceStats->total_quantity ?? 0),
            'total_skus' => (int) ($balanceStats->total_skus ?? 0),
            'low_stock_alerts' => $lowStockCount,
        ];
    }

    protected function applyBalanceFilters($query, array $filters): void
    {
        if (!empty($filters['warehouse_id'])) {
            $query->where('sb.warehouse_id', $filters['warehouse_id']);
        }
        if (!empty($filters['product_id'])) {
            $query->where('sb.product_id', $filters['product_id']);
        }
        if (!empty($filters['category_id'])) {
            $query->where('p.category_id', $filters['category_id']);
        }
    }
}
