import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonCardProps {
  hasHeader?: boolean;
  hasFooter?: boolean;
  lines?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  hasHeader = true,
  hasFooter = true,
  lines = 2,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-2xl border border-default bg-surface p-5 shadow-xs space-y-4 animate-pulse',
        className
      )}
    >
      {hasHeader && (
        <div className="flex items-center justify-between">
          <div className="space-y-1.5 w-2/3">
            <div className="h-3 w-1/3 rounded-md bg-surface-sunken" />
            <div className="h-5 w-2/3 rounded-md bg-surface-raised" />
          </div>
          <div className="size-9 rounded-xl bg-surface-sunken" />
        </div>
      )}

      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              'h-3 rounded-md bg-surface-sunken',
              idx === 0 ? 'w-full' : idx === 1 ? 'w-4/5' : 'w-3/5'
            )}
          />
        ))}
      </div>

      {hasFooter && (
        <div className="pt-2 border-t border-default/50 flex items-center justify-between">
          <div className="h-2.5 w-1/4 rounded bg-surface-sunken" />
          <div className="h-2.5 w-1/5 rounded bg-surface-sunken" />
        </div>
      )}
    </div>
  );
};

export const SkeletonGrid: React.FC<{ count?: number; columns?: number; className?: string }> = ({
  count = 4,
  columns = 4,
  className,
}) => {
  const colCls =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={cn('grid gap-4', colCls, className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} />
      ))}
    </div>
  );
};
