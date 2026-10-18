<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Product;
use App\Models\Storefront;
use App\Models\StorefrontProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StorefrontWhatsAppOrderController extends Controller
{
    /**
     * Generate contextual WhatsApp checkout message and link.
     */
    public function generateOrderLink(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => 'nullable|integer',
            'quantity' => 'nullable|integer|min:1',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:32',
            'delivery_address' => 'nullable|string|max:500',
            'cart_token' => 'nullable|string',
            'order_number' => 'nullable|string|max:64',
        ]);

        /** @var Storefront $storefront */
        $storefront = $request->attributes->get('storefront');

        $whatsappNumber = preg_replace('/[^0-9]/', '', (string) ($storefront->whatsapp_number ?? '+8801700000000'));
        if (empty($whatsappNumber)) {
            $whatsappNumber = '8801700000000';
        }

        // 0. If order_number is provided, generate official receipt
        if (! empty($validated['order_number'])) {
            $order = \App\Modules\Sales\Models\SalesOrder::query()
                ->where('tenant_id', $storefront->tenant_id)
                ->where('order_number', trim($validated['order_number']))
                ->with(['customer', 'items.product'])
                ->first();

            if ($order) {
                $lines = [];
                $lines[] = "🧾 *OFFICIAL ORDER RECEIPT* — {$storefront->name}";
                $lines[] = '================================';
                $lines[] = "🔖 *Order Number:* #{$order->order_number}";
                $lines[] = '📅 *Date:* '.($order->created_at ? $order->created_at->format('M d, Y h:i A') : date('Y-m-d'));
                $lines[] = '📊 *Status:* '.ucfirst((string) $order->status).' ('.ucfirst((string) ($order->payment_status ?? 'pending')).')';
                $lines[] = '--------------------------------';
                $lines[] = '*Purchased Items:*';
                foreach ($order->items as $item) {
                    $pName = $item->product?->name ?? 'Product Item';
                    $qty = (int) $item->quantity;
                    $lines[] = "• {$qty}x {$pName} — {$order->currency} ".number_format((float) $item->line_total, 2);
                }
                $lines[] = '--------------------------------';
                $lines[] = "Subtotal: {$order->currency} ".number_format((float) $order->subtotal, 2);
                if ((float) $order->discount_amount > 0) {
                    $lines[] = "Discount: -{$order->currency} ".number_format((float) $order->discount_amount, 2);
                }
                $lines[] = "💰 *Total Amount:* {$order->currency} ".number_format((float) $order->total_amount, 2);
                $lines[] = '--------------------------------';
                if ($order->customer?->name) {
                    $lines[] = "👤 *Customer:* {$order->customer->name}";
                }
                if ($order->shipping_address) {
                    $lines[] = "📍 *Shipping Address:* {$order->shipping_address}";
                }
                $lines[] = '';
                $lines[] = "🔎 Track Live Status: /store/track?order_number={$order->order_number}";
                $lines[] = 'Thank you for shopping with us!';

                $fullMessage = implode("\n", $lines);
                $encodedText = rawurlencode($fullMessage);
                $whatsappUrl = "https://wa.me/{$whatsappNumber}?text={$encodedText}";

                return response()->json([
                    'success' => true,
                    'data' => [
                        'whatsapp_number' => $whatsappNumber,
                        'message' => $fullMessage,
                        'whatsapp_url' => $whatsappUrl,
                        'total_amount' => (string) $order->total_amount,
                    ],
                ]);
            }
        }

        $lines = [];
        $lines[] = "🛒 *NEW ORDER INQUIRY* — {$storefront->name}";
        $lines[] = '--------------------------------';

        $totalEstimated = '0.0000';

        $currency = $storefront->currency ?: 'USD';

        // 1. If ordering specific product
        if (! empty($validated['product_id'])) {
            $product = Product::query()
                ->where('tenant_id', $storefront->tenant_id)
                ->where('id', $validated['product_id'])
                ->first();

            if ($product) {
                $qty = (int) ($validated['quantity'] ?? 1);
                $sfProd = StorefrontProduct::where('storefront_id', $storefront->id)
                    ->where('product_id', $product->id)
                    ->first();
                $unitPrice = (string) ($sfProd?->price_override ?: ($product->default_sale_price ?? '0.0000'));
                $lineTotal = bcmul($unitPrice, (string) $qty, 4);
                $totalEstimated = $lineTotal;

                $lines[] = "📦 *Item:* {$product->name}";
                $lines[] = "🔢 *Quantity:* {$qty}";
                $lines[] = "💰 *Price:* {$currency} ".number_format((float) $unitPrice, 2);
                $lines[] = "💵 *Total Est:* {$currency} ".number_format((float) $lineTotal, 2);
            }
        } elseif (! empty($validated['cart_token'])) {
            // 2. If ordering from active cart
            $cart = Cart::query()
                ->where('storefront_id', $storefront->id)
                ->where('session_token', $validated['cart_token'])
                ->with(['items.product'])
                ->first();

            if ($cart && $cart->items->isNotEmpty()) {
                $lines[] = '*Cart Items:*';
                foreach ($cart->items as $item) {
                    $pName = $item->product?->name ?? 'Product';
                    $lines[] = "• {$item->quantity}x {$pName} — {$currency} ".number_format((float) $item->line_total, 2);
                }
                $lines[] = '--------------------------------';
                $lines[] = "💵 *Cart Total:* {$currency} ".number_format((float) $cart->total_amount, 2);
                $totalEstimated = (string) $cart->total_amount;
            }
        }

        // Customer details if provided
        if (! empty($validated['customer_name'])) {
            $lines[] = '';
            $lines[] = "👤 *Name:* {$validated['customer_name']}";
        }
        if (! empty($validated['customer_phone'])) {
            $lines[] = "📞 *Phone:* {$validated['customer_phone']}";
        }
        if (! empty($validated['delivery_address'])) {
            $lines[] = "📍 *Address:* {$validated['delivery_address']}";
        }

        $lines[] = '';
        $lines[] = 'Please confirm availability and dispatch schedule. Thank you!';

        $fullMessage = implode("\n", $lines);
        $encodedText = rawurlencode($fullMessage);
        $whatsappUrl = "https://wa.me/{$whatsappNumber}?text={$encodedText}";

        return response()->json([
            'success' => true,
            'data' => [
                'whatsapp_number' => $whatsappNumber,
                'message' => $fullMessage,
                'whatsapp_url' => $whatsappUrl,
                'total_amount' => $totalEstimated,
            ],
        ]);
    }
}
