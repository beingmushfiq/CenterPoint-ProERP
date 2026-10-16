<?php

declare(strict_types=1);

namespace App\Modules\Documents\Resources;

use App\Modules\Documents\Models\PaperSize;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PaperSize
 */
final class PaperSizeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'code' => $this->code,
            'name' => $this->name,
            'width_mm' => (float) $this->width_mm,
            'height_mm' => $this->height_mm !== null ? (float) $this->height_mm : null,
            'unit' => $this->unit,
            'orientation_default' => $this->orientation_default,
            'margin_top_mm' => (float) $this->margin_top_mm,
            'margin_bottom_mm' => (float) $this->margin_bottom_mm,
            'margin_left_mm' => (float) $this->margin_left_mm,
            'margin_right_mm' => (float) $this->margin_right_mm,
            'is_builtin' => (bool) $this->is_builtin,
            'is_active' => (bool) $this->is_active,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
