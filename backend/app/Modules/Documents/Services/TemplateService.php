<?php

declare(strict_types=1);

namespace App\Modules\Documents\Services;

use App\Core\Tenancy\TenantContext;
use App\Modules\Documents\Models\DocumentTemplate;
use App\Modules\Documents\Models\DocumentTemplateVersion;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class TemplateService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function createTemplate(array $data, int $userId): DocumentTemplate
    {
        $tenantId = TenantContext::current()->tenantId();

        return DB::transaction(function () use ($data, $userId, $tenantId): DocumentTemplate {
            $isDefault = (bool) ($data['is_default'] ?? false);
            $documentType = (string) $data['document_type'];

            if ($isDefault) {
                $this->unsetDefault($tenantId, $documentType);
            }

            $template = DocumentTemplate::create([
                'tenant_id' => $tenantId,
                'company_id' => $data['company_id'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
                'name' => (string) $data['name'],
                'document_type' => $documentType,
                'paper_size_id' => $data['paper_size_id'] ?? null,
                'print_profile_id' => $data['print_profile_id'] ?? null,
                'status' => (string) ($data['status'] ?? 'active'),
                'is_default' => $isDefault,
                'current_version' => 1,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $version = DocumentTemplateVersion::create([
                'tenant_id' => $tenantId,
                'template_id' => $template->id,
                'version' => 1,
                'status' => 'active',
                'change_summary' => 'Initial version',
                'layout_config' => $data['layout_config'] ?? [],
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $template->update(['active_version_id' => $version->id]);

            return $template->load(['activeVersion', 'paperSize', 'printProfile']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateTemplate(DocumentTemplate $template, array $data, int $userId): DocumentTemplate
    {
        $tenantId = TenantContext::current()->tenantId();

        return DB::transaction(function () use ($template, $data, $userId, $tenantId): DocumentTemplate {
            $isDefault = isset($data['is_default']) ? (bool) $data['is_default'] : $template->is_default;
            $documentType = (string) ($data['document_type'] ?? $template->document_type);

            if ($isDefault && ! $template->is_default) {
                $this->unsetDefault($tenantId, $documentType, $template->id);
            }

            $template->fill([
                'name' => $data['name'] ?? $template->name,
                'document_type' => $documentType,
                'company_id' => array_key_exists('company_id', $data) ? $data['company_id'] : $template->company_id,
                'branch_id' => array_key_exists('branch_id', $data) ? $data['branch_id'] : $template->branch_id,
                'paper_size_id' => array_key_exists('paper_size_id', $data) ? $data['paper_size_id'] : $template->paper_size_id,
                'print_profile_id' => array_key_exists('print_profile_id', $data) ? $data['print_profile_id'] : $template->print_profile_id,
                'status' => $data['status'] ?? $template->status,
                'is_default' => $isDefault,
                'updated_by' => $userId,
            ]);

            // If layout_config is provided and changed, create a new version
            if (isset($data['layout_config'])) {
                $newVersionNumber = $template->current_version + 1;
                $newVersion = DocumentTemplateVersion::create([
                    'tenant_id' => $tenantId,
                    'template_id' => $template->id,
                    'version' => $newVersionNumber,
                    'status' => 'active',
                    'change_summary' => (string) ($data['change_summary'] ?? "Updated version {$newVersionNumber}"),
                    'layout_config' => $data['layout_config'],
                    'created_by' => $userId,
                    'updated_by' => $userId,
                ]);

                $template->current_version = $newVersionNumber;
                $template->active_version_id = $newVersion->id;
            }

            $template->save();

            return $template->load(['activeVersion', 'paperSize', 'printProfile', 'versions']);
        });
    }

    public function setDefault(DocumentTemplate $template, int $userId): DocumentTemplate
    {
        $tenantId = TenantContext::current()->tenantId();

        return DB::transaction(function () use ($template, $userId, $tenantId): DocumentTemplate {
            $this->unsetDefault($tenantId, $template->document_type, $template->id);

            $template->update([
                'is_default' => true,
                'updated_by' => $userId,
            ]);

            return $template;
        });
    }

    public function activateVersion(DocumentTemplate $template, int $versionNumber, int $userId): DocumentTemplate
    {
        $version = $template->versions()->where('version', $versionNumber)->first();
        if (! $version) {
            throw new InvalidArgumentException("Version {$versionNumber} does not exist for template {$template->name}");
        }

        $template->update([
            'active_version_id' => $version->id,
            'updated_by' => $userId,
        ]);

        return $template->load(['activeVersion', 'paperSize', 'printProfile']);
    }

    public function duplicateTemplate(DocumentTemplate $template, string $newName, int $userId): DocumentTemplate
    {
        $tenantId = TenantContext::current()->tenantId();

        return DB::transaction(function () use ($template, $newName, $userId, $tenantId): DocumentTemplate {
            $activeVersion = $template->activeVersion;

            $newTemplate = DocumentTemplate::create([
                'tenant_id' => $tenantId,
                'company_id' => $template->company_id,
                'branch_id' => $template->branch_id,
                'name' => $newName,
                'document_type' => $template->document_type,
                'paper_size_id' => $template->paper_size_id,
                'print_profile_id' => $template->print_profile_id,
                'status' => 'draft',
                'is_default' => false,
                'current_version' => 1,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $version = DocumentTemplateVersion::create([
                'tenant_id' => $tenantId,
                'template_id' => $newTemplate->id,
                'version' => 1,
                'status' => 'active',
                'change_summary' => "Cloned from {$template->name} (v{$template->current_version})",
                'layout_config' => $activeVersion ? $activeVersion->layout_config : [],
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $newTemplate->update(['active_version_id' => $version->id]);

            return $newTemplate->load(['activeVersion', 'paperSize', 'printProfile']);
        });
    }

    private function unsetDefault(int $tenantId, string $documentType, ?int $exceptId = null): void
    {
        $query = DocumentTemplate::where('tenant_id', $tenantId)
            ->where('document_type', $documentType)
            ->where('is_default', true);

        if ($exceptId !== null) {
            $query->where('id', '!=', $exceptId);
        }

        $query->update(['is_default' => false]);
    }
}
