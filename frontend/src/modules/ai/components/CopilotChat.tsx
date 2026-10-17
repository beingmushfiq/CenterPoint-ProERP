import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  Clock,
  Shield,
  Bot,
  User as UserIcon,
  RefreshCw,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { copilotApi } from '../api/copilotApi';
import type {
  AgentMessage,
  ConversationSummary,
  PendingAction,
  CashPositionData,
  OverdueInvoicesData,
  PLSummaryData,
  CashFlowRiskData,
  FinancingMatchData,
  InventoryValuationData,
} from '../types/copilot';
import { CashPositionCard } from './cards/CashPositionCard';
import { OverdueInvoicesCard } from './cards/OverdueInvoicesCard';
import { PLSummaryCard } from './cards/PLSummaryCard';
import { CashFlowRiskCard } from './cards/CashFlowRiskCard';
import { FinancingMatchCard } from './cards/FinancingMatchCard';
import { InventoryValueCard } from './cards/InventoryValueCard';
import { Tier2ConfirmDialog } from './Tier2ConfirmDialog';
import { notify } from '../../../components/ui/Toast';

interface CopilotChatProps {
  initialQuery?: string | null;
  onSwitchToFinancingTab?: () => void;
  onAlertGenerated?: () => void;
}

const QUICK_PROMPTS = [
  {
    icon: '⚡',
    label: 'Cash Runway',
    query: 'What is our current liquid cash position and runway days?',
  },
  {
    icon: '⚠️',
    label: 'Deficit Risk',
    query: 'Analyze our cash flow deficit risk for the next 30 days.',
  },
  {
    icon: '💼',
    label: 'Financing Options',
    query: 'Match WeBank SME financing options to bridge working capital.',
  },
  {
    icon: '📋',
    label: 'Overdue Receivables',
    query: 'List our top overdue customer invoices and aging buckets.',
  },
  {
    icon: '📊',
    label: 'P&L Summary',
    query: 'Show our current profit and loss summary and operating margins.',
  },
  {
    icon: '📦',
    label: 'Inventory Valuation',
    query: 'What is our current inventory valuation and holding cost?',
  },
];

