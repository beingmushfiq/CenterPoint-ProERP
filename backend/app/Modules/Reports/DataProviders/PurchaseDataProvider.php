<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class PurchaseDataProvider extends BaseDataProvider
{
    /**
     * Overview of purchase orders with status, supplier, and financial amounts.
     */
    public function orderSummary(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_orders as po')
            ->join('parties as p', 'po.party_id', '=', 'p.id')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->select([
                'po.id',
                'po.po_number',
                'po.order_date',
                'po.expected_date',
                'p.name as supplier_name',
                'po.subtotal',
                'po.tax_amount',
                'po.total_amount',
                'po.received_value',
                'po.billed_value',
                'po.payment_terms',
                'po.status',
            ]);

        $this->applyOrderFilters($query, $filters);

        $total = $query->count();

        $rows = $query
            ->orderBy('po.order_date', 'desc')
            ->orderBy('po.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'po_number' => $row->po_number,
                    'order_date' => $row->order_date,
                    'expected_date' => $row->expected_date ?? '—',
                    'supplier_name' => $row->supplier_name,
                    'total_amount' => (float) $row->total_amount,
                    'received_value' => (float) $row->received_value,
                    'billed_value' => (float) $row->billed_value,
                    'payment_terms' => $row->payment_terms ?? 'Net 30',
                    'status' => $row->status,
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
     * Line-item purchase details comparing ordered quantities vs received goods.
     */
    public function orderDetails(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_order_items as poi')
            ->join('purchase_orders as po', 'poi.purchase_order_id', '=', 'po.id')
            ->join('parties as p', 'po.party_id', '=', 'p.id')
            ->join('products as pr', 'poi.product_id', '=', 'pr.id')
            ->where('poi.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->select([
                'poi.id',
                'po.po_number',
                'po.order_date',
                'p.name as supplier_name',
                'pr.sku',
                'pr.name as product_name',
                'poi.quantity as ordered_quantity',
                'poi.received_quantity',
                'poi.unit_price',
                'poi.line_total',
                'po.status as po_status',
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('po.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('po.order_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['supplier_id'])) {
            $query->where('po.party_id', $filters['supplier_id']);
        }
        if (!empty($filters['product_id'])) {
            $query->where('poi.product_id', $filters['product_id']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('po.order_date', 'desc')
            ->orderBy('poi.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $ordered = (float) $row->ordered_quantity;
                $received = (float) ($row->received_quantity ?? 0);
                $pending = max(0, $ordered - $received);

                return [
                    'po_number' => $row->po_number,
                    'order_date' => $row->order_date,
                    'supplier_name' => $row->supplier_name,
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'ordered_quantity' => $ordered,
                    'received_quantity' => $received,
                    'pending_quantity' => $pending,
                    'unit_price' => (float) $row->unit_price,
                    'line_total' => (float) $row->line_total,
                    'status' => $row->po_status,
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
     * Supplier-wise procurement volume, order frequency, and financial spend.
     */
    public function bySupplier(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_orders as po')
            ->join('parties as p', 'po.party_id', '=', 'p.id')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->groupBy(['p.id', 'p.code', 'p.name'])
            ->select([
                'p.id as supplier_id',
                'p.code as supplier_code',
                'p.name as supplier_name',
                DB::raw('COUNT(po.id) as total_orders'),
                DB::raw('SUM(po.total_amount) as total_spend'),
                DB::raw('SUM(po.received_value) as total_received_value'),
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('po.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('po.order_date', '<=', $filters['end_date']);
        }

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_spend', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $orders = (int) $row->total_orders;
                $spend = (float) $row->total_spend;
                $aov = $orders > 0 ? round($spend / $orders, 2) : 0.0;

                return [
                    'supplier_code' => $row->supplier_code,
                    'supplier_name' => $row->supplier_name,
                    'total_orders' => $orders,
                    'total_spend' => $spend,
                    'average_po_value' => $aov,
                    'received_value' => (float) $row->total_received_value,
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
     * Outstanding supplier payables and AP ledger.
     */
    public function supplierDue(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_orders as po')
            ->join('parties as p', 'po.party_id', '=', 'p.id')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->whereNotIn('po.status', ['cancelled', 'draft'])
            ->groupBy(['p.id', 'p.code', 'p.name'])
            ->select([
                'p.id as supplier_id',
                'p.code as supplier_code',
                'p.name as supplier_name',
                DB::raw('COUNT(po.id) as active_pos'),
                DB::raw('SUM(po.total_amount) as total_po_amount'),
                DB::raw('SUM(po.billed_value) as total_billed_amount'),
                DB::raw('SUM(po.received_value) as total_received_amount'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_po_amount', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $totalAmt = (float) $row->total_po_amount;
                $billed = (float) $row->total_billed_amount;
                $received = (float) $row->total_received_amount;
                $outstanding = max(0, $totalAmt - $billed);

                return [
                    'supplier_code' => $row->supplier_code,
                    'supplier_name' => $row->supplier_name,
                    'active_pos' => (int) $row->active_pos,
                    'total_po_amount' => $totalAmt,
                    'received_amount' => $received,
                    'billed_amount' => $billed,
                    'outstanding_due' => $outstanding,
                    'status' => $outstanding > 0 ? 'payable_pending' : 'settled',
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
     * High-level summary metrics across the tenant's purchasing operations.
     */
    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_orders as po')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at');

        $this->applyOrderFilters($query, $filters);

        $stats = $query->selectRaw('
            COUNT(po.id) as total_orders,
            COALESCE(SUM(po.total_amount), 0) as total_procurement_amount,
            COALESCE(SUM(po.received_value), 0) as total_received_value,
            COALESCE(SUM(po.billed_value), 0) as total_billed_value
        ')->first();

        $totalSpend = (float) ($stats->total_procurement_amount ?? 0);
        $billed = (float) ($stats->total_billed_value ?? 0);
        $outstanding = max(0, $totalSpend - $billed);

        return [
            'total_pos' => (int) ($stats->total_orders ?? 0),
            'total_procurement_spend' => $totalSpend,
            'total_received_value' => (float) ($stats->total_received_value ?? 0),
            'outstanding_ap_due' => $outstanding,
        ];
    }

    protected function applyOrderFilters($query, array $filters): void
    {
        if (!empty($filters['start_date'])) {
            $query->where('po.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('po.order_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['supplier_id'])) {
            $query->where('po.party_id', $filters['supplier_id']);
        }
        if (!empty($filters['status'])) {
            $query->where('po.status', $filters['status']);
        }
    }
}
