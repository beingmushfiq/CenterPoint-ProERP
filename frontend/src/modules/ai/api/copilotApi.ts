// ═══════════════════════════════════════════════════════════════════════════
// AI COPILOT API SERVICE
// CenterPoint ProERP / SliceMartFMS FinTechathon 2026 Topic E
// ═══════════════════════════════════════════════════════════════════════════

import { api } from '../../../lib/api/client';
import type {
  AgentMessage,
  ConversationSummary,
  CashFlowAlertItem,
  AgentAuditLogItem,
  FinancingMatchData,
  FinancingAssessmentRecord,
  ToolCallExecution,
  PendingAction,
  WeBankPreQualifyResponse,
} from '../types/copilot';

export interface ChatResponsePayload {
  conversation_uuid: string;
  message: string;
  tool_calls?: ToolCallExecution[];
  pending_action?: PendingAction | null;
  audit_log_id?: number;
}

export interface ConversationHistoryPayload {
  conversation: ConversationSummary;
  messages: AgentMessage[];
}

export interface ConfirmActionPayload {
  executed: boolean;
  action_id: string;
  result?: Record<string, unknown>;
  reason?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export const copilotApi = {
  /**
   * Send a message to the AI Copilot.
   */
  async sendMessage(
    message: string,
    conversationUuid?: string,
    supervisedResponse?: { action_id: string; approved: boolean; rejection_reason?: string }
  ): Promise<ChatResponsePayload> {
    const res = await api.post<{ status: string; data: ChatResponsePayload }>(
      '/ai/copilot/chat',
      {
        message,
        conversation_uuid: conversationUuid,
        supervised_response: supervisedResponse,
      }
    );
    return res.data.data;
  },

  /**
   * Fetch all conversation threads for current tenant.
   */
  async getConversations(): Promise<ConversationSummary[]> {
    const res = await api.get<{ status: string; data: ConversationSummary[] }>(
      '/ai/copilot/conversations'
    );
    return res.data.data;
  },

  /**
   * Fetch complete message history for a conversation.
   */
  async getConversationHistory(uuid: string): Promise<ConversationHistoryPayload> {
    const res = await api.get<{ status: string; data: ConversationHistoryPayload }>(
      `/ai/copilot/conversations/${uuid}/history`
    );
    return res.data.data;
  },

  /**
   * Supervised Tier 2 confirmation / rejection of an action.
   */
  async confirmAction(
    conversationUuid: string,
    actionId: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<ConfirmActionPayload> {
    const res = await api.post<{ status: string; data: ConfirmActionPayload }>(
      `/ai/copilot/conversations/${conversationUuid}/confirm`,
      {
        action_id: actionId,
        approved,
        rejection_reason: rejectionReason,
      }
    );
    return res.data.data;
  },

  /**
   * Fetch audit logs for AI actions and compliance.
   */
  async getAuditLogs(params?: {
    tool_name?: string;
    permission_tier?: number;
    executed?: boolean;
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResult<AgentAuditLogItem>> {
    const query = new URLSearchParams();
    if (params?.tool_name) query.set('tool_name', params.tool_name);
    if (params?.permission_tier !== undefined) query.set('permission_tier', String(params.permission_tier));
    if (params?.executed !== undefined) query.set('executed', String(params.executed));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.page) query.set('page', String(params.page));

    const path = `/ai/copilot/audit-log${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await api.get<{ status: string; data: PaginatedResult<AgentAuditLogItem> }>(path);
    return res.data.data;
  },

  /**
   * Fetch active cash flow and liquidity alerts.
   */
  async getAlerts(params?: {
    status?: string;
    severity?: string;
    alert_type?: string;
  }): Promise<CashFlowAlertItem[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.alert_type) query.set('alert_type', params.alert_type);

    const path = `/ai/copilot/alerts${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await api.get<{ status: string; data: CashFlowAlertItem[] }>(path);
    return res.data.data;
  },

  /**
   * Acknowledge an operational cash flow alert.
   */
  async acknowledgeAlert(uuid: string): Promise<CashFlowAlertItem> {
    const res = await api.patch<{ status: string; data: CashFlowAlertItem }>(
      `/ai/copilot/alerts/${uuid}/acknowledge`
    );
    return res.data.data;
  },

  /**
   * Match financing options based on SME real-time financials and parameters.
   */
  async matchFinancing(params: {
    requested_amount?: number;
    preferred_term_months?: number;
    collateral_available?: string;
    purpose?: string;
  }): Promise<FinancingMatchData> {
    const res = await api.post<{ status: string; data: FinancingMatchData }>(
      '/ai/financing/match',
      params
    );
    return res.data.data;
  },

  /**
   * Retrieve historical financing assessments for tenant.
   */
  async getFinancingHistory(): Promise<FinancingAssessmentRecord[]> {
    const res = await api.get<{ status: string; data: FinancingAssessmentRecord[] }>(
      '/ai/financing/history'
    );
    return res.data.data;
  },

  /**
   * Submit pre-qualification application to WeBank digital SME credit facility.
   */
  async preQualifyWebank(payload: {
    product_id: string;
    requested_amount: number;
    collateral_type?: string;
  }): Promise<WeBankPreQualifyResponse> {
    const res = await api.post<{ status: string; data: WeBankPreQualifyResponse }>(
      '/ai/webank/pre-qualify',
      payload
    );
    return res.data.data;
  },
};
