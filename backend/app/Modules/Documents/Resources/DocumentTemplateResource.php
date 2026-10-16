<?php

declare(strict_types=1);

namespace App\Modules\Documents\Resources;

use App\Modules\Documents\Models\DocumentTemplate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DocumentTemplate
 */
final class DocumentTemplateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'branch_id' => $this->branch_id,
            'name' => $this->name,
            'document_type' => $this->document_type,
            'paper_size_id' => $this->paper_size_id,
            'paper_size' => $this->whenLoaded('paperSize', fn () => new PaperSizeResource($this->paperSize)),
            'print_profile_id' => $this->print_profile_id,
            'print_profile' => $this->whenLoaded('printProfile', fn () => new PrintProfileResource($this->printProfile)),
            'status' => $this->status,
            'is_default' => (bool) $this->is_default,
            'current_version' => (int) $this->current_version,
            'active_version_id' => $this->active_version_id,
            'active_version' => $this->whenLoaded('activeVersion', fn () => new DocumentTemplateVersionResource($this->activeVersion)),
            'versions' => DocumentTemplateVersionResource::collection($this->whenLoaded('versions')),
            'created_by' => $this->created_by,
            'updated_by' => $this->updated_by,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
