import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { RunSheet } from '../../../types/api/delivery';
import type { BusinessConfig } from '../../../lib/document/useBusinessConfig';
import { DEFAULT_BUSINESS_CONFIG } from '../../../lib/document/useBusinessConfig';
import { formatDocumentDate, formatCurrency } from '../../../lib/document/formatters';
import { generateBarcodeSvg } from '../../../lib/barcode/engine';

export interface RunSheetManifestStop {
  stop_number: number;
  delivery_number: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  items_summary: string;
  package_count: number;
  payment_method: 'COD' | 'Prepaid';
  cod_amount: string;
  cod_collected: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'returned';
  recipient_notes?: string;
}

export interface RiderRunSheetChallanDocumentProps {
  runSheet: RunSheet;
  stops?: RunSheetManifestStop[];
  businessConfig?: BusinessConfig;
}

const SAMPLE_RUN_SHEET_STOPS: Record<string, RunSheetManifestStop[]> = {
  'RS-20260828-001': [
    {
      stop_number: 1,
      delivery_number: 'DO-202608-00101',
      order_number: 'SO-2026-0042',
      customer_name: 'Bengal Textile Mills Ltd (Rahim Chowdhury)',
      customer_phone: '+8801711223344',
      delivery_address: 'Plot 42, Sector 7, Uttara Commercial Area, Dhaka',
      items_summary: 'Infrared Cooker 2200W (2 units), Heating Coils (5 pcs)',
      package_count: 2,
      payment_method: 'COD',
      cod_amount: '8000.00',
      cod_collected: '8000.00',
      status: 'delivered',
      recipient_notes: 'Received by Security Desk (Jamal)',
    },
    {
      stop_number: 2,
      delivery_number: 'DO-202608-00102',
      order_number: 'SO-2026-0045',
      customer_name: 'Urban Retailers Hub (Anika Tabassum)',
      customer_phone: '+8801822334455',
      delivery_address: 'House 14, Road 11, Dhanmondi R/A, Dhaka',
      items_summary: 'Double Burner Gas Stove (2 units), Glass Panels (2 pcs)',
      package_count: 2,
      payment_method: 'COD',
      cod_amount: '9500.00',
      cod_collected: '0.00',
      status: 'in_transit',
      recipient_notes: 'Call before arrival / Leave at reception',
    },
    {
      stop_number: 3,
      delivery_number: 'DO-202608-00103',
      order_number: 'SO-2026-0049',
      customer_name: 'Dhaka Superstore Mart (Zubair Al-Mamun)',
      customer_phone: '+8801712345678',
      delivery_address: 'Shop 4B, Level 1, Gulshan-2 Circle Market, Dhaka',
      items_summary: 'Infrared Cooker 3500W Double Burner (1 unit)',
      package_count: 1,
      payment_method: 'COD',
      cod_amount: '6500.00',
      cod_collected: '0.00',
      status: 'in_transit',
      recipient_notes: 'Store Manager desk handover',
    },
  ],
};

