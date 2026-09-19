import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Invoice } from '../../../types/api/sales';
import type { BusinessConfig } from '../../../lib/document/useBusinessConfig';
import { formatCurrency, formatDocumentDate } from '../../../lib/document/formatters';
import { generateBarcodeSvg } from '../../../lib/barcode/engine';

export interface ThermalReceiptProps {
  invoice: Invoice;
  businessConfig: BusinessConfig;
  paperWidth?: '80mm' | '58mm';
  cashierName?: string;
  terminalName?: string;
  tenderedCash?: string;
  changeAmount?: string;
  orderNotes?: string;
}

export function ThermalReceipt({
  invoice,
  businessConfig,
  paperWidth = '80mm',
  cashierName = 'Authorized Cashier',
  terminalName = 'POS-01',
  tenderedCash,
  changeAmount,
  orderNotes,
}: ThermalReceiptProps) {
  const { t: tDoc } = useTranslation('documents');
  const is58mm = paperWidth === '58mm';

  const qrSvg = useMemo(() => {
    const posPrefix = (businessConfig.name || 'POS').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'POS';
    return generateBarcodeSvg({
      bcid: 'qrcode',
      text: `${posPrefix}-POS:${invoice.invoice_number}|AMT:${invoice.total_amount}|BIN:${businessConfig.vatNumber}`,
      scale: 1.2,
      height: 14,
    });
  }, [invoice.invoice_number, invoice.total_amount, businessConfig.vatNumber, businessConfig.name]);

  const items = invoice.items ?? [];

  const currencySymbol = businessConfig.currencySymbol || '৳';

  return (
    <div
      style={{
        width: is58mm ? '52mm' : '74mm',
        margin: '0 auto',
        fontFamily: "'Courier New', Courier, monospace",
      }}
      className="bg-white text-black text-[9pt] leading-tight select-none p-1"
    >
      {/* Header */}
      <div className="text-center space-y-1 pb-2 border-b border-black border-dashed">
        <div className="font-bold text-[11pt] tracking-tight uppercase">
          {businessConfig.name}
        </div>
        <div className="text-[7.5pt]">{businessConfig.tagline}</div>
        <div className="text-[7.5pt]">{businessConfig.address}</div>
        <div className="text-[7.5pt]">
          Phone: {businessConfig.phone} &bull; {businessConfig.vatNumber}
        </div>
      </div>

      {/* Meta */}
      <div className="py-2 text-[8pt] border-b border-black border-dashed space-y-0.5">
        <div className="flex justify-between font-bold">
          <span>{tDoc('thermalReceipt')}:</span>
          <span>{invoice.invoice_number}</span>
        </div>
        <div className="flex justify-between">
          <span>{tDoc('date')}:</span>
          <span>{formatDocumentDate(invoice.invoice_date, true)}</span>
        </div>
        <div className="flex justify-between">
          <span>Terminal:</span>
          <span>{terminalName}</span>
        </div>
        <div className="flex justify-between">
          <span>Cashier:</span>
          <span>{cashierName}</span>
        </div>
        <div className="flex justify-between">
          <span>Customer:</span>
          <span>{invoice.customer_name || 'Walk-in Customer'}</span>
        </div>
      </div>

      {/* Items Table */}
      <div className="py-2 border-b border-black border-dashed text-[8.5pt]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-black border-dashed text-[7.5pt] font-bold">
              <th className="py-1">{tDoc('item')}</th>
              <th className="py-1 text-center">{tDoc('qty')}</th>
              <th className="py-1 text-right">{tDoc('rate')}</th>
              <th className="py-1 text-right">{tDoc('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="align-top">
                <td className="py-1 pr-1 font-bold text-[8pt]">
                  {item.product_name}
                </td>
                <td className="py-1 text-center font-mono">
                  {item.quantity}
                </td>
                <td className="py-1 text-right font-mono">
                  {parseFloat(item.unit_price || '0').toFixed(0)}
                </td>
                <td className="py-1 text-right font-mono font-bold">
                  {parseFloat(item.line_total || '0').toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="py-2 border-b border-black border-dashed text-[8.5pt] space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span className="font-mono">{formatCurrency(invoice.subtotal, currencySymbol)}</span>
        </div>
        {parseFloat(invoice.discount_amount || '0') > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span className="font-mono">- {formatCurrency(invoice.discount_amount, currencySymbol)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>VAT / Tax (Incl.):</span>
          <span className="font-mono">{formatCurrency(invoice.tax_amount, currencySymbol)}</span>
        </div>
        <div className="flex justify-between text-[11pt] font-bold border-t border-black border-dashed pt-1">
          <span>GRAND TOTAL:</span>
          <span className="font-mono">{formatCurrency(invoice.total_amount, currencySymbol)}</span>
        </div>
        <div className="flex justify-between pt-1">
          <span>Paid ({invoice.status === 'paid' ? 'CASH' : 'MFS'}):</span>
          <span className="font-mono font-bold">{formatCurrency(invoice.paid_amount, currencySymbol)}</span>
        </div>
        {tenderedCash && (
          <div className="flex justify-between">
            <span>Tendered Cash:</span>
            <span className="font-mono">{formatCurrency(tenderedCash, currencySymbol)}</span>
          </div>
        )}
        {changeAmount && (
          <div className="flex justify-between font-bold">
            <span>Change Returned:</span>
            <span className="font-mono">{formatCurrency(changeAmount, currencySymbol)}</span>
          </div>
        )}
      </div>

      {/* Order Notes if present */}
      {orderNotes && (
        <div className="py-1.5 border-b border-black border-dashed text-[7.5pt] text-left">
          <span className="font-bold">NOTE: </span>
          <span className="italic">{orderNotes}</span>
        </div>
      )}

      {/* QR & Footer */}
      <div className="text-center pt-3 space-y-2">
        <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="text-[7.5pt] font-bold uppercase tracking-wider">
          *** THANK YOU FOR YOUR VISIT ***
        </div>
        <div className="text-[7pt] text-slate-700">
          Freshness Guaranteed &bull; Please visit again
        </div>
        <div className="text-[6.5pt] text-slate-500 font-mono">
          Powered by {businessConfig.name || 'Enterprise'} FMS
        </div>
      </div>
    </div>
  );
}
