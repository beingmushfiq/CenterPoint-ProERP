<?php

declare(strict_types=1);

namespace App\Modules\Platform\Services;

use App\Models\PlatformRole;
use Illuminate\Support\Str;

class PlatformRbacService
{
    /**
     * Authoritative list of all platform permissions with human-readable labels and categories.
     *
     * @return array<string, array{name: string, description: string, category: string}>
     */
    public static function getCatalogue(): array
    {
        return [
            'platform.dashboard.view' => [
                'name' => 'View Platform Dashboard',
                'description' => 'View telemetry KPIs, revenue metrics, and cluster health.',
                'category' => 'Telemetry',
            ],
            'platform.tenants.view' => [
                'name' => 'View Tenant Directory',
                'description' => 'View tenant list, details, and usage metrics.',
                'category' => 'Tenancy',
            ],
            'platform.tenants.create' => [
                'name' => 'Provision Tenant',
                'description' => 'Provision new enterprise and trial tenants.',
                'category' => 'Tenancy',
            ],
            'platform.tenants.update' => [
                'name' => 'Update Tenant Details',
                'description' => 'Modify tenant branding, settings, and modules.',
                'category' => 'Tenancy',
            ],
            'platform.tenants.status' => [
                'name' => 'Manage Tenant Lifecycle',
                'description' => 'Suspend, activate, or archive tenants.',
                'category' => 'Tenancy',
            ],
            'platform.tenants.delete' => [
                'name' => 'Delete Tenant',
                'description' => 'Soft delete or decommission a tenant.',
                'category' => 'Tenancy',
            ],
            'platform.subscriptions.view' => [
                'name' => 'View Subscriptions',
                'description' => 'View tenant subscription tiers and histories.',
                'category' => 'Billing',
            ],
            'platform.subscriptions.manage' => [
                'name' => 'Manage Subscriptions',
                'description' => 'Extend, set absolute expiry, apply discounts, or renew subscriptions.',
                'category' => 'Billing',
            ],
            'platform.payments.manage' => [
                'name' => 'Manage SaaS Payments',
                'description' => 'Record, view, and update subscription payments.',
                'category' => 'Billing',
            ],
            'platform.plans.manage' => [
                'name' => 'Manage Subscription Plans',
                'description' => 'Create, edit, and archive subscription plan tiers.',
                'category' => 'Billing',
            ],
            'platform.domains.manage' => [
                'name' => 'Manage Custom Domains',
                'description' => 'Verify, toggle, and inspect custom domains.',
                'category' => 'Domains',
            ],
            'platform.impersonate' => [
                'name' => 'Tenant Impersonation',
                'description' => 'Issue short-lived impersonation tokens for troubleshooting.',
                'category' => 'Security',
            ],
            'platform.audit.view' => [
                'name' => 'View Platform Audit Trail',
                'description' => 'Inspect append-only platform-wide audit logs.',
                'category' => 'Compliance',
            ],
            'platform.errors.view' => [
                'name' => 'View Error Telemetry',
                'description' => 'View real-time error logs and deduplicated diagnostics.',
                'category' => 'Observability',
            ],
            'platform.errors.manage' => [
                'name' => 'Manage Error Telemetry',
                'description' => 'Resolve, triage, and annotate error records.',
                'category' => 'Observability',
            ],
            'platform.flags.manage' => [
                'name' => 'Manage Feature Flags',
                'description' => 'Toggle platform capabilities and staged rollout flags.',
                'category' => 'Platform Control',
            ],
            'platform.settings.manage' => [
                'name' => 'Manage Platform Settings',
                'description' => 'Configure platform parameters and maintenance mode.',
                'category' => 'Platform Control',
            ],
            'platform.health.view' => [
                'name' => 'View System Health & Jobs',
                'description' => 'Inspect infrastructure health and queue jobs.',
                'category' => 'Observability',
            ],
            'platform.jobs.manage' => [
                'name' => 'Manage Queue Jobs',
                'description' => 'Retry or delete failed background jobs.',
                'category' => 'Observability',
            ],
            'platform.announcements.manage' => [
                'name' => 'Manage Announcements',
                'description' => 'Create and schedule platform broadcast notices.',
                'category' => 'Communications',
            ],
            'platform.support.manage' => [
                'name' => 'Manage Support Tickets',
                'description' => 'Triage, assign, and respond to support tickets.',
                'category' => 'Support',
            ],
            'platform.admins.manage' => [
                'name' => 'Manage Platform Administrators',
                'description' => 'Create and manage platform staff and RBAC roles.',
                'category' => 'Administration',
            ],
        ];
    }

