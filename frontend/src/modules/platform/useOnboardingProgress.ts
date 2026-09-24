import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api/client';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { useAuthStore } from '../../lib/auth/authStore';

const STORAGE_SKIP_KEY = 'erp_onboarding_skipped';
const STORAGE_COMPLETED_KEY = 'erp_onboarding_completed';

export interface CompletionMilestones {
  percentage: number;
  is_completed: boolean;
  completed_milestones: string[];
  pending_milestones: string[];
}

export interface OnboardingStateResponse {
  tenant_id: number;
  name: string;
  slug: string;
  currency_code: string;
  timezone: string;
  business_type_keys: string[];
  industry_profile_key: string;
  manufacturing_type: string;
  onboarding_step: number;
  onboarding_completed: boolean;
  onboarding_draft: Record<string, unknown>;
  completion_score?: CompletionMilestones;

  company_legal_name?: string;
  tax_number?: string;
  trade_license?: string;
  address?: string;
  phone?: string;
  email?: string;
  warehouse_name?: string;
  warehouse_address?: string;
  pos_counter_name?: string;
  brand_color?: string;
  logo_url?: string;
  invoice_terms?: string;
  units?: string[];
}

export function useOnboardingProgress() {
  const navigate = useNavigate();
  const manifest = useTenantCapabilityStore((s) => s.manifest);
  const authStatus = useAuthStore((s) => s.status);
  const isAuthenticated = authStatus === 'authenticated';
  const tenant = useAuthStore((s) => s.tenant);

  // Fast-path: Check localStorage to prevent flashing/splashing on page reload
  const [localCompleted] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
      return localStorage.getItem(STORAGE_COMPLETED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [isSkipped, setIsSkipped] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_SKIP_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const stateQuery = useQuery({
    queryKey: ['tenant', 'onboarding', 'state'],
    queryFn: async ({ signal }) => {
      try {
        const res = await api.get<OnboardingStateResponse | { data: OnboardingStateResponse }>(
          '/tenant/onboarding/state',
          { signal }
        );
        const raw = res.data;
        if (raw && typeof raw === 'object') {
          if ('onboarding_completed' in raw) return raw as OnboardingStateResponse;
          if ('data' in raw && raw.data && typeof raw.data === 'object') {
            return raw.data as OnboardingStateResponse;
          }
        }
        return null;
      } catch {
        return null;
      }
    },
    enabled: isAuthenticated && Boolean(tenant) && !localCompleted,
    staleTime: 60_000,
  });

  const backendCompleted = stateQuery.data?.onboarding_completed ?? false;
  const manifestCompleted = manifest?.onboarding_completed ?? false;
  const isCompleted = localCompleted || backendCompleted || manifestCompleted;

  // Persist completion state locally whenever backend confirms it
  useEffect(() => {
    if (backendCompleted || manifestCompleted) {
      try {
        localStorage.setItem(STORAGE_COMPLETED_KEY, 'true');
      } catch {
        // Ignore storage errors
      }
    }
  }, [backendCompleted, manifestCompleted]);

  // While query is loading and we don't have local or manifest confirmation,
  // do NOT show startup modal or progress card to prevent flashing on reload
  const isInitialLoading = stateQuery.isLoading && !stateQuery.data && !localCompleted && !manifestCompleted;

  const completionPercentage = isCompleted
    ? 100
    : (stateQuery.data?.completion_score?.percentage ?? manifest?.onboarding_percentage ?? 0);

  const milestones: CompletionMilestones = stateQuery.data?.completion_score ?? {
    percentage: completionPercentage,
    is_completed: isCompleted,
    completed_milestones: [] as string[],
    pending_milestones: [
      'legal_identity',
      'operational_facilities',
      'standards_branding',
    ] as string[],
  };

  const skipOnboarding = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_SKIP_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    setIsSkipped(true);
  }, []);

  const resetSkip = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_SKIP_KEY);
    } catch {
      // Ignore storage errors
    }
    setIsSkipped(false);
  }, []);

  const resumeOnboarding = useCallback(() => {
    navigate('/onboarding');
  }, [navigate]);

  return {
    state: stateQuery.data,
    isLoading: isInitialLoading,
    isCompleted,
    completionPercentage,
    milestones,
    isSkipped,
    shouldShowStartupModal: !isCompleted && !isSkipped && !isInitialLoading,
    shouldShowProgressCard: !isCompleted && !isInitialLoading,
    skipOnboarding,
    resetSkip,
    resumeOnboarding,
    refetchState: stateQuery.refetch,
  };
}
