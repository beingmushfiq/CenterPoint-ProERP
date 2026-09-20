import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DataBinWorkspace } from './DataBinWorkspace';
import { api } from '../../lib/api/client';

vi.mock('../../lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../components/ui/Toast', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('DataBinWorkspace - Enterprise Recovery Vault', () => {
  const mockStats = {
    total: 2,
    counts: {
      purchase_orders: 1,
      products: 1,
    },
    domains: {
      supply: 1,
      inventory: 1,
      commercial: 0,
      manufacturing: 0,
      workforce: 0,
      finance: 0,
      system: 0,
    },
    types: [
      { key: 'purchase_orders', label: 'Purchase Order', domain: 'supply', count: 1 },
      { key: 'products', label: 'Product', domain: 'inventory', count: 1 },
    ],
  };

  const mockItems = [
    {
      id: 101,
      uuid: 'po-uuid-101',
      type: 'purchase_orders',
      type_label: 'Purchase Order',
      domain: 'supply',
      identifier: 'PO-TEST-101',
      details: {
        code: 'PO-101',
        amount: 25000,
        status: 'draft',
        date: '2026-09-20',
      },
      deleted_at: '2026-09-20T10:00:00Z',
    },
    {
      id: 202,
      uuid: 'prod-uuid-202',
      type: 'products',
      type_label: 'Product',
      domain: 'inventory',
      identifier: 'Vanilla Sponge Cake',
      details: {
        code: 'SKU-CAKE-01',
        category: 'Bakery',
      },
      deleted_at: '2026-09-20T11:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/bin/stats') {
        return { data: { data: mockStats } } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      if (url === '/bin') {
        return { data: { data: mockItems } } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      return { data: null } as unknown as Awaited<ReturnType<typeof api.get>>;
    });
  });

  it('renders the Data Bin vault banner and quarantined metrics', async () => {
    render(
      <MemoryRouter>
        <DataBinWorkspace />
      </MemoryRouter>
    );

    // Banner and headers
    expect(screen.getByText('Data Bin & Recovery Vault')).toBeInTheDocument();
    expect(screen.getByText('Zero Data-Loss Enterprise Vault')).toBeInTheDocument();
    expect(screen.getByText('Rollback Integrity')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Verify items appear
    await waitFor(() => {
      expect(screen.getByText('PO-TEST-101')).toBeInTheDocument();
      expect(screen.getByText('Vanilla Sponge Cake')).toBeInTheDocument();
    });
  });

  it('allows restoring a trashed item with confirmation dialog', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, message: 'Purchase Order restored.' },
    } as unknown as Awaited<ReturnType<typeof api.post>>);

    render(
      <MemoryRouter>
        <DataBinWorkspace />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PO-TEST-101')).toBeInTheDocument();
    });

    // Click restore on first item
    const restoreButtons = screen.getAllByRole('button', { name: /Restore/i });
    expect(restoreButtons[0]).toBeDefined();
    fireEvent.click(restoreButtons[0]!);

    // Dialog opens
    await waitFor(() => {
      expect(screen.getAllByText('Restore Purchase Order').length).toBeGreaterThanOrEqual(1);
    });

    // Confirm restore
    const confirmButton = screen.getByRole('button', { name: 'Restore Record' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/bin/purchase_orders/101/restore', {});
    });
  });

  it('allows purging an item permanently with confirmation dialog', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({
      data: { success: true, message: 'Purchase Order permanently deleted.' },
    } as unknown as Awaited<ReturnType<typeof api.delete>>);

    render(
      <MemoryRouter>
        <DataBinWorkspace />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PO-TEST-101')).toBeInTheDocument();
    });

    // Click purge on first item
    const purgeButtons = screen.getAllByRole('button', { name: /Purge/i });
    expect(purgeButtons[0]).toBeDefined();
    fireEvent.click(purgeButtons[0]!);

    // Dialog opens
    await waitFor(() => {
      expect(screen.getAllByText('Permanently Purge Purchase Order?').length).toBeGreaterThanOrEqual(1);
    });

    // Confirm purge
    const confirmButton = screen.getByRole('button', { name: 'Permanently Delete' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/bin/purchase_orders/101/force-delete');
    });
  });

  it('renders pristine empty state when no items are trashed', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/bin/stats') {
        return { data: { data: { total: 0, counts: {}, domains: {}, types: [] } } } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      if (url === '/bin') {
        return { data: { data: [] } } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      return { data: null } as unknown as Awaited<ReturnType<typeof api.get>>;
    });

    render(
      <MemoryRouter>
        <DataBinWorkspace />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Recovery Vault is Pristine')).toBeInTheDocument();
    });
  });

  it('supports selecting all items and bulk restoring them', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, message: '2 record(s) restored.', data: { restored_count: 2 } },
    } as unknown as Awaited<ReturnType<typeof api.post>>);

    render(
      <MemoryRouter>
        <DataBinWorkspace />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PO-TEST-101')).toBeInTheDocument();
      expect(screen.getByText('Vanilla Sponge Cake')).toBeInTheDocument();
    });

    // Check header checkbox to select all
    const selectAllCheckbox = screen.getByLabelText('Select all');
    fireEvent.click(selectAllCheckbox);

    // Bulk ribbon appears
    await waitFor(() => {
      expect(screen.getByText(/records selected in vault/i)).toBeInTheDocument();
    });

    // Click "Restore Selected"
    const bulkRestoreButton = screen.getByRole('button', { name: /Restore Selected/i });
    fireEvent.click(bulkRestoreButton);

    // Confirm dialog opens
    await waitFor(() => {
      expect(screen.getAllByText(/Restore 2 Selected Record\(s\)/i).length).toBeGreaterThanOrEqual(1);
    });

    // Confirm bulk restore
    const confirmButton = screen.getByRole('button', { name: /Restore Records/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/bin/bulk-restore', {
        items: [
          { type: 'purchase_orders', id: '101' },
          { type: 'products', id: '202' },
        ],
      });
    });
  });

  it('supports selecting individual items and bulk purging them', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, message: '1 record(s) purged.', data: { purged_count: 1 } },
    } as unknown as Awaited<ReturnType<typeof api.post>>);

    render(
      <MemoryRouter>
        <DataBinWorkspace />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PO-TEST-101')).toBeInTheDocument();
    });

    // Select first item
    const itemCheckbox = screen.getByLabelText('Select PO-TEST-101');
    fireEvent.click(itemCheckbox);

    // Ribbon displays 1 selected
    await waitFor(() => {
      expect(screen.getByText(/record selected in vault/i)).toBeInTheDocument();
    });

    // Click "Purge Selected"
    const bulkPurgeButton = screen.getByRole('button', { name: /Purge Selected/i });
    fireEvent.click(bulkPurgeButton);

    // Confirm dialog opens
    await waitFor(() => {
      expect(screen.getAllByText(/Permanently Purge 1 Selected Record\(s\)\?/i).length).toBeGreaterThanOrEqual(1);
    });

    // Confirm bulk purge
    const confirmButton = screen.getByRole('button', { name: /Permanently Purge/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/bin/bulk-force-delete', {
        items: [{ type: 'purchase_orders', id: '101' }],
      });
    });
  });
});

