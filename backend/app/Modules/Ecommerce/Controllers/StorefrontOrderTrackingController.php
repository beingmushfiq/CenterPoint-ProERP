<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Storefront;
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class StorefrontOrderTrackingController extends Controller
{
    /**
     * Public self-service order tracking lookup.
     */
    public function track(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_number' => 'required|string|max:64',
            'phone' => 'nullable|string|max:32',
        ]);

        /** @var Storefront|null $storefront */
        $storefront = $request->attributes->get('storefront');
        if (! $storefront) {
            return response()->json([
                'success' => false,
                'message' => 'Storefront not resolved.',
            ], Response::HTTP_NOT_FOUND);
        }

        $query = SalesOrder::where('tenant_id', $storefront->tenant_id)
            ->where('order_number', trim($validated['order_number']))
            ->with(['customer:id,name,phone,email', 'items.product:id,sku,name']);

        if (! empty($validated['phone'])) {
            $cleanPhone = preg_replace('/[^0-9]/', '', $validated['phone']);
            $query->whereHas('customer', function ($q) use ($cleanPhone): void {
                $q->whereRaw("REPLACE(REPLACE(phone, '+', ''), ' ', '') LIKE ?", ["%{$cleanPhone}%"]);
            });
        }

        $order = $query->first();

        if (! $order) {
            return response()->json([
                'success' => false,
                'message' => 'No matching order found. Please verify the order number and phone number.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Compute fulfillment timeline
        $timeline = [
            [
                'stage' => 'placed',
                'title' => 'Order Received',
                'description' => 'Your order has been logged into our system.',
                'timestamp' => $order->created_at?->toIso8601String(),
                'completed' => true,
                'current' => $order->status === 'pending',
            ],
            [
                'stage' => 'confirmed',
                'title' => 'Confirmed & In Production',
                'description' => 'Direct factory batching and inspection in progress.',
                'timestamp' => in_array($order->status, ['confirmed', 'processing', 'dispatched', 'delivered'], true) ? $order->updated_at?->toIso8601String() : null,
                'completed' => in_array($order->status, ['confirmed', 'processing', 'dispatched', 'delivered'], true),
                'current' => in_array($order->status, ['confirmed', 'processing'], true),
            ],
            [
                'stage' => 'dispatched',
                'title' => 'Dispatched with Courier',
                'description' => 'Parcel is on the way to your delivery address.',
                'timestamp' => in_array($order->status, ['dispatched', 'delivered'], true) ? $order->updated_at?->toIso8601String() : null,
                'completed' => in_array($order->status, ['dispatched', 'delivered'], true),
                'current' => $order->status === 'dispatched',
            ],
            [
                'stage' => 'delivered',
                'title' => 'Delivered',
                'description' => 'Package safely handed over.',
                'timestamp' => $order->status === 'delivered' ? $order->updated_at?->toIso8601String() : null,
                'completed' => $order->status === 'delivered',
                'current' => $order->status === 'delivered',
            ],
        ];

        // Calculate estimated delivery
        $estimatedDelivery = $order->required_date 
            ? \Carbon\Carbon::parse($order->required_date)->format('M d, Y')
            : ($order->created_at ? $order->created_at->addDays(3)->format('M d, Y') : null);

        // Mask phone for public privacy if present
        $rawPhone = $order->customer_phone ?? $order->customer?->phone ?? '';
        $maskedPhone = '';
        if (strlen($rawPhone) > 4) {
            $maskedPhone = substr($rawPhone, 0, 4) . '****' . substr($rawPhone, -3);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'order_number' => $order->order_number,
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'currency' => $order->currency ?? $storefront->currency,
                'subtotal' => $order->subtotal,
                'discount_amount' => $order->discount_amount,
                'tax_amount' => $order->tax_amount,
                'shipping_amount' => $order->shipping_amount,
                'total_amount' => $order->total_amount,
                'delivery_address' => $order->shipping_address,
                'delivery_type' => $order->delivery_type ?? 'Standard Direct Courier',
                'courier_reference' => 'CN-' . strtoupper(substr(md5($order->order_number), 0, 8)),
                'estimated_delivery' => $estimatedDelivery,
                'customer_name' => $order->customer_name ?? $order->customer?->name ?? 'Customer',
                'customer_phone' => $maskedPhone,
                'items' => $order->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_name' => $item->product?->name ?? 'Product Item',
                    'quantity' => (string) (int) $item->quantity,
                    'unit_price' => $item->unit_price,
                    'line_total' => $item->line_total,
                ]),
                'timeline' => $timeline,
            ],
        ]);
    }
}
