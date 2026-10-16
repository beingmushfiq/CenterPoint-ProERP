<?php

declare(strict_types=1);

namespace App\Modules\Pos\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Pos\Actions\ProcessPosCheckoutAction;
use App\Modules\Pos\Requests\PosCheckoutRequest;
use App\Modules\Pos\Resources\PosSessionResource;
use App\Modules\Sales\Resources\InvoiceResource;
use App\Modules\Sales\Resources\SalesOrderResource;
use Illuminate\Http\JsonResponse;

final class PosCheckoutController extends Controller
{
    public function __construct(
        private readonly ProcessPosCheckoutAction $checkoutAction
    ) {}

    public function checkout(PosCheckoutRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{pos_session_id: int, items: list<array{product_id: int, quantity: string, unit_id: int, unit_price: string}>, payments: list<array{method: string, amount: string}>} $validated */
        $result = $this->checkoutAction->execute([
            ...$validated,
            'tenant_id' => $tenantId,
            'user_id' => (int) $request->user()?->id,
        ]);

        return response()->json([
            'data' => [
                'order' => new SalesOrderResource($result['order']),
                'invoice' => new InvoiceResource($result['invoice']),
                'session' => new PosSessionResource($result['session']),
            ],
        ], 201);
    }
}