export const CopilotChat: React.FC<CopilotChatProps> = ({
  initialQuery,
  onSwitchToFinancingTab,
  onAlertGenerated,
}) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationUuid, setActiveConversationUuid] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Supervised Confirmation Dialog state
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const selectConversation = useCallback(async (uuid: string) => {
    setActiveConversationUuid(uuid);
    setIsLoadingHistory(true);
    try {
      const history = await copilotApi.getConversationHistory(uuid);
      setMessages(Array.isArray(history?.messages) ? history.messages : []);
    } catch {
      notify.error('Failed to load conversation history');
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const data = await copilotApi.getConversations();
      const safeData = Array.isArray(data) ? data : [];
      setConversations(safeData);
      if (safeData.length > 0 && !activeConversationUuid && safeData[0]?.uuid) {
        selectConversation(safeData[0].uuid);
      }
    } catch {
      // If error (e.g. offline simulation or empty), start clean
      setConversations([]);
    }
  }, [activeConversationUuid, selectConversation]);

  // Load conversation threads on mount
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        loadConversations();
      }
    });
    return () => {
      active = false;
    };
  }, [loadConversations]);

  const handleStartNewChat = () => {
    setActiveConversationUuid(null);
    setMessages([]);
    setInputText('');
  };

  const handleSendMessage = useCallback(async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');

    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const nowIso = new Date().toISOString();

    // Append user message optimistically
    const optimisticUserMessage: AgentMessage = {
      uuid: `user-${randomSuffix}`,
      role: 'user',
      content: text,
      created_at: nowIso,
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);
    setIsLoading(true);

    try {
      const response = await copilotApi.sendMessage(
        text,
        activeConversationUuid || undefined
      );

      if (!activeConversationUuid && response.conversation_uuid) {
        setActiveConversationUuid(response.conversation_uuid);
        loadConversations();
      }

      const assistantMessage: AgentMessage = {
        uuid: `assistant-${randomSuffix}`,
        role: 'assistant',
        content: response.message,
        tool_calls: response.tool_calls ?? null,
        pending_action: response.pending_action ?? null,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.pending_action) {
        setPendingAction(response.pending_action);
        setShowConfirmDialog(true);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'AI Copilot communication failed.';
      notify.error(errorMessage);
      // Append error message to chat
      setMessages((prev) => [
        ...prev,
        {
          uuid: `err-${randomSuffix}`,
          role: 'assistant',
          content: `⚠️ Error: ${errorMessage}. Please check your connection or retry.`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, activeConversationUuid, loadConversations]);

  // Trigger initial query if passed from parent
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      let active = true;
      void Promise.resolve().then(() => {
        if (active) {
          handleSendMessage(initialQuery.trim());
        }
      });
      return () => {
        active = false;
      };
    }
  }, [initialQuery, handleSendMessage]);

  const handleConfirmAction = async (actionId: string, approved: boolean, reason?: string) => {
    if (!activeConversationUuid) return;
    setIsSubmittingConfirm(true);
    try {
      const result = await copilotApi.confirmAction(
        activeConversationUuid,
        actionId,
        approved,
        reason
      );

      if (result.executed) {
        notify.success('Supervised operational action executed successfully.');
        onAlertGenerated?.();
      } else {
        notify.info('Action was declined.');
      }

      // Reload conversation history to reflect executed state
      await selectConversation(activeConversationUuid);
    } catch {
      notify.error('Failed to record supervisor decision.');
    } finally {
      setIsSubmittingConfirm(false);
      setPendingAction(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[780px] bg-surface rounded-2xl border border-default shadow-xs overflow-hidden">
      {/* Sidebar: Conversation Threads */}
      <div className="w-full lg:w-72 bg-surface-sunken/40 border-b lg:border-b-0 lg:border-r border-default flex flex-col shrink-0">
        <div className="p-3.5 border-b border-default flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            <span className="text-xs font-bold text-default">Conversations</span>
          </div>
          <button
            type="button"
            onClick={handleStartNewChat}
            className="p-1.5 rounded-lg bg-surface hover:bg-surface-sunken border border-default text-primary hover:text-primary-hover text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
            title="Start new conversation"
          >
            <Plus className="size-3.5" />
            <span>New</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {!Array.isArray(conversations) || conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted">
              No previous threads. Ask a question to begin!
            </div>
          ) : (
            conversations.map((c) => {
              const isSelected = c.uuid === activeConversationUuid;
              return (
                <button
                  key={c.uuid}
                  type="button"
                  onClick={() => selectConversation(c.uuid)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                      : 'text-default hover:bg-surface-sunken/80'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="truncate font-medium">{c.title || 'Finance Advisory Thread'}</div>
                    <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                      <Clock className="size-2.5" />
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Security Tier Badge Footer */}
        <div className="p-3 border-t border-default/70 bg-surface/80 text-[10px] text-muted space-y-1">
          <div className="flex items-center gap-1 font-semibold text-default">
            <Shield className="size-3 text-emerald-600" />
            <span>3-Tier Supervised Architecture</span>
          </div>
          <p className="leading-tight opacity-80">
            Tier 0 queries (Read) auto-execute. Tier 2 mutations require supervisor sign-off.
          </p>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col bg-surface overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-default flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-default flex items-center gap-1.5">
                <span>WeBank AI SME Finance Copilot</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Topic E Active
                </span>
              </h3>
              <p className="text-[10px] text-muted">
                Proactive cash flow analysis, liquidity forecasting & loan matching
              </p>
            </div>
          </div>

          {activeConversationUuid && (
            <button
              type="button"
              onClick={() => selectConversation(activeConversationUuid)}
              className="p-1.5 text-muted hover:text-default rounded-lg border border-default transition"
              title="Refresh messages"
            >
              <RefreshCw className="size-3.5" />
            </button>
          )}
        </div>

        {/* Messages Thread Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full text-xs text-muted gap-2">
              <RefreshCw className="size-4 animate-spin text-primary" />
              <span>Loading conversation history...</span>
            </div>
          ) : !Array.isArray(messages) || messages.length === 0 ? (
            /* Empty State & Quick Prompts */
            <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
              <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-base sm:text-lg font-extrabold text-default">
                  How can the AI Copilot assist your SME today?
                </h2>
                <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                  Ask financial questions, evaluate 30-day deficit risk, simulate cash flow stress,
                  or match pre-approved WeBank financing facilities.
                </p>
              </div>

              {/* Quick Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-left pt-2">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(qp.query)}
                    className="p-3 rounded-xl border border-default bg-surface hover:border-primary/50 hover:bg-surface-sunken transition text-left cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-default group-hover:text-primary transition-colors">
                      <span>{qp.icon}</span>
                      <span>{qp.label}</span>
                    </div>
                    <p className="text-[11px] text-muted line-clamp-2 mt-1 leading-snug">
                      {qp.query}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Render Message List */
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.uuid || index}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="size-4" />
                    </div>
                  )}

                  <div className={`space-y-3 max-w-2xl ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* Message Bubble */}
                    <div
                      className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-primary text-primary-fg font-medium rounded-tr-xs shadow-xs'
                          : 'bg-surface-sunken/70 text-default border border-default rounded-tl-xs shadow-2xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Pending Action Card Widget */}
                      {msg.pending_action && (
                        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-default space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1 text-amber-700 dark:text-amber-400">
                              <Lock className="size-3.5" />
                              <span>Supervised Tier 2 Action Pending</span>
                            </span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20">
                              {msg.pending_action.tool}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted">
                            {msg.pending_action.description}
                          </p>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setPendingAction(msg.pending_action!);
                                setShowConfirmDialog(true);
                              }}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                            >
                              <Shield className="size-3.5" />
                              <span>Review & Authorize Action</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Render Interactive Financial Tool Call Cards */}
                    {msg.tool_calls &&
                      msg.tool_calls.map((tc, tcIdx) => {
                        if (!tc.result) return null;
                        const res = tc.result;

                        if (tc.tool === 'get_cash_position') {
                          return (
                            <CashPositionCard
                              key={tcIdx}
                              data={res as unknown as CashPositionData}
                            />
                          );
                        }

                        if (tc.tool === 'list_overdue_invoices') {
                          return (
                            <OverdueInvoicesCard
                              key={tcIdx}
                              data={res as unknown as OverdueInvoicesData}
                            />
                          );
                        }

                        if (tc.tool === 'get_pl_summary') {
                          return (
                            <PLSummaryCard
                              key={tcIdx}
                              data={res as unknown as PLSummaryData}
                            />
                          );
                        }

                        if (tc.tool === 'analyze_cash_flow_risk') {
                          return (
                            <CashFlowRiskCard
                              key={tcIdx}
                              data={res as unknown as CashFlowRiskData}
                              onExploreFinancing={() => {
                                handleSendMessage(
                                  'Find SME financing facilities to cover the projected cash deficit.'
                                );
                              }}
                            />
                          );
                        }

                        if (tc.tool === 'match_financing_options') {
                          return (
                            <FinancingMatchCard
                              key={tcIdx}
                              data={res as unknown as FinancingMatchData}
                              onSelectProduct={() => {
                                onSwitchToFinancingTab?.();
                              }}
                            />
                          );
                        }

                        if (tc.tool === 'get_inventory_value') {
                          return (
                            <InventoryValueCard
                              key={tcIdx}
                              data={res as unknown as InventoryValuationData}
                            />
                          );
                        }

                        if (tc.tool === 'create_cash_flow_alert') {
                          return (
                            <div
                              key={tcIdx}
                              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2"
                            >
                              <CheckCircle2 className="size-4 text-emerald-600" />
                              <span>
                                Cash Flow Alert created successfully and broadcast to operational
                                monitors.
                              </span>
                            </div>
                          );
                        }

                        return null;
                      })}

                    <div className="text-[10px] text-muted px-1 flex items-center gap-1">
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.tokens_used && (
                        <span>• {msg.tokens_used} tokens</span>
                      )}
                    </div>
                  </div>

                  {isUser && (
                    <div className="size-7 rounded-xl bg-surface-sunken border border-default text-muted flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon className="size-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Thinking / Loading Animation */}
          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="size-4 animate-spin text-primary" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-surface-sunken/70 border border-default text-xs text-muted flex items-center gap-2">
                <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
                <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse delay-150" />
                <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse delay-300" />
                <span className="ml-1 text-[11px] font-medium">Analyzing ledger data...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-default bg-surface">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 relative">
              <textarea
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask financial question, analyze deficit, or request financing match... (Enter to send)"
                className="w-full resize-none px-3.5 py-2.5 rounded-xl border border-default bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none scrollbar-none"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer disabled:opacity-50 h-[44px]"
            >
              <Send className="size-3.5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Supervised Tier 2 Authorization Modal */}
      <Tier2ConfirmDialog
        open={showConfirmDialog}
        action={pendingAction}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmAction}
        isSubmitting={isSubmittingConfirm}
      />
    </div>
  );
};
