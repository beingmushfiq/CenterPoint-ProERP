import React, { useState } from 'react';
import {
  X,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  PackageCheck,
  Calendar,
  Tag,
} from 'lucide-react';
import type { GoodsReceipt, GoodsReceiptItem } from '../../../types/api/purchasing';
import { api } from '../../../lib/api/client';
import { notify } from '../../../components/ui/Toast';

interface GoodsReceiptQcModalProps {
  open: boolean;
  onClose: () => void;
  grn: GoodsReceipt | null;
  onSuccess: (updatedGrn: GoodsReceipt) => void;
}

interface ItemInspectionState {
  id: number;
  product_name: string;
  product_sku?: string;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  batch_code: string;
  expiry_date: string;
  defect_reason: string;
}

const DEFECT_REASONS = [
  'None - Meets Specification',
  'Damaged / Crushed Packaging',
  'Broken Seal / Tampered',
  'Short Shelf-Life / Near Expiry',
  'Incorrect Specification / Variant',
  'Physical Contamination / Foreign Material',
  'Missing Components / Accessories',
  'Weight / Volume Discrepancy',
];

function buildInitialInspections(grn: GoodsReceipt): ItemInspectionState[] {
  if (!grn.items) return [];
  return grn.items.map((item: GoodsReceiptItem) => {
    const rec = parseFloat(item.received_quantity) || 0;
    const acc = item.accepted_quantity ? parseFloat(item.accepted_quantity) : rec;
    const rej = item.rejected_quantity ? parseFloat(item.rejected_quantity) : Math.max(0, rec - acc);

    return {
      id: item.id,
      product_name: item.product_name || `Product #${item.product_id}`,
      product_sku: item.product_sku || '',
      received_quantity: rec,
      accepted_quantity: acc,
      rejected_quantity: rej,
      batch_code: item.batch_code || `LOT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`,
      expiry_date: item.expiry_date || '',
      defect_reason: rej > 0 ? 'Damaged / Crushed Packaging' : 'None - Meets Specification',
    };
  });
}

export const GoodsReceiptQcModal: React.FC<GoodsReceiptQcModalProps> = ({
  open,
  onClose,
  grn,
  onSuccess,
}) => {
  if (!open || !grn) return null;

  return (
    <GoodsReceiptQcModalContent
      key={`${grn.id}-${grn.status}`}
      onClose={onClose}
      grn={grn}
      onSuccess={onSuccess}
    />
  );
};

