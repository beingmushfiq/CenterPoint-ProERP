<?php

declare(strict_types=1);

namespace App\Modules\Pos\Resources;

use App\Modules\Pos\Models\PosTerminal;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PosTerminal
 */
final class PosTerminalResource extends JsonResource
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
            'branch_id' => $this->branch_id,
            'default_warehouse_id' => $this->default_warehouse_id,
            'printer_config' => $this->printer_config,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
