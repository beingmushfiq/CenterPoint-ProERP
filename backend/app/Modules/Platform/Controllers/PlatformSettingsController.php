<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlatformSettingsController extends Controller
{
    /**
     * Default platform settings structure.
     */
    private const DEFAULTS = [
        'general' => [
            'platform_name' => 'DevCenterPoint SaaS Engine',
            'support_email' => 'support@devcenterpoint.com',
            'support_phone' => '+880 1700-000000',
            'website_url' => 'https://devcenterpoint.com',
            'company_name' => 'DevCenterPoint Ltd.',
        ],
        'billing' => [
            'default_currency' => 'BDT',
            'currency_symbol' => '৳',
            'default_grace_period_days' => 7,
            'tax_rate_percent' => 0,
            'auto_invoice' => true,
            'allow_offline_payments' => true,
        ],
        'security' => [
            'session_timeout_minutes' => 120,
            'max_login_attempts' => 5,
            'two_factor_required_for_admins' => false,
            'password_min_length' => 8,
            'impersonation_max_minutes' => 15,
        ],
        'maintenance' => [
            'is_maintenance_mode' => false,
            'maintenance_message' => 'DevCenterPoint platform is currently undergoing scheduled maintenance. Please check back shortly.',
            'allowed_ips' => ['127.0.0.1'],
        ],
        'notifications' => [
            'email_notifications_enabled' => true,
            'sms_gateway_configured' => false,
            'alert_on_new_tenant' => true,
            'alert_on_subscription_expiry' => true,
        ],
    ];

    /**
     * Get all platform settings organized by category group.
     */
    public function index(Request $request): JsonResponse
    {
        $rows = Setting::withoutTenantScope()
            ->where('scope', 'platform')
            ->get()
            ->keyBy(fn (Setting $s) => "{$s->group}.{$s->key}");

        $result = [];
        foreach (self::DEFAULTS as $group => $items) {
            $result[$group] = [];
            foreach ($items as $key => $defaultVal) {
                $lookupKey = "{$group}.{$key}";
                if (isset($rows[$lookupKey])) {
                    $rowVal = $rows[$lookupKey]->value;
                    $result[$group][$key] = is_array($rowVal) && isset($rowVal['val']) ? $rowVal['val'] : $rowVal;
                } else {
                    $result[$group][$key] = $defaultVal;
                }
            }
        }

        return response()->json([
            'success' => true,
            'data' => $result,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Update settings for a specific group (general, billing, security, maintenance, notifications).
     */
    public function update(Request $request, string $group): JsonResponse
    {
        if (! array_key_exists($group, self::DEFAULTS)) {
            return response()->json([
                'success' => false,
                'message' => "Unknown settings group '{$group}'. Allowed: ".implode(', ', array_keys(self::DEFAULTS)),
            ], 422);
        }

        $input = $request->input('settings', $request->all());

        foreach ($input as $key => $value) {
            Setting::withoutTenantScope()->updateOrCreate(
                [
                    'scope' => 'platform',
                    'scope_id' => 0,
                    'group' => $group,
                    'key' => $key,
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'value' => ['val' => $value],
                    'value_type' => gettype($value),
                    'is_encrypted' => false,
                    'updated_by' => $request->user()?->id,
                ]
            );
        }

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Updated,
            'auditable_type' => 'PlatformSettings',
            'auditable_id' => 0,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => ['group' => $group, 'updated_keys' => array_keys($input)],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Platform {$group} settings updated successfully.",
        ]);
    }

    /**
     * Dedicated action to toggle platform maintenance mode.
     */
    public function toggleMaintenance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'is_maintenance_mode' => 'required|boolean',
            'maintenance_message' => 'nullable|string',
            'allowed_ips' => 'nullable|array',
            'allowed_ips.*' => 'string',
        ]);

        $settings = [
            'is_maintenance_mode' => $validated['is_maintenance_mode'],
        ];
        if (isset($validated['maintenance_message'])) {
            $settings['maintenance_message'] = $validated['maintenance_message'];
        }
        if (isset($validated['allowed_ips'])) {
            $settings['allowed_ips'] = $validated['allowed_ips'];
        }

        foreach ($settings as $key => $value) {
            Setting::withoutTenantScope()->updateOrCreate(
                [
                    'scope' => 'platform',
                    'scope_id' => 0,
                    'group' => 'maintenance',
                    'key' => $key,
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'value' => ['val' => $value],
                    'value_type' => gettype($value),
                    'is_encrypted' => false,
                    'updated_by' => $request->user()?->id,
                ]
            );
        }

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Updated,
            'auditable_type' => 'PlatformMaintenance',
            'auditable_id' => 0,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => ['is_maintenance_mode' => $validated['is_maintenance_mode']],
        ]);

        $state = $validated['is_maintenance_mode'] ? 'ACTIVATED' : 'DEACTIVATED';

        return response()->json([
            'success' => true,
            'message' => "Platform maintenance mode {$state}.",
            'is_maintenance_mode' => $validated['is_maintenance_mode'],
        ]);
    }
}
