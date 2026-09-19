<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class ProductionDataProvider extends BaseDataProvider
{
    /**
     * Batch-level yield efficiency and variance analysis.
     */
    public function yield(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('production_batches as pb')
            ->join('products as p', 'pb.product_id', '=', 'p.id')
            ->leftJoin('production_lines as pl', 'pb.production_line_id', '=', 'pl.id')
            ->where('pb.tenant_id', $tenantId)
            ->whereNull('pb.deleted_at')
            ->select([
                'pb.id',
                'pb.batch_number',
                'pb.batch_date',
                'p.sku',
                'p.name as product_name',
                DB::raw("COALESCE(pl.name, 'Unassigned Line') as line_name"),
                'pb.planned_quantity',
                'pb.total_output_quantity as actual_quantity',
                'pb.variance_quantity as rejected_quantity',
                'pb.yield_percentage',
                'pb.status',
            ]);

        $this->applyBatchFilters($query, $filters);

        $total = $query->count();

        $rows = $query
            ->orderBy('pb.batch_date', 'desc')
            ->orderBy('pb.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $planned = (float) $row->planned_quantity;
                $actual = (float) ($row->actual_quantity ?? 0);
                $variance = (float) ($row->rejected_quantity ?? max(0, $planned - $actual));
                $yield = $row->yield_percentage !== null
                    ? (float) $row->yield_percentage
                    : ($planned > 0 ? round(($actual / $planned) * 100, 2) : 100.0);

                return [
                    'batch_number' => $row->batch_number,
                    'batch_date' => $row->batch_date,
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'line_name' => $row->line_name,
                    'planned_quantity' => number_format($planned, 2, '.', ''),
                    'actual_quantity' => number_format($actual, 2, '.', ''),
                    'rejected_quantity' => number_format($variance, 2, '.', ''),
                    'yield_percentage' => "{$yield}%",
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
     * Daily output units planned vs actual produced per line and shift.
     */
    public function dailyOutput(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('production_batches as pb')
            ->leftJoin('production_lines as pl', 'pb.production_line_id', '=', 'pl.id')
            ->leftJoin('shifts as s', 'pb.shift_id', '=', 's.id')
            ->where('pb.tenant_id', $tenantId)
            ->whereNull('pb.deleted_at')
            ->groupBy(['pb.batch_date', 'pl.id', 'pl.name', 's.id', 's.name'])
            ->select([
                'pb.batch_date',
                DB::raw("COALESCE(pl.name, 'General Line') as line_name"),
                DB::raw("COALESCE(s.name, 'General Shift') as shift_name"),
                DB::raw('COUNT(pb.id) as batches_count'),
                DB::raw('SUM(pb.planned_quantity) as total_planned'),
                DB::raw('SUM(pb.total_output_quantity) as total_actual'),
                DB::raw('SUM(COALESCE(pb.variance_quantity, 0)) as total_scrap'),
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('pb.batch_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('pb.batch_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['production_line_id'])) {
            $query->where('pb.production_line_id', $filters['production_line_id']);
        }

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('pb.batch_date', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $planned = (float) $row->total_planned;
                $actual = (float) $row->total_actual;
                $adherence = $planned > 0 ? round(($actual / $planned) * 100, 2) : 100.0;

                return [
                    'date' => $row->batch_date,
                    'line_name' => $row->line_name,
                    'shift_name' => $row->shift_name,
                    'batches_count' => (int) $row->batches_count,
                    'planned_quantity' => $planned,
                    'actual_quantity' => $actual,
                    'scrap_quantity' => (float) $row->total_scrap,
                    'adherence_percent' => $adherence,
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
     * Target vs actual achievement per production line.
     */
    public function targetVsAchievement(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('production_lines as pl')
            ->leftJoin('production_batches as pb', function ($join) use ($tenantId, $filters) {
                $join->on('pl.id', '=', 'pb.production_line_id')
                    ->where('pb.tenant_id', '=', $tenantId)
                    ->whereNull('pb.deleted_at');

                if (!empty($filters['start_date'])) {
                    $join->where('pb.batch_date', '>=', $filters['start_date']);
                }
                if (!empty($filters['end_date'])) {
                    $join->where('pb.batch_date', '<=', $filters['end_date']);
                }
            })
            ->where('pl.tenant_id', $tenantId)
            ->groupBy(['pl.id', 'pl.code', 'pl.name', 'pl.capacity_per_shift'])
            ->select([
                'pl.id',
                'pl.code as line_code',
                'pl.name as line_name',
                DB::raw('COALESCE(pl.capacity_per_shift, 0) as capacity_per_day'),
                DB::raw('COUNT(pb.id) as batches_run'),
                DB::raw('COALESCE(SUM(pb.planned_quantity), 0) as target_quantity'),
                DB::raw('COALESCE(SUM(pb.total_output_quantity), 0) as achieved_quantity'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('achieved_quantity', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $target = (float) $row->target_quantity;
                $achieved = (float) $row->achieved_quantity;
                $variance = $achieved - $target;
                $rate = $target > 0 ? round(($achieved / $target) * 100, 2) : ($achieved > 0 ? 100.0 : 0.0);

                return [
                    'line_code' => $row->line_code,
                    'line_name' => $row->line_name,
                    'daily_capacity' => (float) $row->capacity_per_day,
                    'batches_count' => (int) $row->batches_run,
                    'target_quantity' => $target,
                    'achieved_quantity' => $achieved,
                    'variance_quantity' => $variance,
                    'achievement_percent' => $rate,
                    'status' => $rate >= 100 ? 'target_met' : ($rate >= 80 ? 'on_track' : 'underperforming'),
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
     * Line operator and worker piece-rate production log.
     */
    public function workerProduction(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('worker_production_entries as wpe')
            ->join('employees as e', 'wpe.employee_id', '=', 'e.id')
            ->join('products as p', 'wpe.product_id', '=', 'p.id')
            ->leftJoin('production_batches as pb', 'wpe.production_batch_id', '=', 'pb.id')
            ->leftJoin('production_lines as pl', 'wpe.production_line_id', '=', 'pl.id')
            ->where('wpe.tenant_id', $tenantId)
            ->select([
                'wpe.id',
                'wpe.work_date',
                'e.employee_code',
                DB::raw("TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) as worker_name"),
                'p.sku',
                'p.name as product_name',
                'pb.batch_number',
                DB::raw("COALESCE(pl.name, 'Line N/A') as line_name"),
                'wpe.quantity as quantity_produced',
                'wpe.rejected_quantity as quantity_rejected',
                DB::raw('COALESCE(wpe.rate, 0) as piece_rate'),
                DB::raw('COALESCE(wpe.quantity * wpe.rate, 0) as earnings'),
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('wpe.work_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('wpe.work_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['employee_id'])) {
            $query->where('wpe.employee_id', $filters['employee_id']);
        }
        if (!empty($filters['product_id'])) {
            $query->where('wpe.product_id', $filters['product_id']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('wpe.work_date', 'desc')
            ->orderBy('wpe.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $produced = (float) $row->quantity_produced;
                $rejected = (float) ($row->quantity_rejected ?? 0);
                $rate = (float) ($row->piece_rate ?? 0);
                $earnings = (float) ($row->earnings ?? ($produced * $rate));

                return [
                    'date' => $row->work_date,
                    'employee_code' => $row->employee_code,
                    'worker_name' => !empty(trim($row->worker_name)) ? trim($row->worker_name) : 'Worker #' . $row->employee_code,
                    'product_sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'batch_number' => $row->batch_number ?? '—',
                    'line_name' => $row->line_name,
                    'quantity_produced' => $produced,
                    'quantity_rejected' => $rejected,
                    'piece_rate' => $rate,
                    'earnings' => $earnings,
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
     * Summary production metrics across the tenant.
     */
    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('production_batches as pb')
            ->where('pb.tenant_id', $tenantId)
            ->whereNull('pb.deleted_at');

        $this->applyBatchFilters($query, $filters);

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

    protected function applyBatchFilters($query, array $filters): void
    {
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
        if (!empty($filters['production_line_id'])) {
            $query->where('pb.production_line_id', $filters['production_line_id']);
        }
    }
}
