import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiModelApi } from '../aiModelApi';
import { api, type ApiResult } from '../../../../lib/api/client';
import type { TenantAiModelConfig, AiModelTestResult } from '../../../ai/types/aiModel';

vi.mock('../../../../lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('aiModelApi Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches AI model configuration unwrapping direct data', async () => {
    const mockConfig: TenantAiModelConfig = {
      configured: true,
      model_name: 'Claude 3.7 Sonnet',
      model_id: 'claude-3-7-sonnet-20250219',
      base_url: 'https://api.anthropic.com',
      api_key_masked: 'sk-ant-***',
      api_key_set: true,
      api_version: '2023-06-01',
      max_tokens: 4096,
      is_active: true,
      source: 'tenant',
    };

    vi.mocked(api.get).mockResolvedValue({
      data: mockConfig,
      meta: { correlation_id: 'corr-1' },
    } as unknown as ApiResult<TenantAiModelConfig>);

    const result = await aiModelApi.getConfig();
    expect(result.configured).toBe(true);
    expect(result.model_id).toBe('claude-3-7-sonnet-20250219');
    expect(result.source).toBe('tenant');
    expect(api.get).toHaveBeenCalledWith('/settings/ai-model');
  });

  it('unwraps nested data envelope for getConfig', async () => {
    const mockConfig: TenantAiModelConfig = {
      configured: false,
      model_name: null,
      model_id: 'claude-3-7-sonnet-20250219',
      base_url: 'https://api.anthropic.com',
      api_key_masked: null,
      api_key_set: false,
      api_version: '2023-06-01',
      max_tokens: 4096,
      is_active: true,
      source: 'global',
    };

    vi.mocked(api.get).mockResolvedValue({
      data: { data: mockConfig },
      meta: { correlation_id: 'corr-2' },
    } as unknown as ApiResult<{ data: TenantAiModelConfig }>);

    const result = await aiModelApi.getConfig();
    expect(result.configured).toBe(false);
    expect(result.source).toBe('global');
  });

  it('saves configuration with updateConfig', async () => {
    const payload = {
      model_name: 'DeepSeek V3',
      model_id: 'deepseek-chat',
      base_url: 'https://api.deepseek.com',
      api_key: 'sk-deepseek-secret-key-1234',
    };

    const mockResponse: TenantAiModelConfig = {
      configured: true,
      model_name: 'DeepSeek V3',
      model_id: 'deepseek-chat',
      base_url: 'https://api.deepseek.com',
      api_key_masked: 'sk-dee***1234',
      api_key_set: true,
      api_version: '2023-06-01',
      max_tokens: 4096,
      is_active: true,
      source: 'tenant',
    };

    vi.mocked(api.post).mockResolvedValue({
      data: mockResponse,
      meta: { correlation_id: 'corr-3' },
    } as unknown as ApiResult<TenantAiModelConfig>);

    const result = await aiModelApi.updateConfig(payload);
    expect(result.model_name).toBe('DeepSeek V3');
    expect(result.api_key_masked).toBe('sk-dee***1234');
    expect(api.post).toHaveBeenCalledWith('/settings/ai-model', payload);
  });

  it('calls test endpoint and returns latency and status', async () => {
    const testResult: AiModelTestResult = {
      success: true,
      latency_ms: 142,
      model: 'deepseek-chat',
      response_preview: 'CenterPoint ProERP ready.',
    };

    vi.mocked(api.post).mockResolvedValue({
      data: testResult,
      meta: { correlation_id: 'corr-4' },
    } as unknown as ApiResult<AiModelTestResult>);

    const res = await aiModelApi.testConnection();
    expect(res.success).toBe(true);
    expect(res.latency_ms).toBe(142);
    expect(api.post).toHaveBeenCalledWith('/settings/ai-model/test');
  });

  it('resets tenant AI configuration with DELETE request', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      data: { success: true },
      meta: { correlation_id: 'corr-5' },
    } as unknown as ApiResult<{ success: boolean }>);

    await aiModelApi.resetToDefault();
    expect(api.delete).toHaveBeenCalledWith('/settings/ai-model');
  });
});
