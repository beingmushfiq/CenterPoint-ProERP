import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Clock, HardDrive, Play, Zap, Store, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PosSessionsSection } from './sections/PosSessionsSection';
import { PosTerminalsSection } from './sections/PosTerminalsSection';
import { POSShell } from './POSShell';
import type { PosSession, PosTerminal } from '../../types/api/pos';
import { api } from '../../lib/api/client';
import { extractList, extractItem } from '../../lib/api/apiData';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../lib/auth/authStore';
import { useCurrency } from '../../hooks/useCurrency';

export type PosTab = 'sessions' | 'terminals';

interface TabConfig {
  id: PosTab;
  label: string;
  icon: typeof Clock;
  description: string;
}

export default function PosWorkspace() {
  const { t } = useTranslation();
  const { currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const activeBranch = useAuthStore((s) => s.activeBranch);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PosTab>('sessions');
  const [manualSession, setManualSession] = useState<PosSession | null>(null);

  // Quick Open Register State
  const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(null);
  const [openingFloat, setOpeningFloat] = useState<string>('2000.00');
  const [openingNotes, setOpeningNotes] = useState<string>('');
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: 'sessions',
        label: t('pos.tabs.sessions.label'),
        icon: Clock,
        description: t('pos.tabs.sessions.description'),
      },
      {
        id: 'terminals',
        label: t('pos.tabs.terminals.label'),
        icon: HardDrive,
        description: t('pos.tabs.terminals.description'),
      },
    ],
    [t]
  );

  // Fetch real terminals
  const { data: terminals = [] } = useQuery<PosTerminal[]>({
    queryKey: ['pos', 'terminals'],
    queryFn: async () => {
      try {
        const res = await api.get<PosTerminal[]>('/pos/terminals');
        return extractList<PosTerminal>(res);
      } catch {
        return [];
      }
    },
  });

  // Derive resolved terminal id cleanly without cascading setState
  const effectiveTerminalId = useMemo(() => {
    if (selectedTerminalId !== null && terminals.some((t) => t.id === selectedTerminalId)) {
      return selectedTerminalId;
    }
    return terminals[0]?.id ?? null;
  }, [selectedTerminalId, terminals]);

  // Fetch all sessions to find the currently active open session
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery<PosSession[]>({
    queryKey: ['pos', 'sessions'],
    queryFn: async () => {
      try {
        const sessRes = await api.get<PosSession[]>('/pos/sessions');
        return extractList<PosSession>(sessRes);
      } catch {
        return [];
      }
    },
  });

  // Resolve active open session
  const activeSession = useMemo(() => {
    if (manualSession && manualSession.status === 'open') return manualSession;
    return sessions.find((s) => s.status === 'open') ?? null;
  }, [manualSession, sessions]);

  // If URL has ?manage=true, user explicitly wants to view sessions/terminals manager
  const isManageMode = searchParams.get('manage') === 'true' || Boolean(searchParams.get('tab'));

  // Handler when user exits POS terminal from inside POSShell
  const handleExitPOS = () => {
    setSearchParams({ manage: 'true' });
  };

  // Handler when user clicks "Launch POS" from session list
  const handleLaunchSession = (session: PosSession) => {
    setManualSession(session);
    setSearchParams({});
  };

  // Handler to quickly open a new shift and launch POS immediately
  const handleOpenShiftAndLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpeningShift(true);
    try {
      const selectedTerm = effectiveTerminalId
        ? terminals.find((t) => t.id === effectiveTerminalId)
        : terminals[0];

      const payload: Record<string, unknown> = {
        opening_cash: openingFloat || '0.00',
        ...(selectedTerm?.id ? { terminal_id: selectedTerm.id } : {}),
        ...(selectedTerm?.branch_id || activeBranch?.id ? { branch_id: selectedTerm?.branch_id ?? activeBranch?.id } : {}),
        ...(selectedTerm?.default_warehouse_id ? { warehouse_id: selectedTerm.default_warehouse_id } : {}),
        ...(openingNotes ? { notes: openingNotes } : {}),
      };

      const res = await api.post<PosSession | { data: PosSession }>('/pos/sessions', payload);
      const created = extractItem<PosSession>(res.data) ?? (res.data as unknown as PosSession);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pos', 'sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['pos', 'terminals'] }),
      ]);

      toast.success('Cashier register opened successfully.');

      if (created) {
        setManualSession(created);
        setSearchParams({});
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string; response?: { data?: { message?: string } } };
      const msg = apiErr.response?.data?.message || apiErr.message || 'Failed to open register. Please verify terminal configuration.';
      toast.error(msg);
    } finally {
      setIsOpeningShift(false);
    }
  };

  // Direct POS Launch: If an active open session exists and not in manage mode, render POSShell
  if (!isManageMode && activeSession) {
    const posContent = <POSShell session={activeSession} onExit={handleExitPOS} />;
    if (typeof document !== 'undefined' && document.body) {
      return createPortal(posContent, document.body);
    }
    return posContent;
  }

  // If visiting POS directly but no session is currently open and not in manage mode,
  // show the "Open Register Shift" onboarding screen
  if (!isManageMode && !activeSession) {
    if (isLoadingSessions) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Checking register shift status...</p>
        </div>
      );
    }

    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="rounded-3xl border border-default bg-surface p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Store className="size-48" />
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <Store className="size-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-0.5">
                <Sparkles className="size-3" />
                <span>POS Ready</span>
              </div>
              <h2 className="text-xl font-bold text-default">Open Cashier Register</h2>
              <p className="text-xs text-muted">Initialize opening drawer cash float to start sales.</p>
            </div>
          </div>

          <form onSubmit={handleOpenShiftAndLaunch} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Assigned Terminal Station
              </label>
              <select
                value={effectiveTerminalId ?? ''}
                onChange={(e) => setSelectedTerminalId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2.5 text-xs text-default focus:border-primary focus:outline-none"
              >
                {terminals.length > 0 ? (
                  terminals.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))
                ) : (
                  <option value="">Default Counter 1 (Auto-Provisioned)</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Cashier Operator
                </label>
                <input
                  type="text"
                  readOnly
                  value={user?.name || 'Authorized Cashier'}
                  className="w-full rounded-xl border border-default bg-surface-sunken/60 px-3.5 py-2.5 text-xs text-muted font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Opening Float ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2.5 text-xs text-default font-mono font-bold focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Float quick-preset chips */}
            <div>
              <span className="text-[11px] font-medium text-muted block mb-1.5">Quick Float Amount:</span>
              <div className="flex gap-2 flex-wrap">
                {['0.00', '500.00', '1000.00', '2000.00', '5000.00'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setOpeningFloat(val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      openingFloat === val
                        ? 'bg-primary text-primary-fg border-primary shadow-xs'
                        : 'bg-surface-sunken text-muted border-default hover:text-default'
                    }`}
                  >
                    {currencySymbol}{val}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Shift Notes (Optional)
              </label>
              <input
                type="text"
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                placeholder="e.g., Morning shift float, drawer verified"
                className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="submit"
                variant="primary"
                disabled={isOpeningShift}
                className="w-full sm:flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer"
              >
                {isOpeningShift ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Opening Shift...</span>
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-current" />
                    <span>Open Register & Start Selling</span>
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setSearchParams({ manage: 'true' })}
                className="px-4 py-2.5 rounded-xl border border-default text-xs font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-all cursor-pointer"
              >
                Shift History & Terminals
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-7xl mx-auto py-1 sm:py-2">
      {/* Workspace Header with Direct POS Return Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">
            {t('pos.managementTag')}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-default sm:text-3xl">
            {currentTab?.label}
          </h1>
          <p className="mt-1 text-xs text-muted">{currentTab?.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setSearchParams({})}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <Play className="size-3.5 fill-current" />
            <span>{t('pos.openPosInterface')}</span>
          </Button>
        </div>
      </div>

      {/* Universal POS Quick-Action Ribbon */}
      <div className="rounded-2xl border border-primary/20 bg-linear-to-r from-primary/5 via-surface to-surface-raised p-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-default">
              <Zap className="size-3.5 text-amber-500 fill-amber-500" />
              <span>{t('pos.quickActionsTitle')}</span>
            </div>
            <p className="text-[11px] text-muted">
              {t('pos.quickActionsSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSearchParams({})}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Play className="size-3.5 fill-current" />
              <span>{t('pos.resumeCashier')}</span>
            </Button>
            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
            >
              <Clock className="size-3.5 text-primary" />
              <span>{t('pos.shiftReconciliations')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('terminals')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
            >
              <HardDrive className="size-3.5 text-cyan-600" />
              <span>{t('pos.terminalsHardware')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto no-scrollbar scroll-smooth touch-pan-x w-full min-w-0 p-1.5 bg-surface-sunken rounded-2xl border border-default shadow-2xs">
        <div className="flex gap-1.5 min-w-full sm:min-w-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-fg font-semibold shadow-xs border border-primary'
                    : 'text-muted hover:text-default hover:bg-surface/50 border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary-fg' : 'text-muted'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'sessions' && (
          <PosSessionsSection onLaunchPOS={handleLaunchSession} />
        )}
        {activeTab === 'terminals' && <PosTerminalsSection />}
      </div>
    </div>
  );
}
