import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useOnboardingProgress, type OnboardingStateResponse } from './useOnboardingProgress';
import { useAuthStore } from '../../lib/auth/authStore';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { api } from '../../lib/api/client';
import type { TenantInfo } from '../../types/api/auth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function createStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

const mockStorage = createStorageMock();
Object.defineProperty(window, 'localStorage', {
  value: mockStorage,
  writable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
});

describe('useOnboardingProgress hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();

    const mockTenant: TenantInfo = {
      id: 1,
      uuid: 'ten-001',
      name: 'SliceMart',
      slug: 'slicemart',
      status: 'active',
      currency_code: 'BDT',
      timezone: 'UTC',
    };

    useAuthStore.setState({
      status: 'authenticated',
      tenant: mockTenant,
    });

    useTenantCapabilityStore.setState({
      manifest: null,
      status: 'idle',
      error: null,
    });
  });

  it('prevents flashing modal when local storage has erp_onboarding_completed set to true', () => {
    localStorage.setItem('erp_onboarding_completed', 'true');

    const { result } = renderHook(() => useOnboardingProgress(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isCompleted).toBe(true);
    expect(result.current.shouldShowStartupModal).toBe(false);
    expect(result.current.shouldShowProgressCard).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('does NOT show startup modal while initial query is loading', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // Never resolves (in flight)

    const { result } = renderHook(() => useOnboardingProgress(), {
      wrapper: createWrapper(),
    });

    // While request is in flight, it must not prematurely render startup modal
    expect(result.current.isLoading).toBe(true);
    expect(result.current.shouldShowStartupModal).toBe(false);
    expect(result.current.shouldShowProgressCard).toBe(false);
  });

  it('persists completion state to localStorage when backend confirms completion', async () => {
    const mockState: OnboardingStateResponse = {
      tenant_id: 1,
      name: 'SliceMart',
      slug: 'slicemart',
      currency_code: 'BDT',
      timezone: 'UTC',
      business_type_keys: [],
      industry_profile_key: 'retail',
      manufacturing_type: 'none',
      onboarding_step: 6,
      onboarding_completed: true,
      onboarding_draft: {},
    };

    vi.mocked(api.get).mockResolvedValueOnce({
      data: mockState,
      meta: {
        correlation_id: 'test-correlation-id',
      },
    });

    const { result } = renderHook(() => useOnboardingProgress(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isCompleted).toBe(true);
    });

    expect(result.current.shouldShowStartupModal).toBe(false);
    expect(localStorage.getItem('erp_onboarding_completed')).toBe('true');
  });
});
