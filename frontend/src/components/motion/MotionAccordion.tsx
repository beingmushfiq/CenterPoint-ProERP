import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { accordionVariants } from './motionPresets';
import { cn } from '../../lib/utils';

export interface MotionAccordionProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
  unmountOnExit?: boolean;
}

/**
 * MotionAccordion: Handles smooth, hardware-accelerated height and opacity transitions
 * for collapsible filters, expandable card rows, and nested line items.
 */
export function MotionAccordion({
  isOpen,
  children,
  className,
  unmountOnExit = true,
}: MotionAccordionProps) {
  if (unmountOnExit) {
    return (
      <AnimatePresence initial={false}>
        {isOpen && (
          <m.div
            variants={accordionVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className={cn('overflow-hidden', className)}
          >
            {children}
          </m.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <m.div
      variants={accordionVariants}
      initial={false}
      animate={isOpen ? 'expanded' : 'collapsed'}
      className={cn('overflow-hidden', className)}
    >
      {children}
    </m.div>
  );
}
