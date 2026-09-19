import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCode, Plus, Search, Calculator, Sparkles, Eye, Edit2, Trash2, Copy, Upload, Download } from 'lucide-react';
import { api } from '../../../lib/api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { QueryBoundary } from '../../../components/patterns/QueryBoundary';
import { isApiError } from '../../../lib/api/errors';
import { notify } from '../../../components/ui/Toast';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { bomImportSchema } from '../schemas/bomImportSchema';
import type { BillOfMaterial } from '../../../types/api/bom';
import type { Product } from '../../../types/api/catalog';
import type { Unit } from '../../../types/api/unit';
import { useCurrency } from '../../../hooks/useCurrency';

interface BOMItemDraft {
  product_id: string;
  quantity: string;
  unit_id: string;
}

interface BOMFormDraft {
  product_id: string;
  code: string;
  name: string;
  version: number | string;
  output_quantity: string;
  output_unit_id: string;
  is_default: boolean;
  is_active?: boolean;
  items?: BOMItemDraft[];
}

function deriveBOMDefaults(product?: Product | null): { code: string; name: string } {
  if (!product || !product.name) {
    return { code: 'BOM-001', name: '' };
  }

  const rawName = product.name.trim();

  // 1. Extract clean prefix for BOM Code according to product name
  let codePrefix: string;

  // Check for model or short code in parentheses: e.g. (SM-IC220) -> SM-IC220
  const parenMatch = rawName.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    codePrefix = parenMatch[1].trim().replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  } else if (product.sku && product.sku.trim() && product.sku !== rawName) {
    // Or from SKU, stripping FG- prefix: e.g. FG-IC-2200 -> IC-2200
    codePrefix = product.sku.trim().replace(/^FG-?/i, '').replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  } else {
    // From product name words (stripping company/brand prefix e.g. SliceMart)
    const stripped = rawName.replace(/^slicemart\s+/i, '').replace(/[^A-Za-z0-9\s-]/g, '').trim();
    const words = stripped.split(/[\s-]+/).filter(Boolean);
    if (words.length === 0) {
      codePrefix = 'PRD';
    } else if (words.length === 1 && words[0]) {
      codePrefix = words[0].slice(0, 10).toUpperCase();
    } else if (words.length === 2 && words[0] && words[1]) {
      codePrefix = `${words[0].slice(0, 4)}-${words[1].slice(0, 4)}`.toUpperCase();
    } else {
      codePrefix = words.slice(0, 3).map((w) => w.slice(0, 3).toUpperCase()).join('-');
    }
  }

  if (!codePrefix) codePrefix = 'PRD';
  if (codePrefix.length > 14) codePrefix = codePrefix.slice(0, 14);

  const code = `BOM-${codePrefix}-01`;
  const name = /BOM$/i.test(rawName) ? rawName : `${rawName} Assembly BOM`;

  return { code, name };
}

