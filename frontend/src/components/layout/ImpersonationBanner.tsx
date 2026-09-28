import React from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';

import { setAccessToken } from '../../lib/api/client';

export const ImpersonationBanner: React.FC = () => {
  const isImpersonating = typeof localStorage !== 'undefined' && localStorage.getItem('is_impersonating') === 'true';
  const tenantName = typeof localStorage !== 'undefined' ? localStorage.getItem('impersonated_tenant_name') || 'Tenant' : 'Tenant';
  const tenantId = typeof localStorage !== 'undefined' ? localStorage.getItem('impersonated_tenant_id') : null;

  if (!isImpersonating) return null;

  const handleExit = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('impersonation_token');
      sessionStorage.removeItem('tenant_access_token');
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('is_impersonating');
      localStorage.removeItem('impersonated_tenant_name');
      localStorage.removeItem('impersonated_tenant_id');
      localStorage.removeItem('impersonator_email');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_tenant');
      localStorage.removeItem('auth_permissions');
      localStorage.removeItem('auth_branches');
      localStorage.removeItem('auth_active_branch');
      localStorage.removeItem('tenant_access_token');
      localStorage.removeItem('tenant_capability_manifest');
    }
    setAccessToken(null);
    window.location.href = tenantId ? `/platform/tenants/${tenantId}` : '/platform/tenants';
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between border-b border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-xs font-medium text-amber-900 dark:text-amber-200 backdrop-blur-md shadow-xs">
      <div className="flex items-center gap-2.5">
        <div className="flex size-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold tracking-wide uppercase text-[10px] px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-800 dark:text-amber-300 font-mono">
            Impersonation Active
          </span>
          <span className="text-default">Viewing workspace as</span>
          <strong className="font-semibold text-amber-700 dark:text-amber-300 underline underline-offset-2">
            {tenantName}
          </strong>
          <span className="text-muted text-[11px]">(Diagnostic Super Admin Session)</span>
        </div>
      </div>

      <Button
        variant="danger"
        size="sm"
        onClick={handleExit}
        className="text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Exit to Master Admin
      </Button>
    </div>
  );
};
