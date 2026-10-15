import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Code, Shield } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import type { PendingAction } from '../types/copilot';

interface Tier2ConfirmDialogProps {
  open: boolean;
  action: PendingAction | null;
  onClose: () => void;
  onConfirm: (actionId: string, approved: boolean, reason?: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const Tier2ConfirmDialog: React.FC<Tier2ConfirmDialogProps> = ({
  open,
  action,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  if (!action) return null;

  const handleApprove = async () => {
    await onConfirm(action.action_id, true);
    onClose();
  };

  const handleReject = async () => {
    await onConfirm(action.action_id, false, rejectReason || 'Declined by authorized supervisor');
    setIsRejecting(false);
    setRejectReason('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => !isSubmitting && onClose()}
      title="Supervisor Action Authorization (Tier 2)"
      size="md"
    >
      <div className="space-y-4">
        {/* Tier 2 Security Header Alert */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
          <ShieldAlert className="size-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="text-xs space-y-1">
            <div className="font-bold flex items-center gap-2">
              <span>Supervised Operational Mutation</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] uppercase font-mono tracking-wider">
                Tier 2 Guard
              </span>
            </div>
            <p className="leading-relaxed opacity-90">
              The AI Copilot has proposed an operational change that alters system state. In compliance with
              the three-tier security model, this action requires human authorization.
            </p>
          </div>
        </div>

        {/* Action Details */}
        <div className="p-3.5 rounded-xl bg-surface-sunken/60 border border-default space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-muted uppercase text-[10px]">Action Tool</span>
            <span className="font-mono font-bold text-primary flex items-center gap-1">
              <Shield className="size-3" />
              {action.tool}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold text-muted uppercase text-[10px]">Risk Level</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                action.risk_level === 'critical' || action.risk_level === 'high'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              }`}
            >
              {action.risk_level}
            </span>
          </div>

          <div>
            <span className="font-semibold text-muted uppercase text-[10px] block mb-1">
              Description
            </span>
            <div className="text-default font-medium leading-relaxed bg-surface p-2.5 rounded-lg border border-default/60">
              {action.description}
            </div>
          </div>
        </div>

        {/* Parameters Payload Preview */}
        {action.arguments && Object.keys(action.arguments).length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase text-muted flex items-center gap-1">
              <Code className="size-3" />
              <span>Proposed Parameters</span>
            </div>
            <pre className="p-2.5 rounded-xl bg-surface-sunken border border-default/70 text-[11px] font-mono text-default overflow-x-auto max-h-36">
              {JSON.stringify(action.arguments, null, 2)}
            </pre>
          </div>
        )}

        {/* Rejection Reason Input (Visible when user clicks Decline) */}
        {isRejecting ? (
          <div className="space-y-2 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 animate-in fade-in">
            <label className="block text-xs font-semibold text-default">
              Reason for Declining (Optional):
            </label>
            <textarea
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Budget revised, action not required at this time..."
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface text-default text-xs focus:border-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                className="px-3 py-1.5 text-xs text-muted hover:text-default rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleReject}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg shadow-xs hover:bg-rose-700 transition"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        ) : (
          /* Main Dialog Action Buttons */
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-default">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsRejecting(true)}
              className="px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <XCircle className="size-3.5" />
              <span>Decline Action</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-muted hover:text-default hover:bg-surface-sunken border border-default rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleApprove}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" />
                <span>{isSubmitting ? 'Authorizing...' : 'Authorize & Execute'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
