import { create } from 'zustand';
import { api, getAccessToken } from '../api/client';
import type {
  TenantCapabilityManifest,
  ProductionStageConfig,
  CustomFieldDefinitionRecord,
} from './types';

export interface TenantCapabilityState {
  manifest: TenantCapabilityManifest | null;
  modules: Record<string, { enabled: boolean; plan_allowed: boolean; config?: Record<string, unknown> }>;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;

  isModuleEnabled: (moduleKey: string) => boolean;
  hasFeature: (featureKey: string) => boolean;
  getTerm: (termKey: string, fallback?: string) => string;
  getProductionStages: () => ProductionStageConfig[];
  getCustomFields: (module: string, entity: string) => CustomFieldDefinitionRecord[];
  getNavOrder: () => { sections?: string[]; items?: Record<string, string[]> } | null;
  setNavOrder: (order: { sections?: string[]; items?: Record<string, string[]> }) => void;

  bootstrap: (forceRefresh?: boolean) => Promise<void>;
  invalidate: () => Promise<void>;
  setManifest: (manifest: TenantCapabilityManifest) => void;
  updateModule: (moduleKey: string, enabled: boolean) => void;
}

const STORAGE_KEY = 'tenant_capability_manifest';

function getCachedManifest(): TenantCapabilityManifest | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const cachedManifest = getCachedManifest();

export const useTenantCapabilityStore = create<TenantCapabilityState>((set, get) => ({
  manifest: cachedManifest,
  modules: cachedManifest?.modules || {},
  status: cachedManifest ? 'ready' : 'idle',
  error: null,

  isModuleEnabled: (moduleKey: string) => {
    const { modules, manifest } = get();
    const mod = modules[moduleKey] ?? manifest?.modules?.[moduleKey];
    if (!mod) return true; // If unknown, default to accessible
    return mod.enabled && mod.plan_allowed;
  },

  hasFeature: (featureKey: string) => {
    const { manifest } = get();
    if (!manifest) return true;
    return manifest.feature_flags[featureKey] ?? true;
  },

  getTerm: (termKey: string, fallback?: string) => {
    const { manifest } = get();
    if (!manifest || !manifest.terminology) {
      return fallback || termKey;
    }
    return manifest.terminology[termKey] || fallback || termKey;
  },

  getProductionStages: () => {
    const { manifest } = get();
    if (!manifest || !manifest.production_stages || manifest.production_stages.length === 0) {
      return [
        { key: 'material_prep', label: 'Material Prep', sort_order: 1, is_qc_stage: false },
        { key: 'assembly', label: 'Assembly', sort_order: 2, is_qc_stage: false },
        { key: 'qc_inspection', label: 'Quality Control', sort_order: 3, is_qc_stage: true },
        { key: 'packaging', label: 'Packaging', sort_order: 4, is_qc_stage: false },
      ];
    }
    return manifest.production_stages;
  },

  getCustomFields: (module: string, entity: string) => {
    const { manifest } = get();
    if (!manifest || !manifest.custom_fields) return [];
    const groupKey = `${module}.${entity}`;
    return manifest.custom_fields[groupKey] || [];
  },

  getNavOrder: () => {
    const { manifest } = get();
    return manifest?.nav_order || null;
  },

  setNavOrder: (order) => {
    const { manifest } = get();
    const base: TenantCapabilityManifest = manifest || {
      tenant_id: 1,
      tenant_uuid: '00000000-0000-0000-0000-000000000000',
      tenant_name: 'Default Workspace',
      business_type_keys: [],
      industry_profile_key: 'custom',
      manufacturing_type: 'general',
      currency_code: 'BDT',
      timezone: 'Asia/Dhaka',
      onboarding_completed: true,
      onboarding_step: 1,
      modules: {},
      feature_flags: {},
      terminology: {},
      production_stages: [],
      custom_fields: {},
      nav_order: order,
    };
    const updated: TenantCapabilityManifest = {
      ...base,
      nav_order: order,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    set({ manifest: updated });
  },

  bootstrap: async (forceRefresh = false) => {
    const hasToken = Boolean(getAccessToken());
    if (!hasToken) {
      set({ status: 'idle', manifest: null });
      return;
    }

    // If we have cached manifest and not forceRefresh, set ready and fetch in background
    if (get().manifest && !forceRefresh) {
      set({ status: 'ready' });
    } else {
      set({ status: 'loading' });
    }

    try {
      const res = await api.get<TenantCapabilityManifest | { data: TenantCapabilityManifest }>(
        `/tenant/manifest${forceRefresh ? '?refresh=1' : ''}`
      );
      // Support both unwrapped manifest (ApiResult<T>.data is payload) and nested { data: manifest }
      const rawData = res.data as unknown;
      let manifest: TenantCapabilityManifest | null = null;
      if (rawData && typeof rawData === 'object') {
        if ('modules' in rawData) {
          manifest = rawData as TenantCapabilityManifest;
        } else if (
          'data' in rawData &&
          (rawData as { data: unknown }).data &&
          typeof (rawData as { data: unknown }).data === 'object' &&
          'modules' in ((rawData as { data: unknown }).data as Record<string, unknown>)
        ) {
          manifest = (rawData as { data: TenantCapabilityManifest }).data;
        }
      }

      if (manifest) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
        }
        set({
          manifest,
          modules: manifest.modules || {},
          status: 'ready',
          error: null,
        });
      }
    } catch (err) {
      // If we already had cached data, preserve it
      if (!get().manifest) {
        set({
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to load tenant capability manifest.',
        });
      }
    }
  },

  invalidate: async () => {
    await get().bootstrap(true);
  },

  setManifest: (manifest: TenantCapabilityManifest) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
    }
    set({
      manifest,
      modules: manifest.modules || {},
      status: 'ready',
    });
  },

  updateModule: (moduleKey: string, enabled: boolean) => {
    const { manifest, modules } = get();
    const existing = modules[moduleKey] ?? manifest?.modules?.[moduleKey] ?? { enabled: true, plan_allowed: true, config: {} };
    const updatedMod = { ...existing, enabled };
    const updatedModules = { ...modules, [moduleKey]: updatedMod };
    const updatedManifest: TenantCapabilityManifest = manifest
      ? { ...manifest, modules: { ...manifest.modules, [moduleKey]: updatedMod } }
      : {
          tenant_id: 0,
          tenant_uuid: '',
          tenant_name: '',
          business_type_keys: [],
          industry_profile_key: '',
          manufacturing_type: '',
          currency_code: 'BDT',
          timezone: 'Asia/Dhaka',
          onboarding_completed: true,
          onboarding_step: 10,
          modules: updatedModules,
          feature_flags: {},
          terminology: {},
          production_stages: [],
          custom_fields: {},
        };

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedManifest));
    }

    set({
      manifest: updatedManifest,
      modules: updatedModules,
      status: 'ready',
    });
  },
}));
