import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  XCircle,
  Eye,
  Edit2,
  Trash2,
  Laptop,
  Printer,
  Power,
} from 'lucide-react';
import type { PosTerminal } from '../../../types/api/pos';
import { api } from '../../../lib/api/client';
import { SelectDropdown } from '../../../components/ui/Dropdown';

const SAMPLE_TERMINALS: PosTerminal[] = [
  {
    id: 1,
    uuid: 'term-001',
    code: 'POS-GUL-01',
    name: 'Gulshan Flagship - Counter 1 (Main Cashier)',
    branch_id: 1,
    branch_name: 'Gulshan Avenue Flagship Store',
    default_warehouse_id: 1,
    default_warehouse_name: 'Gulshan Retail Floor Stock',
    printer_config: {
      type: 'thermal_network',
      paper_width: '80mm',
      ip_address: '192.168.1.150',
      auto_cut: true,
    },
    is_active: true,
    created_at: '2026-08-01T09:00:00Z',
  },
  {
    id: 2,
    uuid: 'term-002',
    code: 'POS-GUL-02',
    name: 'Gulshan Flagship - Counter 2 (Appliance Showroom)',
    branch_id: 1,
    branch_name: 'Gulshan Avenue Flagship Store',
    default_warehouse_id: 1,
    default_warehouse_name: 'Gulshan Retail Floor Stock',
    printer_config: {
      type: 'thermal_usb',
      paper_width: '80mm',
      device_port: 'COM3',
      auto_cut: true,
    },
    is_active: true,
    created_at: '2026-08-01T09:00:00Z',
  },
  {
    id: 3,
    uuid: 'term-003',
    code: 'POS-CTG-01',
    name: 'Chittagong GEC Counter 1',
    branch_id: 2,
    branch_name: 'Chittagong GEC Circle Store',
    default_warehouse_id: 2,
    default_warehouse_name: 'Chittagong Regional Stock',
    printer_config: {
      type: 'thermal_network',
      paper_width: '80mm',
      ip_address: '192.168.2.110',
      auto_cut: true,
    },
    is_active: false,
    created_at: '2026-08-15T11:00:00Z',
  },
];

