<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Party;
use App\Models\Storefront;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StorefrontCheckoutController extends Controller
{
    /**
     * Complete guest or customer checkout and generate an online sales order.
     */
    public function checkout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_name' => 'required|string|max:255',
            'phone' => 'required|string|max:32',
            'email' => 'nullable|email|max:255',
            'delivery_address' => 'required|string|max:500',
            'city' => 'nullable|string|max:100',
            'payment_method' => 'required|string|in:cod,online,bkash,nagad,rocket,card',
            'notes' => 'nullable|string|max:500',
            'cart_token' => 'nullable|string',
            'transaction_id' => 'nullable|string|max:100',
        ]);

        /** @var Storefront $storefront */
        $storefront = $request->attributes->get('storefront');
        $sessionToken = $request->header('X-Cart-Session') ?: $request->input('cart_token');

        $cart = Cart::query()
            ->where('storefront_id', $storefront->id)
            ->where('session_token', $sessionToken)
            ->where('status', 'active')
            ->with(['items.product', 'items.variant'])
            ->first();

        if (! $cart || $cart->items->isEmpty()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CART_EMPTY',
                    'message' => 'Your shopping cart is empty.',
                ],
            ], 422);
        }

        return DB::transaction(function () use ($validated, $storefront, $cart): JsonResponse {
            // 1. Resolve or create customer party strictly scoped to the storefront tenant
            $customer = Party::query()
                ->where('tenant_id', $storefront->tenant_id)
                ->where('phone', $validated['phone'])
                ->first();

            if (! $customer) {
                $customerCode = 'CUST-' . strtoupper(Str::random(6));
                $customer = Party::create([
                    'tenant_id' => $storefront->tenant_id,
                    'uuid' => (string) Str::uuid(),
                    'code' => $customerCode,
                    'name' => $validated['customer_name'],
                    'phone' => $validated['phone'],
                    'email' => $validated['email'] ?? null,
                    'is_customer' => true,
                    'type' => 'individual',
                ]);
            } else {
                // Update name/email if empty or provided
                if (! empty($validated['customer_name']) && empty($customer->name)) {
                    $customer->name = $validated['customer_name'];
                }
                if (! empty($validated['email']) && empty($customer->email)) {
                    $customer->email = $validated['email'];
                }
                $customer->save();
            }

            // 2. Generate Order Number
            $orderNumber = 'SO-ONL-' . date('Ymd') . '-' . strtoupper(Str::random(4));

            // 3. Create Sales Order
            $salesOrder = SalesOrder::create([
                'tenant_id' => $storefront->tenant_id,
                'uuid' => (string) Str::uuid(),
                'order_number' => $orderNumber,
                'company_id' => $storefront->company_id,
                'branch_id' => $storefront->default_branch_id,
                'warehouse_id' => $storefront->default_warehouse_id,
                'party_id' => $customer->id,
                'channel' => 'online',
                'order_date' => now()->toDateString(),
                'currency' => $storefront->currency,
                'subtotal' => $cart->subtotal,
                'discount_amount' => $cart->discount_amount,
                'tax_amount' => $cart->tax_amount,
                'shipping_amount' => $cart->shipping_amount,
                'total_amount' => $cart->total_amount,
                'paid_amount' => (! empty($validated['transaction_id']) && in_array($validated['payment_method'], ['online', 'bkash', 'nagad', 'rocket', 'card'], true))
                    ? $cart->total_amount
                    : '0.0000',
                'status' => 'pending',
                'payment_status' => (! empty($validated['transaction_id']) && in_array($validated['payment_method'], ['online', 'bkash', 'nagad', 'rocket', 'card'], true))
                    ? 'paid'
                    : 'pending',
                'shipping_address' => $validated['delivery_address'] . ($validated['city'] ? ', ' . $validated['city'] : ''),
                'notes' => trim(($validated['notes'] ?? '') . (! empty($validated['transaction_id']) ? " [TxnID: {$validated['transaction_id']}]" : '')) ?: null,
            ]);

            // 4. Create Sales Order Items
            foreach ($cart->items as $item) {
                SalesOrderItem::create([
                    'tenant_id' => $storefront->tenant_id,
                    'uuid' => (string) Str::uuid(),
                    'sales_order_id' => $salesOrder->id,
                    'product_id' => $item->product_id,
                    'variant_id' => $item->variant_id,
                    'quantity' => $item->quantity,
                    'unit_id' => $item->unit_id,
                    'unit_price' => $item->unit_price,
                    'line_discount' => $item->line_discount,
                    'tax_amount' => $item->tax_amount,
                    'line_total' => $item->line_total,
                ]);
            }

            // 5. Convert Cart
            $cart->status = 'converted';
            $cart->converted_sales_order_id = $salesOrder->id;
            $cart->save();

            return response()->json([
                'success' => true,
                'data' => [
                    'order_number' => $salesOrder->order_number,
                    'order_uuid' => $salesOrder->uuid,
                    'total_amount' => $salesOrder->total_amount,
                    'currency' => $salesOrder->currency,
                    'payment_method' => $validated['payment_method'],
                    'status' => $salesOrder->status,
                    'tracking_token' => $salesOrder->uuid,
                ],
                'message' => 'Thank you! Your order has been placed successfully.',
            ], 201);
        });
    }
}
