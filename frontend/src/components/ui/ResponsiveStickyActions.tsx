// ═══════════════════════════════════════════════════════════════════════════
// RESPONSIVE STICKY ACTION BAR
// ───────────────────────────────────────────────────────────────────────────
// Provides a unified action container that:
// - On Desktop (>= sm): Renders inline with standard spacing.
// - On Mobile (< sm): Docks stickily to the bottom of the viewport with safe-area
//   insets and backdrop blur, giving mobile users effortless one-thumb form completion.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';
import { cn } from '../../lib/utils';

export interface ResponsiveStickyActionsProps {
  children: React.ReactNode;
  className?: string;
  /** When true, mobile sticky docking is forced even on larger screens (e.g. inside drawers/wizards) */
  forceSticky?: boolean;
}

export const ResponsiveStickyActions: React.FC<ResponsiveStickyActionsProps> = ({
  children,
  className,
  forceSticky = false,
}) => {
  return (
    <>
      {/* Mobile Spacer to ensure content above sticky bar is never obscured */}
      <div className={cn('h-16 sm:hidden', forceSticky && 'h-16')} aria-hidden="true" />

      <div
        className={cn(
          'transition-all duration-150',
          forceSticky
            ? 'sticky bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur-md border-t border-default p-3 pb-safe shadow-xl flex items-center justify-end gap-2.5'
            : 'fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur-md border-t border-default p-3 pb-safe shadow-xl flex items-center justify-end gap-2.5 sm:static sm:z-auto sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:p-0 sm:shadow-none',
          className
        )}
      >
        {children}
      </div>
    </>
  );
};
