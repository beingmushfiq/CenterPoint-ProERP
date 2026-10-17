import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Bot,
  KeyRound,
  Globe,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Activity,
  Eye,
  EyeOff,
  Zap,
  Info,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input, FormGroup } from '../../../components/ui/FormElements';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import { aiModelApi } from '../api/aiModelApi';
import type {
  TenantAiModelConfig,
  TenantAiModelUpdatePayload,
  AiModelTestResult,
} from '../../ai/types/aiModel';

interface PresetConfig {
  name: string;
  model_id: string;
  base_url: string;
  max_tokens: number;
  api_version: string;
  description: string;
}

const PRESETS: PresetConfig[] = [
  {
    name: 'Anthropic Direct',
    model_id: 'claude-3-7-sonnet-20250219',
    base_url: 'https://api.anthropic.com',
    max_tokens: 4096,
    api_version: '2023-06-01',
    description: 'Direct Anthropic API (requires Anthropic API key)',
  },
  {
    name: 'AgentRouter / OpenRouter',
    model_id: 'anthropic/claude-3.7-sonnet',
    base_url: 'https://openrouter.ai/api',
    max_tokens: 4096,
    api_version: '2023-06-01',
    description: 'OpenRouter / AgentRouter Anthropic-compatible gateway',
  },
  {
    name: 'DeepSeek (Compatible Gateway)',
    model_id: 'deepseek-chat',
    base_url: 'https://api.deepseek.com',
    max_tokens: 4096,
    api_version: '2023-06-01',
    description: 'DeepSeek V3 / R1 via compatible proxy or router',
  },
];