export function BillOfMaterialsSection() {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingBOM, setEditingBOM] = useState<BillOfMaterial | null>(null);
  const [viewingBOM, setViewingBOM] = useState<BillOfMaterial | null>(null);
  const [deletingBOM, setDeletingBOM] = useState<BillOfMaterial | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedBOMForRollup, setSelectedBOMForRollup] = useState<BillOfMaterial | null>(null);
  const [materialCostInflation, setMaterialCostInflation] = useState<number>(0);

  const [draft, setDraft] = useState<BOMFormDraft>({
    product_id: '',
    code: '',
    name: '',
    version: 1,
    output_quantity: '1.0000',
    output_unit_id: '',
    is_default: true,
    is_active: true,
    items: [],
  });

  const updateDraftItem = (index: number, patch: Partial<BOMItemDraft>) => {
    setDraft((prev) => ({
      ...prev,
      items: (prev.items || []).map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));
  };

  const removeDraftItem = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== index),
    }));
  };

  const queryClient = useQueryClient();

  const bomsQuery = useQuery({
    queryKey: ['catalogue', 'boms', search],
    queryFn: ({ signal }) =>
      api.get<BillOfMaterial[]>('/boms', {
        signal,
        params: search.trim().length >= 2 ? { q: search.trim() } : {},
      }),
  });

  const productsQuery = useQuery({
    queryKey: ['catalogue', 'products', 'finished-options'],
    queryFn: ({ signal }) =>
      api.get<Product[]>('/products', { signal, params: { type: 'finished' } }),
  });

  const rawMaterialsQuery = useQuery({
    queryKey: ['catalogue', 'products', 'raw-materials'],
    queryFn: ({ signal }) =>
      api.get<Product[]>('/products', { signal, params: { type: 'raw_material' } }),
  });

  const unitsQuery = useQuery({
    queryKey: ['catalogue', 'units', 'options'],
    queryFn: ({ signal }) => api.get<Unit[]>('/units', { signal }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: BOMFormDraft) => {
      const verStr = String(payload.version).trim();
      const version = verStr.startsWith('v') ? verStr : `v${verStr}.0`;
      const body = {
        product_id: payload.product_id,
        name: payload.name.trim(),
        version,
        output_quantity: Number(payload.output_quantity || 1).toFixed(4),
        output_unit_id: payload.output_unit_id,
        status: payload.is_active ? 'active' : 'draft',
        items: (payload.items || [])
          .filter((it) => it.product_id && it.unit_id)
          .map((it, idx) => ({
            product_id: it.product_id,
            quantity: Number(it.quantity || 1).toFixed(4),
            unit_id: it.unit_id,
            sort_order: idx + 1,
          })),
      };
      return api.post<BillOfMaterial>('/boms', body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'boms'] });
      setIsCreateOpen(false);
      setDraft({
        product_id: '',
        code: '',
        name: '',
        version: 1,
        output_quantity: '1.0000',
        output_unit_id: '',
        is_default: true,
        is_active: true,
        items: [],
      });
      setErrorMsg(null);
      notify.success('Bill of Materials created successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        if (err.code === 'DUPLICATE') setErrorMsg('BOM version for this product already exists.');
        else setErrorMsg(err.message ?? 'Failed to create BOM.');
      } else {
        setErrorMsg('Error creating BOM.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BOMFormDraft> }) => {
      const body: Record<string, unknown> = {};
      if (payload.product_id) body.product_id = payload.product_id;
      if (payload.name) body.name = payload.name.trim();
      if (payload.version !== undefined) {
        const verStr = String(payload.version).trim();
        body.version = verStr.startsWith('v') ? verStr : `v${verStr}.0`;
      }
      if (payload.output_quantity) {
        body.output_quantity = Number(payload.output_quantity).toFixed(4);
      }
      if (payload.output_unit_id) body.output_unit_id = payload.output_unit_id;
      if (payload.is_active !== undefined) {
        body.status = payload.is_active ? 'active' : 'draft';
      }
      if (payload.items) {
        body.items = payload.items
          .filter((it) => it.product_id && it.unit_id)
          .map((it, idx) => ({
            product_id: it.product_id,
            quantity: Number(it.quantity || 1).toFixed(4),
            unit_id: it.unit_id,
            sort_order: idx + 1,
          }));
      }
      return api.patch<BillOfMaterial>(`/boms/${id}`, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'boms'] });
      setEditingBOM(null);
      setErrorMsg(null);
      notify.success('Bill of Materials updated successfully.');
    },
    onError: (err) => {
      if (isApiError(err)) {
        setErrorMsg(err.message ?? 'Failed to update BOM.');
      } else {
        setErrorMsg('Error updating BOM.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/boms/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'boms'] });
      setDeletingBOM(null);
      notify.success('Bill of Materials deleted successfully.');
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : 'Failed to delete BOM.';
      notify.error(msg);
    },
  });

  const handleOpenEdit = (b: BillOfMaterial) => {
    setErrorMsg(null);
    setDraft({
      product_id: b.product_id,
      code: b.code,
      name: b.name,
      version: b.version,
      output_quantity: b.output_quantity,
      output_unit_id: b.output_unit_id,
      is_default: b.is_default,
      is_active: b.is_active,
      items: (b.items || []).map((it) => ({
        product_id: it.product_id,
        quantity: String(it.quantity),
        unit_id: it.unit_id,
      })),
    });
    setEditingBOM(b);
    const bomId = (b as { uuid?: string }).uuid || b.id;
    void api.get<BillOfMaterial>(`/boms/${bomId}`).then((res) => {
      if (res && res.data) {
        setEditingBOM(res.data);
      }
    }).catch(() => {});
  };

  const handleDuplicateBOM = (b: BillOfMaterial) => {
    setErrorMsg(null);
    setDraft({
      product_id: b.product_id,
      code: `${b.code}-COPY`,
      name: `${b.name} (Copy)`,
      version: Number(b.version || 1) + 1,
      output_quantity: b.output_quantity,
      output_unit_id: b.output_unit_id,
      is_default: false,
      is_active: true,
      items: (b.items || []).map((it) => ({
        product_id: it.product_id,
        quantity: String(it.quantity),
        unit_id: it.unit_id,
      })),
    });
    setEditingBOM(null);
    setIsCreateOpen(true);
    notify.info(`Duplicating BOM "${b.name}". Review materials, update version/code, and save.`);
  };

  const boms = useMemo(() => bomsQuery.data?.data ?? [], [bomsQuery.data?.data]);
  const products = useMemo(() => productsQuery.data?.data ?? [], [productsQuery.data?.data]);
  const rawMaterials = useMemo(() => rawMaterialsQuery.data?.data ?? [], [rawMaterialsQuery.data?.data]);
  const units = useMemo(() => unitsQuery.data?.data ?? [], [unitsQuery.data?.data]);

  const selectedParentProduct = useMemo(() => {
    return (
      products.find(
        (p) => String(p.id) === String(draft.product_id)
      ) || products[0] || null
    );
  }, [products, draft.product_id]);

  const sampleComponents = [
    { name: 'Microcrystalline Ceramic Glass Panel (280x360mm)', qty: 1.0, unit: 'PC', baseCost: 450.0 },
    { name: '2200W Infrared Heating Coil', qty: 1.0, unit: 'PC', baseCost: 380.0 },
    { name: 'Digital Touch Mainboard PCB', qty: 1.0, unit: 'PC', baseCost: 320.0 },
    { name: 'Brushless DC Cooling Fan 12V', qty: 1.0, unit: 'PC', baseCost: 120.0 },
    { name: 'Stainless Steel Chassis Bottom Case', qty: 1.0, unit: 'PC', baseCost: 260.0 },
    { name: 'Infrared Cooker Shockproof EPE Foam Set', qty: 1.0, unit: 'SET', baseCost: 85.0 },
  ];

  const handleExportCsv = () => {
    if (!boms.length) {
      notify.info('No BOMs to export.');
      return;
    }
    const headers = ['finished_sku', 'bom_name', 'version', 'output_quantity', 'output_unit', 'component_sku', 'component_quantity', 'component_unit', 'scrap_percentage', 'status'];
    const rows: string[][] = [];
    boms.forEach((b) => {
      const anyB = b as unknown as { product?: { sku?: string }; output_unit?: { code?: string } };
      const fSku = anyB.product?.sku || b.code || '';
      const bName = b.name || '';
      const ver = String(b.version || 'v1.0');
      const outQty = String(b.output_quantity || 1);
      const outUnit = anyB.output_unit?.code || b.output_unit_id || '';
      const stat = b.is_active ? 'active' : 'inactive';

      if (!b.items || b.items.length === 0) {
        rows.push([fSku, `"${bName.replace(/"/g, '""')}"`, ver, outQty, outUnit, '', '', '', '0', stat]);
      } else {
        b.items.forEach((it) => {
          const anyIt = it as unknown as { product?: { sku?: string }; unit?: { code?: string } };
          rows.push([
            fSku,
            `"${bName.replace(/"/g, '""')}"`,
            ver,
            outQty,
            outUnit,
            it.product_sku || anyIt.product?.sku || '',
            String(it.quantity || 1),
            it.unit_code || anyIt.unit?.code || it.unit_id || '',
            String(it.scrap_percentage || it.wastage_allowance_percentage || 0),
            stat,
          ]);
        });
      }
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `boms_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify.success(`Exported ${boms.length} BOM recipes to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Search and New BOM Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search BOM by structure name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-default bg-surface py-2 pl-9 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Import BOM recipes from Excel (.xlsx) or CSV"
          >
            <Upload className="size-3.5 text-primary" />
            <span>Import</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Export BOM recipes to CSV"
          >
            <Download className="size-3.5 text-muted" />
            <span>Export CSV</span>
          </button>
          <Button
            variant="primary"
            onClick={() => {
              setErrorMsg(null);
              const firstProd = products[0] || null;
              const defaults = deriveBOMDefaults(firstProd);
              setDraft({
                product_id: firstProd?.id ? String(firstProd.id) : '',
                code: defaults.code,
                name: defaults.name,
                version: 1,
                output_quantity: '1.0000',
                output_unit_id: firstProd?.base_unit_id ? String(firstProd.base_unit_id) : (units[0]?.id ? String(units[0].id) : ''),
                is_default: true,
                is_active: true,
                items: [],
              });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Bill of Material</span>
          </Button>
        </div>
      </div>

      <QueryBoundary
        status={bomsQuery.status}
        error={bomsQuery.error}
        data={bomsQuery.data}
        isFetching={bomsQuery.isFetching}
      >
        <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
          <table className="w-full text-left text-xs text-default border-collapse">
            <thead className="border-b border-default bg-surface-sunken/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="py-3.5 pl-4 pr-3">BOM Code</th>
                <th className="py-3.5 px-3">BOM / Structure Name</th>
                <th className="py-3.5 px-3">Version</th>
                <th className="py-3.5 px-3">Output Qty</th>
                <th className="py-3.5 px-3">Default</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 pr-4 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {boms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No Bills of Material configured. Click "New Bill of Material" to create one.
                  </td>
                </tr>
              ) : (
                boms.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-3.5 pl-4 pr-3 font-mono font-semibold text-primary">
                      {b.code}
                    </td>
                    <td className="py-3.5 px-3 text-default font-medium flex items-center gap-2">
                      <FileCode className="size-3.5 text-muted" />
                      <span>{b.name}</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-muted">v{b.version}</td>
                    <td className="py-3.5 px-3 font-mono text-default">{b.output_quantity}</td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          b.is_default
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-surface-sunken text-muted border border-default'
                        }`}
                      >
                        {b.is_default ? 'Primary' : 'Alternative'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          b.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingBOM(b)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="View BOM Structure"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateBOM(b)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-amber-600 dark:hover:text-amber-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="Duplicate / Clone BOM"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(b)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-primary hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="Edit BOM"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedBOMForRollup(b)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="Simulate Cost Rollup"
                        >
                          <Calculator className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingBOM(b)}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-surface-sunken transition-colors cursor-pointer"
                          title="Delete BOM"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </QueryBoundary>

      {/* Cost Rollup Simulator Modal */}
      {selectedBOMForRollup && (
        <Modal
          open={Boolean(selectedBOMForRollup)}
          onClose={() => setSelectedBOMForRollup(null)}
          title={`Cost Rollup Simulation: ${selectedBOMForRollup.name}`}
          size="lg"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between p-3.5 bg-primary/10 border border-primary/20 rounded-xl">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  Interactive Material Inflation & Yield Stress-Testing
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-default">
                  +{materialCostInflation}% Cost Fluctuation
                </span>
                <input
                  type="range"
                  min="-20"
                  max="50"
                  step="5"
                  value={materialCostInflation}
                  onChange={(e) => setMaterialCostInflation(Number(e.target.value))}
                  className="w-28 accent-indigo-600"
                />
              </div>
            </div>

            {(() => {
              const activeComponents =
                selectedBOMForRollup.items && selectedBOMForRollup.items.length > 0
                  ? selectedBOMForRollup.items.map((it) => ({
                      name: it.product_name || `Part #${it.product_id}`,
                      qty: Number(it.quantity) || 1,
                      unit: it.unit_code || 'PCS',
                      baseCost: it.standard_cost || 100,
                    }))
                  : sampleComponents;

              const totalSimulated = activeComponents.reduce(
                (sum, c) => sum + c.baseCost * (1 + materialCostInflation / 100) * c.qty,
                0
              );

              return (
                <>
                  <div className="overflow-hidden rounded-xl border border-default">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-sunken/80 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-default">
                        <tr>
                          <th className="py-2.5 px-3">Ingredient / Assembly Component</th>
                          <th className="py-2.5 px-3">Base Requirement</th>
                          <th className="py-2.5 px-3">Unit Cost</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-default">
                        {activeComponents.map((c, i) => {
                          const effectiveCost = c.baseCost * (1 + materialCostInflation / 100);
                          const subtotal = effectiveCost * c.qty;
                          return (
                            <tr key={i} className="hover:bg-surface-sunken/30">
                              <td className="py-2 px-3 font-medium text-default">{c.name}</td>
                              <td className="py-2 px-3 font-mono text-muted">
                                {c.qty} {c.unit}
                              </td>
                              <td className="py-2 px-3 font-mono text-muted">
                                {formatCurrency(effectiveCost)}
                              </td>
                              <td className="py-2 px-3 font-mono text-right font-semibold text-default">
                                {formatCurrency(subtotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-default">
                    <div className="text-xs">
                      <span className="text-muted">Total Simulated Batch Cost: </span>
                      <span className="font-bold text-primary text-sm font-mono ml-1">
                        {formatCurrency(totalSimulated)}
                      </span>
                    </div>
                    <Button variant="secondary" onClick={() => setSelectedBOMForRollup(null)}>
                      Close Simulation
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Create BOM Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Bill of Materials"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(draft);
          }}
          className="space-y-4"
        >
          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-500/20">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-default">BOM Code *</label>
                {selectedParentProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      const defaults = deriveBOMDefaults(selectedParentProduct);
                      setDraft((prev) => ({ ...prev, code: defaults.code }));
                    }}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-normal"
                    title="Generate default BOM code from product"
                  >
                    <Sparkles className="size-2.5" />
                    <span>Auto-prefix</span>
                  </button>
                )}
              </div>
              <input
                required
                type="text"
                placeholder={selectedParentProduct ? deriveBOMDefaults(selectedParentProduct).code : 'e.g. BOM-BRD-001'}
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none uppercase font-mono"
              />
              <p className="text-[10px] text-muted mt-1">
                Default prefix synced from product model/name.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Parent Finished Product *</label>
              <select
                required
                value={draft.product_id}
                onChange={(e) => {
                  const newProductId = e.target.value;
                  const selectedProd = products.find(
                    (p) => String(p.id) === newProductId
                  );
                  if (selectedProd) {
                    const defaults = deriveBOMDefaults(selectedProd);
                    setDraft((prev) => ({
                      ...prev,
                      product_id: newProductId,
                      code: defaults.code,
                      name: defaults.name,
                      output_unit_id: selectedProd.base_unit_id
                        ? String(selectedProd.base_unit_id)
                        : (prev.output_unit_id || (units[0]?.id ? String(units[0].id) : '')),
                    }));
                  } else {
                    setDraft((prev) => ({ ...prev, product_id: newProductId }));
                  }
                }}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="">Select Finished Item</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-default">BOM / Assembly Structure Name *</label>
              {selectedParentProduct && (
                <button
                  type="button"
                  onClick={() => {
                    const defaults = deriveBOMDefaults(selectedParentProduct);
                    setDraft((prev) => ({ ...prev, name: defaults.name }));
                  }}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-normal"
                  title="Generate default assembly name from product"
                >
                  <Sparkles className="size-2.5" />
                  <span>Auto-name</span>
                </button>
              )}
            </div>
            <input
              required
              type="text"
              placeholder={selectedParentProduct ? deriveBOMDefaults(selectedParentProduct).name : 'e.g. 2200W Infrared Cooker Assembly BOM'}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <p className="text-[10px] text-muted mt-1">
              Default assembly name synced according to product name.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Output Quantity</label>
              <input
                type="text"
                value={draft.output_quantity}
                onChange={(e) => setDraft({ ...draft, output_quantity: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default font-mono focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Output Unit *</label>
              <select
                required
                value={draft.output_unit_id}
                onChange={(e) => setDraft({ ...draft, output_unit_id: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
              >
                <option value="">Select Unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Version Number</label>
              <input
                type="number"
                min="1"
                value={draft.version}
                onChange={(e) => setDraft({ ...draft, version: parseInt(e.target.value, 10) || 1 })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="create_is_default_bom"
              checked={draft.is_default}
              onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })}
              className="size-4 rounded border-default text-primary focus:ring-primary/20"
            />
            <label htmlFor="create_is_default_bom" className="text-xs font-medium text-default">
              Set as Primary Production BOM for this Finished SKU
            </label>
          </div>

          {/* Raw Material Components (Optional) */}
          <div className="space-y-2 pt-3 border-t border-default">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-default flex items-center gap-1.5">
                <FileCode className="size-3.5 text-primary" />
                Raw Material Components (Optional)
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setDraft({
                    ...draft,
                    items: [
                      ...(draft.items || []),
                      {
                        product_id: rawMaterials[0]?.id || products[0]?.id || '',
                        quantity: '1.0000',
                        unit_id: units[0]?.id || '',
                      },
                    ],
                  })
                }
                className="text-[11px] h-7 px-2"
              >
                <Plus className="size-3 mr-1" />
                <span>Add Material</span>
              </Button>
            </div>

            {(!draft.items || draft.items.length === 0) ? (
              <p className="text-[11px] text-muted italic bg-surface-sunken p-2.5 rounded-xl border border-default text-center">
                No raw material lines added yet. You can save now and configure assembly components later.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {draft.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center bg-surface-sunken p-2 rounded-xl border border-default text-xs"
                  >
                    <div className="col-span-6">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateDraftItem(idx, { product_id: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default focus:border-primary focus:outline-none"
                      >
                        <option value="">Select Raw Material / Part</option>
                        {(rawMaterials.length > 0 ? rawMaterials : products).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateDraftItem(idx, { quantity: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default font-mono focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={item.unit_id}
                        onChange={(e) => updateDraftItem(idx, { unit_id: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default focus:border-primary focus:outline-none"
                      >
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeDraftItem(idx)}
                        className="text-rose-500 hover:text-rose-600 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                        title="Remove component line"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save BOM'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit BOM Modal */}
      {editingBOM && (
        <Modal
          open={Boolean(editingBOM)}
          onClose={() => setEditingBOM(null)}
          title={`Edit BOM: ${editingBOM.name}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: editingBOM.id,
                payload: draft,
              });
            }}
            className="space-y-4"
          >
            {errorMsg && (
              <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-default mb-1">BOM Code *</label>
                <input
                  required
                  type="text"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-default mb-1">Version</label>
                <input
                  type="number"
                  min="1"
                  value={draft.version}
                  onChange={(e) =>
                    setDraft({ ...draft, version: parseInt(e.target.value, 10) || 1 })
                  }
                  className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">BOM / Structure Name *</label>
              <input
                required
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_default_bom"
                  checked={draft.is_default}
                  onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })}
                  className="size-4 rounded border-default text-primary focus:ring-primary/20"
                />
                <label htmlFor="edit_is_default_bom" className="text-xs font-medium text-default">
                  Default BOM
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_active_bom"
                  checked={draft.is_active ?? true}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="size-4 rounded border-default text-primary focus:ring-primary/20"
                />
                <label htmlFor="edit_is_active_bom" className="text-xs font-medium text-default">
                  Active BOM
                </label>
              </div>
            </div>

            {/* Raw Material Components (Optional) */}
            <div className="space-y-2 pt-3 border-t border-default">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-default flex items-center gap-1.5">
                  <FileCode className="size-3.5 text-primary" />
                  Raw Material Components (Optional)
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      items: [
                        ...(draft.items || []),
                        {
                          product_id: rawMaterials[0]?.id || products[0]?.id || '',
                          quantity: '1.0000',
                          unit_id: units[0]?.id || '',
                        },
                      ],
                    })
                  }
                  className="text-[11px] h-7 px-2"
                >
                  <Plus className="size-3 mr-1" />
                  <span>Add Material</span>
                </Button>
              </div>

              {(!draft.items || draft.items.length === 0) ? (
                <p className="text-[11px] text-muted italic bg-surface-sunken p-2.5 rounded-xl border border-default text-center">
                  No raw material lines added yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {draft.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-surface-sunken p-2 rounded-xl border border-default text-xs"
                    >
                      <div className="col-span-6">
                        <select
                          value={item.product_id}
                          onChange={(e) => updateDraftItem(idx, { product_id: e.target.value })}
                          className="w-full rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default focus:border-primary focus:outline-none"
                        >
                          <option value="">Select Raw Material / Part</option>
                          {(rawMaterials.length > 0 ? rawMaterials : products).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateDraftItem(idx, { quantity: e.target.value })}
                          className="w-full rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default font-mono focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          value={item.unit_id}
                          onChange={(e) => updateDraftItem(idx, { unit_id: e.target.value })}
                          className="w-full rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default focus:border-primary focus:outline-none"
                        >
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.code}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeDraftItem(idx)}
                          className="text-rose-500 hover:text-rose-600 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                          title="Remove component line"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" type="button" onClick={() => setEditingBOM(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update BOM'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* View BOM Modal */}
      {viewingBOM && (
        <Modal
          open={Boolean(viewingBOM)}
          onClose={() => setViewingBOM(null)}
          title={`BOM Specifications: ${viewingBOM.name}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface-sunken/60 border border-default">
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">BOM Code</span>
                <span className="font-mono font-bold text-primary text-sm">{viewingBOM.code}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Revision Version</span>
                <span className="font-mono text-default">v{viewingBOM.version}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Batch Output Qty</span>
                <span className="font-mono text-default">{viewingBOM.output_quantity}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">BOM Status</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {viewingBOM.is_active ? 'Production Ready' : 'Draft / Inactive'}
                </span>
              </div>
            </div>

            {/* Assembly Component Breakdown Table */}
            <div className="space-y-2 pt-2 border-t border-default">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
                Assembly Component Breakdown ({viewingBOM.items?.length ?? 0} items)
              </span>
              {viewingBOM.items && viewingBOM.items.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-default">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-sunken text-[10px] font-bold uppercase tracking-wider text-muted border-b border-default">
                      <tr>
                        <th className="py-2 px-3">Component / Part</th>
                        <th className="py-2 px-3 font-mono">Qty</th>
                        <th className="py-2 px-3 font-mono">Unit</th>
                        <th className="py-2 px-3 font-mono text-right">Standard Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {viewingBOM.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-surface-sunken/40">
                          <td className="py-2 px-3 font-medium text-default">
                            {it.product_name || `Part #${it.product_id}`}
                            {it.product_sku && (
                              <span className="text-muted font-mono text-[10px] ml-1.5">
                                ({it.product_sku})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-default">{it.quantity}</td>
                          <td className="py-2 px-3 font-mono text-muted">{it.unit_code || 'Units'}</td>
                          <td className="py-2 px-3 font-mono text-right text-default font-semibold">
                            {it.standard_cost ? formatCurrency(it.standard_cost) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted italic text-[11px] bg-surface-sunken p-3 rounded-xl border border-default text-center">
                  No raw material items listed for this BOM version.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setViewingBOM(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete BOM Modal */}
      {deletingBOM && (
        <Modal
          open={Boolean(deletingBOM)}
          onClose={() => setDeletingBOM(null)}
          title="Delete Bill of Materials"
        >
          <div className="space-y-4 text-xs">
            <p className="text-default">
              Are you sure you want to delete BOM{' '}
              <strong className="text-primary font-mono">{deletingBOM.name}</strong> (
              {deletingBOM.code})?
            </p>
            <p className="text-muted text-[11px]">
              This action cannot be undone if work orders are actively executing with this BOM.
            </p>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
              <Button variant="secondary" onClick={() => setDeletingBOM(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(deletingBOM.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        schema={bomImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['catalogue', 'boms'] });
        }}
      />
    </div>
  );
}
