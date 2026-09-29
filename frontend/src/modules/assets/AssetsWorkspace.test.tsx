import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssetsWorkspace } from './AssetsWorkspace';

// Mock Toast notification
vi.mock('../../components/ui/Toast', () => ({
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Currency hook
vi.mock('../../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatCurrency: (val: number | string) => `৳ ${parseFloat(String(val)).toLocaleString()}`,
  }),
}));

describe('AssetsWorkspace Component & Action Buttons', () => {
  it('renders module title and contextual action controls in header', () => {
    render(
      <MemoryRouter initialEntries={['/assets?tab=machinery']}>
        <AssetsWorkspace />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Asset Management' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Work Order/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Register Asset/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders proper action buttons on Asset Categories & Policies tab', () => {
    render(
      <MemoryRouter initialEntries={['/assets?tab=categories']}>
        <AssetsWorkspace />
      </MemoryRouter>
    );

    // Tab header should have "+ Add Category" button
    const addCatButtons = screen.getAllByRole('button', { name: /Add Category/i });
    expect(addCatButtons.length).toBeGreaterThanOrEqual(1);

    // Each category card should have 'View Assets', '+ New Asset', and 'Edit Depreciation Policy'
    const viewAssetButtons = screen.getAllByRole('button', { name: /View Assets/i });
    expect(viewAssetButtons.length).toBe(3);

    const newAssetButtons = screen.getAllByRole('button', { name: /\+ New Asset/i });
    expect(newAssetButtons.length).toBe(3);

    const editPolicyButtons = screen.getAllByRole('button', { name: /Edit Depreciation Policy/i });
    expect(editPolicyButtons.length).toBe(3);
  });

  it('navigates to Fixed Asset Register and applies category filter when clicking "View Assets"', () => {
    render(
      <MemoryRouter initialEntries={['/assets?tab=categories']}>
        <AssetsWorkspace />
      </MemoryRouter>
    );

    const viewAssetButtons = screen.getAllByRole('button', { name: /View Assets/i });
    expect(viewAssetButtons[0]).toBeDefined();
    // Click on the first card ('Plant & Heavy Machinery')
    fireEvent.click(viewAssetButtons[0]!);

    // Should switch to Fixed Asset Register tab and show active filter tag
    expect(screen.getByText(/Category: Plant & Heavy Machinery/i)).toBeInTheDocument();
    // Table should contain the Industrial Automatic Fabric Laser Cutter (belonging to Machinery)
    expect(screen.getByText(/Industrial Automatic Fabric Laser Cutter/i)).toBeInTheDocument();
  });

  it('renders Action column with Service and Details buttons in Fixed Asset Register', () => {
    render(
      <MemoryRouter initialEntries={['/assets?tab=assets']}>
        <AssetsWorkspace />
      </MemoryRouter>
    );

    // Table header should have Action column
    expect(screen.getByRole('columnheader', { name: /Action/i })).toBeInTheDocument();

    // Rows should have Service and Details buttons
    const serviceButtons = screen.getAllByRole('button', { name: /Service/i });
    expect(serviceButtons.length).toBeGreaterThanOrEqual(1);

    const detailButtons = screen.getAllByRole('button', { name: /Details/i });
    expect(detailButtons.length).toBeGreaterThanOrEqual(1);
    expect(detailButtons[0]).toBeDefined();

    // Clicking Details should open the modal
    fireEvent.click(detailButtons[0]!);
    expect(screen.getByText(/Asset Specifications:/i)).toBeInTheDocument();
  });

  it('renders Run Depreciation action on Monthly Depreciation Logs tab', () => {
    render(
      <MemoryRouter initialEntries={['/assets?tab=depreciation']}>
        <AssetsWorkspace />
      </MemoryRouter>
    );

    const runDepButtons = screen.getAllByRole('button', { name: /Run Depreciation/i });
    expect(runDepButtons.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Projection Calculator/i })).toBeInTheDocument();
  });

  it('renders QR Tag and Schedule action buttons in Fixed Asset Register and opens QR modal', () => {
    render(
      <MemoryRouter initialEntries={['/assets?tab=assets']}>
        <AssetsWorkspace />
      </MemoryRouter>
    );

    const qrButtons = screen.getAllByRole('button', { name: /QR Tag/i });
    expect(qrButtons.length).toBeGreaterThanOrEqual(1);

    const scheduleButtons = screen.getAllByRole('button', { name: /Schedule/i });
    expect(scheduleButtons.length).toBeGreaterThanOrEqual(1);

    // Clicking QR Tag should open the Asset QR Label Modal
    fireEvent.click(qrButtons[0]!);
    expect(screen.getByText(/Printable QR Asset Label:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print Label/i })).toBeInTheDocument();
  });

  it('opens Depreciation Projection Schedule modal with multi-method calculations and parameter tuning', () => {
    render(
      <MemoryRouter initialEntries={['/assets?tab=assets']}>
        <AssetsWorkspace />
      </MemoryRouter>
    );

    const scheduleButtons = screen.getAllByRole('button', { name: /Schedule/i });
    expect(scheduleButtons[0]).toBeDefined();

    // Click Schedule button on first asset row
    fireEvent.click(scheduleButtons[0]!);
    expect(screen.getByText(/Depreciation Projection Schedule:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Straight-Line \(IAS 16\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Double Declining/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Export CSV/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Critical Maintenance SLA Breach banner and SLA overdue filter & badges on Maintenance tab', () => {
    render(
      <MemoryRouter initialEntries={['/assets?tab=maintenance']}>
        <AssetsWorkspace />
      </MemoryRouter>
    );

    // SLA breach banner should be visible for overdue work orders
    expect(screen.getByText(/CRITICAL MAINTENANCE SLA BREACH:/i)).toBeInTheDocument();

    // SLA Overdue filter chip should be present
    expect(screen.getByRole('button', { name: /SLA Overdue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Due in 7 Days/i })).toBeInTheDocument();

    // Row should show SLA overdue badge
    expect(screen.getAllByText(/SLA Overdue/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Lifecycle Timeline tab with chronological audit events and custom event modal', () => {
    render(
      <MemoryRouter initialEntries={['/assets?tab=timeline']}>
        <AssetsWorkspace />
      </MemoryRouter>
    );

    // Timeline tab heading and milestones
    expect(screen.getByText(/Audit Trail & Operational Milestones/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log Lifecycle Event/i })).toBeInTheDocument();

    // Capital inception milestone should be present
    expect(screen.getByText(/Capital Acquisition & Balance Sheet Capitalization/i)).toBeInTheDocument();

    // Clicking Log Lifecycle Event should open modal
    fireEvent.click(screen.getByRole('button', { name: /Log Lifecycle Event/i }));
    expect(screen.getByText(/Log Lifecycle Audit Event/i)).toBeInTheDocument();
  });
});
