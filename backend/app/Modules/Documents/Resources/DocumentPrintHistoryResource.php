<?php

declare(strict_types=1);

namespace App\Modules\Documents\Resources;

use App\Modules\Documents\Models\DocumentPrintHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DocumentPrintHistory
 */
final class DocumentPrintHistoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'document_type' => $this->document_type,
            'document_id' => $this->document_id,
            'document_number' => $this->document_number,
            'template_id' => $this->template_id,
            'template_name' => $this->template?->name,
            'template_version' => (int) $this->template_version,
            'print_profile_id' => $this->print_profile_id,
            'print_profile' => $this->printProfile?->name,
            'action' => $this->action,
            'copies' => (int) $this->copies,
            'user_id' => $this->user_id,
            'user_name' => $this->user?->name ?? 'System / Operator',
            'ip_address' => $this->ip_address,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
