<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Core\Auth\JwtService;
use App\Http\Controllers\Controller;
use App\Models\Party;
use App\Models\PartyAddress;
use App\Models\Storefront;
use App\Models\StorefrontCustomer;
use App\Modules\Sales\Models\SalesOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class StorefrontCustomerAuthController extends Controller
{
    public function __construct(
        protected JwtService $jwtService
    ) {}

    /**
     * Customer registration.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:32',
            'email' => 'nullable|email|max:255',
            'password' => 'required|string|min:8',
        ]);

        /** @var Storefront $storefront */
        $storefront = $request->attributes->get('storefront');

        // Check if customer already exists for this storefront + phone
        $existing = StorefrontCustomer::query()
            ->where('tenant_id', $storefront->tenant_id)
            ->where('storefront_id', $storefront->id)
            ->where('phone', $validated['phone'])
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CUSTOMER_ALREADY_EXISTS',
                    'message' => 'An account with this phone number already exists.',
                ],
            ], 422);
        }

        return DB::transaction(function () use ($validated, $storefront): JsonResponse {
            // Find or create ERP Customer Party
            $party = Party::query()
                ->where('tenant_id', $storefront->tenant_id)
                ->where('phone', $validated['phone'])
                ->first();

            if (! $party) {
                $party = Party::create([
                    'tenant_id' => $storefront->tenant_id,
                    'uuid' => (string) Str::uuid(),
                    'code' => 'CUST-' . strtoupper(Str::random(6)),
                    'name' => $validated['name'],
                    'phone' => $validated['phone'],
                    'email' => $validated['email'] ?? null,
                    'is_customer' => true,
                    'type' => 'individual',
                ]);
            }

            $customer = StorefrontCustomer::create([
                'tenant_id' => $storefront->tenant_id,
                'storefront_id' => $storefront->id,
                'party_id' => $party->id,
                'uuid' => (string) Str::uuid(),
                'name' => $validated['name'],
                'email' => $validated['email'] ?? null,
                'phone' => $validated['phone'],
                'password_hash' => Hash::make($validated['password']),
                'status' => 'active',
                'last_login_at' => now(),
            ]);

            $token = $this->jwtService->issueToken(
                userId: $customer->id,
                tenantId: $storefront->tenant_id,
                tokenVersion: 1,
                permVersion: '1',
                scopes: ['storefront:customer', "storefront_id:{$storefront->id}"]
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'token' => $token,
                    'customer' => [
                        'uuid' => $customer->uuid,
                        'name' => $customer->name,
                        'email' => $customer->email,
                        'phone' => $customer->phone,
                    ],
                ],
                'message' => 'Account registered successfully.',
            ], 201);
        });
    }

    /**
     * Customer login.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => 'required|string',
            'password' => 'required|string',
        ]);

        /** @var Storefront $storefront */
        $storefront = $request->attributes->get('storefront');

        $customer = StorefrontCustomer::query()
            ->where('tenant_id', $storefront->tenant_id)
            ->where('storefront_id', $storefront->id)
            ->where('phone', $validated['phone'])
            ->first();

        if (! $customer || ! Hash::check($validated['password'], $customer->password_hash)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_CREDENTIALS',
                    'message' => 'Invalid phone number or password.',
                ],
            ], 401);
        }

        if ($customer->status !== 'active') {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'ACCOUNT_SUSPENDED',
                    'message' => 'Your account is suspended. Please contact support.',
                ],
            ], 403);
        }

        $customer->update(['last_login_at' => now()]);

        $token = $this->jwtService->issueToken(
            userId: $customer->id,
            tenantId: $storefront->tenant_id,
            tokenVersion: 1,
            permVersion: '1',
            scopes: ['storefront:customer', "storefront_id:{$storefront->id}"]
        );

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $token,
                'customer' => [
                    'uuid' => $customer->uuid,
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                ],
            ],
            'message' => 'Signed in successfully.',
        ]);
    }

    /**
     * Retrieve authenticated customer profile.
     */
    public function profile(Request $request): JsonResponse
    {
        $customer = $this->resolveCustomer($request);
        if (! $customer) {
            return response()->json(['success' => false, 'error' => ['message' => 'Unauthenticated']], 401);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'uuid' => $customer->uuid,
                'name' => $customer->name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'created_at' => $customer->created_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Retrieve authenticated customer order history.
     */
    public function orders(Request $request): JsonResponse
    {
        $customer = $this->resolveCustomer($request);
        if (! $customer || ! $customer->party_id) {
            return response()->json(['success' => false, 'error' => ['message' => 'Unauthenticated']], 401);
        }

        $orders = SalesOrder::query()
            ->where('party_id', $customer->party_id)
            ->with(['items.product'])
            ->orderBy('id', 'desc')
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $orders->items(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
            ],
        ]);
    }

    /**
     * Helper to resolve customer from Bearer token.
     */
    protected function resolveCustomer(Request $request): ?StorefrontCustomer
    {
        $token = $request->bearerToken();
        if (! $token) {
            return null;
        }

        try {
            $claims = $this->jwtService->decode($token);

            // Enforce token scope isolation: must explicitly be issued for a storefront customer
            $scopes = $claims['scopes'] ?? [];
            if (! is_array($scopes) || ! in_array('storefront:customer', $scopes, true)) {
                return null;
            }

            $userId = (int) ($claims['sub'] ?? 0);

            /** @var Storefront $storefront */
            $storefront = $request->attributes->get('storefront');

            return StorefrontCustomer::query()
                ->where('id', $userId)
                ->where('tenant_id', $storefront->tenant_id)
                ->where('storefront_id', $storefront->id)
                ->first();
        } catch (\Throwable) {
            return null;
        }
    }
}
