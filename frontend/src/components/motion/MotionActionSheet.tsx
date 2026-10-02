import React, { useEffect, useRef, useCallback } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { bottomSheetVariants, scrimVariants } from './motionPresets';
import { cn } from '../../lib/utils';

export interface ActionSheetItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
  description?: string;
}

export interface MotionActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  items?: ActionSheetItem[];
  children?: React.ReactNode;
  className?: string;
}

/**
 * MotionActionSheet: Native-feeling mobile bottom action sheet.
 * Used for table card three-dots actions, header kebab menus, and mobile filter drawers.
 */
export function MotionActionSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  items,
  children,
  className,
}: MotionActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      if (info.offset.y > 100 || info.velocity.y > 500) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-(--z-modal) flex items-end justify-center pointer-events-auto">
          {/* Frosted Scrim Backdrop */}
          <m.div
            variants={scrimVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
            aria-hidden="true"
          />

          {/* Draggable Bottom Sheet */}
          <m.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            variants={bottomSheetVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'relative z-10 w-full max-w-lg rounded-t-3xl border-t border-default bg-surface text-default shadow-2xl pb-safe flex flex-col max-h-[88dvh] overflow-hidden',
              className
            )}
          >
            {/* Drag Handle Bar */}
            <div className="pt-3 pb-2 flex justify-center shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-surface-sunken hover:bg-muted/40 transition-colors" />
            </div>

            {/* Header */}
            {(title || subtitle) && (
              <div className="px-5 pb-3 border-b border-default flex items-center justify-between shrink-0">
                <div className="min-w-0 pr-4">
                  {title && (
                    <h3 className="text-base font-semibold text-default truncate">{title}</h3>
                  )}
                  {subtitle && (
                    <p className="text-xs text-muted truncate mt-0.5">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  aria-label="Close action sheet"
                >
                  <X className="size-5" />
                </button>
              </div>
            )}

            {/* Content Body */}
            <div className="p-4 overflow-y-auto flex-1 overscroll-contain">
              {children}

              {items && items.length > 0 && (
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isDanger = item.variant === 'danger';
                    const isPrimary = item.variant === 'primary';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => {
                          item.onClick();
                          onClose();
                        }}
                        className={cn(
                          'w-full min-h-[48px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-left font-medium text-sm transition-colors cursor-pointer',
                          item.disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
                          isDanger
                            ? 'text-danger hover:bg-danger/10 active:bg-danger/15'
                            : isPrimary
                            ? 'text-primary bg-primary/10 hover:bg-primary/15'
                            : 'text-default hover:bg-surface-sunken active:bg-surface-raised'
                        )}
                      >
                        {Icon && (
                          <div
                            className={cn(
                              'size-9 rounded-lg flex items-center justify-center shrink-0',
                              isDanger ? 'bg-danger/10 text-danger' : 'bg-surface-sunken text-muted'
                            )}
                          >
                            <Icon className="size-4.5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{item.label}</div>
                          {item.description && (
                            <div className="text-xs text-muted truncate">{item.description}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
