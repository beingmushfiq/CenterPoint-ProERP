<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Services;

use App\Models\OrderFraudAssessment;
use App\Modules\Sales\Models\SalesOrder;

class OrderFraudScorerService
{
    /**
     * Compute risk score and persist fraud assessment for a sales order.
     */
    public function assessOrder(SalesOrder $order): OrderFraudAssessment
    {
        $score = 0;
        $factors = [];

        // 1. High COD order check (> 3,000 BDT)
        if (bccomp((string) $order->total_amount, '3000.0000', 4) >= 0) {
            $score += 25;
            $factors[] = [
                'code' => 'HIGH_ORDER_VALUE',
                'description' => 'Order total is high for Cash on Delivery (> 3,000 BDT).',
                'points' => 25,
            ];
        }

        // 2. Customer history check
        if ($order->party_id) {
            $pastOrdersCount = SalesOrder::query()
                ->where('tenant_id', $order->tenant_id)
                ->where('party_id', $order->party_id)
                ->where('id', '!=', $order->id)
                ->count();

            if ($pastOrdersCount === 0) {
                $score += 20;
                $factors[] = [
                    'code' => 'FIRST_TIME_BUYER',
                    'description' => 'First order placed by this customer account / phone.',
                    'points' => 20,
                ];
            }

            // Past cancelled/returned check
            $pastCancelledCount = SalesOrder::query()
                ->where('tenant_id', $order->tenant_id)
                ->where('party_id', $order->party_id)
                ->where('id', '!=', $order->id)
                ->whereIn('status', ['cancelled', 'returned'])
                ->count();

            if ($pastCancelledCount > 0) {
                $score += 35;
                $factors[] = [
                    'code' => 'PAST_CANCELLATIONS',
                    'description' => "Customer has {$pastCancelledCount} previously cancelled or returned orders.",
                    'points' => 35,
                ];
            }

            // Rapid order placement check (same customer placed order in past 2 hours)
            $recentOrdersCount = SalesOrder::query()
                ->where('tenant_id', $order->tenant_id)
                ->where('party_id', $order->party_id)
                ->where('id', '!=', $order->id)
                ->where('created_at', '>=', now()->subHours(2))
                ->count();

            if ($recentOrdersCount > 0) {
                $score += 30;
                $factors[] = [
                    'code' => 'RAPID_CONCURRENT_ORDERS',
                    'description' => "Multiple orders placed within the last 2 hours ({$recentOrdersCount} recent).",
                    'points' => 30,
                ];
            }
        }

        // 3. Address completeness check
        $address = (string) ($order->shipping_address ?? '');
        if (strlen(trim($address)) < 15) {
            $score += 15;
            $factors[] = [
                'code' => 'SHORT_SHIPPING_ADDRESS',
                'description' => 'Delivery address is very brief or may be missing specific house/road info.',
                'points' => 15,
            ];
        }

        $finalScore = min(100, $score);

        $riskLevel = match (true) {
            $finalScore >= 70 => 'high',
            $finalScore >= 30 => 'medium',
            default => 'low',
        };

        return OrderFraudAssessment::updateOrCreate(
            [
                'tenant_id' => $order->tenant_id,
                'sales_order_id' => $order->id,
            ],
            [
                'risk_score' => $finalScore,
                'risk_level' => $riskLevel,
                'risk_factors' => $factors,
                'verification_status' => $finalScore >= 70 ? 'on_hold' : 'pending_review',
                'verification_checklist' => [
                    'phone_confirmed' => false,
                    'address_validated' => false,
                    'items_confirmed' => false,
                ],
            ]
        );
    }
}
