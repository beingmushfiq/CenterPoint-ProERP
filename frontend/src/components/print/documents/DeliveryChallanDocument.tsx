import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeliveryOrder } from '../../../types/api/sales';
import type { BusinessConfig } from '../../../lib/document/useBusinessConfig';
import { formatDocumentDate, formatCurrency } from '../../../lib/document/formatters';
import { generateBarcodeSvg } from '../../../lib/barcode/engine';

export interface DeliveryChallanDocumentProps {
  delivery: DeliveryOrder;
  businessConfig: BusinessConfig;
}

export function DeliveryChallanDocument({ delivery, businessConfig }: DeliveryChallanDocumentProps) {
  const { t } = useTranslation('documents');
  const barcodeSvg = useMemo(() => {
    return generateBarcodeSvg({
      bcid: 'code128',
      text: delivery.delivery_number,
      scale: 1.5,
      height: 8,
      includeText: false,
    });
  }, [delivery.delivery_number]);

  const items = delivery.items ?? [];

  return (
    <div className="print-doc w-full text-slate-900 bg-white text-[9pt] leading-normal font-sans">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-3">
        <div className="max-w-[55%]">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-8 rounded-lg bg-slate-900 text-white font-black text-sm flex items-center justify-center">
              DC
            </div>
            <div>
              <h1 className="text-base font-black text-slate-950 uppercase tracking-tight">
                {businessConfig.name}
              </h1>
              <p className="text-[7.5pt] font-semibold text-slate-600 tracking-wide uppercase">
                {t('deliveryChallanSubtitle')}
              </p>
            </div>
          </div>
          <div className="text-[8pt] text-slate-600 space-y-0.5 mt-1 leading-tight">
            <p>{businessConfig.address}</p>
            <p><span className="font-semibold text-slate-800">Hotline:</span> {businessConfig.phone}</p>
          </div>
        </div>

        <div className="flex flex-col items-end text-right">
          <h2 className="text-lg font-black text-slate-950 uppercase tracking-tight">
            {t('deliveryChallan')}
          </h2>
          <div className="font-mono text-xs font-bold text-slate-950 mb-1">
            {delivery.delivery_number}
          </div>
          <div className="text-[8pt] text-slate-600 font-mono">
            <span>{t('dispatchDate')}: </span>
            <span className="font-bold text-slate-900">{formatDocumentDate(delivery.created_at, true)}</span>
          </div>
        </div>
      </div>

      {/* Recipient & Transport Details */}
      <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-[8.5pt]">
        <div>
          <span className="text-[7.5pt] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            {t('consignee')}
          </span>
          <div className="font-bold text-slate-950 text-[9.5pt]">
            {delivery.recipient_name}
          </div>
          <div className="text-slate-600 mt-0.5 space-y-0.5">
            <p>{t('customerContact')}: <span className="font-mono font-semibold text-slate-900">{delivery.recipient_phone}</span></p>
            <p>{t('destinationAddress')}: <span className="text-slate-800">{delivery.warehouse_name || 'Customer Address'}</span></p>
          </div>
        </div>

        <div className="border-l border-slate-200 pl-4 space-y-1 text-[8pt]">
          <span className="text-[7.5pt] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            {t('waybillManifest')}
          </span>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-600">
            <div>
              <span className="text-slate-500">{t('salesOrder')}:</span>{' '}
              <span className="font-mono font-bold text-slate-900">{delivery.sales_order_number || 'SO-DIRECT'}</span>
            </div>
            <div>
              <span className="text-slate-500">{t('courierFleet')}:</span>{' '}
              <span className="font-semibold text-slate-900 capitalize">{delivery.delivery_type}</span>
            </div>
            <div>
              <span className="text-slate-500">{t('codAmount')}:</span>{' '}
              <span className="font-mono font-bold text-emerald-700">
                {formatCurrency(delivery.cod_amount || '0.00', businessConfig.currencySymbol || '৳')}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t('packages')}:</span>{' '}
              <span className="font-bold text-slate-900">{delivery.package_count || 1} Box(es)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Item Table */}
      <div className="mb-4">
        <table className="w-full text-left border-collapse border border-slate-300 text-[8.5pt]">
          <thead className="bg-slate-100 border-b border-slate-300 text-[7.5pt] font-bold uppercase text-slate-700 tracking-wider">
            <tr>
              <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">#</th>
              <th className="py-2 px-2.5 border-r border-slate-300">{t('item')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-center w-28">{t('batchNo')}</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right w-24">{t('dispatchedQty')}</th>
              <th className="py-2 px-2.5 text-right w-28">{t('receivedQtyCheck')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-slate-500">
                  {idx + 1}
                </td>
                <td className="py-2 px-2.5 border-r border-slate-200 font-bold text-slate-900">
                  {item.product_name || 'Appliance Finished Goods'}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-slate-600">
                  {item.batch_code || 'BAT-2026'}
                </td>
                <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                  {item.quantity} PCS
                </td>
                <td className="py-2 px-2.5 text-right font-mono text-slate-400">
                  [ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Special Instructions & Barcode */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[8pt]">
          <span className="font-bold text-slate-700 block mb-1">{t('driverInstructions')}:</span>
          <p className="text-slate-600">
            {delivery.special_instructions ||
              'Handle electronic appliances and ceramic glass panels with care. Protect from impact and moisture. Verify package seals before handover.'}
          </p>
        </div>
        <div className="flex justify-end items-center">
          <div className="max-w-50" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-6 pt-6 mt-4 border-t border-slate-200 text-center text-[7.5pt] break-inside-avoid">
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('dispatchSupervisor')}
          </div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('vehicleDriver')}
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
