import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PurchaseOrder } from '../../../types/api/purchasing';
import type { BusinessConfig } from '../../../lib/document/useBusinessConfig';
import {
  formatCurrency,
  formatDocumentDate,
  numberToWords,
} from '../../../lib/document/formatters';
import { generateBarcodeSvg } from '../../../lib/barcode/engine';

export interface PurchaseOrderDocumentProps {
  po: PurchaseOrder;
  businessConfig: BusinessConfig;
}

export function PurchaseOrderDocument({ po, businessConfig }: PurchaseOrderDocumentProps) {
  const { t } = useTranslation('documents');
  const barcodeSvg = useMemo(() => {
    return generateBarcodeSvg({
      bcid: 'code128',
      text: po.po_number,
      scale: 1.5,
      height: 8,
      includeText: false,
    });
  }, [po.po_number]);

  const items = po.items ?? [];
  const currencySymbol = businessConfig.currencySymbol || '$';

  return (
    <div className="print-doc w-full text-slate-900 bg-white text-[9pt] leading-normal font-sans">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-3">
        <div className="max-w-[55%]">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-8 rounded-lg bg-slate-900 text-white font-black text-sm flex items-center justify-center">
              PO
            </div>
            <div>
              <h1 className="text-base font-black text-slate-950 uppercase tracking-tight">
                {businessConfig.name}
              </h1>
              <p className="text-[7.5pt] font-semibold text-slate-600 tracking-wide uppercase">
                {t('procurementDivision')}
              </p>
            </div>
          </div>
          <div className="text-[8pt] text-slate-600 space-y-0.5 mt-1.5 leading-tight">
            <p>{businessConfig.address}</p>
            <p>
              <span className="font-semibold text-slate-800">Phone:</span> {businessConfig.phone} &bull;{' '}
              <span className="font-semibold text-slate-800">Email:</span> {businessConfig.email}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end text-right">
          <h2 className="text-lg font-black text-slate-950 uppercase tracking-tight">
            {t('purchaseOrder')}
          </h2>
          <div className="font-mono text-xs font-bold text-slate-950 mb-1">
            {po.po_number}
          </div>
          <div className="text-[8pt] text-slate-600 space-y-0.5 font-mono">
            <div>
              <span className="text-slate-500 font-sans">{t('date')}: </span>
              <span className="font-bold text-slate-900">{formatDocumentDate(po.order_date)}</span>
            </div>
            <div>
              <span className="text-slate-500 font-sans">{t('expectedDelivery')}: </span>
              <span className="font-bold text-slate-900">{formatDocumentDate(po.expected_delivery_date)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Supplier & Delivery Destination */}
      <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-[8.5pt]">
        <div>
          <span className="text-[7.5pt] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            {t('vendorDetails')}
          </span>
          <div className="font-bold text-slate-950 text-[9.5pt]">
            {po.supplier_name || t('supplier')}
          </div>
          <div className="text-slate-600 mt-0.5 space-y-0.5">
            <p>{t('supplier')}: <span className="font-mono font-semibold text-slate-800">VEN-{po.party_id || '001'}</span></p>
            <p>{t('termsConditions')}: <span className="font-medium text-slate-800">Net 30 Days</span></p>
          </div>
        </div>

        <div className="border-l border-slate-200 pl-4 space-y-1">
          <span className="text-[7.5pt] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            {t('shippingDestination')}
          </span>
          <div className="font-bold text-slate-900">
            {po.warehouse_name || 'Central Silo & Raw Materials Warehouse'}
          </div>
          <p className="text-slate-600 text-[8pt]">
            {t('destinationAddress')}: Plot 42, Tejgaon I/A, Dhaka - 1208, Bangladesh
          </p>
        </div>
      </div>

      {/* Item Table */}
      <div className="mb-4">
        <table className="w-full text-left border-collapse border border-slate-300 text-[8.5pt]">
          <thead className="bg-slate-100 border-b border-slate-300 text-[7.5pt] font-bold uppercase text-slate-700 tracking-wider">
            <tr>
              <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">#</th>
              <th className="py-2 px-2.5 border-r border-slate-300">{t('item')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right w-20">{t('receivedQty')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-center w-14">{t('unit')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right w-24">{t('rate')} ({currencySymbol})</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right w-20">{t('vatTax')} ({currencySymbol})</th>
              <th className="py-2 px-2.5 text-right w-28">{t('amount')} ({currencySymbol})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-slate-500">
                  {idx + 1}
                </td>
                <td className="py-2 px-2.5 border-r border-slate-200">
                  <div className="font-bold text-slate-900">{item.product_name || 'Raw Material'}</div>
                  <div className="font-mono text-[7.5pt] text-slate-500">{item.product_sku}</div>
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                  {item.quantity}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-slate-600">
                  {item.unit_code || 'KG'}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-right font-mono text-slate-700">
                  {parseFloat(item.unit_price || '0').toFixed(2)}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-right font-mono text-slate-500">
                  {parseFloat(item.tax_amount || '0').toFixed(2)}
                </td>
                <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-950">
                  {parseFloat(item.total_amount || '0').toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-12 gap-4 mb-5 break-inside-avoid">
        <div className="col-span-7 space-y-2">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[7pt] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              {t('orderValuationInWords')}
            </span>
            <p className="font-bold text-slate-900 italic text-[8.5pt]">
              {numberToWords(po.grand_total, 'Taka', 'Paisa')}
            </p>
          </div>
          {po.notes && (
            <div className="text-[7.5pt] text-slate-600 p-2 bg-slate-50/50 rounded border border-slate-200">
              <span className="font-bold uppercase text-slate-700 block">{t('termsConditions')}:</span>
              <p>{po.notes}</p>
            </div>
          )}
          <div className="pt-2 max-w-50" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
        </div>

        <div className="col-span-5 border border-slate-300 rounded-lg overflow-hidden text-[8.5pt]">
          <div className="divide-y divide-slate-200 px-3 py-1">
            <div className="flex justify-between py-1 text-slate-600">
              <span>{t('subtotal')}:</span>
              <span className="font-mono">{formatCurrency(po.subtotal_amount)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>{t('vatTax')}:</span>
              <span className="font-mono">{formatCurrency(po.tax_amount)}</span>
            </div>
            <div className="flex justify-between py-1.5 font-bold text-slate-950 text-[10pt] border-t-2 border-slate-900 bg-slate-50">
              <span>{t('grandTotal')}:</span>
              <span className="font-mono">{formatCurrency(po.grand_total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-6 pt-6 mt-3 border-t border-slate-200 text-center text-[7.5pt] break-inside-avoid">
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('procurementOfficer')}
          </div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('factoryOperationsHead')}
          </div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('supplierAcceptanceSeal')}
          </div>
        </div>
      </div>
    </div>
  );
}
