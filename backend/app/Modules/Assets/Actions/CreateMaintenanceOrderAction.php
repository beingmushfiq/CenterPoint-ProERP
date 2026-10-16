<?php

declare(strict_types=1);

namespace App\Modules\Assets\Actions;

use App\Modules\Assets\Models\Asset;
use App\Modules\Assets\Models\MaintenanceOrder;
use Illuminate\Support\Facades\DB;

class CreateMaintenanceOrderAction
{
    /**
     * @param array{
     *     asset_id: int,
     *     maintenance_type: string,
     *     priority?: string,
     *     problem_description?: string,
     *     scheduled_start?: string,
     *     scheduled_end?: string,
     *     performed_by_employee_id?: int,
     *     labour_cost?: float|string,
     *     parts_cost?: float|string,
     *     external_cost?: float|string,
     * } $data
     */
    public function execute(array $data, int $userId): MaintenanceOrder
    {
        return DB::transaction(function () use ($data, $userId): MaintenanceOrder {
            $asset = Asset::findOrFail($data['asset_id']);

            $labour = (string) ($data['labour_cost'] ?? '0.0000');
            $parts = (string) ($data['parts_cost'] ?? '0.0000');
            $external = (string) ($data['external_cost'] ?? '0.0000');
            $total = bcadd(bcadd($labour, $parts, 4), $external, 4);

            $orderNumber = 'MNT-'.date('Ym').'-'.str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT);

            $order = MaintenanceOrder::create([
                'order_number' => $orderNumber,
                'asset_id' => $asset->id,
                'maintenance_type' => $data['maintenance_type'],
                'priority' => $data['priority'] ?? 'normal',
                'reported_by' => $userId,
                'reported_at' => now(),
                'problem_description' => $data['problem_description'] ?? null,
                'scheduled_start' => $data['scheduled_start'] ?? null,
                'scheduled_end' => $data['scheduled_end'] ?? null,
                'status' => 'requested',
                'performed_by_employee_id' => $data['performed_by_employee_id'] ?? null,
                'labour_cost' => $labour,
                'parts_cost' => $parts,
                'external_cost' => $external,
                'total_cost' => $total,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            // Set asset status to under_maintenance
            $asset->update(['status' => 'under_maintenance', 'updated_by' => $userId]);

            return $order->load(['asset', 'performedBy']);
        });
    }
}
