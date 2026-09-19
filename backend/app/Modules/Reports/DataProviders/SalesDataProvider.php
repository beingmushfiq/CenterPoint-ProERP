<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class SalesDataProvider extends BaseDataProvider
{
    /**
     * Order-level sales performance report.
     */
    public function performance(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->leftJoin('parties as p', 'so.party_id', '=', 'p.id')
            ->leftJoin('users as u', 'so.salesperson_id', '=', 'u.id')
            ->leftJoin('branches as b', 'so.branch_id', '=', 'b.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->select([
                'so.id',
                'so.uuid',
                'so.order_number',
                'so.order_date',
                'so.channel',
                DB::raw("COALESCE(p.name, so.customer_name, 'Walk-in Customer') as customer_name"),
                'so.customer_phone',
                'u.name as salesperson_name',
                'b.name as branch_name',
                'so.subtotal',
                'so.discount_amount',
                'so.tax_amount',
                'so.total_amount',
                'so.paid_amount',
                'so.due_amount',
                'so.status',
                'so.payment_status',
            ]);

        $this->applyFilters($query, $filters);

        $total = $query->count();

        $rows = $query
            ->orderBy('so.order_date', 'desc')
            ->orderBy('so.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'id' => $row->id,
                    'uuid' => $row->uuid,
                    'order_number' => $row->order_number,
                    'order_date' => $row->order_date,
                    'channel' => ucfirst($row->channel ?? 'counter'),
                    'customer_name' => $row->customer_name,
                    'customer_phone' => $row->customer_phone ?? '—',
                    'salesperson' => $row->salesperson_name ?? 'Direct',
                    'branch' => $row->branch_name ?? 'Main Branch',
                    'subtotal' => (float) $row->subtotal,
                    'discount_amount' => (float) $row->discount_amount,
                    'tax_amount' => (float) $row->tax_amount,
                    'grand_total' => (float) $row->total_amount,
                    'paid_amount' => (float) $row->paid_amount,
                    'due_amount' => (float) $row->due_amount,
                    'status' => $row->status,
                    'payment_status' => $row->payment_status,
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
     * Sales grouped by product with quantity, revenue, COGS, and profit margin.
     */
    public function byProduct(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_order_items as soi')
            ->join('sales_orders as so', 'soi.sales_order_id', '=', 'so.id')
            ->join('products as p', 'soi.product_id', '=', 'p.id')
            ->leftJoin('categories as c', 'p.category_id', '=', 'c.id')
            ->where('soi.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNull('soi.deleted_at')
            ->groupBy(['p.id', 'p.sku', 'p.name', 'c.name', 'p.standard_cost'])
            ->select([
                'p.id as product_id',
                'p.sku',
                'p.name as product_name',
                DB::raw("COALESCE(c.name, 'Uncategorized') as category_name"),
                'p.standard_cost',
                DB::raw('COUNT(DISTINCT so.id) as total_orders'),
                DB::raw('SUM(soi.quantity) as total_quantity_sold'),
                DB::raw('SUM(soi.line_total) as total_revenue'),
                DB::raw('SUM(soi.quantity * COALESCE(p.standard_cost, 0)) as total_cogs'),
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('so.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('so.order_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['category_id'])) {
            $query->where('p.category_id', $filters['category_id']);
        }

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_revenue', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $revenue = (float) $row->total_revenue;
                $cogs = (float) $row->total_cogs;
                $profit = $revenue - $cogs;
                $margin = $revenue > 0 ? round(($profit / $revenue) * 100, 2) : 0.0;

                return [
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'category' => $row->category_name,
                    'orders_count' => (int) $row->total_orders,
                    'quantity_sold' => (float) $row->total_quantity_sold,
                    'unit_cost' => (float) $row->standard_cost,
                    'total_revenue' => $revenue,
                    'total_cogs' => $cogs,
                    'gross_profit' => $profit,
                    'margin_percent' => $margin,
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
     * Sales grouped by customer party.
     */
    public function byCustomer(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->leftJoin('parties as p', 'so.party_id', '=', 'p.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->groupBy(['so.party_id', 'p.name', 'p.phone', 'p.type'])
            ->select([
                'so.party_id',
                DB::raw("COALESCE(p.name, 'Walk-in Customers') as customer_name"),
                DB::raw("COALESCE(p.phone, '—') as customer_phone"),
                DB::raw("COALESCE(p.type, 'business') as customer_type"),
                DB::raw('COUNT(so.id) as order_count'),
                DB::raw('SUM(so.total_amount) as total_spend'),
                DB::raw('SUM(so.paid_amount) as total_paid'),
                DB::raw('SUM(so.due_amount) as total_due'),
                DB::raw('MAX(so.order_date) as last_order_date'),
            ]);

        $this->applyFilters($query, $filters);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_spend', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $spend = (float) $row->total_spend;
                $count = (int) $row->order_count;
                $aov = $count > 0 ? round($spend / $count, 2) : 0.0;

                return [
                    'customer_name' => $row->customer_name,
                    'phone' => $row->customer_phone,
                    'tier' => ucfirst($row->customer_type),
                    'total_orders' => $count,
                    'total_spend' => $spend,
                    'total_paid' => (float) $row->total_paid,
                    'total_due' => (float) $row->total_due,
                    'average_order_value' => $aov,
                    'last_order_date' => $row->last_order_date,
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
     * Sales performance by salesperson.
     */
    public function bySalesman(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->leftJoin('users as u', 'so.salesperson_id', '=', 'u.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->groupBy(['so.salesperson_id', 'u.name', 'u.email'])
            ->select([
                'so.salesperson_id',
                DB::raw("COALESCE(u.name, 'Direct / Online Sales') as salesman_name"),
                DB::raw("COALESCE(u.email, '—') as salesman_email"),
                DB::raw('COUNT(so.id) as total_orders'),
                DB::raw('SUM(so.total_amount) as total_revenue'),
                DB::raw('SUM(so.paid_amount) as total_collected'),
                DB::raw('AVG(so.total_amount) as avg_order_value'),
            ]);

        $this->applyFilters($query, $filters);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_revenue', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'salesperson' => $row->salesman_name,
                    'email' => $row->salesman_email,
                    'orders_count' => (int) $row->total_orders,
                    'total_revenue' => (float) $row->total_revenue,
                    'total_collected' => (float) $row->total_collected,
                    'average_order_value' => round((float) $row->avg_order_value, 2),
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
     * Compute top-level KPI metrics across all matching sales records.
     */
    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at');

        $this->applyFilters($query, $filters);

        $orderStats = (clone $query)->select([
            DB::raw('COUNT(so.id) as total_orders'),
            DB::raw('COALESCE(SUM(so.total_amount), 0) as total_revenue'),
            DB::raw('COALESCE(SUM(so.paid_amount), 0) as total_collected'),
            DB::raw('COALESCE(SUM(so.due_amount), 0) as total_due'),
            DB::raw('COALESCE(SUM(so.tax_amount), 0) as total_tax'),
            DB::raw('COALESCE(SUM(so.discount_amount), 0) as total_discounts'),
        ])->first();

        // Calculate COGS from line items
        $cogsQuery = DB::table('sales_order_items as soi')
            ->join('sales_orders as so', 'soi.sales_order_id', '=', 'so.id')
            ->join('products as p', 'soi.product_id', '=', 'p.id')
            ->where('soi.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNull('soi.deleted_at');

        $this->applyFilters($cogsQuery, $filters);

        $totalCogs = (float) $cogsQuery->sum(DB::raw('soi.quantity * COALESCE(p.standard_cost, 0)'));

        $totalRevenue = (float) ($orderStats->total_revenue ?? 0);
        $totalOrders = (int) ($orderStats->total_orders ?? 0);
        $grossProfit = $totalRevenue - $totalCogs;
        $grossMargin = $totalRevenue > 0 ? round(($grossProfit / $totalRevenue) * 100, 2) : 0.0;
        $avgOrderValue = $totalOrders > 0 ? round($totalRevenue / $totalOrders, 2) : 0.0;
        $collectionRate = $totalRevenue > 0 ? round(((float) $orderStats->total_collected / $totalRevenue) * 100, 2) : 0.0;

        return [
            'total_revenue' => $totalRevenue,
            'total_orders' => $totalOrders,
            'total_cogs' => $totalCogs,
            'gross_profit' => $grossProfit,
            'gross_margin_percentage' => $grossMargin,
            'average_order_value' => $avgOrderValue,
            'total_collected' => (float) ($orderStats->total_collected ?? 0),
            'total_outstanding' => (float) ($orderStats->total_due ?? 0),
            'total_tax' => (float) ($orderStats->total_tax ?? 0),
            'collection_rate' => $collectionRate,
        ];
    }

    /**
     * Apply common tenant-safe filters.
     */
    protected function applyFilters($query, array $filters): void
    {
        if (!empty($filters['start_date'])) {
            $query->where('so.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('so.order_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['channel'])) {
            $query->where('so.channel', $filters['channel']);
        }
        if (!empty($filters['payment_status'])) {
            $query->where('so.payment_status', $filters['payment_status']);
        }
        if (!empty($filters['status'])) {
            $query->where('so.status', $filters['status']);
        }
        if (!empty($filters['branch_id'])) {
            $query->where('so.branch_id', $filters['branch_id']);
        }
        if (!empty($filters['warehouse_id'])) {
            $query->where('so.warehouse_id', $filters['warehouse_id']);
        }
        if (!empty($filters['salesperson_id'])) {
            $query->where('so.salesperson_id', $filters['salesperson_id']);
        }
        if (!empty($filters['party_id'])) {
            $query->where('so.party_id', $filters['party_id']);
        }
    }
}
