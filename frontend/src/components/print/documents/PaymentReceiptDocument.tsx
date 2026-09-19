import { useMemo } from 'react';
import type { Payment } from '../../../types/api/sales';
import type { BusinessConfig } from '../../../lib/document/useBusinessConfig';
import {
  formatCurrency,
  formatDocumentDate,
  numberToWords,
} from '../../../lib/document/formatters';
import { generateBarcodeSvg } from '../../../lib/barcode/engine';
import { useTranslation } from 'react-i18next';

export interface PaymentReceiptDocumentProps {
  payment: Payment;
  businessConfig: BusinessConfig;
}

export function PaymentReceiptDocument({ payment, businessConfig }: PaymentReceiptDocumentProps) {
  const { t } = useTranslation('documents');
  const barcodeSvg = useMemo(() => {
    return generateBarcodeSvg({
      bcid: 'code128',
      text: payment.payment_number,
      scale: 1.5,
      height: 8,
      includeText: false,
    });
  }, [payment.payment_number]);

  return (
    <div className="print-doc w-full text-slate-900 bg-white text-[9pt] leading-normal font-sans">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-3">
        <div className="max-w-[55%]">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-8 rounded-lg bg-slate-900 text-white font-black text-sm flex items-center justify-center">
              MR
            </div>
            <div>
              <h1 className="text-base font-black text-slate-950 uppercase tracking-tight">
                {businessConfig.name}
              </h1>
              <p className="text-[7.5pt] font-semibold text-slate-600 tracking-wide uppercase">
                {t('moneyReceiptSubtitle')}
              </p>
            </div>
          </div>
          <div className="text-[8pt] text-slate-600 space-y-0.5 mt-1 leading-tight">
            <p>{businessConfig.address}</p>
          </div>
        </div>

        <div className="flex flex-col items-end text-right">
          <h2 className="text-lg font-black text-slate-950 uppercase tracking-tight">
            {t('moneyReceipt')}
          </h2>
          <div className="font-mono text-xs font-bold text-slate-950 mb-1">
            {payment.payment_number}
          </div>
          <div className="text-[8pt] text-slate-600 font-mono">
            <span>{t('paymentDate')}: </span>
            <span className="font-bold text-slate-900">{formatDocumentDate(payment.payment_date, true)}</span>
          </div>
        </div>
      </div>

      {/* Main Receipt Body Box */}
      <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-3 mb-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <span className="text-slate-600">{t('receivedWithThanks')}:</span>
          <span className="font-bold text-slate-950 text-[10pt] uppercase">
            {payment.customer_name || 'Designated Customer / Client'}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <span className="text-slate-600">{t('theSumOf')}:</span>
          <span className="font-mono font-black text-[11pt] text-emerald-800">
            {formatCurrency(payment.amount, payment.currency_code || businessConfig.currencySymbol || '৳')}
          </span>
        </div>

        <div className="border-b border-slate-200 pb-2">
          <span className="text-[7.5pt] font-bold text-slate-500 uppercase block mb-0.5">{t('inWords')}:</span>
          <p className="font-bold italic text-slate-900 text-[8.5pt]">
            {numberToWords(
              payment.amount,
              payment.currency_code === 'BDT' ? 'Taka' : (payment.currency_code || 'Units'),
              payment.currency_code === 'BDT' ? 'Paisa' : 'Cents'
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[8pt] pt-1">
          <div>
            <span className="text-slate-500 block">{t('paymentInstrument')}</span>
            <span className="font-bold uppercase text-slate-900">{payment.method}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{t('transactionRef')}</span>
            <span className="font-mono font-bold text-slate-900">{payment.reference_number || 'TXN-CASH'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{t('receiptDirection')}</span>
            <span className="font-bold text-emerald-700 uppercase">
              {payment.direction === 'in' ? t('inwardCollection') : t('disbursement')}
            </span>
          </div>
        </div>

        {payment.notes && (
          <div className="text-[8pt] text-slate-600 pt-2 border-t border-slate-200">
            <span className="font-bold text-slate-700">{t('particulars')}: </span>
            <span>{payment.notes}</span>
          </div>
        )}
      </div>

      {/* Barcode */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-[7.5pt] text-slate-500 italic max-w-sm">
          {t('receiptNotice')}
        </div>
        <div className="max-w-50" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 pt-14 mt-6 border-t border-slate-200 text-center text-[7.5pt] break-inside-avoid">
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('customerSignature')}
          </div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
            {t('cashierSeal')}
          </div>
        </div>
      </div>
    </div>
  );
}
