<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Capabilities\TenantCapabilityManifest;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\CustomFieldDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class CustomFieldDefinitionController extends Controller
{
    /**
     * List custom fields for a module/entity or all entities.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $query = CustomFieldDefinition::where('tenant_id', $tenantId)
            ->where('is_archived', false);

        if ($request->filled('module')) {
            $query->where('module', $request->query('module'));
        }

        if ($request->filled('entity')) {
            $query->where('entity', $request->query('entity'));
        }

        $fields = $query->orderBy('sort_order')->get();

        return response()->json([
            'success' => true,
            'data' => $fields,
        ]);
    }

    /**
     * Define a new custom field.
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $validated = $request->validate([
            'module' => 'required|string|max:64',
            'entity' => 'required|string|max:64',
            'label' => 'required|string|max:128',
            'internal_key' => 'nullable|string|max:64',
            'field_type' => 'required|string|in:text,textarea,number,currency,percentage,date,datetime,time,select,multi_select,radio,checkbox,toggle,file,image,url,email,phone,barcode,qr',
            'options' => 'nullable|array',
            'validation_rules' => 'nullable|array',
            'is_required' => 'nullable|boolean',
            'default_value' => 'nullable',
            'placeholder' => 'nullable|string|max:255',
            'help_text' => 'nullable|string',
            'visibility_rules' => 'nullable|array',
            'sort_order' => 'nullable|integer',
        ]);

        $key = ! empty($validated['internal_key'])
            ? Str::slug($validated['internal_key'], '_')
            : Str::slug($validated['label'], '_');

        // Ensure key is unique per tenant + module + entity
        if (CustomFieldDefinition::where('tenant_id', $tenantId)
            ->where('module', $validated['module'])
            ->where('entity', $validated['entity'])
            ->where('internal_key', $key)
            ->exists()) {
            $key = $key.'_'.time();
        }

        $maxOrder = CustomFieldDefinition::where('tenant_id', $tenantId)
            ->where('module', $validated['module'])
            ->where('entity', $validated['entity'])
            ->max('sort_order') ?? 0;

        /** @var \App\Models\User|null $user */
        $user = $request->user();

        $field = CustomFieldDefinition::create([
            'tenant_id' => $tenantId,
            'module' => $validated['module'],
            'entity' => $validated['entity'],
            'internal_key' => $key,
            'label' => $validated['label'],
            'field_type' => $validated['field_type'],
            'options' => $validated['options'] ?? null,
            'validation_rules' => $validated['validation_rules'] ?? null,
            'is_required' => $validated['is_required'] ?? false,
            'default_value' => isset($validated['default_value']) ? (array) $validated['default_value'] : null,
            'placeholder' => $validated['placeholder'] ?? null,
            'help_text' => $validated['help_text'] ?? null,
            'visibility_rules' => $validated['visibility_rules'] ?? null,
            'sort_order' => $validated['sort_order'] ?? ($maxOrder + 1),
            'is_active' => true,
            'is_archived' => false,
            'created_by' => $user?->id,
        ]);

        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Custom field created successfully.',
            'data' => $field,
        ], 201);
    }

    /**
     * Update an existing custom field definition.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $field = CustomFieldDefinition::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'label' => 'sometimes|required|string|max:128',
            'options' => 'nullable|array',
            'validation_rules' => 'nullable|array',
            'is_required' => 'nullable|boolean',
            'default_value' => 'nullable',
            'placeholder' => 'nullable|string|max:255',
            'help_text' => 'nullable|string',
            'visibility_rules' => 'nullable|array',
            'sort_order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        /** @var \App\Models\User|null $user */
        $user = $request->user();
        $validated['updated_by'] = $user?->id;

        $field->update($validated);
        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Custom field updated successfully.',
            'data' => $field,
        ]);
    }

    /**
     * Archive a custom field (never hard delete historical metadata).
     */
    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $field = CustomFieldDefinition::where('tenant_id', $tenantId)->findOrFail($id);

        $field->update([
            'is_active' => false,
            'is_archived' => true,
        ]);

        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Custom field archived successfully.',
        ]);
    }
}
