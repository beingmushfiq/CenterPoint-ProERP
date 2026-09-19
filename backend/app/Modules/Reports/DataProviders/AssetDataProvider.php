<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class AssetDataProvider extends BaseDataProvider
{
    /**
     * Fixed Asset Register: comprehensive catalog of company machines and capital assets.
     */
    public function register(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('assets as a')
            ->leftJoin('asset_categories as ac', 'a.asset_category_id', '=', 'ac.id')
            ->leftJoin('employees as e', 'a.assigned_employee_id', '=', 'e.id')
            ->leftJoin('production_lines as pl', 'a.production_line_id', '=', 'pl.id')
            ->where('a.tenant_id', $tenantId)
            ->whereNull('a.deleted_at')
            ->select([
                'a.id',
                'a.asset_tag',
                'a.name as asset_name',
                'ac.name as category_name',
                'a.serial_number',
                'a.manufacturer',
                'a.model',
                'a.purchase_date',
                'a.purchase_cost',
                'a.book_value',
                'a.status',
                'a.condition',
                DB::raw("COALESCE(e.display_name, pl.name, 'Unassigned') as assigned_to"),
            ]);

        if (!empty($filters['category_id'])) {
            $query->where('a.asset_category_id', $filters['category_id']);
        }
        if (!empty($filters['status'])) {
            $query->where('a.status', $filters['status']);
        }

        $total = (clone $query)->count();

        $rows = $query->orderBy('a.asset_tag', 'asc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'asset_tag' => $row->asset_tag ?? "AST-{$row->id}",
                    'asset_name' => $row->asset_name,
                    'category' => $row->category_name ?? 'General',
                    'serial_model' => trim("{$row->manufacturer} {$row->model}"),
                    'assigned_to' => $row->assigned_to,
                    'purchase_date' => $row->purchase_date ?? '—',
                    'purchase_cost' => number_format((float) $row->purchase_cost, 2, '.', ''),
                    'book_value' => number_format((float) ($row->book_value ?? $row->purchase_cost), 2, '.', ''),
                    'status' => ucfirst((string) $row->status),
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
     * Asset Valuation & Net Book Value (NBV).
     */
    public function valuationNbv(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('assets as a')
            ->leftJoin('asset_categories as ac', 'a.asset_category_id', '=', 'ac.id')
            ->where('a.tenant_id', $tenantId)
            ->whereNull('a.deleted_at')
            ->select([
                'a.id',
                'a.asset_tag',
                'a.name as asset_name',
                'ac.name as category_name',
                'a.purchase_cost',
                'a.accumulated_depreciation',
                'a.book_value',
                'a.depreciation_method',
                'a.status',
            ]);

        $total = (clone $query)->count();

        $rows = $query->orderBy('a.book_value', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $cost = (float) $row->purchase_cost;
                $dep = (float) ($row->accumulated_depreciation ?? 0);
                $nbv = (float) ($row->book_value ?? ($cost - $dep));
                return [
                    'asset_tag' => $row->asset_tag ?? "AST-{$row->id}",
                    'asset_name' => $row->asset_name,
                    'category' => $row->category_name ?? 'General',
                    'purchase_cost' => number_format($cost, 2, '.', ''),
                    'accumulated_depreciation' => number_format($dep, 2, '.', ''),
                    'net_book_value' => number_format($nbv, 2, '.', ''),
                    'depreciation_method' => ucfirst(str_replace('_', ' ', $row->depreciation_method ?? 'straight_line')),
                    'status' => ucfirst((string) $row->status),
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
     * Assets assigned to employees, production lines, or branches.
     */
    public function assignedAssets(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('assets as a')
            ->leftJoin('employees as e', 'a.assigned_employee_id', '=', 'e.id')
            ->leftJoin('production_lines as pl', 'a.production_line_id', '=', 'pl.id')
            ->leftJoin('branches as b', 'a.branch_id', '=', 'b.id')
            ->where('a.tenant_id', $tenantId)
            ->whereNull('a.deleted_at')
            ->where(function ($q) {
                $q->whereNotNull('a.assigned_employee_id')
                  ->orWhereNotNull('a.production_line_id')
                  ->orWhereNotNull('a.branch_id');
            })
            ->select([
                'a.asset_tag',
                'a.name as asset_name',
                'e.display_name as employee_name',
                'pl.name as line_name',
                'b.name as branch_name',
                'a.status',
                'a.condition',
            ]);

        $total = (clone $query)->count();

        $rows = $query->orderBy('a.asset_tag', 'asc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'asset_tag' => $row->asset_tag,
                    'asset_name' => $row->asset_name,
                    'assigned_person' => $row->employee_name ?? '—',
                    'production_line' => $row->line_name ?? '—',
                    'operating_branch' => $row->branch_name ?? 'Headquarters',
                    'condition' => ucfirst((string) ($row->condition ?? 'good')),
                    'status' => ucfirst((string) $row->status),
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
     * Asset Maintenance Orders & Repair History.
     */
    public function maintenanceLog(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('maintenance_orders as mo')
            ->leftJoin('assets as a', 'mo.asset_id', '=', 'a.id')
            ->where('mo.tenant_id', $tenantId)
            ->whereNull('mo.deleted_at')
            ->select([
                'mo.order_number',
                'a.asset_tag',
                'a.name as asset_name',
                'mo.maintenance_type',
                'mo.priority',
                'mo.downtime_minutes',
                'mo.labour_cost',
                'mo.parts_cost',
                'mo.total_cost',
                'mo.status',
                'mo.actual_start',
                'mo.actual_end',
            ]);

        $total = (clone $query)->count();

        $rows = $query->orderBy('mo.created_at', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'order_number' => $row->order_number,
                    'asset_tag' => $row->asset_tag ?? '—',
                    'asset_name' => $row->asset_name ?? 'General Machine',
                    'type' => ucfirst(str_replace('_', ' ', (string) $row->maintenance_type)),
                    'priority' => ucfirst((string) $row->priority),
                    'downtime_hrs' => number_format(((float) ($row->downtime_minutes ?? 0)) / 60, 1, '.', ''),
                    'total_cost' => number_format((float) ($row->total_cost ?? 0), 2, '.', ''),
                    'status' => ucfirst((string) $row->status),
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
     * Asset Disposal, Salvage & Write-off History.
     */
    public function disposalHistory(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('assets as a')
            ->where('a.tenant_id', $tenantId)
            ->where(function ($q) {
                $q->where('a.status', 'disposed')
                  ->orWhereNotNull('a.disposal_date');
            })
            ->select([
                'a.asset_tag',
                'a.name as asset_name',
                'a.purchase_cost',
                'a.disposal_date',
                'a.disposal_amount',
                'a.disposal_reason',
                'a.status',
            ]);

        $total = (clone $query)->count();

        $rows = $query->orderBy('a.disposal_date', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'asset_tag' => $row->asset_tag,
                    'asset_name' => $row->asset_name,
                    'purchase_cost' => number_format((float) $row->purchase_cost, 2, '.', ''),
                    'disposal_date' => $row->disposal_date ?? '—',
                    'salvage_amount' => number_format((float) ($row->disposal_amount ?? 0), 2, '.', ''),
                    'disposal_reason' => $row->disposal_reason ?? 'Scrapped / Retired',
                    'status' => ucfirst((string) $row->status),
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

    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

        $stats = DB::table('assets')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->selectRaw('COUNT(*) as total_count, COALESCE(SUM(purchase_cost), 0) as total_cost, COALESCE(SUM(book_value), 0) as total_nbv')
            ->first();

        return [
            'total_assets' => (int) ($stats->total_count ?? 0),
            'total_cost' => number_format((float) ($stats->total_cost ?? 0), 2, '.', ''),
            'total_net_book_value' => number_format((float) ($stats->total_nbv ?? 0), 2, '.', ''),
        ];
    }
}
