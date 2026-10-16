<?php

declare(strict_types=1);

namespace App\Modules\Documents\Services;

use App\Core\Tenancy\TenantContext;
use App\Modules\Documents\Models\PaperSize;
use Illuminate\Database\Eloquent\Collection;

final class PaperSizeService
{
    /**
     * @return Collection<int, PaperSize>
     */
    public function getAllAvailable(): Collection
    {
        $tenantId = TenantContext::current()->tenantId();

        // Built-ins + tenant custom sizes
        return PaperSize::where(function ($query) use ($tenantId): void {
            $query->whereNull('tenant_id')
                ->orWhere('tenant_id', $tenantId);
        })
            ->where('is_active', true)
            ->orderBy('is_builtin', 'desc')
            ->orderBy('name', 'asc')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createCustom(array $data, int $userId): PaperSize
    {
        $tenantId = TenantContext::current()->tenantId();

        return PaperSize::create([
            'tenant_id' => $tenantId,
            'code' => $data['code'] ?? ('custom_'.uniqid()),
            'name' => $data['name'],
            'width_mm' => $data['width_mm'],
            'height_mm' => $data['height_mm'] ?? null,
            'unit' => $data['unit'] ?? 'mm',
            'orientation_default' => $data['orientation_default'] ?? 'portrait',
            'margin_top_mm' => $data['margin_top_mm'] ?? 10.00,
            'margin_bottom_mm' => $data['margin_bottom_mm'] ?? 10.00,
            'margin_left_mm' => $data['margin_left_mm'] ?? 10.00,
            'margin_right_mm' => $data['margin_right_mm'] ?? 10.00,
            'is_builtin' => false,
            'is_active' => true,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);
    }
}
