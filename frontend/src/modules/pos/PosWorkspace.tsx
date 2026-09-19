import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Clock, HardDrive, Play, Zap } from 'lucide-react';
import { PosSessionsSection } from './sections/PosSessionsSection';
import { PosTerminalsSection } from './sections/PosTerminalsSection';
import { POSShell } from './POSShell';
import type { PosSession } from '../../types/api/pos';
import { api } from '../../lib/api/client';
import { Button } from '../../components/ui/Button';

export type PosTab = 'sessions' | 'terminals';

interface TabConfig {
  id: PosTab;
  label: string;
  icon: typeof Clock;
  description: string;
}

const DEFAULT_OPEN_SESSION: PosSession = {
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
};

export default function PosWorkspace() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PosTab>('sessions');
  const [manualSession, setManualSession] = useState<PosSession | null>(null);

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

  // Fetch all sessions to find the currently active open session
  const { data: sessions = [DEFAULT_OPEN_SESSION] } = useQuery<PosSession[]>({
    queryKey: ['pos', 'sessions'],
    queryFn: async () => {
      try {
        const sessRes = await api.get<PosSession[] | { data: PosSession[] }>('/pos/sessions');
        const raw = sessRes.data;
        const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
        if (list.length > 0) {
          return list;
        }
      } catch {
        // Fallback to sample data
      }
      return [DEFAULT_OPEN_SESSION];
    },
    initialData: [DEFAULT_OPEN_SESSION],
  });

  // Resolve active open session
  const activeSession = useMemo(() => {
    if (manualSession) return manualSession;
    return sessions.find((s) => s.status === 'open') ?? DEFAULT_OPEN_SESSION;
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

  // Direct POS Launch: By default when visiting /pos (from Topbar, search, quick add),
  // directly open the POS cashier interface
  if (!isManageMode && activeSession) {
    return <POSShell session={activeSession} onExit={handleExitPOS} />;
  }

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div className="space-y-6">
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
      <div className="flex overflow-x-auto p-1.5 bg-surface-sunken rounded-2xl border border-default shadow-2xs">
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
