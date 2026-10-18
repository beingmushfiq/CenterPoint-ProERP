import React from 'react';
import { Keyboard, X, Sparkles, Command } from 'lucide-react';

interface PosKeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  category: string;
  items: Array<{
    keys: string[];
    description: string;
    actionType?: 'primary' | 'success' | 'warning' | 'default';
  }>;
}

export const PosKeyboardShortcutsModal: React.FC<PosKeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups: ShortcutGroup[] = [
    {
      category: 'Scanner & Navigation',
      items: [
        { keys: ['F1'], description: 'Focus Search & Barcode input', actionType: 'primary' },
        { keys: ['F10', 'or', '?'], description: 'Toggle Keyboard Shortcuts cheatsheet', actionType: 'default' },
        { keys: ['Esc'], description: 'Close modals / Clear item selection', actionType: 'default' },
      ],
    },
    {
      category: 'Cart & Items',
      items: [
        { keys: ['F2'], description: 'Adjust quantity on last selected cart item', actionType: 'primary' },
        { keys: ['F4'], description: 'Open order discount modal', actionType: 'default' },
        { keys: ['F8'], description: 'Hold / Park active transaction', actionType: 'warning' },
        { keys: ['F9'], description: 'Recall parked sale drawer', actionType: 'default' },
      ],
    },
    {
      category: 'Tender & Hardware',
      items: [
        { keys: ['F12', 'or', 'Ctrl+Enter'], description: 'Instant Cash Checkout & Print Receipt', actionType: 'success' },
        { keys: ['F7', 'or', 'Ctrl+Shift+D'], description: 'Kick / Pop Cash Drawer', actionType: 'warning' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-2xl bg-surface border border-default shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-default flex items-center justify-between bg-surface-raised">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Keyboard className="size-4" />
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-sm font-bold text-default flex items-center gap-2">
                Cashier Keyboard Shortcuts
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Fast Keys
                </span>
              </h2>
              <p className="text-2xs text-muted">
                Navigate and process sales without touching the mouse
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="size-7 rounded-lg border border-default hover:bg-surface-sunken text-muted hover:text-default flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {shortcutGroups.map((group) => (
            <div key={group.category} className="space-y-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted block">
                {group.category}
              </span>
              <div className="rounded-xl border border-default bg-surface-sunken/40 divide-y divide-default">
                {group.items.map((item, idx) => (
                  <div key={idx} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-default font-medium">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kIdx) =>
                        k === 'or' ? (
                          <span key={kIdx} className="text-2xs text-muted px-1">or</span>
                        ) : (
                          <kbd
                            key={kIdx}
                            className={`px-2 py-0.5 rounded font-mono text-2xs font-bold border shadow-xs ${
                              item.actionType === 'success'
                                ? 'bg-success/10 text-success border-success/30'
                                : item.actionType === 'primary'
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : item.actionType === 'warning'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                : 'bg-surface text-default border-default'
                            }`}
                          >
                            {k}
                          </kbd>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Barcode scanner notice */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5 text-2xs">
            <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-primary block">Barcode Auto-Detection Active</span>
              <p className="text-muted leading-relaxed">
                Hardware USB/Bluetooth laser scanners automatically scan and append items to the active cart from any screen state.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-default bg-surface-raised flex items-center justify-between">
          <span className="text-2xs text-muted flex items-center gap-1.5">
            <Command className="size-3" /> Press <kbd className="px-1.5 py-0.5 rounded bg-surface border border-default font-mono">Esc</kbd> anytime to dismiss
          </span>
          <button
            onClick={onClose}
            type="button"
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-contrast font-medium text-xs hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
