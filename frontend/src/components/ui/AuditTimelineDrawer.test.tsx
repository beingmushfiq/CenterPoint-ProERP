import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuditTimelineDrawer } from './AuditTimelineDrawer';

// Mock API client
vi.mock('../../lib/api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 101,
            action: 'product.created',
            auditable_type: 'Product',
            auditable_id: 1,
            user: { id: 7, name: 'Alice Admin', email: 'alice@example.com' },
            new_values: { name: 'Premium Leather Loafers', default_sale_price: 3500 },
            created_at: '2026-09-28T01:00:00Z',
          },
        ],
      },
    }),
  },
}));

describe('AuditTimelineDrawer Component', () => {
  it('renders drawer header, entity badge, and title when open', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuditTimelineDrawer
          isOpen={true}
          onClose={vi.fn()}
          entityType="Product"
          entityId={1}
          entityTitle="Premium Leather Loafers"
          entityCode="SKU-LOAFER-01"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText(/Premium Leather Loafers/)).toBeInTheDocument();
  });

  it('renders records when api.get resolves with a direct array payload', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuditTimelineDrawer
          isOpen={true}
          onClose={vi.fn()}
          entityType="Product"
          entityId={1}
          entityTitle="Loafers"
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText('product created')).toBeInTheDocument();
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    expect(screen.getByText('2 attribute change(s)')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const queryClient = new QueryClient();

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AuditTimelineDrawer
          isOpen={false}
          onClose={vi.fn()}
          entityType="Product"
          entityId={1}
        />
      </QueryClientProvider>
    );

    expect(container.firstChild).toBeNull();
  });
});
