import { create } from 'zustand';
import { api, setAccessToken } from '../api/client';
import { isApiError } from '../api/errors';
import type { PlatformUser } from '../../types/api/platform';

export interface PlatformAuthState {
  user: PlatformUser | null;
  status: 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';
  error: string | null;

  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

export const usePlatformAuthStore = create<PlatformAuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  login: async (credentials) => {
    set({ status: 'authenticating', error: null });
    try {
      const response = await api.post<{
        access_token: string;
        token_type: string;
        user: PlatformUser;
      }>('/platform/auth/login', credentials);

      const data = response.data;
      setAccessToken(data.access_token);
      localStorage.setItem('platform_access_token', data.access_token);

      set({
        user: data.user,
        status: 'authenticated',
        error: null,
      });
    } catch (err: unknown) {
      setAccessToken(null);
      localStorage.removeItem('platform_access_token');
      let message = 'Invalid platform credentials. Super Admin access required.';
      if (isApiError(err)) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      set({
        status: 'unauthenticated',
        error: message,
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/platform/auth/logout', {});
    } catch {
      // Best-effort logout
    } finally {
      setAccessToken(null);
      localStorage.removeItem('platform_access_token');
      set({
        user: null,
        status: 'unauthenticated',
        error: null,
      });
    }
  },

  bootstrap: async () => {
    const savedToken = localStorage.getItem('platform_access_token');
    if (!savedToken) {
      set({ status: 'unauthenticated', user: null });
      return;
    }

    setAccessToken(savedToken);
    try {
      const response = await api.get<{
        user: PlatformUser;
      }>('/platform/auth/me');

      set({
        user: response.data.user,
        status: 'authenticated',
        error: null,
      });
    } catch {
      setAccessToken(null);
      localStorage.removeItem('platform_access_token');
      set({
        user: null,
        status: 'unauthenticated',
        error: null,
      });
    }
  },
}));
