import React, { useState, useEffect } from 'react';
import {
  Printer,
  FileDown,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';
import { useDocumentPrint } from './useDocumentPrint';

export interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documentNumber?: string;
  documentType?: string;
  pageClass?:
    | 'print-page-a4'
    | 'print-page-a4-landscape'
    | 'print-page-a3-landscape'
    | 'print-page-thermal-80'
    | 'print-page-thermal-58'
    | 'print-page-label-sheet'
    | 'print-page-label-35x25'
    | 'print-page-label-50x35';
  children: React.ReactNode;
}

export function PrintPreviewModal({
  isOpen,
  onClose,
  title,
  documentNumber,
  documentType = 'Commercial Document',
  pageClass = 'print-page-a4',
  children,
}: PrintPreviewModalProps) {
  const { printDocument, isPrinting } = useDocumentPrint();
  const [zoom, setZoom] = useState<number>(100);
  const previewContainerRef = React.useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState<number>(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const updateScale = () => {
      if (!previewContainerRef.current) return;
      const containerWidth = previewContainerRef.current.clientWidth - 32;
      // Sheet widths in approximate px at 96 DPI: A4 Portrait is ~794px, Landscape is ~1123px, Thermal 80 is ~302px, etc.
      let sheetWidth = 794;
      if (pageClass.includes('landscape')) sheetWidth = 1123;
      else if (pageClass.includes('thermal-80')) sheetWidth = 302;
      else if (pageClass.includes('thermal-58')) sheetWidth = 220;
      else if (pageClass.includes('label')) sheetWidth = 350;

      if (containerWidth < sheetWidth) {
        setAutoScale(Math.max(0.35, Math.min(1, containerWidth / sheetWidth)));
      } else {
        setAutoScale(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [pageClass, isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    printDocument(children as React.ReactElement, {
      documentTitle: documentNumber ? `${documentNumber}.pdf` : `${title}.pdf`,
      pageClass,
    });
  };

  const getSheetContainerClass = () => {
    switch (pageClass) {
      case 'print-page-a4-landscape':
      case 'print-page-a3-landscape':
        return 'document-preview-sheet-a4-landscape';
      case 'print-page-thermal-80':
        return 'document-preview-thermal-80';
      case 'print-page-thermal-58':
        return 'document-preview-thermal-58';
      case 'print-page-label-35x25':
        return 'document-preview-label-35x25';
      case 'print-page-label-50x35':
        return 'document-preview-label-50x35';
      case 'print-page-label-sheet':
      case 'print-page-a4':
      default:
        return 'document-preview-sheet-a4';
    }
  };

  const getFormatBadge = () => {
    switch (pageClass) {
      case 'print-page-a4':
        return 'A4 Portrait (210 × 297 mm)';
      case 'print-page-a4-landscape':
        return 'A4 Landscape (297 × 210 mm)';
      case 'print-page-a3-landscape':
        return 'A3 Landscape (420 × 297 mm)';
      case 'print-page-thermal-80':
        return '80mm POS Thermal Roll';
      case 'print-page-thermal-58':
        return '58mm POS Thermal Roll';
      case 'print-page-label-sheet':
        return 'A4 Label Sheet (Die-cut)';
      case 'print-page-label-35x25':
        return '35 × 25 mm Label Roll';
      case 'print-page-label-50x35':
        return '50 × 35 mm Label Roll';
      default:
        return 'Standard Sheet';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 backdrop-blur-sm text-slate-800 animate-in fade-in duration-200">
      {/* Top Action Bar */}
      <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-slate-700 bg-slate-900 px-3 sm:px-4 py-2.5 sm:py-0 sm:h-14 text-white shrink-0">
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Back button */}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer shadow-xs shrink-0 touch-target"
              title="Return to Setup / Editor"
            >
              <ArrowLeft className="size-4 text-emerald-400" />
              <span className="hidden xs:inline">Back</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">{title}</h2>
                {documentNumber && (
                  <span className="hidden sm:inline font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                    {documentNumber}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                <span>{documentType}</span> &bull;{' '}
                <span className="text-emerald-400 font-medium">{getFormatBadge()}</span>
                {autoScale < 1 && (
                  <span className="ml-1.5 text-amber-400 font-mono">
                    (Fitted {Math.round(autoScale * 100)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-between sm:justify-center gap-1 bg-slate-800/80 px-2 sm:px-3 py-1 rounded-xl border border-slate-700/80 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z - 10, 40))}
            disabled={zoom <= 40}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 cursor-pointer touch-target sm:min-w-0 sm:min-h-0"
            title="Zoom Out"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <span className="font-mono text-[11px] sm:text-xs font-bold w-12 text-center text-slate-200">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z + 10, 200))}
            disabled={zoom >= 200}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 cursor-pointer touch-target sm:min-w-0 sm:min-h-0"
            title="Zoom In"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer touch-target sm:min-w-0 sm:min-h-0"
            title="Reset Zoom"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer touch-target"
          >
            <FileDown className="size-3.5 text-blue-400" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 sm:px-4 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-sm transition-all cursor-pointer touch-target"
          >
            <Printer className="size-3.5" />
            <span>{isPrinting ? 'Preparing...' : 'Print'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer touch-target shrink-0"
            title="Close Preview (Esc)"
          >
            <X className="size-5" />
          </button>
        </div>
      </header>

      {/* Main Preview Area */}
      <main
        ref={previewContainerRef}
        className="flex-1 overflow-auto bg-slate-950/60 p-2 sm:p-6 md:p-8 flex justify-center items-start"
      >
        <div
          style={{
            transform: `scale(${(zoom / 100) * autoScale})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="print-doc"
        >
          <div className={getSheetContainerClass()}>{children}</div>
        </div>
      </main>
    </div>
  );
}
