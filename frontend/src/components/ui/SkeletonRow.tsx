import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonRowProps {
  columns?: number;
  height?: 'compact' | 'comfortable' | 'spacious';
  className?: string;
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({
  columns = 5,
  height = 'comfortable',
  className,
}) => {
  const heightCls =
    height === 'compact' ? 'h-9' : height === 'spacious' ? 'h-14' : 'h-11';

  return (
    <tr className={cn('border-b border-default', className)}>
      {Array.from({ length: columns }).map((_, idx) => (
        <td key={idx} className={cn('px-4 py-2.5', heightCls)}>
          <div
            className={cn(
              'h-3.5 rounded-md bg-surface-sunken animate-pulse',
              idx === 0
                ? 'w-3/4'
                : idx === columns - 1
                  ? 'w-1/2 ml-auto'
                  : idx % 2 === 0
                    ? 'w-2/3'
                    : 'w-4/5'
            )}
          />
        </td>
      ))}
    </tr>
  );
};

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  height?: 'compact' | 'comfortable' | 'spacious';
  showHeader?: boolean;
  className?: string;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 5,
  height = 'comfortable',
  showHeader = true,
  className,
}) => {
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border border-default bg-surface',
        className
      )}
    >
      <table className="w-full text-left text-xs">
        {showHeader && (
          <thead className="bg-surface-sunken border-b border-default">
            <tr>
              {Array.from({ length: columns }).map((_, idx) => (
                <th key={idx} className="h-9 px-4">
                  <div className="h-3 w-16 rounded-md bg-surface-raised animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-default">
          {Array.from({ length: rows }).map((_, idx) => (
            <SkeletonRow key={idx} columns={columns} height={height} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
