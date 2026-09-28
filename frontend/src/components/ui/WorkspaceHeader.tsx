import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface WorkspaceHeaderProps {
  title: string;
  subtitle?: string | React.ReactNode;
  icon?: LucideIcon | React.ElementType;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  metrics?: Array<{
    label: string;
    value: string | number | React.ReactNode;
    change?: string;
    isPositive?: boolean;
  }>;
  children?: React.ReactNode;
  className?: string;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  badge,
  actions,
  metrics,
  children,
  className,
}) => {
  return (
    <div className={cn('space-y-4 pb-1', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary border border-primary/20 shadow-xs mt-0.5">
              <Icon className="size-5" aria-hidden="true" />
            </div>
          )}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-default">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <div className="text-xs text-muted leading-relaxed max-w-2xl">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
            {actions}
          </div>
        )}
      </div>

      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
          {metrics.map((m, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-default bg-surface-raised p-3 shadow-2xs"
            >
              <div className="text-[11px] font-medium text-muted">{m.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold font-mono text-default">{m.value}</span>
                {m.change && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold',
                      m.isPositive ? 'text-success' : 'text-danger'
                    )}
                  >
                    {m.change}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
};
