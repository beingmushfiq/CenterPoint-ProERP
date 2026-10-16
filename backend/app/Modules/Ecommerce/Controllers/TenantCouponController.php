<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class TenantCouponController extends Controller
{
    /**
     * List all coupons with search, status filters, and summary metrics.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Coupon::query()->latest();

        if ($request->filled('search')) {
            $search = trim($request->string('search')->toString());
            $query->where(function ($q) use ($search): void {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('discount_type') && $request->input('discount_type') !== 'all') {
            $query->where('discount_type', $request->input('discount_type'));
        }

        if ($request->filled('status')) {
            $status = $request->input('status');
            $now = now();
            if ($status === 'active') {
                $query->where('is_active', true)
                    ->where(function ($q) use ($now): void {
                        $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
                    });
            } elseif ($status === 'inactive') {
                $query->where('is_active', false);
            } elseif ($status === 'expired') {
                $query->where('ends_at', '<', $now);
            }
        }

        $coupons = $query->paginate($request->integer('per_page', 50));

        // Aggregate summary metrics for the active tenant
        $allCoupons = Coupon::all();
        $now = now();
        $stats = [
            'total_coupons' => $allCoupons->count(),
            'active_coupons' => $allCoupons->where('is_active', true)->filter(function ($c) use ($now) {
                return ! $c->ends_at || $c->ends_at >= $now;
            })->count(),
            'total_redemptions' => (int) $allCoupons->sum(fn (Coupon $c): int => (int) $c->used_count),
            'expired_coupons' => $allCoupons->filter(function ($c) use ($now) {
                return $c->ends_at && $c->ends_at < $now;
            })->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $coupons->items(),
            'meta' => [
                'current_page' => $coupons->currentPage(),
                'last_page' => $coupons->lastPage(),
                'per_page' => $coupons->perPage(),
                'total' => $coupons->total(),
                'stats' => $stats,
            ],
        ]);
    }

    /**
     * Create a single new promotional coupon code.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:64',
            'name' => 'required|string|max:255',
            'discount_type' => 'required|string|in:percentage,fixed,free_shipping',
            'discount_value' => 'required|numeric|min:0',
            'min_order_amount' => 'nullable|numeric|min:0',
            'max_discount_amount' => 'nullable|numeric|min:0',
            'applies_to' => 'nullable|string|in:order,product,category',
            'applies_to_ids' => 'nullable|array',
            'usage_limit_total' => 'nullable|integer|min:1',
            'usage_limit_per_customer' => 'nullable|integer|min:1',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'is_active' => 'nullable|boolean',
            'storefront_id' => 'nullable|integer',
        ]);

        $code = strtoupper(trim($validated['code']));

        if (Coupon::where('code', $code)->exists()) {
            return response()->json([
                'success' => false,
                'message' => "Coupon code '{$code}' already exists for this organization.",
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $coupon = Coupon::create([
            'uuid' => (string) Str::uuid(),
            'storefront_id' => $validated['storefront_id'] ?? null,
            'code' => $code,
            'name' => $validated['name'],
            'discount_type' => $validated['discount_type'],
            'discount_value' => (string) $validated['discount_value'],
            'min_order_amount' => isset($validated['min_order_amount']) ? (string) $validated['min_order_amount'] : null,
            'max_discount_amount' => isset($validated['max_discount_amount']) ? (string) $validated['max_discount_amount'] : null,
            'applies_to' => $validated['applies_to'] ?? 'order',
            'applies_to_ids' => $validated['applies_to_ids'] ?? null,
            'usage_limit_total' => $validated['usage_limit_total'] ?? null,
            'usage_limit_per_customer' => $validated['usage_limit_per_customer'] ?? 1,
            'used_count' => 0,
            'starts_at' => $validated['starts_at'] ?? null,
            'ends_at' => $validated['ends_at'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => is_numeric(Auth::id()) ? (int) Auth::id() : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Coupon '{$coupon->code}' generated successfully!",
            'data' => $coupon,
        ], Response::HTTP_CREATED);
    }

    /**
     * Batch generator for promo vouchers / promotional campaign batches.
     */
    public function generateBatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prefix' => 'nullable|string|max:16',
            'count' => 'required|integer|min:1|max:100',
            'name' => 'required|string|max:255',
            'discount_type' => 'required|string|in:percentage,fixed,free_shipping',
            'discount_value' => 'required|numeric|min:0',
            'min_order_amount' => 'nullable|numeric|min:0',
            'max_discount_amount' => 'nullable|numeric|min:0',
            'usage_limit_total' => 'nullable|integer|min:1',
            'usage_limit_per_customer' => 'nullable|integer|min:1',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'is_active' => 'nullable|boolean',
        ]);

        $count = (int) $validated['count'];
        $prefix = strtoupper(trim($validated['prefix'] ?? 'PROMO'));
        $createdCoupons = [];

        DB::beginTransaction();
        try {
            for ($i = 0; $i < $count; $i++) {
                // Generate a collision-resistant clean alphanumeric code
                $attempts = 0;
                do {
                    $randomPart = strtoupper(substr(str_shuffle('23456789ABCDEFGHJKLMNPQRSTUVWXYZ'), 0, 6));
                    $code = $prefix ? "{$prefix}-{$randomPart}" : $randomPart;
                    $exists = Coupon::where('code', $code)->exists();
                    $attempts++;
                } while ($exists && $attempts < 10);

                if ($exists) {
                    continue;
                }

                $coupon = Coupon::create([
                    'uuid' => (string) Str::uuid(),
                    'code' => $code,
                    'name' => $validated['name'].($count > 1 ? ' #'.($i + 1) : ''),
                    'discount_type' => $validated['discount_type'],
                    'discount_value' => (string) $validated['discount_value'],
                    'min_order_amount' => isset($validated['min_order_amount']) ? (string) $validated['min_order_amount'] : null,
                    'max_discount_amount' => isset($validated['max_discount_amount']) ? (string) $validated['max_discount_amount'] : null,
                    'applies_to' => 'order',
                    'usage_limit_total' => $validated['usage_limit_total'] ?? 1,
                    'usage_limit_per_customer' => $validated['usage_limit_per_customer'] ?? 1,
                    'used_count' => 0,
                    'starts_at' => $validated['starts_at'] ?? null,
                    'ends_at' => $validated['ends_at'] ?? null,
                    'is_active' => $validated['is_active'] ?? true,
                    'created_by' => is_numeric(Auth::id()) ? (int) Auth::id() : null,
                ]);

                $createdCoupons[] = $coupon;
            }
            DB::commit();
        } catch (Throwable $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Failed to generate batch coupons: '.$e->getMessage(),
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        return response()->json([
            'success' => true,
            'message' => count($createdCoupons).' promo codes generated successfully!',
            'data' => $createdCoupons,
        ], Response::HTTP_CREATED);
    }

    /**
     * Show coupon details and redemptions.
     */
    public function show(int $id): JsonResponse
    {
        $coupon = Coupon::with(['redemptions' => function ($q): void {
            $q->latest()->take(20);
        }])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $coupon,
        ]);
    }

    /**
     * Update coupon settings.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $coupon = Coupon::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'discount_type' => 'sometimes|required|string|in:percentage,fixed,free_shipping',
            'discount_value' => 'sometimes|required|numeric|min:0',
            'min_order_amount' => 'nullable|numeric|min:0',
            'max_discount_amount' => 'nullable|numeric|min:0',
            'usage_limit_total' => 'nullable|integer|min:1',
            'usage_limit_per_customer' => 'nullable|integer|min:1',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'is_active' => 'sometimes|boolean',
        ]);

        if (isset($validated['discount_value'])) {
            $validated['discount_value'] = (string) $validated['discount_value'];
        }
        if (array_key_exists('min_order_amount', $validated)) {
            $validated['min_order_amount'] = $validated['min_order_amount'] !== null ? (string) $validated['min_order_amount'] : null;
        }
        if (array_key_exists('max_discount_amount', $validated)) {
            $validated['max_discount_amount'] = $validated['max_discount_amount'] !== null ? (string) $validated['max_discount_amount'] : null;
        }

        $userId = is_numeric(Auth::id()) ? (int) Auth::id() : null;
        $validated['updated_by'] = $userId;

        $coupon->fill($validated);
        $coupon->save();

        return response()->json([
            'success' => true,
            'message' => "Coupon '{$coupon->code}' updated successfully.",
            'data' => $coupon->fresh(),
        ]);
    }

    /**
     * Toggle coupon active/inactive status.
     */
    public function toggleStatus(int $id): JsonResponse
    {
        $coupon = Coupon::findOrFail($id);
        $coupon->is_active = ! $coupon->is_active;
        $authId = Auth::id();
        $coupon->updated_by = is_numeric($authId) && (int) $authId >= 0 ? (int) $authId : null;
        $coupon->save();

        return response()->json([
            'success' => true,
            'message' => "Coupon '{$coupon->code}' is now ".($coupon->is_active ? 'Active' : 'Disabled').'.',
            'data' => $coupon,
        ]);
    }

    /**
     * Delete / soft-delete a coupon.
     */
    public function destroy(int $id): JsonResponse
    {
        $coupon = Coupon::findOrFail($id);
        $code = $coupon->code;
        $coupon->delete();

        return response()->json([
            'success' => true,
            'message' => "Coupon '{$code}' deleted.",
        ]);
    }

    /**
     * Bulk import promotional coupons and discount vouchers.
     */
    public function bulkImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rows' => 'required|array|min:1',
            'mode' => 'nullable|string|in:skip,upsert',
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $tenantId = \App\Core\Tenancy\TenantContext::current()->tenantId();
        $userId = Auth::id() ?? 1;

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $userId,
                $mode,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $i => $row) {
                    $rowNum = ($chunkIndex * 100) + $i + 1;

                    $code = strtoupper(trim((string) ($row['code'] ?? $row['coupon_code'] ?? '')));
                    if ($code === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'code',
                            'message' => 'Coupon code is required.',
                        ];

                        continue;
                    }

                    $name = trim((string) ($row['name'] ?? $row['title'] ?? $code));
                    $rawType = strtolower(trim((string) ($row['discount_type'] ?? $row['type'] ?? 'percentage')));
                    $discountType = match ($rawType) {
                        'fixed', 'fixed_amount', 'flat', 'amount' => 'fixed',
                        'free_shipping', 'shipping' => 'free_shipping',
                        default => 'percentage',
                    };

                    $val = isset($row['discount_value']) ? (float) $row['discount_value'] : (isset($row['value']) ? (float) $row['value'] : (isset($row['discount']) ? (float) $row['discount'] : 0.0));
                    $discountValue = number_format($val, 4, '.', '');

                    $minOrder = isset($row['min_order_amount']) && is_numeric($row['min_order_amount'])
                        ? number_format((float) $row['min_order_amount'], 4, '.', '')
                        : (isset($row['min_spend']) && is_numeric($row['min_spend']) ? number_format((float) $row['min_spend'], 4, '.', '') : null);

                    $maxDiscount = isset($row['max_discount_amount']) && is_numeric($row['max_discount_amount'])
                        ? number_format((float) $row['max_discount_amount'], 4, '.', '')
                        : null;

                    $appliesTo = ! empty($row['applies_to']) ? (string) $row['applies_to'] : 'order';

                    $usageLimit = isset($row['usage_limit_total']) && is_numeric($row['usage_limit_total'])
                        ? (int) $row['usage_limit_total']
                        : (isset($row['usage_limit']) && is_numeric($row['usage_limit']) ? (int) $row['usage_limit'] : null);

                    $limitPerCustomer = isset($row['usage_limit_per_customer']) && is_numeric($row['usage_limit_per_customer'])
                        ? (int) $row['usage_limit_per_customer']
                        : 1;

                    $startsAt = ! empty($row['starts_at']) ? (string) $row['starts_at'] : (! empty($row['start_date']) ? (string) $row['start_date'] : null);
                    $endsAt = ! empty($row['ends_at']) ? (string) $row['ends_at'] : (! empty($row['expiry_date']) ? (string) $row['expiry_date'] : (! empty($row['end_date']) ? (string) $row['end_date'] : null));

                    $isActive = isset($row['is_active']) ? filter_var($row['is_active'], FILTER_VALIDATE_BOOLEAN) : true;

                    $existing = Coupon::withoutGlobalScope('tenant')
                        ->where('tenant_id', $tenantId)
                        ->where('code', $code)
                        ->first();

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        // Upsert
                        $existing->update([
                            'name' => $name,
                            'discount_type' => $discountType,
                            'discount_value' => $discountValue,
                            'min_order_amount' => $minOrder ?? $existing->min_order_amount,
                            'max_discount_amount' => $maxDiscount ?? $existing->max_discount_amount,
                            'applies_to' => $appliesTo,
                            'usage_limit_total' => $usageLimit ?? $existing->usage_limit_total,
                            'usage_limit_per_customer' => $limitPerCustomer,
                            'starts_at' => $startsAt ?? $existing->starts_at,
                            'ends_at' => $endsAt ?? $existing->ends_at,
                            'is_active' => $isActive,
                            'updated_by' => $userId,
                        ]);

                        $updated++;

                        continue;
                    }

                    // Insert
                    Coupon::create([
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' => $tenantId,
                        'code' => $code,
                        'name' => $name,
                        'discount_type' => $discountType,
                        'discount_value' => $discountValue,
                        'min_order_amount' => $minOrder,
                        'max_discount_amount' => $maxDiscount,
                        'applies_to' => $appliesTo,
                        'usage_limit_total' => $usageLimit,
                        'usage_limit_per_customer' => $limitPerCustomer,
                        'used_count' => 0,
                        'starts_at' => $startsAt,
                        'ends_at' => $endsAt,
                        'is_active' => $isActive,
                        'created_by' => $userId,
                    ]);

                    $imported++;
                }
            });
        }

        return response()->json([
            'success' => true,
            'message' => "Bulk import completed. {$imported} coupon(s) imported, {$updated} updated, {$skipped} skipped.",
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'failed' => count($errors),
            'errors' => $errors,
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'failed_count' => count($errors),
                'errors' => $errors,
            ],
        ]);
    }
}
