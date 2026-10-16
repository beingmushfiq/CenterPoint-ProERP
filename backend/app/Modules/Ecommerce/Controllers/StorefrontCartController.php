<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Storefront;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StorefrontCartController extends Controller
{
    /**
     * Get or create active shopping cart for visitor.
     */
    public function getCart(Request $request): JsonResponse
    {
        $cart = $this->resolveOrCreateCart($request);
        $cart->load(['items.product', 'items.variant', 'items.unit']);

        return response()->json([
            'success' => true,
            'data' => $cart,
        ]);
    }

    /**
     * Add an item to the shopping cart.
     */
    public function addItem(Request $request): JsonResponse
    {
        $request->validate([
            'product_id' => 'required|integer',
            'variant_id' => 'nullable|integer',
            'quantity' => 'required|numeric|min:1',
        ]);

        $cart = $this->resolveOrCreateCart($request);

        $product = Product::query()->findOrFail($request->input('product_id'));
        $variant = null;
        if ($request->filled('variant_id')) {
            $variant = ProductVariant::query()->where('product_id', $product->id)->findOrFail($request->input('variant_id'));
        }

        $unitPrice = $variant ? $variant->price : $product->default_sale_price;
        $quantity = (string) $request->input('quantity');
        $lineTotal = bcmul((string) $unitPrice, $quantity, 4);

        // Check if item already exists in cart
        $existingItem = CartItem::query()
            ->where('cart_id', $cart->id)
            ->where('product_id', $product->id)
            ->where('variant_id', $variant?->id)
            ->first();

        if ($existingItem) {
            $newQuantity = bcadd((string) $existingItem->quantity, $quantity, 4);
            $existingItem->quantity = $newQuantity;
            $existingItem->line_total = bcmul((string) $existingItem->unit_price, $newQuantity, 4);
            $existingItem->save();
        } else {
            CartItem::create([
                'tenant_id' => $cart->tenant_id,
                'cart_id' => $cart->id,
                'product_id' => $product->id,
                'variant_id' => $variant?->id,
                'product_name' => $product->name.($variant ? " ({$variant->name})" : ''),
                'quantity' => $quantity,
                'unit_id' => $product->base_unit_id,
                'unit_price' => $unitPrice,
                'line_discount' => '0.0000',
                'tax_amount' => '0.0000',
                'line_total' => $lineTotal,
            ]);
        }

        $cart->recalculateTotals();
        $cart->load(['items.product', 'items.variant', 'items.unit']);

        return response()->json([
            'success' => true,
            'data' => $cart,
            'message' => 'Item added to cart',
        ]);
    }

    /**
     * Update quantity of a cart item.
     */
    public function updateItem(Request $request, string $itemId): JsonResponse
    {
        $request->validate([
            'quantity' => 'required|numeric|min:0',
        ]);

        $cart = $this->resolveOrCreateCart($request);
        $item = CartItem::query()
            ->where('cart_id', $cart->id)
            ->where(function ($q) use ($itemId): void {
                if (is_numeric($itemId)) {
                    $q->where('id', $itemId);
                } else {
                    $q->where('uuid', $itemId);
                }
            })
            ->firstOrFail();

        $quantity = (string) $request->input('quantity');
        if (bccomp($quantity, '0', 4) <= 0) {
            $item->delete();
        } else {
            $item->quantity = $quantity;
            $item->line_total = bcmul((string) $item->unit_price, $quantity, 4);
            $item->save();
        }

        $cart->recalculateTotals();
        $cart->load(['items.product', 'items.variant', 'items.unit']);

        return response()->json([
            'success' => true,
            'data' => $cart,
        ]);
    }

    /**
     * Remove an item from the shopping cart.
     */
    public function removeItem(Request $request, string $itemId): JsonResponse
    {
        $cart = $this->resolveOrCreateCart($request);
        $item = CartItem::query()
            ->where('cart_id', $cart->id)
            ->where(function ($q) use ($itemId): void {
                if (is_numeric($itemId)) {
                    $q->where('id', $itemId);
                } else {
                    $q->where('uuid', $itemId);
                }
            })
            ->first();

        if ($item) {
            $item->delete();
        }

        $cart->recalculateTotals();
        $cart->load(['items.product', 'items.variant', 'items.unit']);

        return response()->json([
            'success' => true,
            'data' => $cart,
            'message' => 'Item removed from cart',
        ]);
    }

    private function resolveOrCreateCart(Request $request): Cart
    {
        /** @var Storefront $storefront */
        $storefront = $request->attributes->get('storefront');
        $sessionToken = $request->header('X-Cart-Session') ?: $request->input('cart_token') ?: (string) Str::uuid();

        $cart = Cart::query()
            ->where('storefront_id', $storefront->id)
            ->where('session_token', $sessionToken)
            ->where('status', 'active')
            ->first();

        if (! $cart) {
            $cart = Cart::create([
                'tenant_id' => $storefront->tenant_id,
                'storefront_id' => $storefront->id,
                'session_token' => $sessionToken,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'status' => 'active',
            ]);
        }

        return $cart;
    }
}
