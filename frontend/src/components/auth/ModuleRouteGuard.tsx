import React from 'react';
import { Link } from 'react-router-dom';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { useAuthStore } from '../../lib/auth/authStore';
import { Button } from '../ui/Button';
import {
  ShieldAlert,
  ArrowLeft,
  Settings,
  Sparkles,
  Lock,
} from 'lucide-react';

interface ModuleRouteGuardProps {
  moduleKey: string;
  moduleName?: string;
  children: React.ReactNode;
}

const MODULE_FRIENDLY_NAMES: Record<string, string> = {
  production: 'Production Lines & Shop Floor',
  inventory: 'Warehouse & Inventory Control',
  purchasing: 'Procurement & Purchasing',
  sales: 'Commercial Sales & Invoicing',
  pos: 'Point of Sale (POS) Counter',
  ecommerce: 'Headless Online Store CMS',
  delivery: 'Logistics & 3PL Deliveries',
  finance: 'Finance & General Ledger',
  assets: 'Plant CMMS & Fixed Asset Registry',
  hr: 'Team, Attendance & Workforce',
  qc: 'Quality Control & Inspection',
  reports: 'Business Reports & Analytics',
  crm: 'CRM Leads & Customer Pipeline',
};

export const ModuleRouteGuard: React.FC<ModuleRouteGuardProps> = ({
  moduleKey,
  moduleName,
  children,
}) => {
  const modules = useTenantCapabilityStore((state) => state.modules);
  const isModuleEnabled = useTenantCapabilityStore((state) => state.isModuleEnabled);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const modMeta = modules[moduleKey];
  const isEnabled = modMeta ? (modMeta.enabled && modMeta.plan_allowed) : isModuleEnabled(moduleKey);
  const isPlanLocked = modMeta ? !modMeta.plan_allowed : false;

  const displayName = moduleName || MODULE_FRIENDLY_NAMES[moduleKey] || moduleKey.toUpperCase();

  if (isEnabled) {
    return <>{children}</>;
  }

  const canManageSettings = hasPermission(['settings.tenant.manage', 'settings.*', '*']);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="max-w-md w-full bg-surface border border-default rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-6">
        <div className="flex justify-center">
          <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            {isPlanLocked ? <Lock className="size-8" /> : <ShieldAlert className="size-8" />}
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <Sparkles className="size-3" />
            {isPlanLocked ? 'Subscription Plan Gated' : 'Module Inactive'}
          </div>
          <h2 className="text-xl font-bold text-default font-sans tracking-tight">
            {displayName}
          </h2>
          <p className="text-xs text-muted leading-relaxed">
            {isPlanLocked
              ? `The ${displayName} module is not included in your organization's current SaaS subscription tier. Please contact your platform administrator to upgrade.`
              : `The ${displayName} module has been temporarily deactivated for this workspace. An administrator can enable it in system settings.`}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/dashboard" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs">
              <ArrowLeft className="size-3.5" />
              <span>Dashboard</span>
            </Button>
          </Link>

          {canManageSettings && !isPlanLocked && (
            <Link to="/settings" className="w-full sm:w-auto">
              <Button variant="primary" className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs">
                <Settings className="size-3.5" />
                <span>Module Settings</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
