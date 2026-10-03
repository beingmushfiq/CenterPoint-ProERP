import React from 'react';
import { m } from 'framer-motion';
import { pageVariants } from './motionPresets';
import { cn } from '../../lib/utils';

export interface MotionPageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MotionPage: Wraps page routes to provide a calm, subtle enter/exit transition,
 * eliminating the abrupt "snap" when switching between ERP modules or storefront pages.
 */
export function MotionPage({ children, className }: MotionPageProps) {
  return (
    <m.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn('w-full min-w-0 max-w-full flex-1 flex flex-col will-change-[opacity,transform]', className)}
    >
      {children}
    </m.div>
  );
}
