// ═══════════════════════════════════════════════════════════════════════════
// MODAL + CONFIRM DIALOG + DRAWER                        UI_SYSTEM.md §10.2
// ───────────────────────────────────────────────────────────────────────────
// Overlay primitives. Fully controlled — value in, change out (§10.3 rule 1).
//
// Defects resolved (DEVELOPMENT_STATUS.md §4.2):
//   1. useId() — unique, safe when two dialogs exist simultaneously
//   2. Focus trap (Tab/Shift+Tab), focus move on open, restore to trigger,
//      background inert, Escape to close
//   3. Deleted legacy classes: modal-overlay, modal-box, modal-header,
//      modal-footer, drawer-overlay, drawer-panel
//   4. Token-only classes — no primitive colours, no font-600
//   5. TriangleAlert (lucide v1 — AlertTriangle was deleted)
//   6. sizeClasses → max-w-(--modal-width-*); 'full' dropped (4 tokens only)
//   7. drawerWidths → w-(--drawer-width) / w-(--drawer-width-lg); 3→2 sizes
//   8. ConfirmDialog accessible name (title prop → aria-labelledby) and only
//      legal Button variants (danger | primary — no 'warning')
//   9. Dirty-form suppression on scrim click via isDirty prop
//  10. Framer Motion: scrim fade + panel scale 0.98→1 (modal) or slide from
//      right edge (drawer), enter at base / exit at fast (§7.3 row 2)
//  11. z-(--z-overlay) for scrim, z-(--z-modal) for panel
//  12. No focus ring re-implementation — base.css supplies :focus-visible
//
// Motion uses `m.*` (not `motion.*`) which requires the LazyMotion provider
// in main.tsx (§7 item 7). AnimatePresence handles exit animation when open
// becomes false. Under reduced motion the CSS tokens collapse durations to 1ms
// and distances/scales to 0/1 (tokens.motion.css), so the Framer transitions
// become imperceptible without a second code path (§7.6 rule 3).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useId, useRef, useCallback } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m, type Variants } from 'framer-motion';
import { X, TriangleAlert, CircleCheckBig } from 'lucide-react';
import { cn } from '../../lib/utils';
import { enterBase, exitFast, craft } from '../../lib/motion/tokens';
import { Button } from './Button';

// ── Motion tokens ───────────────────────────────────────────────────────────
// §7.3 row 2: scrim fade + panel scale 0.98→1 (modal) or slide from edge
// (drawer), enter at base / exit at fast.
// `LazyMotion` + `domAnimation` (§7.6 rule 6) enables `m.*` without the full
// Framer Motion bundle. Components use `m.*`; `motion.*` would throw.
//
// Per-variant transitions: the `transition` inside each variant state controls
// that specific animation — `visible` animates with `enterBase`, `hidden` with
// `exitFast`. AnimatePresence invokes the hidden→visible path on enter
// (slower, decelerating) and visible→hidden on exit (faster, accelerating).

const scrimVariants: Variants = {
  hidden: { opacity: 0, transition: exitFast },
  visible: { opacity: 1, transition: enterBase },
};

const modalPanelVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: craft.modalScaleFrom,
    transition: exitFast,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: enterBase,
  },
};

const drawerPanelVariants: Variants = {
  hidden: { x: '100%', transition: exitFast },
  visible: { x: '0%', transition: enterBase },
};

// ── Modal sizes ─────────────────────────────────────────────────────────────
// §4.2 defect 6: width tokens, no arbitrary values, 'full' dropped.

const sizeMap = {
  sm: 'max-w-(--modal-width-sm)',
  md: 'max-w-(--modal-width-md)',
  lg: 'max-w-(--modal-width-lg)',
  xl: 'max-w-(--modal-width-xl)',
} as const;

// ── Drawer widths ───────────────────────────────────────────────────────────
// §4.2 defect 7: two sizes only, matching the two existing tokens.

