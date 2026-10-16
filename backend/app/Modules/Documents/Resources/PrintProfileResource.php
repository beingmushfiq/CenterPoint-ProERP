<?php

declare(strict_types=1);

namespace App\Modules\Documents\Resources;

use App\Modules\Documents\Models\PrintProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PrintProfile
 */
final class PrintProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'paper_size_id' => $this->paper_size_id,
            'paper_size' => $this->whenLoaded('paperSize', fn () => new PaperSizeResource($this->paperSize)),
            'orientation' => $this->orientation,
            'margin_top_mm' => (float) $this->margin_top_mm,
            'margin_bottom_mm' => (float) $this->margin_bottom_mm,
            'margin_left_mm' => (float) $this->margin_left_mm,
            'margin_right_mm' => (float) $this->margin_right_mm,
            'scale' => (float) $this->scale,
            'copies' => (int) $this->copies,
            'is_printer_friendly' => (bool) $this->is_printer_friendly,
            'is_default' => (bool) $this->is_default,
            'is_active' => (bool) $this->is_active,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
