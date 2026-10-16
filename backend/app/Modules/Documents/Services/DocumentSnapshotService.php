<?php

declare(strict_types=1);

namespace App\Modules\Documents\Services;

use App\Core\Tenancy\TenantContext;
use App\Modules\Documents\Models\DocumentSnapshot;

final class DocumentSnapshotService
{
    /**
     * @param  array<string, mixed>  $dataPayload
     * @param  array<string, mixed>  $layoutSnapshot
     */
    public function captureSnapshot(
        string $documentType,
        int $documentId,
        string $documentNumber,
        ?int $templateId,
        ?int $templateVersionId,
        ?int $printProfileId,
        array $dataPayload,
        array $layoutSnapshot,
        ?int $userId = null
    ): DocumentSnapshot {
        $tenantId = TenantContext::current()->tenantId();
        $checksum = hash('sha256', json_encode($dataPayload).json_encode($layoutSnapshot));

        return DocumentSnapshot::create([
            'tenant_id' => $tenantId,
            'document_type' => $documentType,
            'document_id' => $documentId,
            'document_number' => $documentNumber,
            'template_id' => $templateId,
            'template_version_id' => $templateVersionId,
            'print_profile_id' => $printProfileId,
            'data_payload' => $dataPayload,
            'layout_snapshot' => $layoutSnapshot,
            'checksum' => $checksum,
            'created_by' => $userId,
        ]);
    }

    public function getSnapshot(string $documentType, int $documentId): ?DocumentSnapshot
    {
        $tenantId = TenantContext::current()->tenantId();

        return DocumentSnapshot::with(['template', 'templateVersion', 'printProfile'])
            ->where('tenant_id', $tenantId)
            ->where('document_type', $documentType)
            ->where('document_id', $documentId)
            ->latest('id')
            ->first();
    }
}
