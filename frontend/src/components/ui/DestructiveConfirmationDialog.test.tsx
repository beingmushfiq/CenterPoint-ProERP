import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DestructiveConfirmationDialog } from './DestructiveConfirmationDialog';

describe('DestructiveConfirmationDialog', () => {
  it('renders entity name, code, and impact items', () => {
    const onCancel = vi.fn();
    const onDelete = vi.fn();
    const onArchive = vi.fn();

    render(
      <DestructiveConfirmationDialog
        open={true}
        onClose={onCancel}
        onConfirmDelete={onDelete}
        onArchive={onArchive}
        entityType="Product"
        entityName="Premium Cooker 5L"
        entityCode="SKU-COOKER-001"
        impactItems={[
          { label: 'Active Inventory Records', count: 120, warning: true },
          { label: 'Open Sales Orders', count: 3 },
        ]}
      />
    );

    expect(screen.getByText('Premium Cooker 5L')).toBeInTheDocument();
    expect(screen.getByText('SKU-COOKER-001')).toBeInTheDocument();
    expect(screen.getByText('Active Inventory Records')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('Open Sales Orders')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    const archiveBtn = screen.getByRole('button', { name: /Archive \/ Deactivate/i });
    expect(archiveBtn).toBeInTheDocument();
    fireEvent.click(archiveBtn);
    expect(onArchive).toHaveBeenCalledTimes(1);

    const deleteBtn = screen.getByRole('button', { name: /Delete Permanently/i });
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
