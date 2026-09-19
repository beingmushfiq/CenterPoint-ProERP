import { useMemo } from 'react';
import type { GoodsReceipt } from '../../../types/api/purchasing';
import type { BusinessConfig } from '../../../lib/document/useBusinessConfig';
import { formatDocumentDate } from '../../../lib/document/formatters';
import { generateBarcodeSvg } from '../../../lib/barcode/engine';
import { useTranslation } from 'react-i18next';

export interface GoodsReceiptDocumentProps {
  grn: GoodsReceipt;
  businessConfig: BusinessConfig;
}

export function GoodsReceiptDocument({ grn, businessConfig }: GoodsReceiptDocumentProps) {
  const { t } = useTranslation('documents');
  const barcodeSvg = useMemo(() => {
    return generateBarcodeSvg({
      bcid: 'code128',
      text: grn.grn_number,
      scale: 1.5,
      height: 8,
      includeText: false,
    });
  }, [grn.grn_number]);

  const items = grn.items ?? [];

  return (
    <div className="print-doc w-full text-slate-900 bg-white text-[9pt] leading-normal font-sans">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-3">
        <div className="max-w-[55%]">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-8 rounded-lg bg-slate-900 text-white font-black text-sm flex items-center justify-center">
              GRN
            </div>
            <div>
              <h1 className="text-base font-black text-slate-950 uppercase tracking-tight">
                {businessConfig.name}
              </h1>
              <p className="text-[7.5pt] font-semibold text-slate-600 tracking-wide uppercase">
                {t('grnSubtitle')}
              </p>
            </div>
          </div>
          <div className="text-[8pt] text-slate-600 space-y-0.5 mt-1 leading-tight">
            <p>{businessConfig.address}</p>
          </div>
        </div>

        <div className="flex flex-col items-end text-right">
          <h2 className="text-lg font-black text-slate-950 uppercase tracking-tight">
            {t('goodsReceipt')}
          </h2>
          <div className="font-mono text-xs font-bold text-slate-950 mb-1">
            {grn.grn_number}
          </div>
          <div className="text-[8pt] text-slate-600 font-mono">
            <span>{t('receivedDate')}: </span>
            <span className="font-bold text-slate-900">{formatDocumentDate(grn.receipt_date, true)}</span>
          </div>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-4 text-[8pt]">
        <div>
          <span className="text-slate-500 block uppercase text-[7pt] font-bold">{t('supplier')}</span>
          <span className="font-bold text-slate-900 text-[9pt]">{grn.supplier_name || 'Designated Supplier'}</span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase text-[7pt] font-bold">{t('poReference')}</span>
          <span className="font-mono font-bold text-slate-900">{grn.po_number || 'DIRECT-RECEIPT'}</span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase text-[7pt] font-bold">{t('supplierChallan')}</span>
          <span className="font-mono font-bold text-slate-900">{grn.supplier_document_number || 'CH-2026-99'}</span>
        </div>
      </div>

      {/* Table */}
      <div className="mb-4">
        <table className="w-full text-left border-collapse border border-slate-300 text-[8.5pt]">
          <thead className="bg-slate-100 border-b border-slate-300 text-[7.5pt] font-bold uppercase text-slate-700 tracking-wider">
            <tr>
              <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">#</th>
              <th className="py-2 px-2.5 border-r border-slate-300">{t('item')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-center w-24">{t('batchNo')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right w-20">{t('receivedQty')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right w-20">{t('acceptedQty')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right w-20 text-rose-600">{t('rejectedQty')}</th>
              <th className="py-2 px-2.5 text-center w-14">{t('unit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-slate-500">
                  {idx + 1}
                </td>
                <td className="py-2 px-2.5 border-r border-slate-200 font-bold text-slate-900">
                  {item.product_name || 'Material Item'}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-[8pt]">
                  {item.batch_code || 'BAT-AUTO'}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-right font-mono text-slate-800">
                  {item.received_quantity}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">
                  {item.accepted_quantity}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-bold text-rose-600">
                  {item.rejected_quantity}
                </td>
                <td className="py-2 px-2.5 text-center font-mono text-slate-600">
                  {item.unit_code || 'KG'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes & Barcode */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[8pt]">
          <span className="font-bold text-slate-700 block mb-1">{t('qaNotes')}:</span>
          <p className="text-slate-600">{grn.notes || 'All accepted items passed sensory and quality control screening. Routed to designated Silo Bin.'}</p>
        </div>
        <div className="flex justify-end items-center">
          <div className="max-w-50" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-6 pt-6 mt-3 border-t border-slate-200 text-center text-[7.5pt] break-inside-avoid">
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('unloadingSupervisor')}
          </div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('qaInspector')}
          </div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('storekeeperSignoff')}
          </div>
        </div>
      </div>
    </div>
  );
}
