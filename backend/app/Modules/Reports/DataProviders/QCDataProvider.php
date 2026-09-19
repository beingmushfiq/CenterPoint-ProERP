<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class QCDataProvider extends BaseDataProvider
{
    /**
     * QC Inspection Pass/Fail ratio and sample efficiency.
     */
    public function inspectionRatio(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('qc_inspections as qi')
            ->leftJoin('production_batches as pb', 'qi.production_batch_id', '=', 'pb.id')
            ->leftJoin('products as p', 'pb.product_id', '=', 'p.id')
            ->leftJoin('users as u', 'qi.inspector_id', '=', 'u.id')
            ->where('qi.tenant_id', $tenantId)
            ->whereNull('qi.deleted_at')
            ->select([
                'qi.id',
                'qi.inspection_number',
                'qi.inspection_date',
                'pb.batch_number',
                DB::raw("COALESCE(p.name, 'N/A') as product_name"),
                DB::raw("COALESCE(p.sku, 'N/A') as sku"),
                'qi.sample_size',
                'qi.inspected_quantity',
                'qi.passed_quantity',
                'qi.failed_quantity',
                'qi.rework_quantity',
                'qi.scrap_quantity',
                'qi.result',
                'qi.status',
                DB::raw("COALESCE(u.name, 'Inspector') as inspector_name"),
            ]);

        $this->applyQCFilters($query, $filters);

        $total = $query->count();

        $rows = $query
            ->orderBy('qi.inspection_date', 'desc')
            ->orderBy('qi.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $inspected = (float) ($row->inspected_quantity ?: $row->sample_size ?: 1);
                $passed = (float) $row->passed_quantity;
                $failed = (float) $row->failed_quantity;
                $passRate = $inspected > 0 ? round(($passed / $inspected) * 100, 2) : 0.0;

                return [
                    'inspection_number' => $row->inspection_number,
                    'inspection_date' => $row->inspection_date,
                    'batch_number' => $row->batch_number ?? '—',
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'inspector' => $row->inspector_name,
                    'sample_size' => (float) $row->sample_size,
                    'inspected_quantity' => (float) $row->inspected_quantity,
                    'passed_quantity' => $passed,
                    'failed_quantity' => $failed,
                    'rework_quantity' => (float) $row->rework_quantity,
                    'scrap_quantity' => (float) $row->scrap_quantity,
                    'pass_rate_percent' => $passRate,
                    'result' => ucfirst($row->result ?? 'pending'),
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
     * Defect categorization breakdown by reason and severity.
     */
    public function defectCategorization(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('qc_defects as qd')
            ->join('qc_inspections as qi', 'qd.qc_inspection_id', '=', 'qi.id')
            ->leftJoin('reason_codes as rc', 'qd.defect_reason_id', '=', 'rc.id')
            ->leftJoin('production_batches as pb', 'qi.production_batch_id', '=', 'pb.id')
            ->leftJoin('products as p', 'pb.product_id', '=', 'p.id')
            ->where('qd.tenant_id', $tenantId)
            ->whereNull('qd.deleted_at')
            ->select([
                'qd.id',
                'qi.inspection_number',
                'qi.inspection_date',
                DB::raw("COALESCE(rc.code, 'DEF-GEN') as defect_code"),
                DB::raw("COALESCE(rc.name, 'Unspecified Defect') as defect_reason"),
                'qd.severity',
                'qd.quantity as defect_quantity',
                'pb.batch_number',
                DB::raw("COALESCE(p.name, 'N/A') as product_name"),
                DB::raw("COALESCE(p.sku, 'N/A') as sku"),
                'qd.notes',
            ]);

        if (!empty($filters['severity'])) {
            $query->where('qd.severity', $filters['severity']);
        }
        if (!empty($filters['start_date'])) {
            $query->where('qi.inspection_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('qi.inspection_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['batch_id'])) {
            $query->where('qi.production_batch_id', $filters['batch_id']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('qd.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'defect_code' => $row->defect_code,
                    'defect_reason' => $row->defect_reason,
                    'severity' => ucfirst($row->severity ?? 'minor'),
                    'quantity' => (float) $row->defect_quantity,
                    'inspection_number' => $row->inspection_number,
                    'inspection_date' => $row->inspection_date,
                    'batch_number' => $row->batch_number ?? '—',
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
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
     * Compliance and audit trail for inspections and sign-offs.
     */
    public function complianceAuditTrail(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('qc_inspections as qi')
            ->leftJoin('production_batches as pb', 'qi.production_batch_id', '=', 'pb.id')
            ->leftJoin('users as inspector', 'qi.inspector_id', '=', 'inspector.id')
            ->leftJoin('users as approver', 'qi.approved_by', '=', 'approver.id')
            ->where('qi.tenant_id', $tenantId)
            ->whereNull('qi.deleted_at')
            ->select([
                'qi.id',
                'qi.inspection_number',
                'qi.inspection_date',
                'pb.batch_number',
                'qi.result',
                'qi.status',
                DB::raw("COALESCE(inspector.name, 'Inspector') as inspector_name"),
                DB::raw("COALESCE(approver.name, 'Pending Approval') as approver_name"),
                'qi.approved_at',
                'qi.notes',
            ]);

        $this->applyQCFilters($query, $filters);

        $total = $query->count();

        $rows = $query
            ->orderBy('qi.inspection_date', 'desc')
            ->orderBy('qi.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'inspection_number' => $row->inspection_number,
                    'inspection_date' => $row->inspection_date,
                    'batch_number' => $row->batch_number ?? '—',
                    'result' => ucfirst($row->result ?? 'pending'),
                    'status' => ucfirst($row->status ?? 'open'),
                    'inspector_name' => $row->inspector_name,
                    'approver_name' => $row->approver_name,
                    'approved_at' => $row->approved_at ?? '—',
                    'compliance_status' => $row->approved_at ? 'Fully Compliant' : 'Pending Verification',
                    'remarks' => $row->notes ?? '—',
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
     * Top-level summary metrics for QC dashboard.
     */
    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('qc_inspections as qi')
            ->where('qi.tenant_id', $tenantId)
            ->whereNull('qi.deleted_at');

        $this->applyQCFilters($query, $filters);

        $stats = $query->selectRaw('
            COUNT(qi.id) as total_inspections,
            COALESCE(SUM(qi.inspected_quantity), 0) as total_inspected_quantity,
            COALESCE(SUM(qi.passed_quantity), 0) as total_passed_quantity,
            COALESCE(SUM(qi.failed_quantity), 0) as total_failed_quantity,
            COALESCE(SUM(qi.rework_quantity), 0) as total_rework_quantity
        ')->first();

        $inspected = (float) ($stats->total_inspected_quantity ?? 0);
        $passed = (float) ($stats->total_passed_quantity ?? 0);
        $passRate = $inspected > 0 ? round(($passed / $inspected) * 100, 2) : 100.0;

        return [
            'total_inspections' => (int) ($stats->total_inspections ?? 0),
            'total_inspected_quantity' => $inspected,
            'total_passed_quantity' => $passed,
            'total_failed_quantity' => (float) ($stats->total_failed_quantity ?? 0),
            'total_rework_quantity' => (float) ($stats->total_rework_quantity ?? 0),
            'overall_pass_rate' => "{$passRate}%",
        ];
    }

    protected function applyQCFilters($query, array $filters): void
    {
        if (!empty($filters['start_date'])) {
            $query->where('qi.inspection_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('qi.inspection_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['result'])) {
            $query->where('qi.result', $filters['result']);
        }
        if (!empty($filters['status'])) {
            $query->where('qi.status', $filters['status']);
        }
    }
}
