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
     * Daily aggregated sales revenue and volume.
     */
    public function dailySales(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'draft'])
            ->groupBy('so.order_date')
            ->select([
                'so.order_date',
                DB::raw('COUNT(so.id) as orders_count'),
                DB::raw('COALESCE(SUM(so.subtotal), 0) as total_subtotal'),
                DB::raw('COALESCE(SUM(so.discount_amount), 0) as total_discount'),
                DB::raw('COALESCE(SUM(so.tax_amount), 0) as total_tax'),
                DB::raw('COALESCE(SUM(so.total_amount), 0) as total_revenue'),
                DB::raw('COALESCE(SUM(so.paid_amount), 0) as total_collected'),
                DB::raw('COALESCE(SUM(so.due_amount), 0) as total_due'),
            ]);

        $this->applyFilters($query, $filters);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('so.order_date', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'order_date' => $row->order_date,
                    'orders_count' => (int) $row->orders_count,
                    'subtotal' => (float) $row->total_subtotal,
                    'discount_amount' => (float) $row->total_discount,
                    'tax_amount' => (float) $row->total_tax,
                    'total_revenue' => (float) $row->total_revenue,
                    'collected_amount' => (float) $row->total_collected,
                    'due_amount' => (float) $row->total_due,
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
     * Monthly aggregated sales revenue and volume.
     */
    public function monthlySales(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'draft'])
            ->groupBy(DB::raw("SUBSTR(so.order_date, 1, 7)"))
            ->select([
                DB::raw("SUBSTR(so.order_date, 1, 7) as month_period"),
                DB::raw('COUNT(so.id) as orders_count'),
                DB::raw('COALESCE(SUM(so.total_amount), 0) as total_revenue'),
                DB::raw('COALESCE(SUM(so.paid_amount), 0) as total_collected'),
                DB::raw('COALESCE(SUM(so.due_amount), 0) as total_due'),
            ]);

        $this->applyFilters($query, $filters);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('month_period', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'month' => $row->month_period,
                    'orders_count' => (int) $row->orders_count,
                    'total_revenue' => (float) $row->total_revenue,
                    'collected_amount' => (float) $row->total_collected,
                    'due_amount' => (float) $row->total_due,
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
     * B2B wholesale orders and client performance.
     */
    public function b2bSales(array $filters, int $page = 1, int $perPage = 25): array
    {
        $filters['channel'] = 'b2b';
        return $this->performance($filters, $page, $perPage);
    }

    /**
     * B2C direct customer orders and revenue.
     */
    public function b2cSales(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->leftJoin('parties as p', 'so.party_id', '=', 'p.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereIn('so.channel', ['b2c', 'online', 'storefront', 'counter', 'pos'])
            ->select([
                'so.id',
                'so.order_number',
                'so.order_date',
                'so.channel',
                DB::raw("COALESCE(p.name, so.customer_name, 'Retail Customer') as customer_name"),
                'so.customer_phone',
                'so.total_amount',
                'so.paid_amount',
                'so.payment_status',
                'so.status',
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
                    'order_number' => $row->order_number,
                    'order_date' => $row->order_date,
                    'channel' => ucfirst($row->channel ?? 'retail'),
                    'customer_name' => $row->customer_name,
                    'phone' => $row->customer_phone ?? '—',
                    'grand_total' => (float) $row->total_amount,
                    'paid_amount' => (float) $row->paid_amount,
                    'payment_status' => ucfirst($row->payment_status ?? 'paid'),
                    'status' => ucfirst($row->status ?? 'completed'),
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
     * POS Counter Register Sales.
     */
    public function posCounterSales(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->leftJoin('users as u', 'so.salesperson_id', '=', 'u.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->where(function ($q) {
                $q->whereIn('so.channel', ['pos', 'counter'])
                    ->orWhereNotNull('so.pos_session_id');
            })
            ->select([
                'so.id',
                'so.order_number',
                'so.order_date',
                DB::raw("COALESCE(so.customer_name, 'Walk-in Customer') as customer_name"),
                DB::raw("COALESCE(u.name, 'Cashier') as cashier_name"),
                'so.subtotal',
                'so.discount_amount',
                'so.tax_amount',
                'so.total_amount',
                'so.paid_amount',
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
                    'order_number' => $row->order_number,
                    'order_date' => $row->order_date,
                    'customer_name' => $row->customer_name,
                    'cashier' => $row->cashier_name,
                    'subtotal' => (float) $row->subtotal,
                    'discount_amount' => (float) $row->discount_amount,
                    'tax_amount' => (float) $row->tax_amount,
                    'total_amount' => (float) $row->total_amount,
                    'paid_amount' => (float) $row->paid_amount,
                    'payment_status' => ucfirst($row->payment_status ?? 'paid'),
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
     * Sales returns and credit note audit trail.
     */
    public function salesReturn(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_returns as sr')
            ->leftJoin('parties as p', 'sr.party_id', '=', 'p.id')
            ->leftJoin('warehouses as w', 'sr.warehouse_id', '=', 'w.id')
            ->leftJoin('reason_codes as rc', 'sr.reason_code_id', '=', 'rc.id')
            ->where('sr.tenant_id', $tenantId)
            ->whereNull('sr.deleted_at')
            ->select([
                'sr.id',
                'sr.return_number',
                'sr.return_date',
                DB::raw("COALESCE(p.name, 'Customer') as customer_name"),
                DB::raw("COALESCE(w.name, 'Main Warehouse') as warehouse_name"),
                'sr.credit_note_number',
                'sr.subtotal',
                'sr.tax_amount',
                'sr.total_amount',
                DB::raw("COALESCE(rc.name, 'Customer Return') as return_reason"),
                'sr.status',
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('sr.return_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('sr.return_date', '<=', $filters['end_date']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('sr.return_date', 'desc')
            ->orderBy('sr.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'return_number' => $row->return_number,
                    'return_date' => $row->return_date,
                    'customer_name' => $row->customer_name,
                    'warehouse_name' => $row->warehouse_name,
                    'credit_note_number' => $row->credit_note_number ?? '—',
                    'subtotal' => (float) $row->subtotal,
                    'tax_amount' => (float) $row->tax_amount,
                    'total_amount' => (float) $row->total_amount,
                    'reason' => $row->return_reason,
                    'status' => ucfirst($row->status ?? 'approved'),
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
     * Profit analysis broken down by invoice / order.
     */
    public function invoiceProfit(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->leftJoin('parties as p', 'so.party_id', '=', 'p.id')
            ->leftJoin('sales_order_items as soi', 'so.id', '=', 'soi.sales_order_id')
            ->leftJoin('products as pr', 'soi.product_id', '=', 'pr.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'draft'])
            ->groupBy(['so.id', 'so.order_number', 'so.order_date', 'so.total_amount', 'p.name', 'so.customer_name'])
            ->select([
                'so.id',
                'so.order_number',
                'so.order_date',
                DB::raw("COALESCE(p.name, so.customer_name, 'Customer') as customer_name"),
                'so.total_amount as revenue',
                DB::raw('COALESCE(SUM(soi.quantity * COALESCE(pr.standard_cost, 0)), 0) as total_cogs'),
            ]);

        $this->applyFilters($query, $filters);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('so.order_date', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $rev = (float) $row->revenue;
                $cogs = (float) $row->total_cogs;
                $profit = $rev - $cogs;
                $margin = $rev > 0 ? round(($profit / $rev) * 100, 2) : 0.0;

                return [
                    'order_number' => $row->order_number,
                    'order_date' => $row->order_date,
                    'customer_name' => $row->customer_name,
                    'revenue' => $rev,
                    'cost_of_goods' => $cogs,
                    'gross_profit' => $profit,
                    'margin_percent' => "{$margin}%",
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
     * Profit analysis broken down by product.
     */
    public function productProfit(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->byProduct($filters, $page, $perPage);
    }

    /**
     * Profit contribution by sales representative.
     */
    public function salesmanProfitability(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->bySalesman($filters, $page, $perPage);
    }

    /**
     * Daily aggregated profitability.
     */
    public function dailyProfit(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->leftJoin('sales_order_items as soi', 'so.id', '=', 'soi.sales_order_id')
            ->leftJoin('products as pr', 'soi.product_id', '=', 'pr.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'draft'])
            ->groupBy('so.order_date')
            ->select([
                'so.order_date',
                DB::raw('COUNT(DISTINCT so.id) as orders_count'),
                DB::raw('COALESCE(SUM(so.total_amount), 0) as total_revenue'),
                DB::raw('COALESCE(SUM(soi.quantity * COALESCE(pr.standard_cost, 0)), 0) as total_cogs'),
            ]);

        $this->applyFilters($query, $filters);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('so.order_date', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $rev = (float) $row->total_revenue;
                $cogs = (float) $row->total_cogs;
                $profit = $rev - $cogs;
                $margin = $rev > 0 ? round(($profit / $rev) * 100, 2) : 0.0;

                return [
                    'date' => $row->order_date,
                    'orders_count' => (int) $row->orders_count,
                    'revenue' => $rev,
                    'cost_of_goods' => $cogs,
                    'gross_profit' => $profit,
                    'margin_percent' => "{$margin}%",
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
     * Monthly aggregated profitability.
     */
    public function monthlyProfit(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->leftJoin('sales_order_items as soi', 'so.id', '=', 'soi.sales_order_id')
            ->leftJoin('products as pr', 'soi.product_id', '=', 'pr.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'draft'])
            ->groupBy(DB::raw("SUBSTR(so.order_date, 1, 7)"))
            ->select([
                DB::raw("SUBSTR(so.order_date, 1, 7) as month_period"),
                DB::raw('COUNT(DISTINCT so.id) as orders_count'),
                DB::raw('COALESCE(SUM(so.total_amount), 0) as total_revenue'),
                DB::raw('COALESCE(SUM(soi.quantity * COALESCE(pr.standard_cost, 0)), 0) as total_cogs'),
            ]);

        $this->applyFilters($query, $filters);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('month_period', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $rev = (float) $row->total_revenue;
                $cogs = (float) $row->total_cogs;
                $profit = $rev - $cogs;
                $margin = $rev > 0 ? round(($profit / $rev) * 100, 2) : 0.0;

                return [
                    'month' => $row->month_period,
                    'orders_count' => (int) $row->orders_count,
                    'revenue' => $rev,
                    'cost_of_goods' => $cogs,
                    'gross_profit' => $profit,
                    'margin_percent' => "{$margin}%",
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
     * Salesman quota achievement vs target.
     */
    public function salesmanQuotaAchievement(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->join('users as u', 'so.salesperson_id', '=', 'u.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'draft'])
            ->groupBy(['u.id', 'u.name'])
            ->select([
                'u.id as salesman_id',
                'u.name as salesman_name',
                DB::raw('COUNT(so.id) as orders_closed'),
                DB::raw('COALESCE(SUM(so.total_amount), 0) as achieved_revenue'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $targetPerSalesman = 500000.0;

        $rows = $query
            ->orderBy('achieved_revenue', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row) use ($targetPerSalesman): array {
                $achieved = (float) $row->achieved_revenue;
                $rate = $targetPerSalesman > 0 ? round(($achieved / $targetPerSalesman) * 100, 2) : 100.0;

                return [
                    'salesman_name' => $row->salesman_name,
                    'orders_closed' => (int) $row->orders_closed,
                    'target_quota' => $targetPerSalesman,
                    'achieved_revenue' => $achieved,
                    'achievement_percent' => "{$rate}%",
                    'status' => $rate >= 100 ? 'Quota Met' : ($rate >= 75 ? 'Pacing Well' : 'Under Quota'),
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
     * Salesman remaining target gap analysis.
     */
    public function salesmanRemainingTarget(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->join('users as u', 'so.salesperson_id', '=', 'u.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'draft'])
            ->groupBy(['u.id', 'u.name'])
            ->select([
                'u.id as salesman_id',
                'u.name as salesman_name',
                DB::raw('COALESCE(SUM(so.total_amount), 0) as achieved_revenue'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $target = 500000.0;

        $rows = $query
            ->orderBy('achieved_revenue', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row) use ($target): array {
                $achieved = (float) $row->achieved_revenue;
                $gap = max(0, $target - $achieved);

                return [
                    'salesman_name' => $row->salesman_name,
                    'monthly_target' => $target,
                    'achieved_amount' => $achieved,
                    'remaining_gap' => $gap,
                    'status' => $gap === 0.0 ? 'Goal Surpassed' : 'Target Deficit',
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
     * Salesman gross profit contribution.
     */
    public function salesmanProfitContribution(array $filters, int $page = 1, int $perPage = 25): array
    {
        return $this->bySalesman($filters, $page, $perPage);
    }

    /**
     * Salesman incentive and commission accrual.
     */
    public function salesmanIncentiveAccrual(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->join('users as u', 'so.salesperson_id', '=', 'u.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'draft'])
            ->groupBy(['u.id', 'u.name'])
            ->select([
                'u.id as salesman_id',
                'u.name as salesman_name',
                DB::raw('COUNT(so.id) as orders_count'),
                DB::raw('COALESCE(SUM(so.total_amount), 0) as total_sales'),
                DB::raw('COALESCE(SUM(so.paid_amount), 0) as collected_sales'),
                DB::raw('COALESCE(SUM(so.paid_amount * 0.03), 0) as accrued_incentive'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('accrued_incentive', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'salesman_name' => $row->salesman_name,
                    'orders_count' => (int) $row->orders_count,
                    'total_sales' => (float) $row->total_sales,
                    'collected_sales' => (float) $row->collected_sales,
                    'incentive_rate' => '3.00%',
                    'accrued_incentive' => (float) $row->accrued_incentive,
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
     * Salesman rank leaderboard.
     */
    public function salesmanLeaderboard(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('sales_orders as so')
            ->join('users as u', 'so.salesperson_id', '=', 'u.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'draft'])
            ->groupBy(['u.id', 'u.name'])
            ->select([
                'u.id as salesman_id',
                'u.name as salesman_name',
                DB::raw('COUNT(so.id) as deals_count'),
                DB::raw('COALESCE(SUM(so.total_amount), 0) as total_volume'),
                DB::raw('COALESCE(AVG(so.total_amount), 0) as avg_deal_size'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rank = ($page - 1) * $perPage + 1;

        $rows = $query
            ->orderBy('total_volume', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row) use (&$rank): array {
                return [
                    'rank' => '#' . ($rank++),
                    'salesman_name' => $row->salesman_name,
                    'deals_closed' => (int) $row->deals_count,
                    'total_volume' => (float) $row->total_volume,
                    'average_deal_size' => round((float) $row->avg_deal_size, 2),
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