    /**
     * Ensure default system platform roles exist in the database.
     */
    public static function seedDefaultRoles(): void
    {
        $defaultRoles = [
            [
                'name' => 'Platform Owner',
                'slug' => 'platform_owner',
                'description' => 'Absolute authority over all platform operations, administrators, and infrastructure.',
                'permissions' => ['*'],
                'is_system' => true,
            ],
            [
                'name' => 'Super Administrator',
                'slug' => 'super_admin',
                'description' => 'Full administrative access across all tenant management, observability, and billing functions.',
                'permissions' => ['*'],
                'is_system' => true,
            ],
            [
                'name' => 'Operations Manager',
                'slug' => 'operations_manager',
                'description' => 'Tenant management, plan tiers, custom domains, support, and platform announcements.',
                'permissions' => [
                    'platform.dashboard.view',
                    'platform.tenants.*',
                    'platform.subscriptions.*',
                    'platform.plans.manage',
                    'platform.domains.manage',
                    'platform.announcements.manage',
                    'platform.support.manage',
                ],
                'is_system' => true,
            ],
            [
                'name' => 'Support Manager',
                'slug' => 'support_manager',
                'description' => 'Troubleshooting, tenant impersonation, support ticket handling, error triage, and audit trail.',
                'permissions' => [
                    'platform.dashboard.view',
                    'platform.tenants.view',
                    'platform.subscriptions.view',
                    'platform.impersonate',
                    'platform.support.manage',
                    'platform.errors.view',
                    'platform.errors.manage',
                    'platform.audit.view',
                ],
                'is_system' => true,
            ],
            [
                'name' => 'Billing Manager',
                'slug' => 'billing_manager',
                'description' => 'Subscription extensions, validity adjustments, invoices, and SaaS payment records.',
                'permissions' => [
                    'platform.dashboard.view',
                    'platform.tenants.view',
                    'platform.subscriptions.*',
                    'platform.payments.manage',
                    'platform.plans.manage',
                ],
                'is_system' => true,
            ],
            [
                'name' => 'Tech Administrator',
                'slug' => 'tech_admin',
                'description' => 'Error monitoring, infrastructure health, background queue jobs, and feature flags.',
                'permissions' => [
                    'platform.dashboard.view',
                    'platform.health.view',
                    'platform.jobs.manage',
                    'platform.errors.*',
                    'platform.flags.manage',
                    'platform.settings.manage',
                    'platform.audit.view',
                ],
                'is_system' => true,
            ],
            [
                'name' => 'Read-Only Auditor',
                'slug' => 'read_only',
                'description' => 'Read-only visibility for compliance inspection and financial telemetry.',
                'permissions' => [
                    'platform.dashboard.view',
                    'platform.tenants.view',
                    'platform.subscriptions.view',
                    'platform.audit.view',
                    'platform.errors.view',
                    'platform.health.view',
                ],
                'is_system' => true,
            ],
        ];

        foreach ($defaultRoles as $data) {
            PlatformRole::updateOrCreate(
                ['slug' => $data['slug']],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' => $data['name'],
                    'description' => $data['description'],
                    'permissions' => $data['permissions'],
                    'is_system' => $data['is_system'],
                ]
            );
        }
    }
}
