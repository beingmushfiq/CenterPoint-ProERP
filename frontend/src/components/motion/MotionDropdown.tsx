import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { popoverVariants } from './motionPresets';
import { cn } from '../../lib/utils';

export interface MotionDropdownProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * MotionDropdown: Smooth scale & opacity popover animation for desktop/tablet dropdown menus,
 * eliminating the harsh pop-in cut.
 */
export function MotionDropdown({ isOpen, children, className }: MotionDropdownProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          variants={popoverVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className={cn(
            'absolute z-50 rounded-2xl border border-default bg-surface text-default shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden',
            className
          )}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
