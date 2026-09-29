import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { SliceMartBrainModal } from './SliceMartBrainModal';
import { useAuthStore } from '../../lib/auth/authStore';

vi.mock('../../lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn().mockResolvedValue({ data: { capabilities: ['streaming'], tools: ['get_stock_level'] } }),
      post: vi.fn().mockResolvedValue({ data: { success: true } }),
      streamSse: vi.fn(),
    },
    getAccessToken: vi.fn().mockReturnValue('mock-jwt-token'),
  };
});

vi.mock('../ui/Toast', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('SliceMartBrainModal Component (Phase 10 Upgrades)', () => {
  let storage: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    storage = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
    });

    useAuthStore.setState({
      user: {
        id: '1',
        name: 'Executive Admin',
        email: 'admin@proerp.test',
        role: 'Administrator',
        is_active: true,
        is_platform_admin: false,
        locale: 'en',
        theme: 'light',
        density: 'normal',
        landing_page: '/dashboard',
        tenant_id: 1,
        default_company_id: 1,
        default_branch_id: 1,
        default_factory_id: null,
        default_warehouse_id: null,
      },
      tenant: {
        id: 1,
        uuid: 'tenant-enterprise',
        name: 'ProERP Enterprise',
        slug: 'proerp-ent',
        status: 'active',
        currency_code: 'BDT',
        timezone: 'UTC',
      },
      permissions: new Set(['*']),
      status: 'authenticated',
      error: null,
      hasPermission: () => true,
    });
  });

  it('renders the slide-over drawer with header, badges, and default message', () => {
    render(
      <MemoryRouter>
        <SliceMartBrainModal open={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByRole('dialog', { name: /ProERP Enterprise AI Operations Brain/i })).toBeInTheDocument();
    expect(screen.getByText(/Streaming Neural Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Commercial & Sales Performance/i)).toBeInTheDocument();
    expect(screen.getByText(/Warehouse Inventory & Valuation/i)).toBeInTheDocument();
  });

  it('renders categorized prompt tabs and chips', () => {
    render(
      <MemoryRouter>
        <SliceMartBrainModal open={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Commercial/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stock & Warehouse/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finance & AR/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Factory & Quality/i })).toBeInTheDocument();

    // Default active category is Commercial
    expect(screen.getByText(/What is our total sales revenue and collected cash this month\?/i)).toBeInTheDocument();

    // Switch to Stock & Warehouse category
    fireEvent.click(screen.getByRole('button', { name: /Stock & Warehouse/i }));
    expect(screen.getByText(/Calculate total warehouse inventory valuation and show low-stock items/i)).toBeInTheDocument();
  });

  it('restores conversation history from localStorage', () => {
    storage['brain.history'] = JSON.stringify([
      {
        id: 'hist-1',
        sender: 'user',
        text: 'Previous audit request',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'hist-2',
        sender: 'agent',
        text: 'Found 42 items in warehouse.',
        timestamp: new Date().toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <SliceMartBrainModal open={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText('Previous audit request')).toBeInTheDocument();
    expect(screen.getByText('Found 42 items in warehouse.')).toBeInTheDocument();
  });

  it('clears conversation history when Clear History button is clicked', () => {
    storage['brain.history'] = JSON.stringify([
      {
        id: 'hist-1',
        sender: 'user',
        text: 'Temporary message to wipe',
        timestamp: new Date().toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <SliceMartBrainModal open={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText('Temporary message to wipe')).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /Clear Conversation History/i });
    fireEvent.click(clearBtn);

    // After clearing, restored to default welcome message
    expect(screen.queryByText('Temporary message to wipe')).not.toBeInTheDocument();
    expect(screen.getByText(/Commercial & Sales Performance/i)).toBeInTheDocument();
  });
});
