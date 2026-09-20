<?php

declare(strict_types=1);

namespace App\Core\Auth;

use InvalidArgumentException;

/**
 * Permission Catalogue for SliceMart FMS (ADR-008).
 *
 * Enforces canonical 3-segment format: `module.resource.action`.
 * Closed action vocabulary:
 * - view, create, update, delete, approve, void, export, lock, assign, import, print, manage, configure.
 */
class PermissionCatalogue
{
    /**
     * Closed action vocabulary (ADR-008).
     *
     * @var list<string>
     */
    public const VALID_ACTIONS = [
        'view',
        'create',
        'update',
        'delete',
        'approve',
        'void',
        'export',
        'lock',
        'assign',
        'import',
        'print',
        'manage',
        'configure',
        'suspend',
        'checkout',
        'depreciate',
        'open',
        'close',
        'adjust',
        'dispatch',
    ];

    /**
     * Canonical system permissions list.
     *
     * @var list<string>
     */
    public const ALL_PERMISSIONS = [
        // Tenancy & Platform
        'platform.tenant.view',
        'platform.tenant.create',
        'platform.tenant.update',
        'platform.tenant.suspend',
        'platform.plan.manage',
        'platform.audit.view',

        // Core Identity & RBAC
        'core.user.view',
        'core.user.create',
        'core.user.update',
        'core.user.delete',
        'core.role.view',
        'core.role.create',
        'core.role.update',
        'core.role.delete',
        'core.role.manage',
        'core.permission.view',
        'core.audit_log.view',
        'core.setting.view',
        'core.setting.manage',
        'core.setting.configure',
        'core.sequence.configure',

        // Organization
        'org.company.view',
        'org.company.create',
        'org.company.update',
        'org.company.delete',
        'org.company.manage',
        'org.branch.view',
        'org.branch.create',
        'org.branch.update',
        'org.branch.delete',
        'org.branch.manage',
        'org.factory.view',
        'org.factory.create',
        'org.factory.update',
        'org.factory.delete',
        'org.factory.manage',
        'org.production_line.view',
        'org.production_line.create',
        'org.production_line.update',
        'org.production_line.delete',
        'org.production_line.manage',

        // Master Data & Catalog
        'catalog.unit.view',
        'catalog.unit.create',
        'catalog.unit.update',
        'catalog.unit.delete',
        'catalog.unit.manage',
        'catalog.category.view',
        'catalog.category.create',
        'catalog.category.update',
        'catalog.category.delete',
        'catalog.category.manage',
        'catalog.brand.view',
        'catalog.brand.create',
        'catalog.brand.update',
        'catalog.brand.delete',
        'catalog.brand.manage',
        'catalog.product.view',
        'catalog.product.manage',
        'catalog.product.create',
        'catalog.product.update',
        'catalog.product.delete',
        'catalog.bom.view',
        'catalog.bom.create',
        'catalog.bom.update',
        'catalog.bom.delete',
        'catalog.bom.manage',
        'catalog.price_list.view',
        'catalog.price_list.create',
        'catalog.price_list.update',
        'catalog.price_list.delete',
        'catalog.price_list.manage',
        'catalog.party.view',
        'catalog.party.manage',
        'catalog.party.create',
        'catalog.party.update',
        'catalog.party.delete',

        // Pricing
        'pricing.price_list.view',
        'pricing.price_list.create',
        'pricing.price_list.update',
        'pricing.price_list.delete',
        'pricing.price_list.manage',
        'pricing.discount_rule.view',
        'pricing.discount_rule.create',
        'pricing.discount_rule.update',
        'pricing.discount_rule.delete',
        'pricing.discount_rule.manage',
        'pricing.tax_profile.view',
        'pricing.tax_profile.create',
        'pricing.tax_profile.update',
        'pricing.tax_profile.delete',
        'pricing.tax_profile.manage',

        // Production & Worker Output
        'production.plan.view',
        'production.plan.create',
        'production.plan.update',
        'production.plan.delete',
        'production.plan.manage',
        'production.plan.approve',
        'production.batch.view',
        'production.batch.create',
        'production.batch.update',
        'production.batch.delete',
        'production.batch.manage',
        'production.batch.approve',
        'production.material_issue.view',
        'production.material_issue.create',
        'production.material_issue.update',
        'production.material_issue.delete',
        'production.output.view',
        'production.output.create',
        'production.output.update',
        'production.output.delete',
        'production.worker_entry.view',
        'production.worker_entry.create',
        'production.worker_entry.update',
        'production.worker_entry.delete',
        'production.worker_entry.manage',
        'production.worker_entry.approve',

        // QC & Wastage
        'qc.inspection.view',
        'qc.inspection.create',
        'qc.inspection.update',
        'qc.inspection.delete',
        'qc.inspection.manage',
        'qc.inspection.approve',
        'qc.parameter.view',
        'qc.parameter.create',
        'qc.parameter.update',
        'qc.parameter.delete',
        'qc.parameter.manage',
        'qc.defect.view',
        'qc.defect.create',
        'qc.defect.update',
        'qc.defect.delete',
        'qc.defect.manage',
        'qc.wastage.view',
        'qc.wastage.create',
        'qc.wastage.update',
        'qc.wastage.delete',
        'qc.wastage.manage',
        'qc.wastage.approve',

        // Inventory & Warehousing
        'inventory.warehouse.view',
        'inventory.warehouse.create',
        'inventory.warehouse.update',
        'inventory.warehouse.delete',
        'inventory.warehouse.manage',
        'inventory.stock.view',
        'inventory.stock.create',
        'inventory.stock.update',
        'inventory.stock.delete',
        'inventory.stock.adjust',
        'inventory.movement.view',
        'inventory.transfer.view',
        'inventory.transfer.create',
        'inventory.transfer.update',
        'inventory.transfer.delete',
        'inventory.transfer.approve',
        'inventory.adjustment.view',
        'inventory.adjustment.create',
        'inventory.adjustment.update',
        'inventory.adjustment.delete',
        'inventory.adjustment.approve',
        'inventory.adjustment.manage',
        'inventory.count.view',
        'inventory.count.create',
        'inventory.count.update',
        'inventory.count.delete',
        'inventory.count.approve',

        // Purchasing
        'purchasing.requisition.view',
        'purchasing.requisition.create',
        'purchasing.requisition.update',
        'purchasing.requisition.delete',
        'purchasing.requisition.approve',
        'purchasing.order.view',
        'purchasing.order.create',
        'purchasing.order.update',
        'purchasing.order.delete',
        'purchasing.order.approve',
        'purchasing.grn.view',
        'purchasing.grn.create',
        'purchasing.grn.update',
        'purchasing.grn.delete',
        'purchasing.grn.approve',
        'purchasing.bill.view',
        'purchasing.bill.create',
        'purchasing.bill.update',
        'purchasing.bill.delete',
        'purchasing.bill.approve',
        'purchasing.return.view',
        'purchasing.return.create',
        'purchasing.return.update',
        'purchasing.return.delete',

        // Sales & Invoicing
        'sales.lead.view',
        'sales.lead.create',
        'sales.lead.update',
        'sales.lead.delete',
        'sales.lead.manage',
        'sales.order.view',
        'sales.order.create',
        'sales.order.update',
        'sales.order.delete',
        'sales.order.approve',
        'sales.order.void',
        'sales.invoice.view',
        'sales.invoice.create',
        'sales.invoice.update',
        'sales.invoice.delete',
        'sales.invoice.approve',
        'sales.invoice.void',
        'sales.invoice.print',
        'sales.return.view',
        'sales.return.create',
        'sales.return.update',
        'sales.return.delete',
        'sales.return.approve',
        'sales.payment.view',
        'sales.payment.create',
        'sales.payment.update',
        'sales.payment.delete',
        'sales.delivery.view',
        'sales.delivery.create',
        'sales.delivery.update',
        'sales.delivery.delete',
        'sales.delivery.dispatch',
        'sales.exchange.view',
        'sales.exchange.create',
        'sales.exchange.update',
        'sales.exchange.delete',
        'sales.target.view',
        'sales.target.create',
        'sales.target.update',
        'sales.target.delete',
        'sales.incentive.view',
        'sales.incentive.create',
        'sales.incentive.update',
        'sales.incentive.delete',
        'sales.incentive.approve',

        // POS
        'pos.terminal.view',
        'pos.terminal.create',
        'pos.terminal.update',
        'pos.terminal.delete',
        'pos.terminal.manage',
        'pos.session.view',
        'pos.session.create',
        'pos.session.open',
        'pos.session.close',
        'pos.session.lock',
        'pos.sale.view',
        'pos.sale.create',
        'pos.sale.update',
        'pos.sale.delete',
        'pos.checkout',

        // Logistics & Delivery
        'logistics.delivery_order.view',
        'logistics.delivery_order.create',
        'logistics.delivery_order.update',
        'logistics.delivery_order.delete',
        'logistics.delivery_order.assign',
        'logistics.run_sheet.view',
        'logistics.run_sheet.create',
        'logistics.run_sheet.update',
        'logistics.run_sheet.delete',
        'logistics.run_sheet.approve',
        'logistics.shipment.view',
        'logistics.shipment.create',
        'logistics.shipment.update',
        'logistics.shipment.delete',
        'logistics.cod.view',
        'logistics.cod.create',
        'logistics.cod.update',
        'logistics.cod.approve',

        // HR & Payroll
        'hr.employee.view',
        'hr.employee.create',
        'hr.employee.update',
        'hr.employee.delete',
        'hr.attendance.view',
        'hr.attendance.create',
        'hr.attendance.update',
        'hr.attendance.delete',
        'hr.leave.view',
        'hr.leave.create',
        'hr.leave.update',
        'hr.leave.delete',
        'hr.leave.approve',
        'hr.payroll.view',
        'hr.payroll.create',
        'hr.payroll.update',
        'hr.payroll.delete',
        'hr.payroll.approve',
        'hr.payroll.lock',
        'hr.payslip.view',
        'hr.payslip.create',
        'hr.payslip.update',
        'hr.payslip.delete',
        'hr.payslip.print',

        // Assets & Maintenance
        'assets.asset.view',
        'assets.asset.create',
        'assets.asset.update',
        'assets.asset.delete',
        'assets.asset.depreciate',
        'assets.maintenance.view',
        'assets.maintenance.create',
        'assets.maintenance.update',
        'assets.maintenance.delete',
        'assets.maintenance.approve',

        // Finance & Costing
        'finance.account.view',
        'finance.account.create',
        'finance.account.update',
        'finance.account.delete',
        'finance.account.manage',
        'finance.journal.view',
        'finance.journal.create',
        'finance.journal.update',
        'finance.journal.delete',
        'finance.journal.approve',
        'finance.expense.view',
        'finance.expense.create',
        'finance.expense.update',
        'finance.expense.delete',
        'finance.expense.approve',
        'finance.bank.view',
        'finance.bank.create',
        'finance.bank.update',
        'finance.bank.delete',
        'finance.bank.manage',
        'finance.costing.view',
        'finance.costing.create',
        'finance.costing.update',
        'finance.costing.delete',
        'finance.costing.manage',

        // Reporting & Analytics
        'reports.definition.view',
        'reports.report.view',
        'reports.report.export',
        'reports.dashboard.view',
        'reports.analytics.view',

        // E-commerce
        'ecommerce.storefront.view',
        'ecommerce.storefront.create',
        'ecommerce.storefront.update',
        'ecommerce.storefront.delete',
        'ecommerce.storefront.manage',
        'ecommerce.domain.view',
        'ecommerce.domain.create',
        'ecommerce.domain.update',
        'ecommerce.domain.delete',
        'ecommerce.domain.manage',
        'ecommerce.cart.view',
        'ecommerce.cart.create',
        'ecommerce.cart.update',
        'ecommerce.cart.delete',
        'ecommerce.coupon.view',
        'ecommerce.coupon.create',
        'ecommerce.coupon.update',
        'ecommerce.coupon.delete',
        'ecommerce.coupon.manage',
        'ecommerce.review.view',
        'ecommerce.review.create',
        'ecommerce.review.update',
        'ecommerce.review.delete',
        'ecommerce.review.approve',

        // Integrations
        'integrations.webhook.view',
        'integrations.webhook.create',
        'integrations.webhook.update',
        'integrations.webhook.delete',
        'integrations.webhook.manage',
        'integrations.import.view',
        'integrations.import.create',
        'integrations.import.update',
        'integrations.import.delete',

        // Document Templates & Printing Infrastructure
        'documents.template.view',
        'documents.template.create',
        'documents.template.update',
        'documents.template.delete',
        'documents.template.manage',
        'documents.paper_size.view',
        'documents.paper_size.create',
        'documents.paper_size.update',
        'documents.paper_size.delete',
        'documents.paper_size.manage',
        'documents.print_profile.view',
        'documents.print_profile.create',
        'documents.print_profile.update',
        'documents.print_profile.delete',
        'documents.print_profile.manage',
        'documents.numbering.create',
        'documents.numbering.update',
        'documents.numbering.delete',
        'documents.numbering.manage',
        'documents.document.print',
        'documents.history.view',
    ];

