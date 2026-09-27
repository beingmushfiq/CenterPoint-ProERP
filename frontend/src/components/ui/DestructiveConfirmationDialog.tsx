import { Modal } from './Modal';
import { Button } from './Button';
import { Trash2, Archive, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ImpactItem {
  label: string;
  count: string | number;
  warning?: boolean | undefined;
  badgeVariant?: ('default' | 'warning' | 'danger') | undefined;
}

export interface DestructiveConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
  onArchive?: (() => void) | undefined;
  title?: string | undefined;
  entityType: string;
  entityName: string;
  entityCode?: string | undefined;
  impactItems?: ImpactItem[] | undefined;
  isDeleting?: boolean | undefined;
  isArchiving?: boolean | undefined;
  warningMessage?: string | undefined;
}

export function DestructiveConfirmationDialog({
  open,
  onClose,
  onConfirmDelete,
  onArchive,
  title,
  entityType,
  entityName,
  entityCode,
  impactItems = [],
  isDeleting = false,
  isArchiving = false,
  warningMessage,
}: DestructiveConfirmationDialogProps) {
  const dialogTitle = title || `Delete ${entityType}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dialogTitle}
      subtitle={`Review business impact before removing from active catalog`}
      icon={<Trash2 className="size-4.5 text-rose-500" />}
      size="md"
    >
      <div className="space-y-4 text-xs">
        {/* Entity Card */}
        <div className="p-3.5 rounded-2xl bg-surface-sunken border border-default flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-0.5">
              Target {entityType}
            </span>
            <div className="text-sm font-semibold text-default">{entityName}</div>
            {entityCode && (
              <span className="font-mono text-[11px] text-primary mt-0.5 inline-block">
                {entityCode}
              </span>
            )}
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase tracking-wider">
            Pending Action
          </span>
        </div>

        {/* Impact Breakdown */}
        {impactItems.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-default uppercase tracking-wider block">
              Associated Business Records Impact
            </span>
            <div className="grid grid-cols-2 gap-2">
              {impactItems.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-2.5 rounded-xl border flex flex-col justify-between',
                    item.warning
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                      : 'bg-surface border-default text-default'
                  )}
                >
                  <span className="text-[10px] text-muted font-medium">{item.label}</span>
                  <span className="text-sm font-bold font-mono mt-0.5">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning Callout */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            {warningMessage ||
              `Deleting this ${entityType.toLowerCase()} is guarded. Any historical ledger transactions, production logs, or journal entries retain full audit integrity.`}
          </div>
        </div>

        {/* Safety Note */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
          <span>Soft delete preserves transactional ledger & compliance history.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-default gap-2 flex-wrap">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting || isArchiving}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {onArchive && (
              <Button
                variant="secondary"
                onClick={onArchive}
                disabled={isDeleting || isArchiving}
                className="flex items-center gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                title={`Deactivate this ${entityType.toLowerCase()} without deleting records`}
              >
                <Archive className="size-3.5" />
                <span>{isArchiving ? 'Archiving...' : 'Archive / Deactivate'}</span>
              </Button>
            )}

            <Button
              variant="danger"
              onClick={onConfirmDelete}
              disabled={isDeleting || isArchiving}
              className="flex items-center gap-1.5 shadow-sm shadow-rose-500/20"
            >
              <Trash2 className="size-3.5" />
              <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
