import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  Play,
  Plus,
  RefreshCw,
  Search,
  StopCircle,
  XCircle,
  Eye,
  DollarSign,
  Printer,
  Receipt,
} from 'lucide-react';
import type { PosSession } from '../../../types/api/pos';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';

interface PosSessionsSectionProps {
  onLaunchPOS?: (session: PosSession) => void;
}

const SAMPLE_SESSIONS: PosSession[] = [
  {
    id: 1,
    uuid: 'sess-001',
    session_number: 'SES-202608-001',
    terminal_id: 1,
    terminal_name: 'Gulshan Flagship - Counter 1',
    branch_id: 1,
    branch_name: 'Gulshan Avenue Flagship Store',
    warehouse_id: 1,
    warehouse_name: 'Gulshan Retail Floor Stock',
    user_id: 1,
    operator_name: 'Tanvir Hossain (Cashier A)',
    opened_at: '2026-08-30T08:00:00Z',
    closed_at: null,
    opening_cash: '2000.00',
    expected_cash: '18450.00',
    counted_cash: null,
    cash_variance: null,
    card_total: '12400.00',
    mobile_total: '8950.00',
    credit_total: '0.00',
    sales_count: 42,
    refund_total: '300.00',
    status: 'open',
    notes: 'Morning shift started with opening drawer float.',
    created_at: '2026-08-30T08:00:00Z',
  },
  {
    id: 2,
    uuid: 'sess-002',
    session_number: 'SES-202608-002',
    terminal_id: 2,
    terminal_name: 'Gulshan Flagship - Counter 2',
    branch_id: 1,
    branch_name: 'Gulshan Avenue Flagship Store',
    warehouse_id: 1,
    warehouse_name: 'Gulshan Retail Floor Stock',
    user_id: 2,
    operator_name: 'Sabrina Islam (Cashier B)',
    opened_at: '2026-08-29T14:00:00Z',
    closed_at: '2026-08-29T22:30:00Z',
    opening_cash: '2000.00',
    expected_cash: '24600.00',
    counted_cash: '24600.00',
    cash_variance: '0.00',
    card_total: '18500.00',
    mobile_total: '14200.00',
    credit_total: '0.00',
    sales_count: 68,
    refund_total: '0.00',
    status: 'closed',
    notes: 'Evening closing reconciled with zero cash drawer variance.',
    created_at: '2026-08-29T14:00:00Z',
  },
];

