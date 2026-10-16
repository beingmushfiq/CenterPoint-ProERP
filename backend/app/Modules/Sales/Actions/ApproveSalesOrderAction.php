<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Models\CrmActivity;
use App\Modules\Sales\Models\CrmLead;
use App\Modules\Sales\Models\SalesOrder;
use DomainException;
use Illuminate\Support\Facades\DB;

final class ApproveSalesOrderAction
{
    public function execute(SalesOrder $order, int $userId): SalesOrder
    {
        return DB::transaction(function () use ($order, $userId): SalesOrder {
            if (! in_array($order->status, ['draft', 'pending'], true)) {
                throw new DomainException("Sales order [{$order->order_number}] cannot be confirmed from status [{$order->status}].");
            }

            $order->status = 'confirmed';
            $order->confirmed_by = $userId;
            $order->confirmed_at = now();
            $order->save();

            // When sold / confirmed, verify the associated lead as genuine sale
            if ($order->lead_id) {
                $lead = CrmLead::where('tenant_id', $order->tenant_id)->find($order->lead_id);
                if ($lead) {
                    $lead->is_fake = false;
                    $lead->stage = 'won';
                    $lead->validated_at = now();
                    $lead->validated_by = $userId;
                    $lead->validation_notes = "Sale verified upon order {$order->order_number} confirmation.";

                    if ($order->party_id) {
                        $lead->converted_party_id = $order->party_id;
                        $lead->converted_at = now();
                    }

                    $lead->updated_by = $userId;
                    $lead->save();

                    // Log activity on lead
                    $activity = new CrmActivity;
                    $activity->tenant_id = $order->tenant_id;
                    $activity->subject_type = 'lead';
                    $activity->subject_id = $lead->id;
                    $activity->type = 'note';
                    $activity->title = 'Sale Verified (Order Confirmed)';
                    $activity->description = "Order {$order->order_number} has been confirmed. Lead marked as Won & verified as genuine sale.";
                    $activity->assigned_to = $lead->assigned_to;
                    $activity->created_by = $userId;
                    $activity->completed_at = now();
                    $activity->save();

                    // Sync salesman targets for the period
                    if ($order->salesman_id || $order->salesperson_id || $order->created_by) {
                        $periodMonth = $order->order_date ? $order->order_date->format('Y-m') : now()->format('Y-m');
                        app(SyncSalesmanAchievementAction::class)
                            ->execute($order->tenant_id, $order->salesman_id, $order->salesperson_id ?? $order->created_by, $periodMonth);
                    }
                }
            }

            return $order->refresh();
        });
    }
}