export function RiderRunSheetChallanDocument({
  runSheet,
  stops: propStops,
  businessConfig = DEFAULT_BUSINESS_CONFIG,
}: RiderRunSheetChallanDocumentProps) {
  const { t } = useTranslation('documents');
  const stops: RunSheetManifestStop[] = useMemo(() => {
    if (propStops && propStops.length > 0) return propStops;
    if (SAMPLE_RUN_SHEET_STOPS[runSheet.run_sheet_number]) {
      return SAMPLE_RUN_SHEET_STOPS[runSheet.run_sheet_number]!;
    }
    // Fallback generated stops from count
    return Array.from({ length: runSheet.total_stops || 1 }).map((_, i) => ({
      stop_number: i + 1,
      delivery_number: `DO-202608-${(100 + i + 1).toString()}`,
      order_number: `SO-2026-${(40 + i + 1).toString()}`,
      customer_name: `Customer Account #${i + 1}`,
      customer_phone: '+8801700000000',
      delivery_address: `${runSheet.branch_name || 'Dhaka'}, Delivery Zone ${i + 1}`,
      items_summary: 'Infrared Cooker & Gas Stove Appliance Packages',
      package_count: 1,
      payment_method: 'COD',
      cod_amount: (parseFloat(runSheet.total_cod_expected || '0') / (runSheet.total_stops || 1)).toFixed(2),
      cod_collected: i < (runSheet.completed_stops || 0)
        ? (parseFloat(runSheet.total_cod_expected || '0') / (runSheet.total_stops || 1)).toFixed(2)
        : '0.00',
      status: i < (runSheet.completed_stops || 0) ? 'delivered' : 'pending',
    }));
  }, [propStops, runSheet]);

  const barcodeSvg = useMemo(() => {
    return generateBarcodeSvg({
      bcid: 'code128',
      text: runSheet.run_sheet_number,
      scale: 1.2,
      height: 6,
      includeText: false,
    });
  }, [runSheet.run_sheet_number]);

  const totalCodExpected = stops.reduce((sum, s) => sum + parseFloat(s.cod_amount || '0'), 0);
  const totalCodCollected = stops.reduce((sum, s) => sum + parseFloat(s.cod_collected || '0'), 0);
  const totalPackages = stops.reduce((sum, s) => sum + (s.package_count || 1), 0);

  return (
    <div
      className="print-doc print-single-page w-full text-slate-900 bg-white text-[8pt] leading-snug font-sans p-0 m-0 page-break-avoid"
      style={{
        margin: 0,
        padding: 0,
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        pageBreakAfter: 'avoid',
        breakAfter: 'avoid',
        overflow: 'hidden',
        maxHeight: '100%',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2 mb-2">
        <div className="max-w-[55%]">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-8 rounded bg-slate-900 text-white font-black text-xs flex items-center justify-center tracking-wider">
              {(businessConfig.name || 'Enterprise')
                .split(' ')
                .map((w) => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'EP'}
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-950 uppercase tracking-tight">
                {businessConfig.name || 'Enterprise'}
              </h1>
              <p className="text-[7pt] font-bold text-slate-600 tracking-wider uppercase">
                {t('riderRunSheetSubtitle')} • {t('riderRunSheet')}
              </p>
            </div>
          </div>
          <div className="text-[7.5pt] text-slate-600 space-y-0 leading-tight">
            <p>{businessConfig.address || 'Industrial Processing Zone, Tejgaon I/A, Dhaka'}</p>
            <p>
              <span className="font-semibold text-slate-800">Hotline:</span>{' '}
              {businessConfig.phone || '+880 9612-888999'} • <span className="font-semibold text-slate-800">Dispatch:</span> dispatch@company.com
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end text-right">
          <h2 className="text-sm font-black text-slate-950 uppercase tracking-tight">
            {t('riderRunSheet')}
          </h2>
          <div className="font-mono text-xs font-black text-blue-700 mb-0.5">
            {runSheet.run_sheet_number}
          </div>
          <div className="text-[7.5pt] text-slate-600 font-mono space-y-0.5">
            <div>
              <span>{t('date')}: </span>
              <span className="font-bold text-slate-900">{runSheet.run_date}</span>
            </div>
            <div>
              <span>{t('dispatchDate')}: </span>
              <span className="font-bold text-slate-900">
                {runSheet.dispatched_at
                  ? formatDocumentDate(runSheet.dispatched_at, true)
                  : formatDocumentDate(runSheet.created_at, true)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 bg-slate-50 border border-slate-300 rounded p-2 mb-2 text-[7.5pt]">
        <div>
          <span className="text-[6.5pt] font-bold uppercase tracking-wider text-slate-500 block">
            {t('hubBranch')}
          </span>
          <span className="font-bold text-slate-950 text-[8.5pt]">
            {runSheet.branch_name || 'Dhaka Central Hub'}
          </span>
        </div>
        <div>
          <span className="text-[6.5pt] font-bold uppercase tracking-wider text-slate-500 block">
            {t('riderName')}
          </span>
          <span className="font-bold text-slate-950 text-[8.5pt]">
            {runSheet.rider_name || 'Karim Rider (+8801811111111)'}
          </span>
        </div>
        <div>
          <span className="text-[6.5pt] font-bold uppercase tracking-wider text-slate-500 block">
            {t('totalStops')}
          </span>
          <span className="font-bold text-slate-950 text-[8.5pt]">
            {stops.length} ({totalPackages} Pkgs)
          </span>
        </div>
        <div>
          <span className="text-[6.5pt] font-bold uppercase tracking-wider text-slate-500 block">
            {t('status')}
          </span>
          <span className="inline-block font-mono font-bold text-[7.5pt] text-blue-800 uppercase bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
            {runSheet.status} ({runSheet.completed_stops || 0}/{runSheet.total_stops || stops.length})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2 text-[8pt]">
        <div className="p-2 bg-slate-50 border border-slate-300 rounded">
          <span className="text-[6.5pt] font-bold uppercase tracking-wider text-slate-500 block">
            {t('codExpected')}
          </span>
          <span className="font-mono text-xs font-black text-slate-900">
            {formatCurrency(totalCodExpected.toFixed(2), businessConfig.currencySymbol || '৳')}
          </span>
        </div>
        <div className="p-2 bg-emerald-50 border border-emerald-300 rounded">
          <span className="text-[6.5pt] font-bold uppercase tracking-wider text-emerald-700 block">
            {t('codCollected')}
          </span>
          <span className="font-mono text-xs font-black text-emerald-800">
            {formatCurrency(totalCodCollected.toFixed(2), businessConfig.currencySymbol || '৳')}
          </span>
        </div>
        <div className="p-2 bg-amber-50 border border-amber-300 rounded">
          <span className="text-[6.5pt] font-bold uppercase tracking-wider text-amber-700 block">
            {t('pendingBalance')}
          </span>
          <span className="font-mono text-xs font-black text-amber-900">
            {formatCurrency((totalCodExpected - totalCodCollected).toFixed(2), businessConfig.currencySymbol || '৳')}
          </span>
        </div>
      </div>

      {/* Stop-by-Stop Delivery Manifest Table */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[7.5pt] font-bold uppercase tracking-wider text-slate-800">
            {t('manifestTableTitle')}
          </h3>
          <span className="text-[6.5pt] text-slate-500 font-medium">
            Page 1 of 1 • {t('customerSignature')}
          </span>
        </div>

        <table className="w-full text-left border-collapse border border-slate-300 text-[7.5pt]">
          <thead className="bg-slate-100 border-b border-slate-300 text-[6.5pt] font-bold uppercase text-slate-700 tracking-wider">
            <tr>
              <th className="py-1 px-1 border-r border-slate-300 text-center w-6">#</th>
              <th className="py-1 px-1.5 border-r border-slate-300 w-24">{t('orderNo')} / {t('deliveryNo')}</th>
              <th className="py-1 px-1.5 border-r border-slate-300 w-36">{t('customerContact')}</th>
              <th className="py-1 px-1.5 border-r border-slate-300">{t('destinationAddress')}</th>
              <th className="py-1 px-1.5 border-r border-slate-300 w-32">{t('item')}</th>
              <th className="py-1 px-1.5 border-r border-slate-300 text-right w-16">{t('codAmount')}</th>
              <th className="py-1 px-1.5 border-r border-slate-300 text-center w-14">{t('status')}</th>
              <th className="py-1 px-1.5 text-center w-24">{t('customerSignature')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {stops.map((stop) => (
              <tr key={stop.stop_number} className="hover:bg-slate-50">
                <td className="py-1.5 px-1 border-r border-slate-200 text-center font-bold text-slate-700">
                  {stop.stop_number}
                </td>
                <td className="py-1.5 px-1.5 border-r border-slate-200 font-mono text-[7pt]">
                  <div className="font-bold text-slate-950">{stop.delivery_number}</div>
                  <div className="text-slate-500 text-[6.5pt]">SO: {stop.order_number}</div>
                </td>
                <td className="py-1.5 px-1.5 border-r border-slate-200">
                  <div className="font-bold text-slate-900 leading-tight">{stop.customer_name}</div>
                  <div className="text-[7pt] font-mono text-slate-600">{stop.customer_phone}</div>
                </td>
                <td className="py-1.5 px-1.5 border-r border-slate-200 text-[7pt] text-slate-700 leading-tight">
                  <div>{stop.delivery_address}</div>
                  {stop.recipient_notes && (
                    <div className="text-[6.5pt] text-slate-500 italic">Note: {stop.recipient_notes}</div>
                  )}
                </td>
                <td className="py-1.5 px-1.5 border-r border-slate-200 text-[7pt] text-slate-700 leading-tight">
                  <div>{stop.items_summary}</div>
                  <div className="text-[6.5pt] font-semibold text-slate-500">{stop.package_count} Pkg(s)</div>
                </td>
                <td className="py-1.5 px-1.5 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                  <div>{formatCurrency(stop.cod_amount, businessConfig.currencySymbol || '৳')}</div>
                  <div className="text-[6.5pt] text-slate-500 font-normal uppercase">{stop.payment_method}</div>
                </td>
                <td className="py-1.5 px-1.5 border-r border-slate-200 text-center font-semibold text-[6.5pt]">
                  {stop.status === 'delivered' ? (
                    <span className="text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded uppercase font-bold">
                      {t('delivered')}
                    </span>
                  ) : (
                    <span className="text-amber-700 bg-amber-100 px-1 py-0.5 rounded uppercase font-bold">
                      {t('inTransit')}
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-1.5 text-center text-[6.5pt] text-slate-400">
                  {stop.status === 'delivered' ? (
                    <div className="text-emerald-700 font-bold text-[7pt]">
                      ✓ {t('delivered')}
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-300 rounded h-6 flex items-center justify-center text-[6pt] text-slate-400">
                      {t('customerSignature')}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-slate-900 text-[7.5pt]">
            <tr>
              <td colSpan={4} className="py-1 px-1.5 border-r border-slate-300 text-right uppercase">
                {t('grandTotal')}:
              </td>
              <td className="py-1 px-1.5 border-r border-slate-300 text-left font-mono">
                {totalPackages} Pkgs Total
              </td>
              <td className="py-1 px-1.5 border-r border-slate-300 text-right font-mono text-[8pt] text-emerald-800 font-black">
                {formatCurrency(totalCodExpected.toFixed(2), businessConfig.currencySymbol || '৳')}
              </td>
              <td colSpan={2} className="py-1 px-1.5 text-center text-slate-600 text-[6.5pt]">
                {t('collectedAmount')}: {formatCurrency(totalCodCollected.toFixed(2), businessConfig.currencySymbol || '৳')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="col-span-2 p-1.5 bg-slate-50 border border-slate-200 rounded text-[7pt] leading-tight">
          <span className="font-bold text-slate-800 block mb-0.5">{t('codeOfConductTitle')}:</span>
          <p className="text-slate-600">
            {t('codeOfConductText')}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center p-1 bg-slate-50 border border-slate-200 rounded">
          <div className="w-full flex justify-center" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
          <span className="font-mono text-[6.5pt] text-slate-600 font-bold">
            {runSheet.run_sheet_number}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-300 text-center text-[7pt] break-inside-avoid page-break-avoid">
        <div>
          <div className="border-t border-slate-500 pt-1 font-bold text-slate-900">
            {t('dispatchSupervisor')}
          </div>
          <div className="text-[6.5pt] text-slate-500">{runSheet.branch_name || 'Central Hub'}</div>
        </div>
        <div>
          <div className="border-t border-slate-500 pt-1 font-bold text-slate-900">
            {t('riderSignoff')}
          </div>
          <div className="text-[6.5pt] text-slate-500">{runSheet.rider_name || t('riderName')}</div>
        </div>
        <div>
          <div className="border-t border-slate-500 pt-1 font-bold text-slate-900">
            {t('reconciliationSignoff')}
          </div>
          <div className="text-[6.5pt] text-slate-500">{t('cashierSeal')}</div>
        </div>
      </div>
    </div>
  );
}