export const AiModelSettingsSection: React.FC = () => {
  const [config, setConfig] = useState<TenantAiModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiModelTestResult | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Form Fields
  const [modelName, setModelName] = useState('');
  const [modelId, setModelId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const [apiVersion, setApiVersion] = useState('2023-06-01');
  const [isActive, setIsActive] = useState(true);

  // UI State
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [showKeyText, setShowKeyText] = useState(false);
  const [hasFormChanges, setHasFormChanges] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await aiModelApi.getConfig();
      setConfig(data);
      setModelName(data.model_name || '');
      setModelId(data.model_id || 'claude-3-7-sonnet-20250219');
      setBaseUrl(data.base_url || 'https://api.anthropic.com');
      setMaxTokens(data.max_tokens || 4096);
      setApiVersion(data.api_version || '2023-06-01');
      setIsActive(data.is_active ?? true);
      setApiKey('');
      setIsEditingKey(!data.api_key_set);
      setHasFormChanges(false);
    } catch (err) {
      console.error('Failed to load AI model config', err);
      notify.error('Unable to fetch AI model configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleApplyPreset = (preset: PresetConfig) => {
    setModelName(preset.name);
    setModelId(preset.model_id);
    setBaseUrl(preset.base_url);
    setMaxTokens(preset.max_tokens);
    setApiVersion(preset.api_version);
    setHasFormChanges(true);
    notify.info(`Applied preset: ${preset.name}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelId.trim() || !baseUrl.trim()) {
      notify.error('Model ID and Base URL are required.');
      return;
    }

    try {
      setSaving(true);
      const payload: TenantAiModelUpdatePayload = {
        model_id: modelId.trim(),
        base_url: baseUrl.trim(),
        api_version: apiVersion.trim() || '2023-06-01',
        max_tokens: Number(maxTokens) || 4096,
        is_active: isActive,
      };

      if (modelName.trim()) {
        payload.model_name = modelName.trim();
      }

      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }

      const updated = await aiModelApi.updateConfig(payload);
      setConfig(updated);
      setApiKey('');
      setIsEditingKey(false);
      setHasFormChanges(false);
      setTestResult(null);
      notify.success('AI Model configuration saved successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await aiModelApi.testConnection();
      setTestResult(result);
      if (result.success) {
        notify.success(`Connection verified (${result.latency_ms}ms)`);
      } else {
        notify.error(result.error || 'Connection test failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test failed to execute';
      setTestResult({
        success: false,
        latency_ms: 0,
        model: null,
        error: msg,
      });
      notify.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleResetToDefault = async () => {
    try {
      setSaving(true);
      await aiModelApi.resetToDefault();
      setConfirmResetOpen(false);
      notify.success('AI configuration reset to platform defaults.');
      await loadConfig();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset configuration';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="skeleton-shimmer h-24 rounded-2xl" />
        <div className="skeleton-shimmer h-64 rounded-2xl" />
      </div>
    );
  }

  const isCustomTenant = config?.source === 'tenant' && config.configured;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface rounded-2xl border border-default p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-md font-bold text-default">AI Model & LLM Provider</h2>
                <Badge tone={isCustomTenant ? 'primary-subtle' : 'surface-sunken'}>
                  {isCustomTenant ? 'Tenant Custom Model' : 'Platform Default (.env)'}
                </Badge>
                {config?.api_key_set ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Check className="size-3" /> API Key Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-2xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <AlertTriangle className="size-3" /> No Key Set
                  </span>
                )}
              </div>
              <p className="text-xs text-muted max-w-xl">
                Configure custom Anthropic-compatible LLM endpoints (Claude, DeepSeek, AgentRouter)
                powering both the <strong>Operations AI Brain</strong> and <strong>Financial Copilot</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            loading={testing}
            disabled={!config?.api_key_set && !apiKey}
          >
            <Activity className="size-3.5 mr-1.5 text-primary" />
            Test Connection
          </Button>

          {isCustomTenant && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmResetOpen(true)}
              disabled={saving}
            >
              <RotateCcw className="size-3.5 mr-1.5" />
              Reset to Platform Default
            </Button>
          )}

          {hasFormChanges && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saving}
            >
              <Save className="size-3.5 mr-1.5" />
              Save Model Configuration
            </Button>
          )}
        </div>
      </div>

      {/* Test Result Alert Banner */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            testResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="size-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs space-y-1">
            <div className="font-bold flex items-center justify-between">
              <span>{testResult.success ? 'Model Endpoint Connected Successfully' : 'Connection Test Failed'}</span>
              <span className="font-mono text-2xs opacity-80">{testResult.latency_ms} ms</span>
            </div>
            {testResult.model && (
              <p className="font-mono text-2xs">Model Verified: {testResult.model}</p>
            )}
            {testResult.response_preview && (
              <p className="italic opacity-90">Preview: &ldquo;{testResult.response_preview}&rdquo;</p>
            )}
            {testResult.error && (
              <p className="font-mono text-2xs font-semibold text-rose-700 dark:text-rose-300">
                Error: {testResult.error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick Setup Presets */}
      <div className="bg-surface rounded-2xl border border-default p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Quick Presets</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="text-left p-3.5 rounded-xl border border-default bg-surface-sunken hover:border-primary/50 hover:bg-surface transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-default group-hover:text-primary transition-colors">
                  {preset.name}
                </span>
                <Sparkles className="size-3 text-muted group-hover:text-primary transition-colors" />
              </div>
              <p className="text-2xs text-muted mt-1 leading-relaxed">
                {preset.description}
              </p>
              <div className="mt-2 text-2xs font-mono text-muted truncate">
                {preset.model_id}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSave} className="bg-surface rounded-2xl border border-default p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-default">
          <Cpu className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-default">Endpoint & Authentication Settings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Model Display Name */}
          <FormGroup
            label="Model Display Name (Optional)"
            helper="Friendly label displayed in Operations AI Brain and Copilot header"
          >
            <Input
              type="text"
              placeholder="e.g. DeepSeek V3 / Claude 3.7 Sonnet"
              value={modelName}
              onChange={(e) => {
                setModelName(e.target.value);
                setHasFormChanges(true);
              }}
            />
          </FormGroup>

          {/* Model ID */}
          <FormGroup
            label="Model ID"
            required
            helper="Exact identifier expected by the LLM provider API"
          >
            <Input
              type="text"
              required
              placeholder="e.g. claude-3-7-sonnet-20250219 or deepseek-chat"
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value);
                setHasFormChanges(true);
              }}
            />
          </FormGroup>

          {/* Base URL */}
          <FormGroup
            label="API Base URL"
            required
            helper="Endpoint URL (must accept /v1/messages Anthropic specification)"
          >
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              <Input
                type="url"
                required
                className="pl-9"
                placeholder="https://api.anthropic.com or https://openrouter.ai/api"
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setHasFormChanges(true);
                }}
              />
            </div>
          </FormGroup>

          {/* API Key */}
          <FormGroup
            label="API Key"
            helper="Stored encrypted at rest with AES-256. Never exposed in plain text."
          >
            {config?.api_key_set && !isEditingKey ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-(--input-radius) border border-(--input-border) bg-(--input-bg) text-xs font-mono text-muted flex items-center justify-between">
                  <span>{config.api_key_masked || 'sk-••••••••••••••••'}</span>
                  <ShieldCheck className="size-4 text-emerald-500" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsEditingKey(true);
                    setApiKey('');
                  }}
                >
                  <KeyRound className="size-3.5 mr-1" />
                  Update Key
                </Button>
              </div>
            ) : (
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                  <Input
                    type={showKeyText ? 'text' : 'password'}
                    className="pl-9 pr-10 font-mono text-xs"
                    placeholder="Enter new API key (e.g. sk-ant-api03-...)"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setHasFormChanges(true);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyText(!showKeyText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-default"
                  >
                    {showKeyText ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {config?.api_key_set && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditingKey(false);
                      setApiKey('');
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </FormGroup>

          {/* Max Tokens */}
          <FormGroup
            label="Max Tokens"
            helper="Maximum response completion length limit (256 - 65,536)"
          >
            <Input
              type="number"
              min={256}
              max={65536}
              step={256}
              value={maxTokens}
              onChange={(e) => {
                setMaxTokens(Number(e.target.value));
                setHasFormChanges(true);
              }}
            />
          </FormGroup>

          {/* API Version */}
          <FormGroup
            label="API Version Header"
            helper="Default is 2023-06-01 for Anthropic v1/messages format"
          >
            <Input
              type="text"
              placeholder="2023-06-01"
              value={apiVersion}
              onChange={(e) => {
                setApiVersion(e.target.value);
                setHasFormChanges(true);
              }}
            />
          </FormGroup>
        </div>

        {/* Security & Architecture Note */}
        <div className="p-3.5 bg-surface-sunken border border-default rounded-xl flex items-start gap-2.5 text-2xs text-muted">
          <Info className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-default">Unified Brain & Copilot Pipeline</span>
            <p>
              When a custom tenant model is configured, both the quick-access <strong>Operations AI Brain</strong> modal
              (Cmd+K) and the <strong>Financial Copilot</strong> workspace route through this model. If reset or inactive,
              the platform automatically falls back to system-wide server configuration.
            </p>
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-default">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={!hasFormChanges}
          >
            <Save className="size-3.5 mr-1.5" />
            Save Configuration
          </Button>
        </div>
      </form>

      {/* Confirm Reset Dialog */}
      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={handleResetToDefault}
        title="Reset AI Model Configuration"
        message="Are you sure you want to delete custom tenant AI settings? The system will immediately fall back to the platform global model."
        confirmLabel={saving ? 'Resetting...' : 'Yes, Reset to Default'}
        variant="danger"
      />
    </div>
  );
};