    /**
     * Validate and parse a permission string into [module, resource, action].
     *
     * @return array{module: string, resource: string, action: string}
     */
    public static function parse(string $permission): array
    {
        $parts = explode('.', $permission);
        if (count($parts) !== 3) {
            throw new InvalidArgumentException("Invalid permission format '{$permission}'. Must be module.resource.action.");
        }

        [$module, $resource, $action] = $parts;

        if ($module === '' || $resource === '' || $action === '') {
            throw new InvalidArgumentException("Permission segments cannot be empty in '{$permission}'.");
        }

        if (! in_array($action, self::VALID_ACTIONS, true)) {
            throw new InvalidArgumentException("Invalid action '{$action}' in permission '{$permission}'.");
        }

        return [
            'module' => $module,
            'resource' => $resource,
            'action' => $action,
        ];
    }

    /**
     * Compute a deterministic hash representing the version of a permission set.
     *
     * @param  list<string>  $permissions
     */
    public static function computePermVersion(array $permissions): string
    {
        $unique = array_unique($permissions);
        sort($unique);

        return substr(hash('sha256', implode('|', $unique)), 0, 12);
    }

    /**
     * Get the full flat list of system permissions.
     *
     * @return list<string>
     */
    public static function getAllPermissions(): array
    {
        return self::ALL_PERMISSIONS;
    }
}