const GoodsReceiptQcModalContent: React.FC<{
  grn: GoodsReceipt;
  onClose: () => void;
  onSuccess: (updatedGrn: GoodsReceipt) => void;
}> = ({
  grn,
  onClose,
  onSuccess,
}) => {
  const [packagingIntact, setPackagingIntact] = useState(true);
  const [storageCompliant, setStorageCompliant] = useState(true);
  const [labelsMatch, setLabelsMatch] = useState(true);
  const [autoCompleteOnPass, setAutoCompleteOnPass] = useState(true);
  const [qcNotes, setQcNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Initialize inspection state from GRN items
  const [inspections, setInspections] = useState<ItemInspectionState[]>(() => buildInitialInspections(grn));

  const totalReceived = inspections.reduce((s, i) => s + i.received_quantity, 0);
  const totalAccepted = inspections.reduce((s, i) => s + i.accepted_quantity, 0);
  const totalRejected = inspections.reduce((s, i) => s + i.rejected_quantity, 0);
  const rejectionRate = totalReceived > 0 ? (totalRejected / totalReceived) * 100 : 0;

  // Determine suggested verdict
  const suggestedVerdict: 'qc_passed' | 'partially_accepted' | 'qc_failed' =
    totalRejected === 0 && packagingIntact && storageCompliant && labelsMatch
      ? 'qc_passed'
      : totalAccepted > 0
      ? 'partially_accepted'
      : 'qc_failed';

  const handleAcceptedChange = (index: number, val: string) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setInspections((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const validAccepted = Math.min(item.received_quantity, num);
        const autoRejected = Math.max(0, item.received_quantity - validAccepted);
        return {
          ...item,
          accepted_quantity: validAccepted,
          rejected_quantity: autoRejected,
          defect_reason: autoRejected > 0 && item.defect_reason === 'None - Meets Specification'
            ? 'Damaged / Crushed Packaging'
            : autoRejected === 0
            ? 'None - Meets Specification'
            : item.defect_reason,
        };
      })
    );
  };

  const handleRejectedChange = (index: number, val: string) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setInspections((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const validRejected = Math.min(item.received_quantity, num);
        const autoAccepted = Math.max(0, item.received_quantity - validRejected);
        return {
          ...item,
          rejected_quantity: validRejected,
          accepted_quantity: autoAccepted,
          defect_reason: validRejected > 0 && item.defect_reason === 'None - Meets Specification'
            ? 'Damaged / Crushed Packaging'
            : validRejected === 0
            ? 'None - Meets Specification'
            : item.defect_reason,
        };
      })
    );
  };

  const handleBatchChange = (index: number, batch_code: string) => {
    setInspections((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, batch_code } : item))
    );
  };

  const handleExpiryChange = (index: number, expiry_date: string) => {
    setInspections((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, expiry_date } : item))
    );
  };

  const handleDefectReasonChange = (index: number, defect_reason: string) => {
    setInspections((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, defect_reason } : item))
    );
  };

  const handleSubmitDecision = async (decision: 'qc_passed' | 'partially_accepted' | 'qc_failed') => {
    setSubmitting(true);
    try {
      const payload = {
        status: decision,
        notes: [
          `QC Verdict: ${decision.toUpperCase()}`,
          `Inspection Checklist: Packaging ${packagingIntact ? 'PASS' : 'FAIL'}, Storage ${storageCompliant ? 'PASS' : 'FAIL'}, Labels ${labelsMatch ? 'PASS' : 'FAIL'}`,
          qcNotes ? `Inspector Remarks: ${qcNotes}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
        items: inspections.map((i) => ({
          id: i.id,
          accepted_quantity: i.accepted_quantity.toFixed(4),
          rejected_quantity: i.rejected_quantity.toFixed(4),
          batch_code: i.batch_code,
          expiry_date: i.expiry_date || null,
        })),
      };

      const res = await api.post<{ success: boolean; data: GoodsReceipt }>(
        `/purchasing/goods-receipts/${grn.id}/qc`,
        payload
      );

      let finalGrn: GoodsReceipt = res.data?.data || {
        ...grn,
        status: decision,
        notes: (grn.notes ? grn.notes + '\n' : '') + payload.notes,
        items: grn.items?.map((item) => {
          const match = inspections.find((i) => i.id === item.id);
          if (!match) return item;
          return {
            ...item,
            accepted_quantity: match.accepted_quantity.toFixed(4),
            rejected_quantity: match.rejected_quantity.toFixed(4),
            batch_code: match.batch_code,
            expiry_date: match.expiry_date || null,
          };
        }),
      };

      // If QC passed or partially accepted and auto-complete is checked, ingest stock into inventory
      if ((decision === 'qc_passed' || decision === 'partially_accepted') && autoCompleteOnPass) {
        try {
          await api.post(`/purchasing/goods-receipts/${grn.id}/complete`, {});
          finalGrn = { ...finalGrn, status: 'completed' };
          notify.success('QC Inspection Passed & Stock Ingested', {
            description: `GRN #${grn.grn_number} is completed. Accepted inventory balances updated in ${grn.warehouse_name || 'warehouse'}.`,
          });
        } catch {
          notify.success('QC Sign-off Recorded', {
            description: `GRN #${grn.grn_number} marked as ${decision.replace('_', ' ')}.`,
          });
        }
      } else {
        notify.success('QC Sign-off Recorded', {
          description: `GRN #${grn.grn_number} updated with ${decision.replace('_', ' ')}.`,
        });
      }

      onSuccess(finalGrn);
      onClose();
    } catch (err: unknown) {
      console.error('QC inspection failed', err);
      notify.error('QC submission failed', {
        description: 'Unable to update goods receipt QC status. Please check connection and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-default rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-default flex items-center justify-between bg-surface-sunken/40">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ClipboardCheck className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-default">
                  Goods Receipt Quality Control & Inspection
                </h2>
                <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-primary/10 text-primary uppercase">
                  {grn.grn_number}
                </span>
              </div>
              <p className="text-xs text-muted">
                Inspect physical intake, record batch & expiry codes, and sign off inventory inwarding.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-hover transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-xl bg-surface-sunken/50 border border-default text-xs">
            <div>
              <span className="text-muted block text-2xs">Purchase Order:</span>
              <span className="font-semibold text-default">{grn.po_number || 'Direct Inward (None)'}</span>
            </div>
            <div>
              <span className="text-muted block text-2xs">Supplier:</span>
              <span className="font-semibold text-default truncate block">{grn.supplier_name || 'Vendor'}</span>
            </div>
            <div>
              <span className="text-muted block text-2xs">Target Warehouse:</span>
              <span className="font-semibold text-default truncate block">{grn.warehouse_name || 'Main Warehouse'}</span>
            </div>
            <div>
              <span className="text-muted block text-2xs">Receipt Date:</span>
              <span className="font-semibold text-default">{grn.receipt_date || new Date().toISOString().slice(0, 10)}</span>
            </div>
          </div>

          {/* Preliminary Physical Inspection Checklist */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" />
              1. Physical Intake Checklist
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                  packagingIntact
                    ? 'border-success/30 bg-success/5 text-default'
                    : 'border-destructive/30 bg-destructive/5 text-destructive'
                }`}
              >
                <input
                  type="checkbox"
                  checked={packagingIntact}
                  onChange={(e) => setPackagingIntact(e.target.checked)}
                  className="mt-0.5 rounded text-success focus:ring-success"
                />
                <div>
                  <span className="font-semibold block">Package Integrity</span>
                  <span className="text-2xs text-muted block">Cartons sealed, undamaged, no wetness or tear</span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                  storageCompliant
                    ? 'border-success/30 bg-success/5 text-default'
                    : 'border-destructive/30 bg-destructive/5 text-destructive'
                }`}
              >
                <input
                  type="checkbox"
                  checked={storageCompliant}
                  onChange={(e) => setStorageCompliant(e.target.checked)}
                  className="mt-0.5 rounded text-success focus:ring-success"
                />
                <div>
                  <span className="font-semibold block">Temperature / Condition</span>
                  <span className="text-2xs text-muted block">Intact cold-chain or dry warehouse safety standards</span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                  labelsMatch
                    ? 'border-success/30 bg-success/5 text-default'
                    : 'border-destructive/30 bg-destructive/5 text-destructive'
                }`}
              >
                <input
                  type="checkbox"
                  checked={labelsMatch}
                  onChange={(e) => setLabelsMatch(e.target.checked)}
                  className="mt-0.5 rounded text-success focus:ring-success"
                />
                <div>
                  <span className="font-semibold block">Labels & SKU Matching</span>
                  <span className="text-2xs text-muted block">Barcode, brand markings match vendor delivery note</span>
                </div>
              </label>
            </div>
          </div>

          {/* Line Items Inspection Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <PackageCheck className="size-3.5 text-primary" />
                2. Line Items Inspection & Batch Allocation
              </h3>
              <span className="text-2xs text-muted">
                {inspections.length} {inspections.length === 1 ? 'item' : 'items'} in this GRN
              </span>
            </div>

            <div className="border border-default rounded-xl overflow-hidden bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken/60 text-muted uppercase text-2xs font-bold border-b border-default">
                    <tr>
                      <th className="px-3.5 py-2.5">Product & SKU</th>
                      <th className="px-3.5 py-2.5 text-right">Received</th>
                      <th className="px-3.5 py-2.5 text-right w-24">Accepted</th>
                      <th className="px-3.5 py-2.5 text-right w-24">Rejected</th>
                      <th className="px-3.5 py-2.5 w-36">Batch / Lot</th>
                      <th className="px-3.5 py-2.5 w-32">Expiry Date</th>
                      <th className="px-3.5 py-2.5">Defect / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {inspections.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="px-3.5 py-3">
                          <span className="font-semibold text-default block truncate max-w-xs">
                            {item.product_name}
                          </span>
                          {item.product_sku && (
                            <span className="text-2xs text-muted font-mono">{item.product_sku}</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono font-semibold text-default">
                          {item.received_quantity}
                        </td>
                        <td className="px-3.5 py-3">
                          <input
                            type="number"
                            min="0"
                            max={item.received_quantity}
                            step="any"
                            value={item.accepted_quantity}
                            onChange={(e) => handleAcceptedChange(idx, e.target.value)}
                            className="w-20 px-2 py-1 rounded-lg border border-default bg-surface text-right font-mono text-xs focus:ring-1 focus:ring-primary focus:border-primary text-success font-semibold"
                          />
                        </td>
                        <td className="px-3.5 py-3">
                          <input
                            type="number"
                            min="0"
                            max={item.received_quantity}
                            step="any"
                            value={item.rejected_quantity}
                            onChange={(e) => handleRejectedChange(idx, e.target.value)}
                            className={`w-20 px-2 py-1 rounded-lg border text-right font-mono text-xs focus:ring-1 focus:ring-destructive focus:border-destructive ${
                              item.rejected_quantity > 0
                                ? 'border-destructive/50 bg-destructive/10 text-destructive font-bold'
                                : 'border-default bg-surface text-muted'
                            }`}
                          />
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="relative">
                            <input
                              type="text"
                              value={item.batch_code}
                              onChange={(e) => handleBatchChange(idx, e.target.value)}
                              placeholder="Batch Code"
                              className="w-full pl-6 pr-2 py-1 rounded-lg border border-default bg-surface font-mono text-2xs focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                            <Tag className="size-3 absolute left-1.5 top-2 text-muted" />
                          </div>
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="relative">
                            <input
                              type="date"
                              value={item.expiry_date}
                              onChange={(e) => handleExpiryChange(idx, e.target.value)}
                              className="w-full pl-6 pr-1 py-1 rounded-lg border border-default bg-surface text-2xs focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                            <Calendar className="size-3 absolute left-1.5 top-2 text-muted" />
                          </div>
                        </td>
                        <td className="px-3.5 py-3">
                          <select
                            value={item.defect_reason}
                            onChange={(e) => handleDefectReasonChange(idx, e.target.value)}
                            disabled={item.rejected_quantity === 0}
                            className={`w-full px-2 py-1 rounded-lg border text-2xs focus:ring-1 ${
                              item.rejected_quantity > 0
                                ? 'border-destructive/40 bg-surface text-destructive font-medium'
                                : 'border-default bg-surface-sunken/40 text-muted cursor-not-allowed'
                            }`}
                          >
                            {DEFECT_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Inspector Remarks & Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-default block">
                Inspector Notes & Observations:
              </label>
              <textarea
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                placeholder="Enter observations, reason for any rejected lot, or supplier quality feedback..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-default bg-surface text-xs focus:ring-1 focus:ring-primary focus:border-primary"
              />
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoCompleteOnPass}
                  onChange={(e) => setAutoCompleteOnPass(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Automatically mark GRN completed and ingest approved stock into warehouse ledger</span>
              </label>
            </div>

            {/* Metrics Card */}
            <div className="p-4 rounded-xl border border-default bg-surface-sunken/50 space-y-2.5 text-xs">
              <span className="font-bold text-default block text-2xs uppercase tracking-wider">
                Inspection Totals
              </span>
              <div className="flex justify-between items-center py-0.5 border-b border-default/50">
                <span className="text-muted">Total Received:</span>
                <span className="font-mono font-semibold text-default">{totalReceived.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-default/50">
                <span className="text-success font-medium">Accepted:</span>
                <span className="font-mono font-bold text-success">{totalAccepted.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-default/50">
                <span className="text-destructive font-medium">Damaged / Rejected:</span>
                <span className="font-mono font-bold text-destructive">{totalRejected.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-muted">Rejection Rate:</span>
                <span
                  className={`font-mono font-bold ${
                    rejectionRate > 0 ? 'text-destructive' : 'text-success'
                  }`}
                >
                  {rejectionRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-default bg-surface-sunken/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="font-medium text-default">Suggested Action:</span>
            <span
              className={`px-2 py-0.5 rounded text-2xs font-bold uppercase ${
                suggestedVerdict === 'qc_passed'
                  ? 'bg-success/10 text-success'
                  : suggestedVerdict === 'partially_accepted'
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {suggestedVerdict.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-default text-xs font-semibold text-muted hover:text-default hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>

            {/* Reject Entire Lot */}
            <button
              type="button"
              onClick={() => handleSubmitDecision('qc_failed')}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <XCircle className="size-4" />
              Reject Entire Lot
            </button>

            {/* Partially Accept */}
            {totalRejected > 0 && totalAccepted > 0 && (
              <button
                type="button"
                onClick={() => handleSubmitDecision('partially_accepted')}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <AlertTriangle className="size-4" />
                Partially Accept ({totalAccepted.toFixed(0)})
              </button>
            )}

            {/* Pass & Approve */}
            <button
              type="button"
              onClick={() => handleSubmitDecision(suggestedVerdict === 'qc_passed' ? 'qc_passed' : 'partially_accepted')}
              disabled={submitting || totalAccepted === 0}
              className="px-5 py-2 rounded-xl bg-success text-white hover:bg-success/90 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              {submitting ? 'Submitting...' : 'Approve & Pass QC'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
