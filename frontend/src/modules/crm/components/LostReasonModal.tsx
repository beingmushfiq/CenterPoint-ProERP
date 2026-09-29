import { useState } from 'react';
import type React from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { Lead } from '../../../types/api/crm';
import { LOST_REASON_OPTIONS } from '../../../types/api/crm';

interface LostReasonModalProps {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onConfirm: (lostReason: string, notes: string) => void;
  isSubmitting?: boolean;
}

export function LostReasonModal({
  isOpen,
  lead,
  onClose,
  onConfirm,
  isSubmitting = false,
}: LostReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(LOST_REASON_OPTIONS[0]?.id || 'price_too_high');
  const [notes, setNotes] = useState<string>('');

  if (!isOpen || !lead) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(selectedReason, notes.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-surface p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-default pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Mark Deal as Closed Lost</h3>
              <p className="text-xs text-muted">
                {lead.name} {lead.company_name ? `(${lead.company_name})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Primary Loss Reason <span className="text-danger">*</span>
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {LOST_REASON_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    selectedReason === option.id
                      ? 'border-rose-500/50 bg-rose-500/5 text-default'
                      : 'border-default bg-surface-sunken/40 text-muted hover:border-default/80 hover:bg-surface-sunken'
                  }`}
                >
                  <input
                    type="radio"
                    name="lost_reason"
                    value={option.id}
                    checked={selectedReason === option.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="mt-0.5 size-3.5 text-rose-600 focus:ring-rose-500 border-default"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-default">{option.label}</div>
                    {option.description && (
                      <div className="text-[11px] text-muted mt-0.5">{option.description}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Additional Feedback / Notes
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Quoted $4,500, competitor offered equivalent spec at $3,900 with net-30 terms."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default placeholder:text-muted focus:border-rose-500 focus:outline-none leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-default">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-default text-xs font-medium text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Recording Loss...' : 'Confirm Closed Lost'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
