import React from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';

export const ImpersonationBanner: React.FC = () => {
  const isImpersonating = localStorage.getItem('is_impersonating') === 'true';
  const tenantName = localStorage.getItem('impersonated_tenant_name') || 'Tenant';
  const tenantId = localStorage.getItem('impersonated_tenant_id');

  if (!isImpersonating) return null;

  const handleExit = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('impersonation_token');
    }
    localStorage.removeItem('is_impersonating');
    localStorage.removeItem('impersonated_tenant_name');
    localStorage.removeItem('impersonated_tenant_id');
    localStorage.removeItem('impersonator_email');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_tenant');
    localStorage.removeItem('auth_permissions');
    localStorage.removeItem('auth_branches');
    localStorage.removeItem('auth_active_branch');
    window.location.href = tenantId ? `/platform/tenants/${tenantId}` : '/platform/tenants';
  };

  return (
    <div className="sticky top-0 z-(--z-sticky) flex items-center justify-between border-b border-warning bg-warning-subtle px-4 py-2 text-xs font-semibold text-warning backdrop-blur-md">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
        <span>
          <strong>IMPERSONATION ACTIVE:</strong> You are currently viewing workspace as{' '}
          <strong className="underline">{tenantName}</strong> (Super Admin Session).
        </span>
      </div>

      <Button
        variant="primary"
        size="sm"
        onClick={handleExit}
        className="text-xs"
      >
        <ArrowLeft className="size-3.5 mr-1" aria-hidden="true" />
        Exit to Master Admin
      </Button>
    </div>
  );
};
