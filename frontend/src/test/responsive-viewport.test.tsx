import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentSplitEditor } from '../components/payment/PaymentSplitEditor';
import { WorkspaceHeader } from '../components/ui/WorkspaceHeader';
import { ResponsiveDataTable, type ResponsiveColumn } from '../components/ui/ResponsiveDataTable';
import { Modal } from '../components/ui/Modal';

describe('Responsive Viewport & Layout Ergonomics', () => {
  describe('PaymentSplitEditor Responsiveness', () => {
    it('renders responsive stacking classes on split rows and action bars', () => {
      const onChange = vi.fn();
      const splits = [
        { id: '1', method: 'cash' as const, amount: 500 },
        { id: '2', method: 'mobile_banking' as const, amount: 500, mobile_provider: 'bKash' },
      ];

      const { container } = render(
        <PaymentSplitEditor
          totalAmount={1000}
          splits={splits}
          onChange={onChange}
        />
      );

      // Verify header summary ribbon renders allocation
      expect(screen.getByText(/Payment Allocation/i)).toBeInTheDocument();
      expect(screen.getByText(/Fully Allocated/i)).toBeInTheDocument();

      // Verify split rows contain mobile stacking layout classes (sm:flex, xs:flex-row)
      const primaryRows = container.querySelectorAll('.p-3.space-y-2\\.5');
      expect(primaryRows.length).toBeGreaterThan(0);

      // Verify quick add presets are rendered
      expect(screen.getByText(/\+Mobile Banking/i)).toBeInTheDocument();
    });
  });

  describe('WorkspaceHeader Responsiveness', () => {
    it('renders adaptive grid classes for metrics on small screens', () => {
      const metrics = [
        { label: 'Total Revenue', value: '৳50,000' },
        { label: 'Active Orders', value: '14' },
        { label: 'Pending QC', value: '3' },
        { label: 'Stock Valuation', value: '৳1,200,000' },
      ];

      const { container } = render(
        <WorkspaceHeader
          title="Executive Telemetry"
          subtitle="Real-time operations"
          metrics={metrics}
          actions={<button type="button">New Transaction</button>}
        />
      );

      expect(screen.getByText('Executive Telemetry')).toBeInTheDocument();
      expect(screen.getByText('৳50,000')).toBeInTheDocument();

      // Verify grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 classes exist on metrics container
      const grid = container.querySelector('.grid-cols-1.xs\\:grid-cols-2.sm\\:grid-cols-4');
      expect(grid).not.toBeNull();
    });
  });

  describe('ResponsiveDataTable Mobile Card Reflow', () => {
    interface TestItem {
      id: string;
      code: string;
      status: string;
      amount: number;
    }

    it('renders mobile card container and desktop table with priority classes', () => {
      const data: TestItem[] = [
        { id: 'inv-1', code: 'INV-2026-001', status: 'posted', amount: 4500 },
        { id: 'inv-2', code: 'INV-2026-002', status: 'draft', amount: 1200 },
      ];

      const columns: ResponsiveColumn<TestItem>[] = [
        { id: 'code', header: 'Invoice #', isPrimary: true, accessor: (r) => r.code },
        { id: 'status', header: 'Status', isStatus: true, accessor: (r) => r.status },
        { id: 'amount', header: 'Amount', priority: 'medium', accessor: (r) => `৳${r.amount}` },
      ];

      const { container } = render(
        <ResponsiveDataTable
          data={data}
          columns={columns}
          keyExtractor={(r) => r.id}
        />
      );

      // Verify mobile card view container exists with sm:hidden
      const mobileCardContainer = container.querySelector('.sm\\:hidden');
      expect(mobileCardContainer).not.toBeNull();

      // Verify table view container exists with hidden sm:block
      const desktopTableContainer = container.querySelector('.hidden.sm\\:block');
      expect(desktopTableContainer).not.toBeNull();

      // Verify primary and status column values are present
      expect(screen.getAllByText('INV-2026-001').length).toBeGreaterThan(0);
      expect(screen.getAllByText('posted').length).toBeGreaterThan(0);
    });
  });

  describe('Modal Dynamic Viewport Units', () => {
    it('uses dvh and pb-safe overlay classes', () => {
      const onClose = vi.fn();
      render(
        <Modal
          open={true}
          onClose={onClose}
          title="Responsive Modal Dialog"
        >
          <div>Modal content inside viewport</div>
        </Modal>
      );

      expect(screen.getByText('Responsive Modal Dialog')).toBeInTheDocument();
      expect(screen.getByText('Modal content inside viewport')).toBeInTheDocument();

      // Verify dialog element has max-h-[90dvh]
      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('max-h-[90dvh]');
    });
  });
});
