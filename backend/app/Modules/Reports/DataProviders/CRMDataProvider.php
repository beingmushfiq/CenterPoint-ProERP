<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class CRMDataProvider extends BaseDataProvider
{
    /**
     * Commercial Lead Pipeline Summary across stages.
     */
    public function pipelineSummary(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('crm_leads as l')
            ->leftJoin('users as u', 'l.assigned_to', '=', 'u.id')
            ->where('l.tenant_id', $tenantId)
            ->whereNull('l.deleted_at')
            ->select([
                'l.id',
                'l.lead_number',
                'l.name',
                'l.company_name',
                'l.phone',
                'l.source',
                'l.stage',
                'l.expected_value',
                'l.expected_close_date',
                'l.is_fake',
                DB::raw("COALESCE(u.name, 'Unassigned') as assigned_rep"),
            ]);

        if (!empty($filters['stage'])) {
            $query->where('l.stage', $filters['stage']);
        }
        if (!empty($filters['source'])) {
            $query->where('l.source', $filters['source']);
        }
        if (isset($filters['is_fake'])) {
            $query->where('l.is_fake', (bool) $filters['is_fake']);
        }

        $total = (clone $query)->count();

        $rows = $query->orderBy('l.created_at', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'lead_number' => $row->lead_number,
                    'contact_name' => $row->name,
                    'company_name' => $row->company_name ?? 'Individual',
                    'phone' => $row->phone ?? 'N/A',
                    'source' => ucfirst(str_replace('_', ' ', (string) $row->source)),
                    'stage' => ucfirst((string) $row->stage),
                    'expected_value' => number_format((float) $row->expected_value, 2, '.', ''),
                    'expected_close_date' => $row->expected_close_date ?? 'Not Set',
                    'assigned_rep' => $row->assigned_rep,
                    'is_fake' => (bool) $row->is_fake ? 'Flagged Fake' : 'Valid',
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
     * Active workload and assigned leads per sales representative.
     */
    public function salesmanWorkload(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('crm_leads as l')
            ->leftJoin('users as u', 'l.assigned_to', '=', 'u.id')
            ->where('l.tenant_id', $tenantId)
            ->whereNull('l.deleted_at')
            ->groupBy(['l.assigned_to', 'u.name', 'u.email'])
            ->select([
                DB::raw("COALESCE(u.name, 'Unassigned Pool') as representative_name"),
                DB::raw("COALESCE(u.email, 'N/A') as representative_email"),
                DB::raw('COUNT(l.id) as total_leads'),
                DB::raw("SUM(CASE WHEN l.stage IN ('won', 'converted') THEN 1 ELSE 0 END) as converted_leads"),
                DB::raw("SUM(CASE WHEN l.stage NOT IN ('won', 'lost', 'converted') THEN 1 ELSE 0 END) as active_leads"),
                DB::raw("SUM(CASE WHEN l.is_fake = 1 THEN 1 ELSE 0 END) as fake_leads"),
                DB::raw('COALESCE(SUM(l.expected_value), 0) as total_pipeline_value'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query->orderBy('total_leads', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $totalL = (int) $row->total_leads;
                $conv = (int) $row->converted_leads;
                $rate = $totalL > 0 ? ($conv / $totalL) * 100 : 0.0;

                return [
                    'representative_name' => $row->representative_name,
                    'representative_email' => $row->representative_email,
                    'total_assigned_leads' => $totalL,
                    'active_leads' => (int) $row->active_leads,
                    'converted_leads' => $conv,
                    'fake_leads' => (int) $row->fake_leads,
                    'conversion_rate' => number_format($rate, 2, '.', '') . '%',
                    'pipeline_value' => number_format((float) $row->total_pipeline_value, 2, '.', ''),
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
     * Audit log of fraudulent, invalid, or unreachable customer inquiries.
     */
    public function fakeLeadsAudit(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('crm_leads as l')
            ->leftJoin('users as u', 'l.assigned_to', '=', 'u.id')
            ->leftJoin('users as v', 'l.validated_by', '=', 'v.id')
            ->where('l.tenant_id', $tenantId)
            ->where('l.is_fake', true)
            ->whereNull('l.deleted_at')
            ->select([
                'l.id',
                'l.lead_number',
                'l.name',
                'l.phone',
                'l.source',
                'l.validation_notes',
                'l.validated_at',
                DB::raw("COALESCE(u.name, 'Unassigned') as assigned_rep"),
                DB::raw("COALESCE(v.name, 'System Validator') as auditor_name"),
            ]);

        $total = (clone $query)->count();

        $rows = $query->orderBy('l.validated_at', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'lead_number' => $row->lead_number,
                    'contact_name' => $row->name,
                    'phone' => $row->phone ?? 'N/A',
                    'source' => ucfirst(str_replace('_', ' ', (string) $row->source)),
                    'assigned_rep' => $row->assigned_rep,
                    'auditor_name' => $row->auditor_name,
                    'validated_at' => $row->validated_at ?? 'N/A',
                    'audit_reason' => $row->validation_notes ?? 'Failed contact verification audit',
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
     * Conversion efficiency calculated across lead sources.
     */
    public function conversionRates(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('crm_leads as l')
            ->where('l.tenant_id', $tenantId)
            ->whereNull('l.deleted_at')
            ->groupBy(['l.source'])
            ->select([
                'l.source',
                DB::raw('COUNT(l.id) as total_leads'),
                DB::raw("SUM(CASE WHEN l.stage IN ('won', 'converted') THEN 1 ELSE 0 END) as converted_leads"),
                DB::raw("SUM(CASE WHEN l.stage = 'lost' THEN 1 ELSE 0 END) as lost_leads"),
                DB::raw("SUM(CASE WHEN l.is_fake = 1 THEN 1 ELSE 0 END) as fake_leads"),
                DB::raw('COALESCE(SUM(l.expected_value), 0) as total_pipeline_value'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query->orderBy('total_leads', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $totalL = (int) $row->total_leads;
                $conv = (int) $row->converted_leads;
                $rate = $totalL > 0 ? ($conv / $totalL) * 100 : 0.0;

                return [
                    'source_channel' => ucfirst(str_replace('_', ' ', (string) $row->source)),
                    'total_leads' => $totalL,
                    'converted_leads' => $conv,
                    'lost_leads' => (int) $row->lost_leads,
                    'fake_leads' => (int) $row->fake_leads,
                    'conversion_rate' => number_format($rate, 2, '.', '') . '%',
                    'pipeline_value' => number_format((float) $row->total_pipeline_value, 2, '.', ''),
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
     * Lead status and pipeline stage distribution.
     */
    public function leadStatusDistribution(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('crm_leads')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->groupBy('stage')
            ->select([
                'stage',
                DB::raw('COUNT(*) as total_count'),
                DB::raw('COALESCE(SUM(expected_value), 0) as total_value'),
                DB::raw('AVG(COALESCE(expected_value, 0)) as average_value'),
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('created_at', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('created_at', '<=', $filters['end_date']);
        }

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_count', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'stage' => ucfirst(str_replace('_', ' ', (string) $row->stage)),
                    'leads_count' => (int) $row->total_count,
                    'pipeline_value' => (float) $row->total_value,
                    'average_deal_size' => round((float) $row->average_value, 2),
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
     * Converted deals and win rate performance.
     */
    public function convertedLeads(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('crm_leads as l')
            ->leftJoin('users as u', 'l.assigned_to', '=', 'u.id')
            ->leftJoin('parties as p', 'l.converted_party_id', '=', 'p.id')
            ->where('l.tenant_id', $tenantId)
            ->whereNull('l.deleted_at')
            ->where(function ($q) {
                $q->whereIn('l.stage', ['won', 'converted'])
                    ->orWhereNotNull('l.converted_at');
            })
            ->select([
                'l.id',
                'l.lead_number',
                'l.name as contact_name',
                'l.company_name',
                'l.phone',
                'l.source',
                DB::raw("COALESCE(u.name, 'Unassigned') as salesman_name"),
                'l.expected_value as deal_value',
                'l.converted_at',
                DB::raw("COALESCE(p.name, 'Customer Account Created') as account_name"),
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('l.converted_at', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('l.converted_at', '<=', $filters['end_date']);
        }
        if (!empty($filters['salesman_id'])) {
            $query->where('l.assigned_to', $filters['salesman_id']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('l.converted_at', 'desc')
            ->orderBy('l.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'lead_number' => $row->lead_number,
                    'contact_name' => $row->contact_name,
                    'company_name' => $row->company_name ?? '—',
                    'phone' => $row->phone ?? '—',
                    'source' => ucfirst(str_replace('_', ' ', $row->source ?? 'direct')),
                    'salesman' => $row->salesman_name,
                    'deal_value' => (float) ($row->deal_value ?? 0),
                    'converted_at' => $row->converted_at ?? '—',
                    'account_name' => $row->account_name,
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
     * Lost deals root-cause and drop-off analysis.
     */
    public function lostLeadsAnalysis(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('crm_leads as l')
            ->leftJoin('users as u', 'l.assigned_to', '=', 'u.id')
            ->leftJoin('reason_codes as rc', 'l.lost_reason_id', '=', 'rc.id')
            ->where('l.tenant_id', $tenantId)
            ->whereNull('l.deleted_at')
            ->where('l.stage', 'lost')
            ->select([
                'l.id',
                'l.lead_number',
                'l.name as contact_name',
                'l.company_name',
                'l.phone',
                'l.source',
                DB::raw("COALESCE(u.name, 'Unassigned') as salesman_name"),
                'l.expected_value as lost_value',
                DB::raw("COALESCE(rc.name, 'Unspecified Reason') as lost_reason"),
                'l.notes',
                'l.updated_at as lost_at',
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('l.updated_at', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('l.updated_at', '<=', $filters['end_date']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('l.updated_at', 'desc')
            ->orderBy('l.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'lead_number' => $row->lead_number,
                    'contact_name' => $row->contact_name,
                    'company_name' => $row->company_name ?? '—',
                    'source' => ucfirst(str_replace('_', ' ', $row->source ?? 'direct')),
                    'salesman' => $row->salesman_name,
                    'lost_value' => (float) ($row->lost_value ?? 0),
                    'lost_reason' => $row->lost_reason,
                    'notes' => $row->notes ?? '—',
                    'lost_date' => $row->lost_at ? substr((string) $row->lost_at, 0, 10) : '—',
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
     * Overall pipeline health KPIs.
     */
    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

        $stats = DB::table('crm_leads')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->selectRaw("
                COUNT(*) as total_leads,
                SUM(CASE WHEN stage NOT IN ('won', 'lost', 'converted') THEN 1 ELSE 0 END) as active_leads,
                SUM(CASE WHEN stage IN ('won', 'converted') THEN 1 ELSE 0 END) as converted_leads,
                SUM(CASE WHEN is_fake = 1 THEN 1 ELSE 0 END) as fake_leads,
                COALESCE(SUM(expected_value), 0) as total_pipeline_value
            ")
            ->first();

        $total = (int) ($stats->total_leads ?? 0);
        $conv = (int) ($stats->converted_leads ?? 0);
        $rate = $total > 0 ? ($conv / $total) * 100 : 0.0;

        return [
            'total_leads' => $total,
            'active_pipeline_leads' => (int) ($stats->active_leads ?? 0),
            'converted_leads' => $conv,
            'fake_leads_detected' => (int) ($stats->fake_leads ?? 0),
            'conversion_rate' => number_format($rate, 2, '.', '') . '%',
            'total_pipeline_value' => number_format((float) ($stats->total_pipeline_value ?? 0), 2, '.', ''),
        ];
    }
}
