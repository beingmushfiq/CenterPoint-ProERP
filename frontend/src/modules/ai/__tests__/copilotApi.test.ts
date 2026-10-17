import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copilotApi, type ChatResponsePayload, type PaginatedResult } from '../api/copilotApi';
import { api, type ApiResult } from '../../../lib/api/client';
import type { ConversationSummary, CashFlowAlertItem, AgentAuditLogItem } from '../types/copilot';

vi.mock('../../../lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('copilotApi Envelope Extraction & Robustness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps getConversations safely when api returns data directly', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ id: 1, uuid: 'conv-1', title: 'Test Thread', created_at: '2026-10-17' }],
      meta: { correlation_id: 'corr-1' },
    } as unknown as ApiResult<ConversationSummary[]>);

    const conversations = await copilotApi.getConversations();
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.uuid).toBe('conv-1');
  });

  it('unwraps getConversations safely when api returns nested data wrapper', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [{ id: 2, uuid: 'conv-2', title: 'Nested Thread', created_at: '2026-10-17' }] },
      meta: { correlation_id: 'corr-2' },
    } as unknown as ApiResult<{ data: ConversationSummary[] }>);

    const conversations = await copilotApi.getConversations();
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.uuid).toBe('conv-2');
  });

  it('returns empty array when getConversations receives null or undefined', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: null,
      meta: { correlation_id: 'corr-3' },
    } as unknown as ApiResult<ConversationSummary[]>);

    const conversations = await copilotApi.getConversations();
    expect(conversations).toEqual([]);
  });

  it('unwraps getAlerts correctly without throwing length error', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id: 1,
          uuid: 'alert-1',
          title: 'Liquidity Deficit',
          alert_type: 'liquidity_shortfall',
          severity: 'critical',
          projected_shortfall: 100000,
          days_until_shortfall: 14,
          status: 'active',
          created_at: '2026-10-17',
        },
      ],
      meta: { correlation_id: 'corr-4' },
    } as unknown as ApiResult<CashFlowAlertItem[]>);

    const alerts = await copilotApi.getAlerts({ status: 'active' });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.severity).toBe('critical');
  });

  it('unwraps getAuditLogs preserving pagination metadata', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [{ id: 10, uuid: 'audit-10', tool_name: 'get_cash_position', permission_tier: 0, executed: true }],
        current_page: 2,
        last_page: 5,
        per_page: 25,
        total: 120,
      },
      meta: { correlation_id: 'corr-5' },
    } as unknown as ApiResult<PaginatedResult<AgentAuditLogItem>>);

    const logs = await copilotApi.getAuditLogs({ page: 2 });
    expect(logs.current_page).toBe(2);
    expect(logs.total).toBe(120);
    expect(logs.data).toHaveLength(1);
    expect(logs.data[0]?.tool_name).toBe('get_cash_position');
  });

  it('unwraps sendMessage payload correctly', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        conversation_uuid: 'conv-abc',
        message: 'Here is your liquidity report.',
        tool_calls: [],
      },
      meta: { correlation_id: 'corr-6' },
    } as unknown as ApiResult<ChatResponsePayload>);

    const res = await copilotApi.sendMessage('What is our runway?');
    expect(res.conversation_uuid).toBe('conv-abc');
    expect(res.message).toBe('Here is your liquidity report.');
  });
});
