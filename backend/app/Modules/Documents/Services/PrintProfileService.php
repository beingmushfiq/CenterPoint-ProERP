<?php

declare(strict_types=1);

namespace App\Modules\Documents\Services;

use App\Core\Tenancy\TenantContext;
use App\Modules\Documents\Models\PrintProfile;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final class PrintProfileService
{
    /**
     * @return Collection<int, PrintProfile>
     */
    public function getProfiles(): Collection
    {
        $tenantId = TenantContext::current()->tenantId();

        return PrintProfile::with(['paperSize'])
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('is_default', 'desc')
            ->orderBy('name', 'asc')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createProfile(array $data, int $userId): PrintProfile
    {
        $tenantId = TenantContext::current()->tenantId();

        return DB::transaction(function () use ($data, $userId, $tenantId): PrintProfile {
            $isDefault = (bool) ($data['is_default'] ?? false);

            if ($isDefault) {
                PrintProfile::where('tenant_id', $tenantId)
                    ->where('is_default', true)
                    ->update(['is_default' => false]);
            }

            return PrintProfile::create([
                'tenant_id' => $tenantId,
                'name' => $data['name'],
                'paper_size_id' => $data['paper_size_id'] ?? null,
                'orientation' => $data['orientation'] ?? 'portrait',
                'margin_top_mm' => $data['margin_top_mm'] ?? 10.00,
                'margin_bottom_mm' => $data['margin_bottom_mm'] ?? 10.00,
                'margin_left_mm' => $data['margin_left_mm'] ?? 10.00,
                'margin_right_mm' => $data['margin_right_mm'] ?? 10.00,
                'scale' => $data['scale'] ?? 1.00,
                'copies' => $data['copies'] ?? 1,
                'is_printer_friendly' => $data['is_printer_friendly'] ?? true,
                'is_default' => $isDefault,
                'is_active' => true,
                'created_by' => $userId,
                'updated_by' => $userId,
            ])->load('paperSize');
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateProfile(PrintProfile $profile, array $data, int $userId): PrintProfile
    {
        $tenantId = TenantContext::current()->tenantId();

        return DB::transaction(function () use ($profile, $data, $userId, $tenantId): PrintProfile {
            $isDefault = isset($data['is_default']) ? (bool) $data['is_default'] : $profile->is_default;

            if ($isDefault && ! $profile->is_default) {
                PrintProfile::where('tenant_id', $tenantId)
                    ->where('id', '!=', $profile->id)
                    ->where('is_default', true)
                    ->update(['is_default' => false]);
            }

            $profile->update([
                'name' => $data['name'] ?? $profile->name,
                'paper_size_id' => array_key_exists('paper_size_id', $data) ? $data['paper_size_id'] : $profile->paper_size_id,
                'orientation' => $data['orientation'] ?? $profile->orientation,
                'margin_top_mm' => $data['margin_top_mm'] ?? $profile->margin_top_mm,
                'margin_bottom_mm' => $data['margin_bottom_mm'] ?? $profile->margin_bottom_mm,
                'margin_left_mm' => $data['margin_left_mm'] ?? $profile->margin_left_mm,
                'margin_right_mm' => $data['margin_right_mm'] ?? $profile->margin_right_mm,
                'scale' => $data['scale'] ?? $profile->scale,
                'copies' => $data['copies'] ?? $profile->copies,
                'is_printer_friendly' => isset($data['is_printer_friendly']) ? (bool) $data['is_printer_friendly'] : $profile->is_printer_friendly,
                'is_default' => $isDefault,
                'is_active' => isset($data['is_active']) ? (bool) $data['is_active'] : $profile->is_active,
                'updated_by' => $userId,
            ]);

            return $profile->load('paperSize');
        });
    }
}
