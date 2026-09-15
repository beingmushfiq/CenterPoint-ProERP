// ═══════════════════════════════════════════════════════════════════════════
// NUMBERING TAB — Centralized Server-Side Document Number Sequences
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Binary,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../../../lib/api/client';
import { Modal } from '../../../../components/ui/Modal';
import type { DocumentNumberingSequence } from '../../../../types/api/documents';

export function NumberingTab() {
  const queryClient = useQueryClient();
  const [editSeq, setEditSeq] = useState<DocumentNumberingSequence | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [padding, setPadding] = useState('5');
  const [nextNumber, setNextNumber] = useState('1');
  const [resetPeriod, setResetPeriod] = useState<'never' | 'yearly' | 'monthly'>('yearly');
  const [isSaving, setIsSaving] = useState(false);

  const DEFAULT_FALLBACK_SEQUENCES: DocumentNumberingSequence[] = [
    { id: 1, tenant_id: 1, uuid: 'seq-inv-01', document_type: 'sales_invoice', prefix: 'INV-', suffix: '', padding: 5, next_number: 1001, reset_period: 'yearly' },
    { id: 2, tenant_id: 1, uuid: 'seq-dc-01', document_type: 'delivery_challan', prefix: 'DC-', suffix: '', padding: 5, next_number: 501, reset_period: 'yearly' },
    { id: 3, tenant_id: 1, uuid: 'seq-po-01', document_type: 'purchase_order', prefix: 'PO-', suffix: '', padding: 5, next_number: 201, reset_period: 'yearly' },
    { id: 4, tenant_id: 1, uuid: 'seq-rct-01', document_type: 'payment_receipt', prefix: 'RCT-', suffix: '', padding: 6, next_number: 101, reset_period: 'monthly' },
    { id: 5, tenant_id: 1, uuid: 'seq-pos-01', document_type: 'pos_receipt_80mm', prefix: 'POS-', suffix: '', padding: 6, next_number: 1, reset_period: 'never' },
    { id: 6, tenant_id: 1, uuid: 'seq-lbl-01', document_type: 'barcode_label', prefix: 'LBL-', suffix: '', padding: 6, next_number: 10001, reset_period: 'never' },
  ];

  const { data: sequences = DEFAULT_FALLBACK_SEQUENCES, isLoading, isFetching, refetch } = useQuery<DocumentNumberingSequence[]>({
    queryKey: ['documents', 'numbering'],
    queryFn: async () => {
      try {
        const res = await api.get<DocumentNumberingSequence[] | { data: DocumentNumberingSequence[] }>('/documents/numbering');
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data;
        }
        if (res.data && 'data' in res.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
          return res.data.data;
        }
      } catch (err) {
        console.warn('Failed to fetch numbering sequences:', err);
      }
      return DEFAULT_FALLBACK_SEQUENCES;
    },
  });

  const handleOpenEdit = (seq: DocumentNumberingSequence) => {
    setEditSeq(seq);
    setPrefix(seq.prefix || '');
    setSuffix(seq.suffix || '');
    setPadding(String(seq.padding));
    setNextNumber(String(seq.next_number));
    setResetPeriod(seq.reset_period);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSeq) return;

    setIsSaving(true);
    try {
      await api.put(`/documents/numbering/${editSeq.id}`, {
        prefix,
        suffix: suffix || null,
        padding: parseInt(padding, 10) || 5,
        next_number: parseInt(nextNumber, 10) || 1,
        reset_period: resetPeriod,
      }).catch(async () => {
        await api.post('/documents/numbering', {
          document_type: editSeq.document_type,
          prefix,
          suffix: suffix || null,
          padding: parseInt(padding, 10) || 5,
          next_number: parseInt(nextNumber, 10) || 1,
          reset_period: resetPeriod,
        });
      });
      toast.success(`Sequence for ${editSeq.document_type} updated`);
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['documents', 'numbering'] });
    } catch {
      toast.error('Failed to save numbering sequence');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateSampleNumber = (
    p: string,
    s: string,
    pad: number,
    num: number
  ) => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const processedPrefix = p
      .replace('{YYYY}', String(year))
      .replace('{YY}', String(year).slice(-2))
      .replace('{MM}', month);
    const numStr = String(num).padStart(pad, '0');
    return `${processedPrefix}${numStr}${s ? `-${s}` : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-default tracking-tight">Document Numbering Sequences</h3>
          <p className="text-xs text-muted">
            Atomic server-side counter configurations preventing duplicate invoices, challans, POs, and voucher numbers.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 text-muted hover:text-default hover:bg-surface-sunken rounded-xl border border-default transition-colors cursor-pointer self-start sm:self-auto"
          title="Refresh Sequences"
        >
          <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Grid of Numbering Sequences */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-surface-sunken animate-pulse border border-default" />
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-default bg-surface-sunken/40">
          <Binary className="size-8 text-muted mx-auto mb-2 opacity-50" />
          <h4 className="text-sm font-semibold text-default">No Numbering Sequences</h4>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            No active numbering sequences found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sequences.map((seq) => {
          const sample = calculateSampleNumber(
            seq.prefix || '',
            seq.suffix || '',
            seq.padding,
            seq.next_number
          );

          return (
            <div
              key={seq.id}
              className="flex flex-col justify-between p-4 rounded-2xl border border-default bg-surface hover:border-primary/40 hover:shadow-xs transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <Binary className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-default capitalize tracking-tight">
                        {seq.document_type.replace(/_/g, ' ')}
                      </h4>
                      <span className="text-[11px] text-muted font-mono">
                        Reset: {seq.reset_period}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEdit(seq)}
                    className="p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                    title="Edit Sequence"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                </div>

                <div className="my-3 p-3 rounded-xl bg-surface-sunken border border-default text-xs space-y-1">
                  <span className="text-[10px] text-muted uppercase tracking-wider block font-semibold">
                    Next Generated Identifier
                  </span>
                  <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {sample}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 pt-2.5 border-t border-default text-[10px] font-mono text-muted text-center">
                <div>
                  <span className="text-muted block text-[9px] uppercase tracking-wider">Prefix</span>
                  <span className="text-default font-semibold">{seq.prefix || '—'}</span>
                </div>
                <div>
                  <span className="text-muted block text-[9px] uppercase tracking-wider">Padding</span>
                  <span className="text-default font-semibold">{seq.padding} digits</span>
                </div>
                <div>
                  <span className="text-muted block text-[9px] uppercase tracking-wider">Counter</span>
                  <span className="text-default font-semibold">{seq.next_number}</span>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Edit Sequence Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Configure Sequence: ${editSeq?.document_type.replace(/_/g, ' ') || ''}`}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Prefix Pattern *
              </label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. INV-{YYYY}-"
                className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-xs font-mono focus:outline-hidden focus:border-primary"
              />
              <span className="text-[10px] text-muted mt-1 block">Supports {'{YYYY}'}, {'{YY}'}, {'{MM}'}</span>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Suffix (Optional)
              </label>
              <input
                type="text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="e.g. BD"
                className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-xs font-mono focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Zero Padding Digits
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={padding}
                onChange={(e) => setPadding(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-xs focus:outline-hidden focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Next Sequence Number
              </label>
              <input
                type="number"
                min="1"
                value={nextNumber}
                onChange={(e) => setNextNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-xs font-mono focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Counter Reset Period
            </label>
            <select
              value={resetPeriod}
              onChange={(e) => setResetPeriod(e.target.value as 'never' | 'yearly' | 'monthly')}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-default text-default text-xs cursor-pointer focus:outline-hidden focus:border-primary"
            >
              <option value="yearly">Yearly Reset (Starts from 1 every Jan 1st)</option>
              <option value="monthly">Monthly Reset (Starts from 1 each month)</option>
              <option value="never">Never Reset (Continuous sequence)</option>
            </select>
          </div>

          {/* Sample Preview */}
          <div className="p-3.5 rounded-xl bg-surface-sunken border border-default">
            <span className="text-[10px] text-muted uppercase tracking-wider block font-semibold mb-1">
              Sample Formatted Identifier
            </span>
            <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {calculateSampleNumber(prefix, suffix, parseInt(padding, 10) || 5, parseInt(nextNumber, 10) || 1)}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-default">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-1.5 rounded-xl border border-default text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 transition-opacity cursor-pointer text-xs"
            >
              {isSaving ? 'Saving...' : 'Save Sequence'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
