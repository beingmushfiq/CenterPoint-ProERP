<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\ReasonCode;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class ReasonCodesTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::findOrFail(1);
        TenantContext::bind($tenant->toArray());

        if (ReasonCode::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        $reasons = [
            // QC Defect Reasons
            ['context' => 'qc_defect', 'code' => 'GLASS_CHIP', 'name' => 'Ceramic Glass Scratch / Micro-Crack', 'requires_note' => false, 'sort_order' => 1],
            ['context' => 'qc_defect', 'code' => 'COIL_OPEN', 'name' => 'Heating Coil Open Circuit / Out of Spec', 'requires_note' => false, 'sort_order' => 2],
            ['context' => 'qc_defect', 'code' => 'HIPOT_FAIL', 'name' => 'High-Voltage Insulation Breakdown (Hi-Pot Fail)', 'requires_note' => true, 'sort_order' => 3],
            ['context' => 'qc_defect', 'code' => 'FAN_NOISE', 'name' => 'Cooling Fan Vibration / Acoustic Limit Exceeded', 'requires_note' => false, 'sort_order' => 4],
            ['context' => 'qc_defect', 'code' => 'GAS_LEAK', 'name' => 'Gas Stove Valve / Manifold Pressure Leak', 'requires_note' => true, 'sort_order' => 5],
            ['context' => 'qc_defect', 'code' => 'PCB_TOUCH_ERR', 'name' => 'Touch Control Sensor IC Unresponsive (E0/E1)', 'requires_note' => false, 'sort_order' => 6],

            // Wastage Reasons
            ['context' => 'wastage', 'code' => 'SCRATCHED_FRAME', 'name' => 'Chassis Dented or Scratched during Stamping', 'requires_note' => false, 'sort_order' => 1],
            ['context' => 'wastage', 'code' => 'BLOWN_IGBT', 'name' => 'Power Surge / IGBT Component Failure during Test', 'requires_note' => true, 'sort_order' => 2],
            ['context' => 'wastage', 'code' => 'WIRE_TRIM', 'name' => 'Production Wire Harness Cable Trimmings', 'requires_note' => false, 'sort_order' => 3],
            ['context' => 'wastage', 'code' => 'DEFECTIVE_PANEL', 'name' => 'Inbound Glass Panel Internal Flaw', 'requires_note' => true, 'sort_order' => 4],

            // Stock Adjustment Reasons
            ['context' => 'stock_adjustment', 'code' => 'CYCLE_COUNT_VARIANCE', 'name' => 'Periodic Physical Cycle Count Variance', 'requires_note' => false, 'sort_order' => 1],
            ['context' => 'stock_adjustment', 'code' => 'DAMAGED_IN_STORAGE', 'name' => 'Transit or Handling Shock Damage in Warehouse', 'requires_note' => true, 'sort_order' => 2],
            ['context' => 'stock_adjustment', 'code' => 'OPENING_BALANCE_ADJ', 'name' => 'System Onboarding Opening Stock Entry', 'requires_note' => false, 'sort_order' => 3],
            ['context' => 'stock_adjustment', 'code' => 'SAMPLE_DISTRIBUTION', 'name' => 'Showroom Demo & Testing Unit Allocation', 'requires_note' => true, 'sort_order' => 4],

            // Sales Return Reasons
            ['context' => 'sales_return', 'code' => 'WARRANTY_DEFECT', 'name' => 'Customer Warranty Performance Claim', 'requires_note' => true, 'sort_order' => 1],
            ['context' => 'sales_return', 'code' => 'TRANSIT_CRUSHED', 'name' => 'Crushed Carton / Damaged During Logistics Delivery', 'requires_note' => false, 'sort_order' => 2],
            ['context' => 'sales_return', 'code' => 'WRONG_ITEM_SHIPPED', 'name' => 'Dispatched Incorrect Cooker/Stove Model', 'requires_note' => true, 'sort_order' => 3],

            // Purchase Return Reasons
            ['context' => 'purchase_return', 'code' => 'SUPPLIER_REJECTED_QC', 'name' => 'Inbound Component Failed Quality Inspection', 'requires_note' => true, 'sort_order' => 1],
            ['context' => 'purchase_return', 'code' => 'SHORT_DELIVERY', 'name' => 'Vendor Shipped Short Parts Count', 'requires_note' => false, 'sort_order' => 2],

            // Rework Reasons
            ['context' => 'rework', 'code' => 'REPLACE_COIL', 'name' => 'Replace Heating Element / Coil', 'requires_note' => false, 'sort_order' => 1],
            ['context' => 'rework', 'code' => 'SWAP_PCB', 'name' => 'Swap Faulty Digital Touch Control Board', 'requires_note' => false, 'sort_order' => 2],
            ['context' => 'rework', 'code' => 'RE_SEAL_GLASS', 'name' => 'Re-align and Re-seal Glass Top Gasket', 'requires_note' => false, 'sort_order' => 3],
            ['context' => 'rework', 'code' => 'RE_PACK_BOX', 'name' => 'Damaged Outer Box — Re-box & Re-label', 'requires_note' => false, 'sort_order' => 4],
        ];

        foreach ($reasons as $reason) {
            ReasonCode::create([
                'uuid' => (string) Str::uuid(),
                'context' => $reason['context'],
                'code' => $reason['code'],
                'name' => $reason['name'],
                'requires_note' => $reason['requires_note'],
                'is_active' => true,
                'sort_order' => $reason['sort_order'],
            ]);
        }

        TenantContext::flush();
    }
}