const drawerWidthMap = {
  default: 'w-(--drawer-width)',
  lg: 'w-(--drawer-width-lg)',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// MODAL                                                                §10.2
// ═══════════════════════════════════════════════════════════════════════════

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Dialog accessible name. Also rendered as the visible h2 header. */
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** §4.2 defect 9 — suppresses scrim click when the form has unsaved changes. */
  isDirty?: boolean;
  /** When true, the visible h2 header is suppressed but title is still used
   *  as the dialog's accessible name via a sr-only h2. ConfirmDialog uses
   *  this to render its own heading inside the body. */
  hideHeader?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md',
  className,
  isDirty = false,
  hideHeader = false,
}: ModalProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // §4.2 defect 2 — focus trap internals:
  // Store the element that had focus before the modal opened, so we can restore
  // it when the modal closes. Without this, focus lands on <body> after close.
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
    }
  }, [open]);

  // §4.2 defect 2 — focus restore on close:
  // When the dialog closes, return focus to whichever element triggered it.
  useEffect(() => {
    if (!open && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // §4.2 defect 9 — dirty-form suppression:
  // When the form has unsaved changes, clicking the scrim does nothing.
  const handleScrimClick = useCallback(() => {
    if (!isDirty) onClose();
  }, [isDirty, onClose]);

  // §4.2 defect 2 — Escape to close:
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // §4.2 defect 2 — Tab / Shift+Tab focus trap:
  // Prevents focus from leaving the dialog when pressing Tab at the end
  // or Shift+Tab at the start of the tab order.
  useEffect(() => {
    if (!open) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open]);

  // Body scroll lock while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-(--z-overlay) flex items-end sm:items-center justify-center p-0 sm:p-6 pb-safe"
            data-modal="true"
          >
            {/* Scrim with Frosted Blur */}
            <m.div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
              variants={scrimVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              onClick={handleScrimClick}
              aria-hidden="true"
            />

            {/* Modal Dialog Panel */}
            <m.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className={cn(
                'relative z-(--z-modal) max-h-[90vh] sm:max-h-[92vh] overflow-y-auto w-full',
                'rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 pb-6 sm:pb-6',
                'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100',
                'border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl',
                'outline-none transition-all',
                sizeMap[size],
                className
              )}
              variants={modalPanelVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              {/* Mobile Drag Indicator */}
              <div className="sm:hidden w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-3 shrink-0" aria-hidden="true" />

              {/* Top Linear Gradient Glow Accent */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary via-indigo-500 to-emerald-500 rounded-t-3xl sm:rounded-t-2xl"
                aria-hidden="true"
              />

              {/* Header */}
              {!hideHeader && (
                <div className="mb-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {icon && (
                      <div className="size-8.5 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
                        {icon}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 id={titleId} className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                        {title}
                      </h2>
                      {subtitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    aria-label="Close modal"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Visually hidden accessible name when header is suppressed.
                  The title still serves as the dialog's aria-labelledby target. */}
              {hideHeader && (
                <h2 id={titleId} className="sr-only">
                  {title}
                </h2>
              )}

              {/* Body */}
              <div>{children}</div>

              {/* Footer */}
              {footer && (
                <div className="border-default mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 border-t pt-4">
                  {footer}
                </div>
              )}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIRM DIALOG                                                          §10.2
// ───────────────────────────────────────────────────────────────────────────
// §4.2 defect 8 — accessible name is now derived from the `title` prop
// (passed to Modal as aria-labelledby). Variant is 'danger' | 'primary' only
// — Button has no 'warning' variant, and a button is an action, not a status.
// ═══════════════════════════════════════════════════════════════════════════

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Button variant. 'warning' is deliberately absent — Button's closed set
   *  is primary · secondary · ghost · danger · link (§10.2). */
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  // §4.2 defect 5 — TriangleAlert is lucide v1 (AlertTriangle was removed).

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      hideHeader
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4 items-start">
        <div
          className={cn(
            'size-10 shrink-0 rounded-full flex items-center justify-center',
            variant === 'danger' ? 'bg-danger-subtle' : 'bg-primary-subtle'
          )}
        >
          {variant === 'danger' ? (
            <TriangleAlert className="size-5 text-danger" aria-hidden="true" />
          ) : (
            <CircleCheckBig className="size-5 text-primary" aria-hidden="true" />
          )}
        </div>
        <div>
          {/* §4.2 defect 8 — The visible heading. Modal's aria-labelledby
              points at a sr-only h2 containing the same title text, providing
              the accessible name without a second render. */}
          <h3 className="text-md font-semibold text-default">{title}</h3>
          <p className="mt-1 text-sm text-muted leading-relaxed">{message}</p>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAWER                                                                §10.2
// ───────────────────────────────────────────────────────────────────────────
// §4.2 defect 7 — three sizes collapsed to two (only two tokens exist).
// §4.2 defect 10 — slide from right edge (not scale).
// ═══════════════════════════════════════════════════════════════════════════

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'default' | 'lg';
  className?: string;
  isDirty?: boolean;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'default',
  className,
  isDirty = false,
}: DrawerProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // §4.2 defect 2 — focus management (same pattern as Modal)
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  const handleScrimClick = useCallback(() => {
    if (!isDirty) onClose();
  }, [isDirty, onClose]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Tab / Shift+Tab focus trap
  useEffect(() => {
    if (!open) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-(--z-overlay)" data-drawer="true">
            {/* §4.2 defect 11 — z-(--z-overlay) on scrim. */}
            <m.div
              className="fixed inset-0 bg-overlay"
              variants={scrimVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              onClick={handleScrimClick}
              aria-hidden="true"
            />

            {/* §4.2 defect 11 — z-(--z-modal) on panel.
                §4.2 defect 7 — two widths from tokens, not three arbitrary. */}
            <m.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className={cn(
                'fixed inset-y-0 right-0 z-(--z-modal) flex flex-col w-full max-w-full pb-safe',
                'bg-surface-raised shadow-overlay',
                'outline-none',
                drawerWidthMap[width],
                className
              )}
              variants={drawerPanelVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              {/* Header */}
              <div className="border-default flex shrink-0 items-center justify-between border-b px-4 sm:px-6 py-3.5 sm:py-4">
                <h2 id={titleId} className="text-md font-semibold text-default">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-token-colors hover:bg-surface-sunken hover:text-default focus-visible:ring-focus"
                  aria-label="Close drawer"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              {/* Body — scrollable */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">{children}</div>

              {/* Footer */}
              {footer && (
                <div className="border-default flex shrink-0 flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 border-t px-4 sm:px-6 py-3.5 sm:py-4">
                  {footer}
                </div>
              )}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
