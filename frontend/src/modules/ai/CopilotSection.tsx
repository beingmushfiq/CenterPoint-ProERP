import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Briefcase, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { CopilotChat } from './components/CopilotChat';
import { FinancingMatcherTab } from './components/FinancingMatcherTab';
import { CopilotAlertsTab } from './components/CopilotAlertsTab';
import { CopilotAuditTab } from './components/CopilotAuditTab';
import { copilotApi } from './api/copilotApi';

export type CopilotSubTab = 'chat' | 'financing' | 'alerts' | 'audit';

export const CopilotSection: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<CopilotSubTab>('chat');
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0);
  const [chatInitialQuery, setChatInitialQuery] = useState<string | null>(null);

  const fetchAlertCount = useCallback(async () => {
    try {
      const alerts = await copilotApi.getAlerts({ status: 'active' });
      setActiveAlertCount(alerts.length);
    } catch {
      setActiveAlertCount(0);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        fetchAlertCount();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchAlertCount]);

  const handleOpenChatWithQuery = (query: string) => {
    setChatInitialQuery(query);
    setActiveSubTab('chat');
  };

  return (
    <div className="space-y-5">
      {/* Copilot Sub-Navigation Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-surface-sunken/60 rounded-2xl border border-default">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 scrollbar-none">
          {/* Chat Tab */}
          <button
            type="button"
            onClick={() => setActiveSubTab('chat')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeSubTab === 'chat'
                ? 'bg-surface text-primary shadow-xs border border-default/70'
                : 'text-muted hover:text-default hover:bg-surface-sunken'
            }`}
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>AI Copilot Chat</span>
          </button>

          {/* Financing Matcher Tab */}
          <button
            type="button"
            onClick={() => setActiveSubTab('financing')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeSubTab === 'financing'
                ? 'bg-surface text-primary shadow-xs border border-default/70'
                : 'text-muted hover:text-default hover:bg-surface-sunken'
            }`}
          >
            <Briefcase className="size-3.5 text-primary" />
            <span>WeBank SME Financing</span>
          </button>

          {/* Alerts Tab */}
          <button
            type="button"
            onClick={() => setActiveSubTab('alerts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeSubTab === 'alerts'
                ? 'bg-surface text-primary shadow-xs border border-default/70'
                : 'text-muted hover:text-default hover:bg-surface-sunken'
            }`}
          >
            <AlertTriangle className="size-3.5 text-amber-500" />
            <span>Liquidity Alerts</span>
            {activeAlertCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                {activeAlertCount}
              </span>
            )}
          </button>

          {/* Security & Audit Tab */}
          <button
            type="button"
            onClick={() => setActiveSubTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeSubTab === 'audit'
                ? 'bg-surface text-primary shadow-xs border border-default/70'
                : 'text-muted hover:text-default hover:bg-surface-sunken'
            }`}
          >
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span>Security & Audit Trail</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 text-[11px] text-muted self-end sm:self-center">
          <Zap className="size-3.5 text-amber-500" />
          <span className="hidden sm:inline">FinTechathon 2026 Topic E: SME Financial Copilot</span>
        </div>
      </div>

      {/* Active Tab View */}
      <div>
        {activeSubTab === 'chat' && (
          <CopilotChat
            initialQuery={chatInitialQuery}
            onSwitchToFinancingTab={() => setActiveSubTab('financing')}
            onAlertGenerated={() => fetchAlertCount()}
          />
        )}

        {activeSubTab === 'financing' && <FinancingMatcherTab />}

        {activeSubTab === 'alerts' && (
          <CopilotAlertsTab onOpenChatWithQuery={handleOpenChatWithQuery} />
        )}

        {activeSubTab === 'audit' && <CopilotAuditTab />}
      </div>
    </div>
  );
};

export default CopilotSection;
