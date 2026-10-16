<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Party;
use App\Models\PartyAddress;
use App\Models\User;
use App\Modules\Catalogue\Actions\CreatePartyAction;
use App\Modules\Catalogue\Actions\DeletePartyAction;
use App\Modules\Catalogue\Actions\UpdatePartyAction;
use App\Modules\Catalogue\Requests\StorePartyRequest;
use App\Modules\Catalogue\Requests\UpdatePartyRequest;
use App\Modules\Catalogue\Resources\PartyResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class PartyController extends Controller
{
    /**
     * GET /v1/parties
     */
    public function index(Request $request): JsonResponse
    {
        $allowed = [
            'is_supplier', 'is_customer', 'is_dealer', 'is_agent',
            'type', 'status', 'assigned_to', 'q', 'sort', 'page', 'per_page',
        ];
        $unknown = array_diff(array_keys($request->all()), $allowed);
        if ($unknown !== []) {
            return ErrorResponse::make(
                request: $request,
                code: 'VALIDATION_FAILED',
                message: 'Unknown query parameter(s): '.implode(', ', $unknown),
                httpStatus: 422,
                retryable: false,
            );
        }

        $query = Party::query();

        // Role filters
        foreach (['is_supplier', 'is_customer', 'is_dealer', 'is_agent'] as $role) {
            $val = $request->input($role);
            if (is_string($val)) {
                $query->where($role, filter_var($val, FILTER_VALIDATE_BOOLEAN));
            }
        }

        // Enum / String filters
        foreach (['type', 'status'] as $field) {
            $val = $request->input($field);
            if (is_string($val)) {
                $query->where($field, $val);
            }
        }

        // Assignee UUID filter
        $assigneeUuid = $request->input('assigned_to');
        if (is_string($assigneeUuid) && $assigneeUuid !== '') {
            $assignee = User::withoutGlobalScope('tenant')
                ->where('tenant_id', TenantContext::current()->tenantId())
                ->where('uuid', $assigneeUuid)
                ->first();
            if ($assignee !== null) {
                $query->where('assigned_to', $assignee->id);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        // Search: code, name, phone, email
        $qParam = $request->input('q');
        if (is_string($qParam) && mb_strlen($qParam) >= 2) {
            $search = '%'.$qParam.'%';
            $query->where(fn ($qr) => $qr->where('code', 'like', $search)
                ->orWhere('name', 'like', $search)
                ->orWhere('phone', 'like', $search)
                ->orWhere('email', 'like', $search));
        }

        // Sort
        $sortRaw = $request->input('sort', 'id');
        $sortParam = is_string($sortRaw) ? $sortRaw : 'id';
        $sortAllowed = ['id', 'code', 'name', 'type', 'status', 'credit_limit', 'current_balance', 'created_at', 'updated_at'];
        foreach (explode(',', $sortParam) as $piece) {
            $desc = str_starts_with($piece, '-');
            $field = $desc ? substr($piece, 1) : $piece;
            if (in_array($field, $sortAllowed, true)) {
                $query->orderBy($field, $desc ? 'desc' : 'asc');
            }
        }
        $query->orderBy('id', 'asc');

        // Pagination
        $perPageRaw = $request->input('per_page', 25);
        /** @phpstan-ignore cast.int */
        $perPage = is_int($perPageRaw) ? $perPageRaw : (int) $perPageRaw;
        if ($perPage > 100) {
            return ErrorResponse::make(
                request: $request,
                code: 'VALIDATION_FAILED',
                message: 'per_page must not exceed 100.',
                httpStatus: 422,
                retryable: false,
            );
        }
        $pageRaw = $request->input('page', 1);
        /** @phpstan-ignore cast.int */
        $page = is_int($pageRaw) ? $pageRaw : (int) $pageRaw;

        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        /** @var array<string, mixed> $filters */
        $filters = [];
        foreach (['is_supplier', 'is_customer', 'is_dealer', 'is_agent', 'type', 'status', 'assigned_to', 'q'] as $f) {
            if ($request->filled($f)) {
                $filters[$f] = $request->input($f);
            }
        }

        $searchApplied = $request->input('q');

        return response()->json([
            'success' => true,
            'data' => PartyResource::collection($paginated->items()),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'pagination' => [
                    'page' => $paginated->currentPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'total_pages' => $paginated->lastPage(),
                    'has_more' => $paginated->hasMorePages(),
                ],
                'applied' => [
                    'filters' => $filters,
                    'sort' => $sortParam,
                    'search' => is_string($searchApplied) ? $searchApplied : null,
                ],
            ],
        ]);
    }

    /**
     * GET /v1/parties/{party}
     */
    public function show(Request $request, Party $party): JsonResponse
    {
        if (TenantContext::isBound() && $party->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false,
            );
        }

        $party->load(['addresses', 'contacts', 'priceList', 'taxProfile', 'assignee']);

        return response()->json([
            'success' => true,
            'data' => new PartyResource($party),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    /**
     * GET /v1/parties/options
     */
    public function options(Request $request): JsonResponse
    {
        $query = Party::query()->where('status', 'active')->orderBy('name');

        foreach (['is_supplier', 'is_customer', 'is_dealer', 'is_agent'] as $role) {
            $val = $request->input($role);
            if (is_string($val)) {
                $query->where($role, filter_var($val, FILTER_VALIDATE_BOOLEAN));
            }
        }

        /** @var Collection<int, array<string, mixed>> $items */
        $items = $query->limit(500)->get(['uuid', 'id', 'code', 'name', 'phone', 'email', 'type', 'is_dealer', 'is_customer', 'credit_limit', 'current_balance'])->map(static fn (Party $p) => [
            'id' => (string) $p->uuid,
            'party_id' => $p->id,
            'code' => (string) $p->code,
            'name' => (string) $p->name,
            'phone' => $p->phone,
            'email' => $p->email,
            'type' => $p->type,
            'is_dealer' => (bool) $p->is_dealer,
            'is_customer' => (bool) $p->is_customer,
            'credit_limit' => (string) $p->credit_limit,
            'current_balance' => (string) $p->current_balance,
            'label' => ((string) $p->name).' ('.((string) $p->code).')',
        ])->values();

        return response()->json([
            'success' => true,
            'data' => $items->all(),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    /**
     * POST /v1/parties
     */
    public function store(StorePartyRequest $request, CreatePartyAction $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $result = $action->execute([
            'user' => $user,
            ...$request->validated(),
        ]);

        $party = $result['party'];

        return response()->json([
            'success' => true,
            'data' => new PartyResource($party),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ], 201)->header('Location', '/v1/parties/'.$party->uuid);
    }

    /**
     * PATCH /v1/parties/{party}
     */
    public function update(UpdatePartyRequest $request, UpdatePartyAction $action, Party $party): JsonResponse
    {
        if (TenantContext::isBound() && $party->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false,
            );
        }

        /** @var User $user */
        $user = $request->user();

        $result = $action->execute([
            'user' => $user,
            'party' => $party,
            ...$request->validated(),
        ]);

        return response()->json([
            'success' => true,
            'data' => new PartyResource($result['party']),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    /**
     * DELETE /v1/parties/{party}
     */
    public function destroy(Request $request, DeletePartyAction $action, Party $party): JsonResponse
    {
        if (TenantContext::isBound() && $party->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false,
            );
        }

        /** @var User $user */
        $user = $request->user();

        $action->execute([
            'user' => $user,
            'party' => $party,
        ]);

        return response()->json([
            'success' => true,
            'data' => null,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    /**
     * POST /v1/parties/bulk-import
     */
    public function bulkImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mode' => 'nullable|string|in:skip,upsert',
            'rows' => 'required|array|min:1|max:5000',
            'rows.*.code' => 'nullable|string|max:32',
            'rows.*.name' => 'required|string|max:191',
            'rows.*.legal_name' => 'nullable|string|max:191',
            'rows.*.role' => 'nullable|string|max:32',
            'rows.*.is_customer' => 'nullable|boolean',
            'rows.*.is_supplier' => 'nullable|boolean',
            'rows.*.is_dealer' => 'nullable|boolean',
            'rows.*.is_agent' => 'nullable|boolean',
            'rows.*.type' => 'nullable|string|max:32',
            'rows.*.phone' => 'nullable|string|max:32',
            'rows.*.email' => 'nullable|string|max:191',
            'rows.*.tax_identifier' => 'nullable|string|max:64',
            'rows.*.bin' => 'nullable|string|max:64',
            'rows.*.credit_limit' => 'nullable|numeric|min:0',
            'rows.*.credit_days' => 'nullable|integer|min:0',
            'rows.*.opening_balance' => 'nullable|numeric',
            'rows.*.status' => 'nullable|string|max:32',
            'rows.*.address' => 'nullable|string|max:255',
            'rows.*.address_line1' => 'nullable|string|max:255',
            'rows.*.city' => 'nullable|string|max:100',
            'rows.*.state' => 'nullable|string|max:100',
            'rows.*.postal_code' => 'nullable|string|max:20',
            'rows.*.country_code' => 'nullable|string|max:2',
        ]);

        $mode = $validated['mode'] ?? 'skip';
        $rows = $validated['rows'];
        $tenantId = TenantContext::isBound() ? TenantContext::current()->tenantId() : (int) ($request->user()?->tenant_id ?? 1);
        $userId = (int) ($request->user()?->id ?? 1);

        // Preload existing parties for fast matching
        $existingParties = Party::all();
        $codeMap = [];
        $phoneMap = [];
        $emailMap = [];
        foreach ($existingParties as $p) {
            if ($p->code) {
                $codeMap[strtolower(trim($p->code))] = $p;
            }
            if ($p->phone) {
                $cleanP = preg_replace('/[^0-9]/', '', $p->phone);
                if ($cleanP) {
                    $phoneMap[$cleanP] = $p;
                }
            }
            if ($p->email) {
                $emailMap[strtolower(trim($p->email))] = $p;
            }
        }

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        foreach (array_chunk($rows, 100) as $chunkIdx => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIdx,
                $mode,
                $userId,
                &$codeMap,
                &$phoneMap,
                &$emailMap,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $relIdx => $row) {
                    $rowNum = ($chunkIdx * 100) + $relIdx + 2;
                    $code = ! empty($row['code']) ? trim((string) $row['code']) : null;
                    $phone = ! empty($row['phone']) ? trim((string) $row['phone']) : null;
                    $cleanPhone = $phone ? preg_replace('/[^0-9]/', '', $phone) : null;
                    $email = ! empty($row['email']) ? strtolower(trim((string) $row['email'])) : null;

                    // Match existing
                    $existing = null;
                    if ($code && isset($codeMap[strtolower($code)])) {
                        $existing = $codeMap[strtolower($code)];
                    } elseif ($cleanPhone && isset($phoneMap[$cleanPhone])) {
                        $existing = $phoneMap[$cleanPhone];
                    } elseif ($email && isset($emailMap[$email])) {
                        $existing = $emailMap[$email];
                    }

                    // Roles resolution
                    $isCustomer = 0;
                    $isSupplier = 0;
                    $isDealer = 0;
                    $isAgent = 0;

                    if (isset($row['is_customer'])) {
                        $isCustomer = $row['is_customer'] ? 1 : 0;
                    }
                    if (isset($row['is_supplier'])) {
                        $isSupplier = $row['is_supplier'] ? 1 : 0;
                    }
                    if (isset($row['is_dealer'])) {
                        $isDealer = $row['is_dealer'] ? 1 : 0;
                    }
                    if (isset($row['is_agent'])) {
                        $isAgent = $row['is_agent'] ? 1 : 0;
                    }

                    if (! empty($row['role'])) {
                        $roleLower = strtolower(trim((string) $row['role']));
                        if (str_contains($roleLower, 'cust')) {
                            $isCustomer = 1;
                        }
                        if (str_contains($roleLower, 'supp') || str_contains($roleLower, 'vendor')) {
                            $isSupplier = 1;
                        }
                        if (str_contains($roleLower, 'deal')) {
                            $isDealer = 1;
                        }
                        if (str_contains($roleLower, 'agent')) {
                            $isAgent = 1;
                        }
                        if (str_contains($roleLower, 'both')) {
                            $isCustomer = 1;
                            $isSupplier = 1;
                        }
                    }

                    // Default to customer if no roles set
                    if ($isCustomer === 0 && $isSupplier === 0 && $isDealer === 0 && $isAgent === 0) {
                        $isCustomer = 1;
                    }

                    $type = ! empty($row['type']) && in_array(strtolower(trim((string) $row['type'])), ['individual', 'business'], true)
                        ? strtolower(trim((string) $row['type']))
                        : 'business';

                    $status = ! empty($row['status']) && in_array(strtolower(trim((string) $row['status'])), ['active', 'inactive', 'blacklisted'], true)
                        ? strtolower(trim((string) $row['status']))
                        : 'active';

                    $taxId = $row['tax_identifier'] ?? $row['bin'] ?? null;
                    $creditLimit = (float) ($row['credit_limit'] ?? 0);
                    $creditDays = (int) ($row['credit_days'] ?? 0);
                    $openingBalance = (float) ($row['opening_balance'] ?? 0);

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        // Mode is upsert
                        try {
                            $updateData = [
                                'name' => $row['name'],
                                'legal_name' => $row['legal_name'] ?? $existing->legal_name,
                                'type' => $type,
                                'phone' => $phone ?? $existing->phone,
                                'email' => $email ?? $existing->email,
                                'tax_identifier' => $taxId ?? $existing->tax_identifier,
                                'credit_limit' => $creditLimit ?: $existing->credit_limit,
                                'credit_days' => $creditDays ?: $existing->credit_days,
                                'status' => $status,
                                'updated_by' => $userId,
                            ];
                            if ($isCustomer) {
                                $updateData['is_customer'] = 1;
                            }
                            if ($isSupplier) {
                                $updateData['is_supplier'] = 1;
                            }
                            if ($isDealer) {
                                $updateData['is_dealer'] = 1;
                            }
                            if ($isAgent) {
                                $updateData['is_agent'] = 1;
                            }

                            $existing->update($updateData);
                            $updated++;

                            continue;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'code',
                                'value' => $code,
                                'message' => 'Update failed: '.$e->getMessage(),
                            ];

                            continue;
                        }
                    }

                    // Auto-generate code if missing
                    if (! $code) {
                        $prefix = $isSupplier && ! $isCustomer ? 'SUP-' : 'CUST-';
                        $code = $prefix.str_pad((string) random_int(1000, 99999), 5, '0', STR_PAD_LEFT);
                    }

                    try {
                        $newParty = Party::create([
                            'uuid' => (string) Str::uuid(),
                            'code' => $code,
                            'name' => $row['name'],
                            'legal_name' => $row['legal_name'] ?? null,
                            'is_customer' => $isCustomer,
                            'is_supplier' => $isSupplier,
                            'is_dealer' => $isDealer,
                            'is_agent' => $isAgent,
                            'type' => $type,
                            'phone' => $phone,
                            'email' => $email,
                            'tax_identifier' => $taxId,
                            'credit_limit' => $creditLimit,
                            'credit_days' => $creditDays,
                            'opening_balance' => $openingBalance,
                            'current_balance' => $openingBalance,
                            'status' => $status,
                            'created_by' => $userId,
                            'updated_by' => $userId,
                        ]);

                        $addrLine = $row['address_line1'] ?? $row['address'] ?? null;
                        if ($addrLine) {
                            PartyAddress::create([
                                'uuid' => (string) Str::uuid(),
                                'party_id' => $newParty->id,
                                'type' => 'billing',
                                'line1' => $addrLine,
                                'city' => $row['city'] ?? 'Dhaka',
                                'state' => $row['state'] ?? null,
                                'postal_code' => $row['postal_code'] ?? null,
                                'country_code' => $row['country_code'] ?? 'BD',
                                'is_default' => true,
                            ]);
                        }

                        $codeMap[strtolower($code)] = $newParty;
                        if ($cleanPhone) {
                            $phoneMap[$cleanPhone] = $newParty;
                        }
                        if ($email) {
                            $emailMap[$email] = $newParty;
                        }

                        $imported++;
                    } catch (Throwable $e) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'code',
                            'value' => $code,
                            'message' => 'Creation failed: '.$e->getMessage(),
                        ];
                    }
                }
            });
        }

        return response()->json([
            'success' => count($errors) === 0,
            'total' => count($rows),
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'failed' => count($errors),
            'errors' => $errors,
            'message' => sprintf(
                'Import completed: %d added, %d updated, %d skipped, %d failed.',
                $imported,
                $updated,
                $skipped,
                count($errors)
            ),
        ]);
    }
}
