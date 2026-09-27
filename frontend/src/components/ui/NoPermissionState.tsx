import React from 'react';
import { ShieldAlert, ArrowLeft, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface NoPermissionStateProps {
  title?: string | undefined;
  description?: string | undefined;
  requiredPermission?: string | string[] | undefined;
  actionText?: string | undefined;
  onAction?: (() => void) | undefined;
  className?: string | undefined;
}

export const NoPermissionState: React.FC<NoPermissionStateProps> = ({
  title = 'Access Restricted',
  description = 'You do not have the required role or permission privileges to access this operational resource.',
  requiredPermission,
  actionText,
  onAction,
  className = '',
}) => {
  const navigate = useNavigate();

  const permissionsList = requiredPermission
    ? Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission]
    : [];

  return (
    <div
      role="region"
      aria-label="Access Restricted"
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-default bg-surface-sunken/40 shadow-xs ${className}`}
    >
      <div className="relative mb-5 flex size-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-500 shadow-inner">
        <ShieldAlert className="size-8" />
        <div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border border-default bg-surface text-amber-500 shadow-xs">
          <KeyRound className="size-3.5" />
        </div>
      </div>

      <h3 className="text-base sm:text-lg font-bold text-default tracking-tight mb-2">
        {title}
      </h3>

      <p className="max-w-md text-xs sm:text-sm text-muted leading-relaxed mb-5">
        {description}
      </p>

      {permissionsList.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-center gap-1.5 max-w-md">
          <span className="text-[11px] font-medium text-muted mr-1">Required:</span>
          {permissionsList.map((perm) => (
            <span
              key={perm}
              className="inline-flex items-center rounded-md border border-default bg-surface px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-600 dark:text-rose-400"
            >
              {perm}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2.5">
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-4 py-2 text-xs font-semibold text-default shadow-xs hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            {actionText || 'Retry'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-default bg-surface px-4 py-2 text-xs font-semibold text-default shadow-xs hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span>Go Back</span>
          </button>
        )}
      </div>
    </div>
  );
};
