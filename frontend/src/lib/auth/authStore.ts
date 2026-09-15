import { create } from 'zustand';
import { api, getAccessToken, onSessionExpired, refreshOnce, setAccessToken } from '../api/client';
import { useTenantCapabilityStore } from '../capabilities/tenantCapabilityStore';
import type {
  BranchInfo,
  LoginResponseData,
  MeResponseData,
  TenantInfo,
  User,
} from '../../types/api/auth';

export interface AuthState {
  user: User | null;
  tenant: TenantInfo | null;
  branches: BranchInfo[];
  activeBranch: BranchInfo | null;
  permissions: Set<string>;
  status: 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';
  error: string | null;

  login: (credentials: { email: string; password: string; tenant_id?: string }) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  hasPermission: (permission: string | string[]) => boolean;
  switchBranch: (branchId: number) => Promise<void>;
}

function getStoredItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const initialUser = getStoredItem<User | null>('auth_user', null);
const initialTenant = getStoredItem<TenantInfo | null>('auth_tenant', null);
const initialPermissions = new Set<string>(getStoredItem<string[]>('auth_permissions', []));
const initialBranches = getStoredItem<BranchInfo[]>('auth_branches', []);
const initialActiveBranch = getStoredItem<BranchInfo | null>('auth_active_branch', null);
const hasInitialToken = Boolean(getAccessToken());

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialUser,
  tenant: initialTenant,
  branches: initialBranches,
  activeBranch: initialActiveBranch,
  permissions: initialPermissions,
  status: initialUser && hasInitialToken ? 'authenticated' : 'idle',
  error: null,

  login: async (credentials) => {
    set({ status: 'authenticating', error: null });
    try {
      const response = await api.post<LoginResponseData>('/auth/login', credentials);
      const data = response.data;
      setAccessToken(data.access_token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      localStorage.setItem('auth_tenant', JSON.stringify(data.tenant));
      localStorage.setItem('auth_permissions', JSON.stringify(data.permissions ?? []));

      set({
        user: data.user,
        tenant: data.tenant,
        branches: [],
        activeBranch: null,
        permissions: new Set(data.permissions),
        status: 'authenticated',
        error: null,
      });

      // Trigger capability manifest fetch
      try {
        useTenantCapabilityStore.getState().bootstrap();
      } catch {
        // Ignore background bootstrap failure
      }

      // Trigger bootstrap in background to refresh latest branches / permissions
      get().bootstrap().catch(() => {});
    } catch (err: unknown) {
      setAccessToken(null);
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_tenant');
      localStorage.removeItem('auth_permissions');
      localStorage.removeItem('auth_branches');
      localStorage.removeItem('auth_active_branch');

      const message =
        err instanceof Error ? err.message : 'Invalid credentials. Please check and try again.';
      set({
        status: 'unauthenticated',
        error: message,
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Ignore network errors on logout
    } finally {
      setAccessToken(null);
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_tenant');
      localStorage.removeItem('auth_permissions');
      localStorage.removeItem('auth_branches');
      localStorage.removeItem('auth_active_branch');

      set({
        user: null,
        tenant: null,
        branches: [],
        activeBranch: null,
        permissions: new Set(),
        status: 'unauthenticated',
        error: null,
      });
    }
  },

  bootstrap: async () => {
    let savedToken = getAccessToken();
    if (!savedToken) {
      const refreshed = await refreshOnce();
      if (refreshed) {
        savedToken = getAccessToken();
      }
    }

    if (savedToken) {
      setAccessToken(savedToken);
    } else {
      set({ status: 'unauthenticated' });
      return;
    }

    try {
      const response = await api.get<MeResponseData>('/auth/me');
      const data = response.data;

      localStorage.setItem('auth_user', JSON.stringify(data.user));
      localStorage.setItem('auth_tenant', JSON.stringify(data.tenant));
      localStorage.setItem('auth_permissions', JSON.stringify(data.permissions ?? []));
      localStorage.setItem('auth_branches', JSON.stringify(data.branches ?? []));
      localStorage.setItem('auth_active_branch', JSON.stringify(data.active_branch ?? null));

      set({
        user: data.user,
        tenant: data.tenant,
        branches: data.branches ?? [],
        activeBranch: data.active_branch,
        permissions: new Set(data.permissions ?? []),
        status: 'authenticated',
        error: null,
      });

      // Trigger capability manifest fetch
      try {
        useTenantCapabilityStore.getState().bootstrap();
      } catch {
        // Ignore background bootstrap failure
      }
    } catch (err: unknown) {
      // If token is explicitly rejected (401/403) or no cached user exists, cleanly transition to unauthenticated
      const isUnauth =
        typeof err === 'object' &&
        err !== null &&
        (('status' in err && ((err as { status?: number }).status === 401 || (err as { status?: number }).status === 403)) ||
          ('code' in err && (err as { code?: string }).code === 'UNAUTHENTICATED'));

      if (isUnauth || !get().user) {
        setAccessToken(null);
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_tenant');
        localStorage.removeItem('auth_permissions');
        localStorage.removeItem('auth_branches');
        localStorage.removeItem('auth_active_branch');

        set({
          user: null,
          tenant: null,
          branches: [],
          activeBranch: null,
          permissions: new Set(),
          status: 'unauthenticated',
          error: err instanceof Error ? err.message : 'Session verification failed.',
        });
      } else {
        // Keep existing cached user session active so network blips don't log out user
        set({ status: 'authenticated' });
      }
    }
  },

  hasPermission: (permission: string | string[]) => {
    const { user, permissions } = get();
    if (!user) return false;
    if (user.is_platform_admin) return true;
    if (permissions.has('*')) return true;

    if (Array.isArray(permission)) {
      return permission.some((p) => {
        if (permissions.has(p)) return true;
        const modulePrefix = p.split('.')[0] + '.*';
        return permissions.has(modulePrefix);
      });
    }
    if (permissions.has(permission)) return true;
    const modulePrefix = permission.split('.')[0] + '.*';
    return permissions.has(modulePrefix);
  },

  switchBranch: async (branchId: number) => {
    try {
      const response = await api.post<{ branch: BranchInfo }>('/auth/switch-branch', {
        branch_id: branchId,
      });
      const updatedBranch = response.data.branch;
      localStorage.setItem('auth_active_branch', JSON.stringify(updatedBranch));
      set({ activeBranch: updatedBranch });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to switch branch';
      set({ error: message });
      throw err;
    }
  },
}));

// Automatically clear credentials and notify user when API client announces a dead session
onSessionExpired((error) => {
  setAccessToken(null);
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_tenant');
  localStorage.removeItem('auth_permissions');
  localStorage.removeItem('auth_branches');
  localStorage.removeItem('auth_active_branch');

  useAuthStore.setState({
    user: null,
    tenant: null,
    branches: [],
    activeBranch: null,
    permissions: new Set(),
    status: 'unauthenticated',
    error: error.message || 'Your session has expired. Please sign in again.',
  });
});
