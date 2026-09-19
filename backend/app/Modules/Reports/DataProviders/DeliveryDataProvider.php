<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class DeliveryDataProvider extends BaseDataProvider
{
    /**
     * Pending dispatches staged for courier pickup or in transit.
     */
    public function pendingDispatches(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('delivery_orders as do')
            ->leftJoin('sales_orders as so', 'do.sales_order_id', '=', 'so.id')
            ->leftJoin('warehouses as w', 'do.warehouse_id', '=', 'w.id')
            ->leftJoin('courier_providers as cp', 'do.courier_provider_id', '=', 'cp.id')
            ->where('do.tenant_id', $tenantId)
            ->whereIn('do.status', ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'])
            ->whereNull('do.deleted_at')
            ->select([
                'do.id',
                'do.delivery_number',
                'so.order_number',
                'do.recipient_name',
                'do.recipient_phone',
                'w.name as warehouse_name',
                DB::raw("COALESCE(cp.name, 'In-House Fleet') as courier_name"),
                'do.delivery_type',
                'do.cod_amount',
                'do.scheduled_date',
                'do.status',
            ]);

        if (!empty($filters['courier_provider_id'])) {
            $query->where('do.courier_provider_id', $filters['courier_provider_id']);
        }
        if (!empty($filters['warehouse_id'])) {
            $query->where('do.warehouse_id', $filters['warehouse_id']);
        }

        $total = (clone $query)->count();

        $rows = $query->orderBy('do.created_at', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'delivery_number' => $row->delivery_number,
                    'order_number' => $row->order_number ?? 'N/A',
                    'recipient_name' => $row->recipient_name,
                    'recipient_phone' => $row->recipient_phone,
                    'warehouse_name' => $row->warehouse_name ?? 'Primary Depot',
                    'courier_name' => $row->courier_name,
                    'delivery_type' => ucfirst(str_replace('_', ' ', (string) $row->delivery_type)),
                    'cod_amount' => number_format((float) $row->cod_amount, 2, '.', ''),
                    'scheduled_date' => $row->scheduled_date ?? 'Unscheduled',
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
     * Successfully delivered shipments and proof of delivery confirmations.
     */
    public function deliveredOrders(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('delivery_orders as do')
            ->leftJoin('sales_orders as so', 'do.sales_order_id', '=', 'so.id')
            ->leftJoin('courier_providers as cp', 'do.courier_provider_id', '=', 'cp.id')
            ->where('do.tenant_id', $tenantId)
            ->where('do.status', 'delivered')
            ->whereNull('do.deleted_at')
            ->select([
                'do.id',
                'do.delivery_number',
                'so.order_number',
                'do.recipient_name',
                DB::raw("COALESCE(cp.name, 'In-House Fleet') as courier_name"),
                'do.delivered_at',
                'do.cod_amount',
                'do.cod_collected_amount',
                'do.cod_status',
                'do.pod_received_by',
            ]);

        if (!empty($filters['date_from'])) {
            $query->whereDate('do.delivered_at', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->whereDate('do.delivered_at', '<=', $filters['date_to']);
        }

        $total = (clone $query)->count();

        $rows = $query->orderBy('do.delivered_at', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'delivery_number' => $row->delivery_number,
                    'order_number' => $row->order_number ?? 'N/A',
                    'recipient_name' => $row->recipient_name,
                    'courier_name' => $row->courier_name,
                    'delivered_at' => $row->delivered_at ?? 'N/A',
                    'cod_amount' => number_format((float) $row->cod_amount, 2, '.', ''),
                    'cod_collected_amount' => number_format((float) $row->cod_collected_amount, 2, '.', ''),
                    'cod_status' => $row->cod_status,
                    'pod_received_by' => $row->pod_received_by ?? 'Customer',
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
     * Returned consignments (RTO), failed deliveries, and cancellations.
     */
    public function returnedOrders(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('delivery_orders as do')
            ->leftJoin('sales_orders as so', 'do.sales_order_id', '=', 'so.id')
            ->leftJoin('courier_providers as cp', 'do.courier_provider_id', '=', 'cp.id')
            ->where('do.tenant_id', $tenantId)
            ->whereIn('do.status', ['returned', 'cancelled', 'failed'])
            ->whereNull('do.deleted_at')
            ->select([
                'do.id',
                'do.delivery_number',
                'so.order_number',
                'do.recipient_name',
                DB::raw("COALESCE(cp.name, 'In-House Fleet') as courier_name"),
                'do.attempt_count',
                'do.cod_amount',
                'do.status',
                'do.special_instructions',
            ]);

        $total = (clone $query)->count();

        $rows = $query->orderBy('do.updated_at', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'delivery_number' => $row->delivery_number,
                    'order_number' => $row->order_number ?? 'N/A',
                    'recipient_name' => $row->recipient_name,
                    'courier_name' => $row->courier_name,
                    'attempt_count' => (int) $row->attempt_count,
                    'cod_amount' => number_format((float) $row->cod_amount, 2, '.', ''),
                    'status' => $row->status,
                    'return_reason' => $row->special_instructions ?? 'Customer unavailable / Rejected',
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
     * Courier partner fulfillment performance and success rates.
     */
    public function courierPerformance(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('delivery_orders as do')
            ->leftJoin('courier_providers as cp', 'do.courier_provider_id', '=', 'cp.id')
            ->where('do.tenant_id', $tenantId)
            ->whereNull('do.deleted_at')
            ->groupBy(['cp.id', 'cp.code', 'cp.name'])
            ->select([
                DB::raw("COALESCE(cp.code, 'in_house') as courier_code"),
                DB::raw("COALESCE(cp.name, 'In-House Delivery') as courier_name"),
                DB::raw('COUNT(do.id) as total_assigned'),
                DB::raw("SUM(CASE WHEN do.status = 'delivered' THEN 1 ELSE 0 END) as total_delivered"),
                DB::raw("SUM(CASE WHEN do.status IN ('returned', 'cancelled', 'failed') THEN 1 ELSE 0 END) as total_returned"),
                DB::raw('COALESCE(SUM(do.cod_collected_amount), 0) as total_cod_collected'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query->orderBy('total_assigned', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $assigned = (int) $row->total_assigned;
                $delivered = (int) $row->total_delivered;
                $rate = $assigned > 0 ? ($delivered / $assigned) * 100 : 0.0;

                return [
                    'courier_code' => $row->courier_code,
                    'courier_name' => $row->courier_name,
                    'total_assigned' => $assigned,
                    'total_delivered' => $delivered,
                    'total_returned' => (int) $row->total_returned,
                    'success_rate' => number_format($rate, 2, '.', '') . '%',
                    'total_cod_collected' => number_format((float) $row->total_cod_collected, 2, '.', ''),
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
     * Overall logistics fulfillment KPIs.
     */
    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

        $stats = DB::table('delivery_orders')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->selectRaw("
                COUNT(*) as total_orders,
                SUM(CASE WHEN status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery') THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
                SUM(CASE WHEN status IN ('returned', 'cancelled', 'failed') THEN 1 ELSE 0 END) as returned_orders,
                COALESCE(SUM(cod_collected_amount), 0) as total_cod_collected
            ")
            ->first();

        $total = (int) ($stats->total_orders ?? 0);
        $delivered = (int) ($stats->delivered_orders ?? 0);
        $rate = $total > 0 ? ($delivered / $total) * 100 : 0.0;

        return [
            'total_shipments' => $total,
            'pending_shipments' => (int) ($stats->pending_orders ?? 0),
            'delivered_shipments' => $delivered,
            'returned_shipments' => (int) ($stats->returned_orders ?? 0),
            'overall_delivery_rate' => number_format($rate, 2, '.', '') . '%',
            'total_cod_collected' => number_format((float) ($stats->total_cod_collected ?? 0), 2, '.', ''),
        ];
    }
}
