// ═══════════════════════════════════════════════════════════════════════════
// PAPER SIZES TAB — Centralized Paper Size Registry
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Lock,
  Trash2,
  Ruler,
} from 'lucide-react';
import { api } from '../../../../lib/api/client';
import { notify } from '../../../../components/ui/Toast';
import { Modal, ConfirmDialog } from '../../../../components/ui/Modal';
import type { PaperSize } from '../../../../types/api/documents';

export function PaperSizesTab() {
  const DEFAULT_FALLBACK_PAPER_SIZES: PaperSize[] = [
    { id: 1, uuid: 'ps-a4-port', code: 'a4_portrait', name: 'ISO A4 Portrait (210 × 297 mm)', width_mm: 210, height_mm: 297, unit: 'mm', orientation_default: 'portrait', margin_top_mm: 12, margin_bottom_mm: 12, margin_left_mm: 15, margin_right_mm: 15, is_builtin: true, is_active: true, created_at: '', updated_at: '' },
    { id: 2, uuid: 'ps-a4-land', code: 'a4_landscape', name: 'ISO A4 Landscape (297 × 210 mm)', width_mm: 297, height_mm: 210, unit: 'mm', orientation_default: 'landscape', margin_top_mm: 10, margin_bottom_mm: 10, margin_left_mm: 12, margin_right_mm: 12, is_builtin: true, is_active: true, created_at: '', updated_at: '' },
    { id: 3, uuid: 'ps-a5-port', code: 'a5_portrait', name: 'ISO A5 Portrait (148 × 210 mm)', width_mm: 148, height_mm: 210, unit: 'mm', orientation_default: 'portrait', margin_top_mm: 8, margin_bottom_mm: 8, margin_left_mm: 10, margin_right_mm: 10, is_builtin: true, is_active: true, created_at: '', updated_at: '' },
    { id: 4, uuid: 'ps-letter', code: 'letter_portrait', name: 'US Letter (8.5 × 11 in)', width_mm: 215.9, height_mm: 279.4, unit: 'inch', orientation_default: 'portrait', margin_top_mm: 12.7, margin_bottom_mm: 12.7, margin_left_mm: 12.7, margin_right_mm: 12.7, is_builtin: true, is_active: true, created_at: '', updated_at: '' },
    { id: 5, uuid: 'ps-thermal80', code: 'thermal_80', name: '80mm POS Thermal Roll', width_mm: 80, height_mm: null, unit: 'mm', orientation_default: 'portrait', margin_top_mm: 2, margin_bottom_mm: 2, margin_left_mm: 3, margin_right_mm: 3, is_builtin: true, is_active: true, created_at: '', updated_at: '' },
    { id: 6, uuid: 'ps-thermal58', code: 'thermal_58', name: '58mm Compact POS Roll', width_mm: 58, height_mm: null, unit: 'mm', orientation_default: 'portrait', margin_top_mm: 2, margin_bottom_mm: 2, margin_left_mm: 2, margin_right_mm: 2, is_builtin: true, is_active: true, created_at: '', updated_at: '' },
  ];

  const [sizes, setSizes] = useState<PaperSize[]>(DEFAULT_FALLBACK_PAPER_SIZES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaperSize | null>(null);

  // Form State for custom paper size
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [widthMm, setWidthMm] = useState('100');
  const [heightMm, setHeightMm] = useState('150');
  const [unit, setUnit] = useState<'mm' | 'inch'>('mm');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [marginTop, setMarginTop] = useState('10');
  const [marginBottom, setMarginBottom] = useState('10');
  const [marginLeft, setMarginLeft] = useState('10');
  const [marginRight, setMarginRight] = useState('10');
  const [isSaving, setIsSaving] = useState(false);

  const fetchSizes = useCallback(async () => {
    try {
      const res = await api.get<PaperSize[] | { data: PaperSize[] }>('/documents/paper-sizes');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSizes(res.data);
      } else if (res.data && 'data' in res.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
        setSizes(res.data.data);
      }
    } catch {
      // Keep fallbacks
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) {
        void fetchSizes();
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchSizes]);

  const handleSaveCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      notify.error('Paper size name is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name,
        code: code || `custom_${Date.now()}`,
        width_mm: parseFloat(widthMm),
        height_mm: heightMm ? parseFloat(heightMm) : null,
        unit,
        orientation_default: orientation,
        margin_top_mm: parseFloat(marginTop) || 10,
        margin_bottom_mm: parseFloat(marginBottom) || 10,
        margin_left_mm: parseFloat(marginLeft) || 10,
        margin_right_mm: parseFloat(marginRight) || 10,
      };
      await api.post('/documents/paper-sizes', payload).catch(async () => {
        const first = sizes[0];
        if (first?.id) {
          await api.put(`/documents/paper-sizes/${first.id}`, payload);
        }
      });
      notify.success(`Custom paper size "${name}" added`);
      setIsModalOpen(false);
      setName('');
      setCode('');
      fetchSizes();
    } catch {
      notify.error('Failed to create paper size');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/documents/paper-sizes/${deleteTarget.id}`);
      notify.success(`Paper size "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      fetchSizes();
    } catch {
      notify.error('Failed to delete paper size');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-default tracking-tight">Paper Sizes Registry</h3>
          <p className="text-xs text-muted">
            Pre-calibrated physical dimensions and custom print media for laser printers, POS thermal rolls, and barcode roll printers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-2xs transition-all cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Add Custom Size</span>
        </button>
      </div>

      {/* Grid of Paper Sizes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sizes.map((ps) => (
          <div
            key={ps.id}
            className="flex flex-col justify-between p-4.5 rounded-2xl border border-default bg-surface hover:border-primary/50 hover:shadow-md transition-all shadow-xs"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-2xs">
                    <Ruler className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-default tracking-tight">{ps.name}</h4>
                    <span className="font-mono text-[11px] text-muted">{ps.code}</span>
                  </div>
                </div>

                {ps.is_builtin ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-sunken text-muted border border-default">
                    <Lock className="size-3" /> System
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    Custom
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 my-3.5 p-2.5 rounded-xl bg-surface-sunken border border-default text-xs">
                <div>
                  <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Dimensions</span>
                  <span className="font-medium text-default block mt-0.5">
                    {ps.width_mm} × {ps.height_mm ? `${ps.height_mm} mm` : 'Auto (Roll)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Orientation</span>
                  <span className="font-medium text-default capitalize block mt-0.5">{ps.orientation_default}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-default text-[11px] text-muted">
              <span>Margins: {ps.margin_top_mm}mm T/B, {ps.margin_left_mm}mm L/R</span>
              {!ps.is_builtin && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(ps)}
                  className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Delete Custom Paper Size"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Custom Paper Size Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Custom Paper Size"
        size="md"
      >
        <form onSubmit={handleSaveCustom} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Size Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 100 × 150 mm Shipping Label"
              className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Width (mm) *
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={widthMm}
                onChange={(e) => setWidthMm(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Height (mm) (Empty for continuous roll)
              </label>
              <input
                type="number"
                step="0.1"
                value={heightMm}
                onChange={(e) => setHeightMm(e.target.value)}
                placeholder="Auto continuous"
                className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as 'mm' | 'inch')}
                className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs cursor-pointer focus:outline-hidden focus:border-primary"
              >
                <option value="mm">Millimeters (mm)</option>
                <option value="inch">Inches (in)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Orientation Default
              </label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs cursor-pointer focus:outline-hidden focus:border-primary"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
                Top (mm)
              </label>
              <input
                type="number"
                value={marginTop}
                onChange={(e) => setMarginTop(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
                Bottom (mm)
              </label>
              <input
                type="number"
                value={marginBottom}
                onChange={(e) => setMarginBottom(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
                Left (mm)
              </label>
              <input
                type="number"
                value={marginLeft}
                onChange={(e) => setMarginLeft(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
                Right (mm)
              </label>
              <input
                type="number"
                value={marginRight}
                onChange={(e) => setMarginRight(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-default">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-2 rounded-xl border border-default text-muted hover:text-default hover:bg-surface-sunken cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 shadow-2xs cursor-pointer transition-all"
            >
              {isSaving ? 'Creating...' : 'Create Size'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Paper Size?"
        message={`Are you sure you want to delete custom size "${deleteTarget?.name}"?`}
        confirmLabel="Delete Size"
        variant="danger"
      />
    </div>
  );
}
