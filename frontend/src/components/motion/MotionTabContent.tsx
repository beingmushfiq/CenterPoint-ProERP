import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { tabVariants } from './motionPresets';
import { cn } from '../../lib/utils';

export interface MotionTabContentProps {
  tabKey: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * MotionTabContent: Provides a smooth opacity crossfade when switching active tabs,
 * preventing layout jumps and eliminating abrupt tab replacement snaps.
 */
export function MotionTabContent({ tabKey, children, className }: MotionTabContentProps) {
  return (
    <AnimatePresence mode="wait">
      <m.div
        key={tabKey}
        variants={tabVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn('w-full min-w-0', className)}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
