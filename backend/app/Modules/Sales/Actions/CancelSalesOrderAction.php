<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Delivery\Models\CourierShipment;
use App\Modules\Sales\Models\CrmActivity;
use App\Modules\Sales\Models\CrmLead;
use App\Modules\Sales\Models\DeliveryOrder;
use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Support\Facades\DB;

final class CancelSalesOrderAction
{
    /**
     * Cancel a sales order and cascade cancellation to unfulfilled delivery orders,
     * courier shipments, and pending draft invoices.
     */
    public function execute(SalesOrder $order, int $userId, ?string $reason = null): SalesOrder
    {
        return DB::transaction(function () use ($order, $userId, $reason): SalesOrder {
            if ($order->status === 'cancelled') {
                return $order;
            }

            if ($order->status === 'delivered') {
                throw new \DomainException("Sales order [{$order->order_number}] has already been delivered and cannot be cancelled.");
            }

            $order->status = 'cancelled';
            $order->cancelled_at = now();
            $order->cancelled_by = $userId;
            if ($reason !== null && $reason !== '') {
                $order->internal_notes = trim(($order->internal_notes ?? '') . "\nCancellation Reason: " . $reason);
            }
            $order->save();

            // 1. Cancel unfulfilled linked Delivery Orders
            /** @var \Illuminate\Database\Eloquent\Collection<int, DeliveryOrder> $unfulfilledDeliveries */
            $unfulfilledDeliveries = DeliveryOrder::where('tenant_id', $order->tenant_id)
                ->where('sales_order_id', $order->id)
                ->whereNotIn('status', ['delivered', 'cancelled'])
                ->get();

            $cancelledDeliveryIds = [];
            foreach ($unfulfilledDeliveries as $delivery) {
                $delivery->status = 'cancelled';
                $delivery->save();
                $cancelledDeliveryIds[] = $delivery->id;
            }

            // 2. Cancel unfulfilled linked Courier Shipments
            if (! empty($cancelledDeliveryIds)) {
                CourierShipment::where('tenant_id', $order->tenant_id)
                    ->whereIn('delivery_order_id', $cancelledDeliveryIds)
                    ->whereNotIn('status', ['delivered', 'cancelled', 'returned'])
                    ->update([
                        'status' => 'cancelled',
                        'error_message' => 'Linked sales order was cancelled.',
                        'updated_by' => $userId,
                    ]);
            }

            // 3. Void / Cancel pending draft Invoices linked to this order
            Invoice::where('tenant_id', $order->tenant_id)
                ->where('sales_order_id', $order->id)
                ->where('status', 'draft')
                ->update([
                    'status' => 'void',
                ]);

            // 4. Log cancellation activity on linked CRM Lead if present
            if ($order->lead_id) {
                $lead = CrmLead::where('tenant_id', $order->tenant_id)->find($order->lead_id);
                if ($lead) {
                    $activity = new CrmActivity();
                    $activity->tenant_id = $order->tenant_id;
                    $activity->subject_type = 'lead';
                    $activity->subject_id = $lead->id;
                    $activity->type = 'note';
                    $activity->title = "Order Cancelled ({$order->order_number})";
                    $activity->description = sprintf(
                        "Sales order %s was cancelled.%s",
                        $order->order_number,
                        $reason ? " Reason: {$reason}" : ""
                    );
                    $activity->assigned_to = $lead->assigned_to;
                    $activity->created_by = $userId;
                    $activity->completed_at = now();
                    $activity->save();
                }
            }

            return $order->refresh();
        });
    }
}
