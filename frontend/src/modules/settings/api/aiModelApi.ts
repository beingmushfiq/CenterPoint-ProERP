import { api } from '../../../lib/api/client';
import type {
  TenantAiModelConfig,
  TenantAiModelUpdatePayload,
  AiModelTestResult,
} from '../../ai/types/aiModel';

function extractData<T>(res: { data: unknown }): T {
  const d = res.data;
  if (d && typeof d === 'object' && 'data' in d && (d as Record<string, unknown>).data !== undefined) {
    return (d as Record<string, unknown>).data as T;
  }
  return d as T;
}

export const aiModelApi = {
  /**
   * Get current tenant AI model configuration (API key is masked).
   */
  async getConfig(): Promise<TenantAiModelConfig> {
    const res = await api.get<TenantAiModelConfig | { data: TenantAiModelConfig }>(
      '/settings/ai-model'
    );
    return extractData<TenantAiModelConfig>(res);
  },

  /**
   * Save or update tenant AI model configuration.
   */
  async updateConfig(payload: TenantAiModelUpdatePayload): Promise<TenantAiModelConfig> {
    const res = await api.post<TenantAiModelConfig | { data: TenantAiModelConfig }>(
      '/settings/ai-model',
      payload
    );
    return extractData<TenantAiModelConfig>(res);
  },

  /**
   * Test the connection to the configured LLM API.
   */
  async testConnection(): Promise<AiModelTestResult> {
    const res = await api.post<AiModelTestResult | { data: AiModelTestResult }>(
      '/settings/ai-model/test'
    );
    return extractData<AiModelTestResult>(res);
  },

  /**
   * Reset tenant AI configuration to platform default (.env).
   */
  async resetToDefault(): Promise<void> {
    await api.delete('/settings/ai-model');
  },
};