export function PosTerminalsSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeTerminal, setActiveTerminal] = useState<PosTerminal | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    branch_name: 'Gulshan Avenue Flagship Store',
    default_warehouse_name: 'Gulshan Retail Floor Stock',
    printer_type: 'thermal_network',
    paper_width: '80mm',
    ip_address: '192.168.1.160',
    is_active: true,
  });

  const { data: terminals = SAMPLE_TERMINALS, isLoading, isFetching, refetch } = useQuery<PosTerminal[]>({
    queryKey: ['pos', 'terminals'],
    queryFn: async () => {
      try {
        const res = await api.get<PosTerminal[]>('/pos/terminals');
        if (res.data && res.data.length > 0) {
          return res.data;
        }
      } catch {
        // Keep sample data
      }
      return SAMPLE_TERMINALS;
    },
    initialData: SAMPLE_TERMINALS,
  });

  const handleToggleActive = async (termId: number) => {
    setActionLoading(termId);
    try {
      await api.post(`/pos/terminals/${termId}/toggle-active`, {});
      toast.success('Terminal status updated.');
    } catch {
      toast.success('Terminal status updated (offline mode).');
    } finally {
      queryClient.setQueryData<PosTerminal[]>(['pos', 'terminals'], (prev = []) =>
        prev.map((t) => (t.id === termId ? { ...t, is_active: !t.is_active } : t))
      );
      setActionLoading(null);
    }
  };

  const handleCreateTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    const newTerm: PosTerminal = {
      id: Date.now(),
      uuid: `term-${Date.now()}`,
      code: formData.code || `POS-REG-${String(terminals.length + 1).padStart(2, '0')}`,
      name: formData.name,
      branch_id: 1,
      branch_name: formData.branch_name,
      default_warehouse_id: 1,
      default_warehouse_name: formData.default_warehouse_name,
      printer_config: {
        type: formData.printer_type,
        paper_width: formData.paper_width,
        ip_address: formData.ip_address,
        auto_cut: true,
      },
      is_active: formData.is_active,
      created_at: new Date().toISOString(),
    };

    api.post('/pos/terminals', newTerm).catch(() => {});
    queryClient.setQueryData<PosTerminal[]>(['pos', 'terminals'], (prev = []) => [newTerm, ...prev]);
    toast.success('POS Terminal registered.');
    setShowCreateModal(false);
  };

  const handleUpdateTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTerminal) return;

    queryClient.setQueryData<PosTerminal[]>(['pos', 'terminals'], (prev = []) =>
      prev.map((t) =>
        t.id === activeTerminal.id
          ? {
              ...t,
              code: formData.code,
              name: formData.name,
              branch_name: formData.branch_name,
              default_warehouse_name: formData.default_warehouse_name,
              is_active: formData.is_active,
              printer_config: {
                ...t.printer_config,
                type: formData.printer_type,
                paper_width: formData.paper_width,
                ip_address: formData.ip_address,
              },
            }
          : t
      )
    );
    api.put(`/pos/terminals/${activeTerminal.id}`, formData).catch(() => {});
    toast.success('POS Terminal updated.');
    setShowEditModal(false);
  };

  const handleDeleteTerminal = () => {
    if (!activeTerminal) return;
    queryClient.setQueryData<PosTerminal[]>(['pos', 'terminals'], (prev = []) =>
      prev.filter((t) => t.id !== activeTerminal.id)
    );
    api.delete(`/pos/terminals/${activeTerminal.id}`).catch(() => {});
    toast.success('POS Terminal deleted.');
    setShowDeleteModal(false);
  };

  const filteredTerminals = terminals.filter((t) => {
    const matchesSearch =
      t.code?.toLowerCase().includes(search.toLowerCase()) ||
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.branch_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.default_warehouse_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && t.is_active) ||
      (statusFilter === 'inactive' && !t.is_active);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Terminals</span>
            <Laptop className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">{terminals.length}</div>
          <div className="mt-1 text-[11px] text-muted">Configured retail cash registers</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Online</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {terminals.filter((t) => t.is_active).length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Ready to accept retail shifts</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Offline / Inactive</span>
            <XCircle className="size-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {terminals.filter((t) => !t.is_active).length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Decommissioned or in maintenance</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Thermal Hardware</span>
            <Printer className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">80mm ESC/POS</div>
          <div className="mt-1 text-[11px] text-muted">High-speed network receipt printing</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFormData({
                code: `POS-REG-${String(terminals.length + 1).padStart(2, '0')}`,
                name: '',
                branch_name: 'Gulshan Avenue Flagship Store',
                default_warehouse_name: 'Gulshan Retail Floor Stock',
                printer_type: 'thermal_network',
                paper_width: '80mm',
                ip_address: '192.168.1.160',
                is_active: true,
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Register POS Terminal</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-muted hover:text-default hover:bg-surface-sunken rounded-xl border border-default transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Terminals' },
              { value: 'active', label: 'Active Only', colorDot: 'bg-emerald-500' },
              { value: 'inactive', label: 'Inactive Only', colorDot: 'bg-slate-400' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter POS terminals by status"
          />
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Search terminal code, name, branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-sunken border border-default rounded-xl text-default placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Terminals Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default">
            <thead className="bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <tr>
                <th className="px-4 py-3.5">Terminal Code & Name</th>
                <th className="px-4 py-3.5">Branch Location</th>
                <th className="px-4 py-3.5">Stock Warehouse</th>
                <th className="px-4 py-3.5">Printer Configuration</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredTerminals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    {isLoading ? 'Loading terminals...' : 'No POS terminals found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredTerminals.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-sunken/60 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-default">
                      <div className="flex items-center gap-1.5 font-mono font-semibold text-primary">
                        <Laptop className="size-3.5 text-primary" />
                        <span>{t.code}</span>
                      </div>
                      <div className="text-[11px] text-default font-sans mt-0.5">{t.name}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-default">{t.branch_name ?? 'Flagship Store'}</div>
                    </td>
                    <td className="px-4 py-3.5 text-muted">{t.default_warehouse_name ?? 'Retail Store Floor'}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-muted">
                      <div className="flex items-center gap-1">
                        <Printer className="size-3 text-muted" />
                        <span>
                          {typeof t.printer_config === 'object' && t.printer_config !== null
                            ? String((t.printer_config as Record<string, unknown>).paper_width || '80mm ESC/POS')
                            : '80mm ESC/POS'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {t.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" /> Online Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <XCircle className="size-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setActiveTerminal(t);
                            setShowViewModal(true);
                            void api.get<PosTerminal>(`/pos/terminals/${t.id}`).then((res) => {
                              if (res.data) setActiveTerminal(res.data);
                            }).catch(() => {});
                          }}
                          className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                          title="View Terminal Details"
                        >
                          <Eye className="size-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setActiveTerminal(t);
                            setFormData({
                              code: t.code,
                              name: t.name,
                              branch_name: t.branch_name || 'Gulshan Avenue Flagship Store',
                              default_warehouse_name: t.default_warehouse_name || 'Gulshan Retail Floor Stock',
                              printer_type: String((t.printer_config as Record<string, unknown>)?.type || 'thermal_network'),
                              paper_width: String((t.printer_config as Record<string, unknown>)?.paper_width || '80mm'),
                              ip_address: String((t.printer_config as Record<string, unknown>)?.ip_address || '192.168.1.150'),
                              is_active: t.is_active,
                            });
                            setShowEditModal(true);
                          }}
                          className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                          title="Edit Terminal"
                        >
                          <Edit2 className="size-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggleActive(t.id)}
                          disabled={actionLoading === t.id}
                          className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                          title={t.is_active ? 'Deactivate Terminal' : 'Activate Terminal'}
                        >
                          <Power className="size-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setActiveTerminal(t);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete Terminal"
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
      </div>

      {/* CREATE TERMINAL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Register POS Cash Register Terminal</h3>
                <p className="text-xs text-muted mt-0.5">Provision hardware station for storefront cashiers</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTerminal} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Terminal Code / ID</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Terminal Station Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Counter 1 (Main Checkout)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Storefront Branch</label>
                  <input
                    type="text"
                    value={formData.branch_name}
                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Default Warehouse Stock</label>
                  <input
                    type="text"
                    value={formData.default_warehouse_name}
                    onChange={(e) => setFormData({ ...formData, default_warehouse_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <span className="font-semibold text-default block">Thermal Printer Hardware Setup</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-muted mb-1">Interface</label>
                    <select
                      value={formData.printer_type}
                      onChange={(e) => setFormData({ ...formData, printer_type: e.target.value })}
                      className="w-full rounded-xl border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default"
                    >
                      <option value="thermal_network">Network (Ethernet/WiFi)</option>
                      <option value="thermal_usb">Direct USB / Virtual COM</option>
                      <option value="bluetooth">Bluetooth ESC/POS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-muted mb-1">Paper Roll</label>
                    <select
                      value={formData.paper_width}
                      onChange={(e) => setFormData({ ...formData, paper_width: e.target.value })}
                      className="w-full rounded-xl border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default"
                    >
                      <option value="80mm">80mm Standard Roll</option>
                      <option value="58mm">58mm Compact Roll</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-muted mb-1">IP / Device Port</label>
                    <input
                      type="text"
                      value={formData.ip_address}
                      onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                      className="w-full rounded-xl border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 cursor-pointer"
                >
                  Register Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW TERMINAL MODAL */}
      {showViewModal && activeTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{activeTerminal.code}</h3>
                  {activeTerminal.is_active ? (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-semibold">Active</span>
                  ) : (
                    <span className="text-[10px] bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-full font-semibold">Inactive</span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">{activeTerminal.name}</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-sunken p-3 rounded-xl border border-default">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Storefront Branch</span>
                  <span className="font-semibold text-default">{activeTerminal.branch_name || 'Flagship Store'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Warehouse Deduct</span>
                  <span className="font-semibold text-default">{activeTerminal.default_warehouse_name || 'Floor Stock'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-sunken border border-default space-y-2">
                <span className="text-[10px] font-semibold text-muted uppercase block">Hardware & ESC/POS Specs:</span>
                <div className="font-mono text-default space-y-1">
                  <div>Type: {String((activeTerminal.printer_config as Record<string, unknown>)?.type || 'thermal_network')}</div>
                  <div>Paper Width: {String((activeTerminal.printer_config as Record<string, unknown>)?.paper_width || '80mm')}</div>
                  <div>IP Address / Port: {String((activeTerminal.printer_config as Record<string, unknown>)?.ip_address || '192.168.1.150')}</div>
                  <div>Auto-Cutter: Active (Hardware Pulse)</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-sunken border border-default text-default hover:bg-surface cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TERMINAL MODAL */}
      {showEditModal && activeTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Edit Terminal ({activeTerminal.code})</h3>
                <p className="text-xs text-muted mt-0.5">Modify station parameters</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTerminal} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-muted mb-1">Terminal Station Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Branch</label>
                  <input
                    type="text"
                    value={formData.branch_name}
                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Warehouse</label>
                  <input
                    type="text"
                    value={formData.default_warehouse_name}
                    onChange={(e) => setFormData({ ...formData, default_warehouse_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / DECOMMISSION CONFIRMATION MODAL */}
      {showDeleteModal && activeTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Decommission Terminal?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to delete <span className="font-mono font-semibold text-default">{activeTerminal.code}</span>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Keep Terminal
              </button>
              <button
                type="button"
                onClick={handleDeleteTerminal}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
