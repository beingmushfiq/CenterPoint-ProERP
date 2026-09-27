import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrintPreviewModal } from './PrintPreviewModal';

const mockPrintDocument = vi.fn();

vi.mock('./useDocumentPrint', () => ({
  useDocumentPrint: () => ({
    printDocument: mockPrintDocument,
    isPrinting: false,
    exportPdf: vi.fn(),
  }),
}));

describe('PrintPreviewModal Component', () => {
  it('does not render when isOpen is false', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <PrintPreviewModal
        isOpen={false}
        onClose={handleClose}
        title="Commercial Invoice"
      >
        <div>Invoice Content</div>
      </PrintPreviewModal>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal header, document title, and child content when isOpen is true', () => {
    const handleClose = vi.fn();
    render(
      <PrintPreviewModal
        isOpen={true}
        onClose={handleClose}
        title="Commercial Invoice Preview"
        documentNumber="INV-202609-001"
        documentType="Tax Invoice"
      >
        <div data-testid="invoice-body">Invoice Line Items</div>
      </PrintPreviewModal>
    );

    expect(screen.getByText('Commercial Invoice Preview')).toBeInTheDocument();
    expect(screen.getByText(/INV-202609-001/i)).toBeInTheDocument();
    expect(screen.getByText(/Tax Invoice/i)).toBeInTheDocument();
    expect(screen.getByTestId('invoice-body')).toBeInTheDocument();
  });

  it('invokes onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <PrintPreviewModal
        isOpen={true}
        onClose={handleClose}
        title="Purchase Order Preview"
      >
        <div>Content</div>
      </PrintPreviewModal>
    );

    const closeBtn = screen.getByTitle(/close preview/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('triggers printDocument when Print button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <PrintPreviewModal
        isOpen={true}
        onClose={handleClose}
        title="Commercial Invoice"
      >
        <div>Content</div>
      </PrintPreviewModal>
    );

    const printBtn = screen.getByRole('button', { name: /^print$/i });
    fireEvent.click(printBtn);
    expect(mockPrintDocument).toHaveBeenCalled();
  });
});
