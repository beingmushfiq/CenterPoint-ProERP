<?php

declare(strict_types=1);

namespace App\Modules\Documents\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class DocumentNumberingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $sequences = DB::table('document_sequences')
            ->where('tenant_id', $tenantId)
            ->orderBy('document_type')
            ->get();

        return response()->json([
            'data' => $sequences,
        ]);
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $sequence = DB::table('document_sequences')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        if (! $sequence) {
            return response()->json(['message' => 'Sequence not found'], 404);
        }

        $validated = $request->validate([
            'prefix' => ['nullable', 'string', 'max:32'],
            'suffix' => ['nullable', 'string', 'max:32'],
            'padding' => ['sometimes', 'integer', 'min:1', 'max:12'],
            'next_number' => ['sometimes', 'integer', 'min:1'],
            'reset_period' => ['sometimes', 'string', 'in:never,yearly,monthly'],
        ]);

        $validated['updated_at'] = now();
        $validated['updated_by'] = (int) ($request->user()?->id ?? 0);

        DB::table('document_sequences')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->update($validated);

        $updated = DB::table('document_sequences')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        return response()->json([
            'data' => $updated,
            'message' => 'Document numbering sequence updated successfully',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $validated = $request->validate([
            'document_type' => ['required', 'string', 'max:64'],
            'prefix' => ['nullable', 'string', 'max:32'],
            'suffix' => ['nullable', 'string', 'max:32'],
            'padding' => ['nullable', 'integer', 'min:1', 'max:12'],
            'next_number' => ['nullable', 'integer', 'min:1'],
            'reset_period' => ['nullable', 'string', 'in:never,yearly,monthly'],
            'company_id' => ['nullable', 'integer'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        $id = DB::table('document_sequences')->insertGetId([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'company_id' => $validated['company_id'] ?? null,
            'branch_id' => $validated['branch_id'] ?? null,
            'document_type' => $validated['document_type'],
            'prefix' => $validated['prefix'] ?? strtoupper(substr($validated['document_type'], 0, 3)).'-',
            'suffix' => $validated['suffix'] ?? null,
            'padding' => $validated['padding'] ?? 5,
            'next_number' => $validated['next_number'] ?? 1,
            'reset_period' => $validated['reset_period'] ?? 'never',
            'created_at' => now(),
            'updated_at' => now(),
            'created_by' => (int) ($request->user()?->id ?? 0),
        ]);

        $created = DB::table('document_sequences')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        return response()->json([
            'data' => $created,
            'message' => 'Document numbering sequence created successfully',
        ], 201);
    }
}
