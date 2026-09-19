<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use Illuminate\Support\Facades\DB;

class SalesPerformanceReportQuery implements ReportQueryInterface
{
    public function columns(): array
    {
        return [
            'order_number' => ['label' => 'Order Number', 'type' => 'string', 'sortable' => true],
            'order_date' => ['label' => 'Date', 'type' => 'date', 'sortable' => true],
            'channel' => ['label' => 'Channel', 'type' => 'badge'],
            'customer_name' => ['label' => 'Customer', 'type' => 'string'],
            'subtotal' => ['label' => 'Subtotal (BDT)', 'type' => 'currency'],
            'tax_amount' => ['label' => 'Tax (BDT)', 'type' => 'currency'],
            'grand_total' => ['label' => 'Grand Total (BDT)', 'type' => 'currency'],
            'payment_status' => ['label' => 'Payment Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = \App\Core\Tenancy\TenantContext::isBound()
            ? \App\Core\Tenancy\TenantContext::current()->tenantId()
            : (auth()->user()?->tenant_id ?? (int) config('app.default_tenant_id', 1));

        $query = DB::table('sales_orders as so')
            ->leftJoin('parties as p', 'so.customer_party_id', '=', 'p.id')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->select([
                'so.id',
                'so.uuid',
                'so.order_number',
                'so.order_date',
                'so.channel',
                'p.name as customer_name',
                'so.subtotal',
                'so.tax_amount',
                'so.grand_total',
                'so.payment_status',
            ]);

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

        $total = $query->count();
        $rows = $query->orderBy('so.order_date', 'desc')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        $data = $rows->map(function ($row): array {
            return [
                'id' => $row->id,
                'uuid' => $row->uuid,
                'order_number' => $row->order_number,
                'order_date' => $row->order_date,
                'channel' => $row->channel,
                'customer_name' => $row->customer_name ?? 'Counter Customer',
                'subtotal' => number_format((float) $row->subtotal, 4, '.', ''),
                'tax_amount' => number_format((float) ($row->tax_amount ?? 0), 4, '.', ''),
                'grand_total' => number_format((float) $row->grand_total, 4, '.', ''),
                'payment_status' => $row->payment_status,
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
        $tenantId = $filters['tenant_id'] ?? auth()->user()?->tenant_id ?? 1;

        $query = DB::table('sales_orders as so')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at');

        if (!empty($filters['start_date'])) {
            $query->where('so.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('so.order_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['channel'])) {
            $query->where('so.channel', $filters['channel']);
        }

        $stats = $query->selectRaw('
            COUNT(so.id) as total_orders,
            COALESCE(SUM(so.subtotal), 0) as total_subtotal,
            COALESCE(SUM(so.tax_amount), 0) as total_tax,
            COALESCE(SUM(so.grand_total), 0) as total_revenue
        ')->first();

        return [
            'total_orders' => (int) ($stats->total_orders ?? 0),
            'total_subtotal' => number_format((float) ($stats->total_subtotal ?? 0), 4, '.', ''),
            'total_tax' => number_format((float) ($stats->total_tax ?? 0), 4, '.', ''),
            'total_revenue' => number_format((float) ($stats->total_revenue ?? 0), 4, '.', ''),
        ];
    }
}