export function PosSessionsSection({ onLaunchPOS }: PosSessionsSectionProps) {
  const { formatCurrency, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [activeSession, setActiveSession] = useState<PosSession | null>(null);

  // Form State
  const [openFormData, setOpenFormData] = useState({
    session_number: '',
    terminal_id: 1,
    terminal_name: 'Gulshan Flagship - Counter 1',
    operator_name: 'Tanvir Hossain',
    opening_cash: '2000.00',
    notes: '',
  });

  const [closeFormData, setCloseFormData] = useState({
    counted_cash: '',
    notes: '',
  });

  const { data: sessions = SAMPLE_SESSIONS, isLoading, isFetching, refetch } = useQuery<PosSession[]>({
    queryKey: ['pos', 'sessions'],
    queryFn: async () => {
      try {
        const sessRes = await api.get<PosSession[]>('/pos/sessions');
        if (sessRes.data && sessRes.data.length > 0) {
          return sessRes.data;
        }
      } catch {
        // Keep sample data
      }
      return SAMPLE_SESSIONS;
    },
    initialData: SAMPLE_SESSIONS,
  });

  const handleOpenSession = (e: React.FormEvent) => {
    e.preventDefault();
    const newSess: PosSession = {
      id: Date.now(),
      uuid: `sess-${Date.now()}`,
      session_number:
        openFormData.session_number ||
        `SES-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(sessions.length + 1).padStart(3, '0')}`,
      terminal_id: openFormData.terminal_id,
      terminal_name: openFormData.terminal_name,
      branch_id: 1,
      branch_name: 'Gulshan Avenue Flagship Store',
      warehouse_id: 1,
      warehouse_name: 'Gulshan Retail Floor Stock',
      user_id: 1,
      operator_name: openFormData.operator_name,
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: openFormData.opening_cash,
      expected_cash: openFormData.opening_cash,
      counted_cash: null,
      cash_variance: null,
      card_total: '0.00',
      mobile_total: '0.00',
      credit_total: '0.00',
      sales_count: 0,
      refund_total: '0.00',
      status: 'open',
      notes: openFormData.notes,
      created_at: new Date().toISOString(),
    };

    api.post('/pos/sessions', newSess).catch(() => {});
    queryClient.setQueryData<PosSession[]>(['pos', 'sessions'], (prev = []) => [newSess, ...prev]);
    toast.success('Cashier shift opened.');
    setShowOpenModal(false);
  };

  const handleCloseSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const counted = parseFloat(closeFormData.counted_cash || '0');
    const expected = parseFloat(activeSession.expected_cash || '0');
    const variance = (counted - expected).toFixed(2);

    queryClient.setQueryData<PosSession[]>(['pos', 'sessions'], (prev = []) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              status: 'closed',
              closed_at: new Date().toISOString(),
              counted_cash: closeFormData.counted_cash,
              cash_variance: variance,
              notes: closeFormData.notes,
            }
          : s
      )
    );

    api.post(`/pos/sessions/${activeSession.id}/close`, {
      counted_cash: closeFormData.counted_cash,
      notes: closeFormData.notes,
    }).catch(() => {});

    toast.success('Shift closed & Z-Report generated.');
    setShowCloseModal(false);
  };

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.session_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.terminal_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.operator_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.branch_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCollectedToday = sessions.reduce((sum, s) => {
    const cash = parseFloat(s.counted_cash || s.expected_cash || '0');
    const card = parseFloat(s.card_total || '0');
    const mobile = parseFloat(s.mobile_total || '0');
    return sum + cash + card + mobile;
  }, 0);

  const getStatusBadge = (status: PosSession['status']) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3 text-emerald-500 animate-pulse" /> Active Open Shift
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-surface-sunken text-muted border border-default">
            <StopCircle className="size-3 text-muted" /> Shift Closed
          </span>
        );
      case 'locked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="size-3 text-rose-500" /> Locked Out
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Shifts</span>
            <Receipt className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">{sessions.length}</div>
          <div className="mt-1 text-[11px] text-muted">All register shift sessions</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Open Shifts</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {sessions.filter((s) => s.status === 'open').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Cash registers currently transacting</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Closed Reconciled</span>
            <Clock className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">
            {sessions.filter((s) => s.status === 'closed').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Z-Reports generated & closed</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Revenue</span>
            <DollarSign className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(totalCollectedToday)}
          </div>
          <div className="mt-1 text-[11px] text-muted">Combined POS tender intake</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setOpenFormData({
                session_number: `SES-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(sessions.length + 1).padStart(3, '0')}`,
                terminal_id: 1,
                terminal_name: 'Gulshan Flagship - Counter 1',
                operator_name: 'Tanvir Hossain (Cashier)',
                opening_cash: '2000.00',
                notes: 'Morning shift drawer float.',
              });
              setShowOpenModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Open Cashier Shift</span>
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
              { value: 'all', label: 'All Shifts' },
              { value: 'open', label: 'Open Shifts', colorDot: 'bg-emerald-500' },
              { value: 'closed', label: 'Closed Shifts', colorDot: 'bg-slate-400' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter POS sessions by status"
          />
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Search shift #, operator, terminal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-sunken border border-default rounded-xl text-default placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Sessions Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default">
            <thead className="bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <tr>
                <th className="px-4 py-3.5">Shift # / Started</th>
                <th className="px-4 py-3.5">Station & Operator</th>
                <th className="px-4 py-3.5">Txns Count</th>
                <th className="px-4 py-3.5 text-right">Opening Float</th>
                <th className="px-4 py-3.5 text-right">Expected Drawer</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    {isLoading ? 'Loading sessions...' : 'No POS cashier sessions found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-sunken/60 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-medium text-default">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="size-3.5 text-primary" />
                        <span>{s.session_number}</span>
                      </div>
                      <div className="text-[10px] text-muted font-sans mt-0.5">{s.opened_at?.slice(0, 16).replace('T', ' ')}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-default">{s.terminal_name}</div>
                      <div className="text-[10px] text-muted">{s.operator_name}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-primary">{s.sales_count} Receipts</td>
                    <td className="px-4 py-3.5 text-right font-mono text-muted">
                      {formatCurrency(s.opening_cash)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-default">
                      {formatCurrency(s.expected_cash)}
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(s.status)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setActiveSession(s);
                            setShowViewModal(true);
                            void api.get<PosSession>(`/pos/sessions/${s.id}`).then((res) => {
                              if (res.data) setActiveSession(res.data);
                            }).catch(() => {});
                          }}
                          className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                          title="View Z-Report"
                        >
                          <Eye className="size-3.5" />
                        </button>

                        {s.status === 'open' && (
                          <>
                            {onLaunchPOS && (
                              <button
                                onClick={() => onLaunchPOS(s)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary text-primary-fg hover:opacity-90 transition-opacity cursor-pointer"
                                title="Launch Checkout Register"
                              >
                                <Play className="size-3" />
                                <span>POS Screen</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setActiveSession(s);
                                setCloseFormData({
                                  counted_cash: s.expected_cash,
                                  notes: '',
                                });
                                setShowCloseModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
                            >
                              <StopCircle className="size-3" />
                              <span>Close Shift</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OPEN SHIFT MODAL */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Open Cashier Shift Session</h3>
                <p className="text-xs text-muted mt-0.5">Initialize float balance and assign cashier station</p>
              </div>
              <button onClick={() => setShowOpenModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenSession} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Shift Session #</label>
                  <input
                    type="text"
                    value={openFormData.session_number}
                    onChange={(e) => setOpenFormData({ ...openFormData, session_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Terminal Station</label>
                  <select
                    value={openFormData.terminal_name}
                    onChange={(e) => setOpenFormData({ ...openFormData, terminal_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default"
                  >
                    <option value="Gulshan Flagship - Counter 1">Gulshan Counter 1 (Main Cashier)</option>
                    <option value="Gulshan Flagship - Counter 2">Gulshan Counter 2 (Appliance Showroom)</option>
                    <option value="Chittagong GEC Counter 1">Chittagong GEC Counter 1</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Cashier Operator</label>
                  <input
                    type="text"
                    value={openFormData.operator_name}
                    onChange={(e) => setOpenFormData({ ...openFormData, operator_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Opening Cash Float ({currencySymbol})</label>
                  <input
                    type="number"
                    value={openFormData.opening_cash}
                    onChange={(e) => setOpenFormData({ ...openFormData, opening_cash: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Opening Notes</label>
                <textarea
                  rows={2}
                  value={openFormData.notes}
                  onChange={(e) => setOpenFormData({ ...openFormData, notes: e.target.value })}
                  placeholder="Notes regarding float denominations or shift assignment..."
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 cursor-pointer"
                >
                  Start Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE SHIFT & RECONCILE MODAL */}
      {showCloseModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Close Shift & Reconcile Z-Report</h3>
                <p className="text-xs text-muted mt-0.5">{activeSession.session_number} &bull; {activeSession.terminal_name}</p>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCloseSession} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-sunken p-3 rounded-xl border border-default font-mono">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Opening Float</span>
                  <span className="font-semibold text-default">{formatCurrency(activeSession.opening_cash)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Expected Drawer Cash</span>
                  <span className="font-semibold text-primary">{formatCurrency(activeSession.expected_cash)}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Physical Counted Cash in Drawer ({currencySymbol})</label>
                <input
                  type="number"
                  value={closeFormData.counted_cash}
                  onChange={(e) => setCloseFormData({ ...closeFormData, counted_cash: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono text-sm"
                  required
                />
              </div>

              {closeFormData.counted_cash && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default flex items-center justify-between font-mono">
                  <span className="font-semibold text-muted">Cash Drawer Variance:</span>
                  <span
                    className={`font-bold text-sm ${
                      parseFloat(closeFormData.counted_cash) - parseFloat(activeSession.expected_cash) === 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : parseFloat(closeFormData.counted_cash) - parseFloat(activeSession.expected_cash) > 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(parseFloat(closeFormData.counted_cash) - parseFloat(activeSession.expected_cash))}
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-muted mb-1">Shift Handover Notes</label>
                <textarea
                  rows={2}
                  value={closeFormData.notes}
                  onChange={(e) => setCloseFormData({ ...closeFormData, notes: e.target.value })}
                  placeholder="Explain any drawer discrepancy or petty cash payouts..."
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer"
                >
                  Finalize & Close Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW Z-REPORT MODAL */}
      {showViewModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{activeSession.session_number}</h3>
                  {getStatusBadge(activeSession.status)}
                </div>
                <p className="text-xs text-muted mt-0.5">Operator: {activeSession.operator_name} &bull; {activeSession.terminal_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-default text-muted hover:text-default text-xs cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print Z-Report</span>
                </button>
                <button onClick={() => setShowViewModal(false)} className="text-muted hover:text-default cursor-pointer">
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-sunken p-3 rounded-xl border border-default font-mono">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Opened At</span>
                  <span className="font-semibold text-default">{activeSession.opened_at?.slice(0, 16).replace('T', ' ')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Closed At</span>
                  <span className="font-semibold text-default">{activeSession.closed_at ? activeSession.closed_at.slice(0, 16).replace('T', ' ') : 'Active Now'}</span>
                </div>
              </div>

              {/* Tender Breakdown Card */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-2">
                <span className="font-semibold text-default block text-[11px] uppercase tracking-wider">Tender Collections Breakdown</span>
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between py-1 border-b border-default/50">
                    <span className="text-muted">Opening Drawer Float:</span>
                    <span className="font-semibold text-default">{formatCurrency(activeSession.opening_cash)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-default/50">
                    <span className="text-muted">Cash Sales:</span>
                    <span className="font-semibold text-default">{formatCurrency(parseFloat(activeSession.expected_cash) - parseFloat(activeSession.opening_cash))}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-default/50">
                    <span className="text-muted">POS Card Terminal:</span>
                    <span className="font-semibold text-default">{formatCurrency(activeSession.card_total)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-default/50">
                    <span className="text-muted">Mobile Banking (bKash/Nagad):</span>
                    <span className="font-semibold text-default">{formatCurrency(activeSession.mobile_total)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-sm text-primary pt-2 border-t border-default">
                    <span>Total Shift Revenue:</span>
                    <span>
                      {formatCurrency(
                        parseFloat(activeSession.expected_cash) -
                        parseFloat(activeSession.opening_cash) +
                        parseFloat(activeSession.card_total) +
                        parseFloat(activeSession.mobile_total)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {activeSession.cash_variance !== null && activeSession.cash_variance !== undefined && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default flex items-center justify-between font-mono">
                  <span className="font-semibold text-muted">Reconciled Cash Variance:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(activeSession.cash_variance)}</span>
                </div>
              )}

              {activeSession.notes && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-semibold text-muted uppercase block mb-1">Shift Notes:</span>
                  <p className="text-default">{activeSession.notes}</p>
                </div>
              )}

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
    </div>
  );
}
