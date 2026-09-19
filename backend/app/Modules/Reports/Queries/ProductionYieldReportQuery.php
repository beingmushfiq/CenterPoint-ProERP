<?php

declare(strict_types=1);

namespace App\Modules\Reports\Queries;

use App\Modules\Reports\Contracts\ReportQueryInterface;
use Illuminate\Support\Facades\DB;

class ProductionYieldReportQuery implements ReportQueryInterface
{
    public function columns(): array
    {
        return [
            'batch_number' => ['label' => 'Batch Number', 'type' => 'string', 'sortable' => true],
            'product_name' => ['label' => 'Product / SKU', 'type' => 'string'],
            'batch_date' => ['label' => 'Batch Date', 'type' => 'date', 'sortable' => true],
            'planned_quantity' => ['label' => 'Planned Qty', 'type' => 'number'],
            'actual_quantity' => ['label' => 'Produced Qty', 'type' => 'number'],
            'rejected_quantity' => ['label' => 'Variance / Scrap', 'type' => 'number'],
            'yield_percentage' => ['label' => 'Yield Efficiency', 'type' => 'percentage'],
            'status' => ['label' => 'Status', 'type' => 'badge'],
        ];
    }

    public function query(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = \App\Core\Tenancy\TenantContext::isBound()
            ? \App\Core\Tenancy\TenantContext::current()->tenantId()
            : (auth()->user()?->tenant_id ?? (int) config('app.default_tenant_id', 1));

        $query = DB::table('production_batches as pb')
            ->join('products as p', 'pb.product_id', '=', 'p.id')
            ->where('pb.tenant_id', $tenantId)
            ->whereNull('pb.deleted_at')
            ->select([
                'pb.id',
                'pb.uuid',
                'pb.batch_number',
                'p.name as product_name',
                'p.sku as product_sku',
                'pb.batch_date',
                'pb.planned_quantity',
                'pb.total_output_quantity as actual_quantity',
                'pb.variance_quantity as rejected_quantity',
                'pb.yield_percentage',
                'pb.status',
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('pb.batch_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('pb.batch_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['product_id'])) {
            $query->where('pb.product_id', $filters['product_id']);
        }
        if (!empty($filters['status'])) {
            $query->where('pb.status', $filters['status']);
        }

        $total = $query->count();
        $rows = $query->orderBy('pb.batch_date', 'desc')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        $data = $rows->map(function ($row): array {
            $planned = (float) $row->planned_quantity;
            $actual = (float) ($row->actual_quantity ?? 0);
            $yield = $row->yield_percentage !== null
                ? (float) $row->yield_percentage
                : ($planned > 0 ? round(($actual / $planned) * 100, 2) : 100.0);

            return [
                'id' => $row->id,
                'uuid' => $row->uuid,
                'batch_number' => $row->batch_number,
                'product_name' => "{$row->product_name} ({$row->product_sku})",
                'batch_date' => $row->batch_date,
                'planned_quantity' => number_format($planned, 2, '.', ''),
                'actual_quantity' => number_format($actual, 2, '.', ''),
                'rejected_quantity' => number_format((float) ($row->rejected_quantity ?? 0), 2, '.', ''),
                'yield_percentage' => "{$yield}%",
                'status' => $row->status,
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

        $query = DB::table('production_batches as pb')
            ->where('pb.tenant_id', $tenantId)
            ->whereNull('pb.deleted_at');

        if (!empty($filters['start_date'])) {
            $query->where('pb.batch_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('pb.batch_date', '<=', $filters['end_date']);
        }

        $stats = $query->selectRaw('
            COUNT(pb.id) as total_batches,
            COALESCE(SUM(pb.planned_quantity), 0) as total_planned,
            COALESCE(SUM(pb.total_output_quantity), 0) as total_actual,
            COALESCE(SUM(pb.variance_quantity), 0) as total_rejected
        ')->first();

        $planned = (float) ($stats->total_planned ?? 0);
        $actual = (float) ($stats->total_actual ?? 0);
        $avgYield = $planned > 0 ? round(($actual / $planned) * 100, 2) : 100.0;

        return [
            'total_batches' => (int) ($stats->total_batches ?? 0),
            'total_planned_quantity' => number_format($planned, 4, '.', ''),
            'total_actual_quantity' => number_format($actual, 4, '.', ''),
            'total_rejected_quantity' => number_format((float) ($stats->total_rejected ?? 0), 4, '.', ''),
            'average_yield_percentage' => "{$avgYield}%",
        ];
    }
}
