<?php

declare(strict_types=1);

namespace App\Modules\Documents\Services;

use App\Core\Tenancy\TenantContext;
use App\Modules\Documents\Models\DocumentPrintHistory;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class PrintHistoryService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function recordHistory(array $data, ?int $userId = null, ?string $ip = null, ?string $ua = null): DocumentPrintHistory
    {
        $tenantId = TenantContext::current()->tenantId();

        return DocumentPrintHistory::create([
            'tenant_id' => $tenantId,
            'document_type' => (string) $data['document_type'],
            'document_id' => (int) ($data['document_id'] ?? 0),
            'document_number' => (string) ($data['document_number'] ?? 'N/A'),
            'template_id' => isset($data['template_id']) ? (int) $data['template_id'] : null,
            'template_version' => (int) ($data['template_version'] ?? 1),
            'print_profile_id' => isset($data['print_profile_id']) ? (int) $data['print_profile_id'] : null,
            'action' => (string) ($data['action'] ?? 'print'),
            'copies' => (int) ($data['copies'] ?? 1),
            'user_id' => $userId,
            'ip_address' => $ip,
            'user_agent' => $ua ? substr($ua, 0, 250) : null,
            'created_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function getPaginatedHistory(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = DocumentPrintHistory::with(['template', 'printProfile', 'user'])
            ->where('tenant_id', $tenantId);

        if (! empty($filters['document_type'])) {
            $query->where('document_type', $filters['document_type']);
        }

        if (! empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        if (! empty($filters['q'])) {
            $search = (string) $filters['q'];
            $query->where('document_number', 'like', "%{$search}%");
        }

        return $query->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);
    }
}
