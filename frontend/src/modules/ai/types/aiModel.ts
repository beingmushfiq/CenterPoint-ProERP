export interface TenantAiModelConfig {
  configured: boolean;
  model_name: string | null;
  model_id: string;
  base_url: string;
  api_key_masked: string | null;
  api_key_set: boolean;
  api_version: string;
  max_tokens: number;
  is_active: boolean;
  source: 'tenant' | 'global';
  created_at?: string;
  updated_at?: string;
}

export interface TenantAiModelUpdatePayload {
  model_name?: string;
  model_id: string;
  base_url: string;
  api_key?: string;
  api_version?: string;
  max_tokens?: number;
  is_active?: boolean;
}

export interface AiModelTestResult {
  success: boolean;
  latency_ms: number;
  model: string | null;
  response_preview?: string;
  error?: string;
}
