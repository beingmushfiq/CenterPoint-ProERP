// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED ENTERPRISE MOTION PRESETS & VARIANTS
// ───────────────────────────────────────────────────────────────────────────
// Built strictly from `lib/motion/tokens.ts` and `tokens.motion.css`.
// Restrained, enterprise-grade, purposeful:
// - Opacity + small translation (4px-8px)
// - Subtle micro-scaling (0.98 -> 1)
// - Hardware-accelerated transforms
// - Immediate fallback when prefersReducedMotion() is true
// ═══════════════════════════════════════════════════════════════════════════

import type { Variants, Transition } from 'framer-motion';
import {
  duration,
  ease,
  distance,
  craft,
  enterBase,
  exitFast,
  enterFast,
  exitInstant,
} from '../../lib/motion/tokens';

// ── Standard Transitions ───────────────────────────────────────────────────

export const pageTransition: Transition = {
  duration: 0.12,
  ease: [0.16, 1, 0.3, 1],
};

export const pageExitTransition: Transition = {
  duration: 0.08,
  ease: [0.4, 0, 1, 1],
};

export const tabTransition: Transition = {
  duration: duration.fast,
  ease: ease.standard,
};

export const accordionTransition: Transition = {
  duration: duration.base,
  ease: ease.standard,
};

export const sheetSpringTransition: Transition = {
  type: 'spring',
  damping: 28,
  stiffness: 300,
  mass: 0.8,
};

export const popoverTransition: Transition = {
  duration: duration.fast,
  ease: ease.entrance,
};

// ── Motion Variants ────────────────────────────────────────────────────────

/** Page transition: crisp, subtle micro-rise (3px) and swift crossfade */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 3,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: pageTransition,
  },
  exit: {
    opacity: 0,
    y: -2,
    transition: pageExitTransition,
  },
};

/** Tab panel crossfade */
export const tabVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: tabTransition,
  },
  exit: {
    opacity: 0,
    transition: exitInstant,
  },
};

/** Accordion expand/collapse */
export const accordionVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    transition: exitFast,
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    overflow: 'visible',
    transition: accordionTransition,
  },
};

/** Bottom Sheet Drawer (Mobile) */
export const bottomSheetVariants: Variants = {
  hidden: {
    y: '100%',
    transition: exitFast,
  },
  visible: {
    y: '0%',
    transition: sheetSpringTransition,
  },
};

/** Scrim / Backdrop fade */
export const scrimVariants: Variants = {
  hidden: {
    opacity: 0,
    transition: exitFast,
  },
  visible: {
    opacity: 1,
    transition: enterBase,
  },
};

/** Popover / Dropdown scale & fade */
export const popoverVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: craft.modalScaleFrom,
    y: -distance.xs,
    transition: exitFast,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: enterFast,
  },
};

/** Stagger list container */
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

/** Stagger list item */
export const staggerItemVariants: Variants = {
  initial: {
    opacity: 0,
    y: distance.xs,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: enterFast,
  },
};
