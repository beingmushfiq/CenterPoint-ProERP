<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ProductImageController extends Controller
{
    /**
     * List all images for a product.
     */
    public function index(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($request, $product);

        $images = $product->images()
            ->orderBy('sort_order', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $images,
        ]);
    }

    /**
     * Upload or add an image for a product.
     */
    public function store(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($request, $product);

        $request->validate([
            'image' => 'nullable|file|image|mimes:jpeg,png,jpg,webp,svg,gif|max:10240',
            'url' => 'nullable|string|url|max:1000',
            'alt_key' => 'nullable|string|max:128',
            'is_primary' => 'nullable|boolean',
            'variant_id' => 'nullable|integer',
        ]);

        if (! $request->hasFile('image') && ! $request->filled('url')) {
            return ErrorResponse::make(
                request: $request,
                code: 'VALIDATION_FAILED',
                message: 'Either an image file or an image URL is required.',
                httpStatus: 422,
                retryable: false
            );
        }

        $tenantId = TenantContext::isBound() ? TenantContext::current()->tenantId() : $product->tenant_id;
        $userId = $request->user()?->id;

        $path = '';
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $filename = Str::random(24).'.'.$file->getClientOriginalExtension();
            $path = $file->storeAs("products/{$product->id}", $filename, 'public');
        } else {
            $path = (string) $request->input('url');
        }

        $existingCount = $product->images()->count();
        $isPrimary = $request->boolean('is_primary', $existingCount === 0);

        return DB::transaction(function () use ($product, $tenantId, $userId, $path, $request, $isPrimary) {
            if ($isPrimary) {
                $product->images()->update(['is_primary' => false]);
            }

            $maxSort = (int) ($product->images()->max('sort_order') ?? 0);

            $productImage = new ProductImage([
                'product_id' => $product->id,
                'variant_id' => $request->input('variant_id'),
                'path' => $path,
                'alt_key' => $request->input('alt_key'),
                'sort_order' => $maxSort + 1,
                'is_primary' => $isPrimary,
                'created_by' => $userId,
            ]);
            $productImage->tenant_id = $tenantId;
            $productImage->save();

            return response()->json([
                'success' => true,
                'message' => 'Image uploaded successfully.',
                'data' => $productImage,
            ], 201);
        });
    }

    /**
     * Delete an image from a product.
     */
    public function destroy(Request $request, Product $product, int $image): JsonResponse
    {
        $this->authorizeProduct($request, $product);

        /** @var ProductImage|null $productImage */
        $productImage = $product->images()->where('id', $image)->first();

        if (! $productImage) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'Image not found for this product.',
                httpStatus: 404,
                retryable: false
            );
        }

        $wasPrimary = $productImage->is_primary;
        $path = $productImage->path;

        DB::transaction(function () use ($product, $productImage, $wasPrimary): void {
            $productImage->delete();

            if ($wasPrimary) {
                $next = $product->images()->orderBy('sort_order', 'asc')->first();
                if ($next) {
                    $next->update(['is_primary' => true]);
                }
            }
        });

        // Delete local disk file if applicable
        if (! Str::startsWith($path, ['http://', 'https://', 'data:'])) {
            Storage::disk('public')->delete($path);
        }

        return response()->json([
            'success' => true,
            'message' => 'Image removed successfully.',
        ]);
    }

    /**
     * Mark an image as primary for the product.
     */
    public function setPrimary(Request $request, Product $product, int $image): JsonResponse
    {
        $this->authorizeProduct($request, $product);

        /** @var ProductImage|null $productImage */
        $productImage = $product->images()->where('id', $image)->first();

        if (! $productImage) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'Image not found for this product.',
                httpStatus: 404,
                retryable: false
            );
        }

        DB::transaction(function () use ($product, $productImage): void {
            $product->images()->update(['is_primary' => false]);
            $productImage->update(['is_primary' => true]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Primary image updated successfully.',
            'data' => $productImage->fresh(),
        ]);
    }

    /**
     * Reorder images for a product.
     */
    public function reorder(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($request, $product);

        $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer',
        ]);

        $order = (array) $request->input('order');

        DB::transaction(function () use ($product, $order): void {
            foreach ($order as $index => $imageId) {
                $product->images()
                    ->where('id', $imageId)
                    ->update(['sort_order' => $index + 1]);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Images reordered successfully.',
            'data' => $product->images()->orderBy('sort_order', 'asc')->get(),
        ]);
    }

    private function authorizeProduct(Request $request, Product $product): void
    {
        if (TenantContext::isBound() && $product->tenant_id !== TenantContext::current()->tenantId()) {
            abort(404, 'The requested resource was not found.');
        }
    }
}
