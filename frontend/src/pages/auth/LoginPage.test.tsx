import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

vi.mock('../../lib/api/client', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
  getAccessToken: vi.fn(() => null),
  onSessionExpired: vi.fn(),
}));

import { usePwaInstallStore } from '../../store/pwaInstallStore';

describe('LoginPage', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    usePwaInstallStore.setState({
      isInstallable: false,
      isInstalled: false,
      appName: 'Operations ERP',
    });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    });
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    storage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
  });

  it('renders login form with SliceMart ERP and Business Operations Platform branding', async () => {
    storage.set('company_name', 'SliceMart ERP');

    await act(async () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
    });

    // Header branding
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SliceMart ERP');
    expect(screen.getByText('Business Operations Platform')).toBeInTheDocument();
    expect(screen.getByText(/SliceMart ERP • Business Operations Platform/i)).toBeInTheDocument();

    // Inputs are clean and empty by default
    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(emailInput.value).toBe('');
    expect(passwordInput.value).toBe('');

    // Does NOT contain SaaS or multi-tenant clutter
    expect(screen.queryByText(/multi-tenant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/saas/i)).not.toBeInTheDocument();
  });

  it('renders PWA install button when app is installable', async () => {
    usePwaInstallStore.setState({
      isInstallable: true,
      isInstalled: false,
      appName: 'SliceMart ERP',
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
    });

    const installBtn = screen.getByRole('button', { name: /install slicemart erp/i });
    expect(installBtn).toBeInTheDocument();
  });

  it('renders configured brand logo when set in settings/localStorage', async () => {
    storage.set('company_name', 'SliceMart ERP');
    storage.set('brand_logo_url', 'https://example.com/custom-logo.png');

    await act(async () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
    });

    const logoImg = screen.getByRole('img', { name: /slicemart erp/i });
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute('src', 'https://example.com/custom-logo.png');
  });

  it('updates document favicon when configured in settings', async () => {
    storage.set('brand_favicon_url', 'https://example.com/custom-favicon.ico');

    await act(async () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
    });

    const icon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    expect(icon).not.toBeNull();
    expect(icon?.href).toContain('custom-favicon.ico');
  });

  it('defaults to light mode when no preference is stored', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
    });

    // In light mode, dark class is absent and data-theme is light
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Toggle button offers switching to Dark Mode
    const toggleBtn = screen.getByRole('button', { name: /switch to dark mode/i });
    expect(toggleBtn).toBeInTheDocument();
  });

  it('toggles between light mode and dark mode smoothly', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
    });

    const toggleBtn = screen.getByRole('button', { name: /switch to dark mode/i });
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // Now dark mode
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(storage.get('ui.theme')).toBe('dark');

    // Button now shows Switch to Light Mode
    const lightBtn = screen.getByRole('button', { name: /switch to light mode/i });
    expect(lightBtn).toBeInTheDocument();

    // Click again to go back to light mode
    await act(async () => {
      fireEvent.click(lightBtn);
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(storage.get('ui.theme')).toBe('light');
  });

  it('toggles password visibility', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );
    });

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const togglePasswordBtn = screen.getByRole('button', { name: /show password/i });
    await act(async () => {
      fireEvent.click(togglePasswordBtn);
    });
    expect(passwordInput.type).toBe('text');

    const hidePasswordBtn = screen.getByRole('button', { name: /hide password/i });
    await act(async () => {
      fireEvent.click(hidePasswordBtn);
    });
    expect(passwordInput.type).toBe('password');
  });
});
