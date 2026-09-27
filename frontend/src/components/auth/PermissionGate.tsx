import React from 'react';
import { useAuthStore } from '../../lib/auth/authStore';

export interface PermissionGateProps {
  permission: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode | undefined;
}

/**
 * Declarative component gate that renders children only when the current
 * authenticated user holds the required permission capability.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const { hasPermission } = useAuthStore();
  const allowed = hasPermission(permission);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
