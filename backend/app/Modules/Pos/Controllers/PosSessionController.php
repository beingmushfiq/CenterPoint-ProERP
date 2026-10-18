<?php

declare(strict_types=1);

namespace App\Modules\Pos\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Pos\Actions\ClosePosSessionAction;
use App\Modules\Pos\Actions\OpenPosSessionAction;
use App\Modules\Pos\Models\PosSession;
use App\Modules\Pos\Requests\ClosePosSessionRequest;
use App\Modules\Pos\Requests\OpenPosSessionRequest;
use App\Modules\Pos\Resources\PosSessionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PosSessionController extends Controller
{
    public function __construct(
        private readonly OpenPosSessionAction $openSession,
        private readonly ClosePosSessionAction $closeSession
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = PosSession::with(['terminal'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('terminal_id')) {
            $query->where('terminal_id', (int) $request->query('terminal_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('branch_id')) {
            $query->where('branch_id', (int) $request->query('branch_id'));
        }

        $sessions = $query->orderByDesc('opened_at')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return PosSessionResource::collection($sessions);
    }

    public function open(OpenPosSessionRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        try {
            $session = $this->openSession->execute([
                ...$validated,
                'tenant_id' => $tenantId,
                'user_id' => (int) $request->user()?->id,
                'created_by' => (int) $request->user()?->id,
            ]);
        } catch (\DomainException $e) {
            abort(422, $e->getMessage());
        }

        return (new PosSessionResource($session))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): PosSessionResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $session = PosSession::with(['terminal'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new PosSessionResource($session);
    }

    public function close(int $id, ClosePosSessionRequest $request): PosSessionResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $session = PosSession::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        try {
            $closed = $this->closeSession->execute(
                $session,
                (int) $request->user()?->id,
                $request->validated()
            );
        } catch (\DomainException $e) {
            abort(422, $e->getMessage());
        }

        return new PosSessionResource($closed->load(['terminal']));
    }
}
