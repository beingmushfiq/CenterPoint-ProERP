import { useMemo } from 'react';
import type { SalesReturn } from '../../../types/api/sales';
import type { BusinessConfig } from '../../../lib/document/useBusinessConfig';
import {
  formatCurrency,
  formatDocumentDate,
  numberToWords,
} from '../../../lib/document/formatters';
import { generateBarcodeSvg } from '../../../lib/barcode/engine';
import { useTranslation } from 'react-i18next';

export interface CreditNoteDocumentProps {
  salesReturn: SalesReturn;
  businessConfig: BusinessConfig;
}

export function CreditNoteDocument({ salesReturn, businessConfig }: CreditNoteDocumentProps) {
  const { t } = useTranslation('documents');
  const barcodeSvg = useMemo(() => {
    return generateBarcodeSvg({
      bcid: 'code128',
      text: salesReturn.return_number,
      scale: 1.5,
      height: 8,
      includeText: false,
    });
  }, [salesReturn.return_number]);

  const items = salesReturn.items ?? [];
  const currencySymbol = businessConfig.currencySymbol || '$';

  return (
    <div className="print-doc w-full text-slate-900 bg-white text-[9pt] leading-normal font-sans">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-3">
        <div className="max-w-[55%]">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-8 rounded-lg bg-slate-900 text-white font-black text-sm flex items-center justify-center">
              CN
            </div>
            <div>
              <h1 className="text-base font-black text-slate-950 uppercase tracking-tight">
                {businessConfig.name}
              </h1>
              <p className="text-[7.5pt] font-semibold text-slate-600 tracking-wide uppercase">
                {t('creditNoteSubtitle')}
              </p>
            </div>
          </div>
          <div className="text-[8pt] text-slate-600 space-y-0.5 mt-1 leading-tight">
            <p>{businessConfig.address}</p>
          </div>
        </div>

        <div className="flex flex-col items-end text-right">
          <h2 className="text-lg font-black text-slate-950 uppercase tracking-tight">
            {t('creditNote')}
          </h2>
          <div className="font-mono text-xs font-bold text-slate-950 mb-1">
            {salesReturn.credit_note_number || salesReturn.return_number}
          </div>
          <div className="text-[8pt] text-slate-600 font-mono">
            <span>{t('date')}: </span>
            <span className="font-bold text-slate-900">{formatDocumentDate(salesReturn.return_date)}</span>
          </div>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-4 text-[8pt]">
        <div>
          <span className="text-slate-500 block uppercase text-[7pt] font-bold">{t('creditedCustomer')}</span>
          <span className="font-bold text-slate-900 text-[9pt]">{salesReturn.customer_name || 'Retail Client'}</span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase text-[7pt] font-bold">{t('originalInvoice')}</span>
          <span className="font-mono font-bold text-slate-900">
            {salesReturn.invoice_number || (salesReturn.invoice_id ? `#${salesReturn.invoice_id}` : '—')}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase text-[7pt] font-bold">{t('refundMethod')}</span>
          <span className="font-bold uppercase text-slate-900">{salesReturn.refund_method || 'Store Credit'}</span>
        </div>
      </div>

      {/* Returned Items Table */}
      <div className="mb-4">
        <table className="w-full text-left border-collapse border border-slate-300 text-[8.5pt]">
          <thead className="bg-slate-100 border-b border-slate-300 text-[7.5pt] font-bold uppercase text-slate-700 tracking-wider">
            <tr>
              <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">#</th>
              <th className="py-2 px-2.5 border-r border-slate-300">{t('returnedProduct')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-center w-20">{t('condition')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right w-16">{t('qty')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right w-20">{t('unitRate')} ({currencySymbol})</th>
              <th className="py-2 px-2.5 text-right w-24">{t('creditValue')} ({currencySymbol})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-slate-500">
                  {idx + 1}
                </td>
                <td className="py-2 px-2.5 border-r border-slate-200 font-bold text-slate-900">
                  {item.product_name || 'Product'}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-center uppercase text-[7.5pt] font-semibold text-slate-700">
                  {item.condition}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                  {item.quantity}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-right font-mono text-slate-700">
                  {parseFloat(item.unit_price || '0').toFixed(2)}
                </td>
                <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-950">
                  {parseFloat(item.line_total || '0').toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-7 space-y-2">
          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[8pt]">
            <span className="font-bold text-slate-700 block">{t('inWords')}:</span>
            <p className="font-bold italic text-slate-950">
              {numberToWords(salesReturn.total_amount, 'Taka', 'Paisa')}
            </p>
          </div>
          <div className="max-w-50" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
        </div>

        <div className="col-span-5 border border-slate-300 rounded-lg overflow-hidden text-[8.5pt]">
          <div className="divide-y divide-slate-200 px-3 py-1">
            <div className="flex justify-between py-1 text-slate-600">
              <span>{t('subtotal')}:</span>
              <span className="font-mono">{formatCurrency(salesReturn.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>{t('taxAdjusted')}:</span>
              <span className="font-mono">{formatCurrency(salesReturn.tax_amount)}</span>
            </div>
            <div className="flex justify-between py-1.5 font-bold text-slate-950 text-[10pt] border-t-2 border-slate-900 bg-slate-50">
              <span>{t('totalCreditedAmount')}:</span>
              <span className="font-mono text-emerald-800">{formatCurrency(salesReturn.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-6 pt-6 mt-3 border-t border-slate-200 text-center text-[7.5pt] break-inside-avoid">
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('returnsInspector')}
          </div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('creditApproval')}
          </div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('receivedBy')}
          </div>
        </div>
      </div>
    </div>
  );
}
