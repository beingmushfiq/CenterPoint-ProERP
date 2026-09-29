import React, { useState, useMemo, useRef } from 'react';
import type { Asset } from '../../../types/api/assets';
import { useCurrency } from '../../../hooks/useCurrency';
import { Modal } from '../../../components/ui/Modal';
import { generateBarcodeSvg } from '../../../lib/barcode/engine';
import {
  Printer,
  Download,
  Copy,
  Check,
  QrCode,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { notify } from '../../../components/ui/Toast';
import { cn } from '../../../lib/utils';

export interface AssetQrLabelModalProps {
  open: boolean;
  onClose: () => void;
  asset: Asset | null;
}

type LabelSize = 'standard' | 'compact' | 'large';

export const AssetQrLabelModal: React.FC<AssetQrLabelModalProps> = ({
  open,
  onClose,
  asset,
}) => {
  const { formatCurrency } = useCurrency();
  const [copied, setCopied] = useState(false);
  const [labelSize, setLabelSize] = useState<LabelSize>('standard');
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Encode structured asset verification data
  const qrDataPayload = useMemo(() => {
    if (!asset) return '';
    return JSON.stringify({
      erp: 'SLICEMART-FMS',
      code: asset.asset_code,
      id: asset.id,
      sn: asset.serial_number || 'N/A',
      name: asset.name,
      cat: asset.category?.name || 'Fixed Asset',
      loc: asset.location || 'Central Facility',
      cap_date: asset.purchase_date,
    });
  }, [asset]);

  // Generate SVG from local barcode engine
  const qrSvg = useMemo(() => {
    if (!qrDataPayload) return '';
    try {
      return generateBarcodeSvg({
        bcid: 'qrcode',
        text: qrDataPayload,
        scale: labelSize === 'large' ? 4 : labelSize === 'compact' ? 2 : 3,
        height: labelSize === 'large' ? 32 : labelSize === 'compact' ? 16 : 24,
        width: labelSize === 'large' ? 32 : labelSize === 'compact' ? 16 : 24,
        includeText: false,
      });
    } catch (err) {
      console.error('Failed generating QR code SVG:', err);
      return '';
    }
  }, [qrDataPayload, labelSize]);

  // Handle Label Printing via isolated iframe or window.print
  const handlePrint = () => {
    if (!printContainerRef.current) return;

    const printContents = printContainerRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=600,height=500');
    if (!printWindow) {
      notify.error('Unable to open print preview. Please check popup blockers.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset QR Tag - ${asset?.asset_code || 'Label'}</title>
          <style>
            @page {
              size: auto;
              margin: 4mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              margin: 0;
              padding: 10px;
              background: #ffffff;
              color: #000000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .tag-card {
              border: 2px solid #000000;
              border-radius: 8px;
              padding: 12px;
              max-width: ${labelSize === 'large' ? '420px' : labelSize === 'compact' ? '280px' : '360px'};
              margin: 0 auto;
              background: #ffffff;
            }
            .tag-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1.5px solid #000000;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .tag-title {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .tag-badge {
              font-size: 8px;
              font-weight: 700;
              background: #000000;
              color: #ffffff;
              padding: 2px 5px;
              border-radius: 3px;
            }
            .tag-body {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .tag-qr svg {
              display: block;
              width: ${labelSize === 'large' ? '120px' : labelSize === 'compact' ? '70px' : '95px'};
              height: ${labelSize === 'large' ? '120px' : labelSize === 'compact' ? '70px' : '95px'};
            }
            .tag-details {
              flex: 1;
              font-size: 10px;
              line-height: 1.35;
            }
            .tag-code {
              font-family: monospace;
              font-size: 13px;
              font-weight: 900;
              color: #000000;
              margin-bottom: 2px;
            }
            .tag-name {
              font-weight: 700;
              font-size: 10px;
              margin-bottom: 4px;
              line-height: 1.2;
            }
            .tag-meta-item {
              font-size: 8.5px;
              color: #222222;
            }
            .tag-footer {
              border-top: 1px dashed #666666;
              margin-top: 8px;
              padding-top: 4px;
              font-size: 8px;
              color: #444444;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${printContents}
        </body>
      </html>
    `);
    printWindow.document.close();
    notify.success('Printing QR Asset Tag...');
  };

  // Download raw SVG
  const handleDownloadSvg = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${asset?.asset_code || 'asset'}-qrcode.svg`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.success('Asset QR code SVG downloaded');
  };

  // Copy raw payload
  const handleCopyPayload = () => {
    if (!qrDataPayload) return;
    navigator.clipboard?.writeText(qrDataPayload);
    setCopied(true);
    notify.success('Asset QR payload copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!asset) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Printable QR Asset Label: ${asset.name}`}
      subtitle={`Asset Code: ${asset.asset_code} • S/N: ${asset.serial_number || 'N/A'}`}
      size="md"
    >
      <div className="space-y-5 pt-1">
        {/* Controls: Size selection & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-surface-sunken rounded-2xl border border-default">
          <div className="flex items-center gap-2">
            <span className="text-2xs uppercase tracking-wider font-semibold text-muted">Format:</span>
            <div className="inline-flex rounded-xl bg-surface p-1 border border-default text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLabelSize('standard')}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition cursor-pointer',
                  labelSize === 'standard'
                    ? 'bg-primary text-primary-fg shadow-2xs font-bold'
                    : 'text-muted hover:text-default'
                )}
              >
                Standard 3"x2"
              </button>
              <button
                type="button"
                onClick={() => setLabelSize('compact')}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition cursor-pointer',
                  labelSize === 'compact'
                    ? 'bg-primary text-primary-fg shadow-2xs font-bold'
                    : 'text-muted hover:text-default'
                )}
              >
                Compact 2"x1"
              </button>
              <button
                type="button"
                onClick={() => setLabelSize('large')}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition cursor-pointer',
                  labelSize === 'large'
                    ? 'bg-primary text-primary-fg shadow-2xs font-bold'
                    : 'text-muted hover:text-default'
                )}
              >
                Plate 4"x3"
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPayload}
              className="px-2.5 py-1.5 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Copy JSON Payload"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-muted" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="px-2.5 py-1.5 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Download QR SVG"
            >
              <Download className="size-3.5" />
              <span>SVG</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-fg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Printer className="size-3.5" />
              <span>Print Label</span>
            </button>
          </div>
        </div>

        {/* Live Thermal Label Preview (Card printed by printer) */}
        <div className="p-6 bg-slate-900/10 dark:bg-black/40 rounded-2xl border border-default flex justify-center items-center">
          <div ref={printContainerRef} className="w-full flex justify-center">
            <div
              className={cn(
                'tag-card bg-white text-slate-900 border-2 border-slate-950 rounded-xl p-4 shadow-md transition-all',
                labelSize === 'large' ? 'max-w-md' : labelSize === 'compact' ? 'max-w-xs' : 'max-w-sm'
              )}
            >
              {/* Header */}
              <div className="tag-header flex items-center justify-between border-b-2 border-slate-950 pb-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <Cpu className="size-3.5 text-slate-950" />
                  <span className="tag-title text-xs font-black uppercase tracking-wider text-slate-950">
                    SLICEMART ENTERPRISE
                  </span>
                </div>
                <span className="tag-badge text-[9px] font-bold bg-slate-950 text-white px-1.5 py-0.5 rounded uppercase">
                  ASSET #{asset.id}
                </span>
              </div>

              {/* Body */}
              <div className="tag-body flex items-center gap-3">
                {/* QR SVG */}
                <div
                  className="tag-qr shrink-0 bg-white p-1 rounded border border-slate-300"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />

                {/* Details */}
                <div className="tag-details flex-1 min-w-0 space-y-1">
                  <div className="tag-code font-mono text-sm font-black text-slate-950 tracking-tight">
                    {asset.asset_code}
                  </div>
                  <div className="tag-name text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                    {asset.name}
                  </div>
                  <div className="tag-meta-item text-[10px] text-slate-600 font-mono">
                    <span className="font-semibold text-slate-800">S/N:</span> {asset.serial_number || 'N/A'}
                  </div>
                  <div className="tag-meta-item text-[10px] text-slate-600">
                    <span className="font-semibold text-slate-800">Class:</span> {asset.category?.name || 'Machinery'}
                  </div>
                  <div className="tag-meta-item text-[10px] text-slate-600 truncate">
                    <span className="font-semibold text-slate-800">Loc:</span> {asset.location || 'Central Plant'}
                  </div>
                  <div className="tag-meta-item text-[9px] text-slate-500 font-mono">
                    Cap: {asset.purchase_date} • {formatCurrency(asset.purchase_cost)}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="tag-footer border-t border-dashed border-slate-400 mt-3 pt-1.5 text-[8.5px] text-slate-500 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-2.5 text-slate-700" />
                  PROPERTY OF SLICEMART FMS
                </span>
                <span>DO NOT REMOVE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Explanatory banner */}
        <div className="p-3 bg-surface-sunken rounded-xl border border-default text-xs flex items-center gap-2.5">
          <QrCode className="size-4 text-primary shrink-0" />
          <p className="text-2xs text-muted leading-relaxed">
            This QR code encodes cryptographic verification parameters for handheld barcode scanners and mobile ERP audit applications. Compatible with Zebra, Brother, and TSC industrial thermal barcode label printers.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-default">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-default hover:bg-surface-sunken transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
