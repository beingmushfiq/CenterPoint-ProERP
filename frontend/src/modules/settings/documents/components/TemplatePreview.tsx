import type { DocumentType, DocumentTemplateLayoutConfig } from '../../../../types/api/documents';
import type { Invoice, DeliveryOrder, Payment } from '../../../../types/api/sales';
import type { PurchaseOrder, GoodsReceipt } from '../../../../types/api/purchasing';
import type { LabelProductItem } from '../../../../lib/barcode/types';
import { useBusinessConfig } from '../../../../lib/document/useBusinessConfig';
import { SalesInvoiceDocument } from '../../../../components/print/documents/SalesInvoiceDocument';
import { DeliveryChallanDocument } from '../../../../components/print/documents/DeliveryChallanDocument';
import { PurchaseOrderDocument } from '../../../../components/print/documents/PurchaseOrderDocument';
import { GoodsReceiptDocument } from '../../../../components/print/documents/GoodsReceiptDocument';
import { PaymentReceiptDocument } from '../../../../components/print/documents/PaymentReceiptDocument';
import { ThermalReceipt } from '../../../../components/print/receipts/ThermalReceipt';
import { BarcodeLabel } from '../../../../components/print/labels/BarcodeLabel';

export interface TemplatePreviewProps {
  documentType: DocumentType;
  layoutConfig?: DocumentTemplateLayoutConfig | undefined;
  paperCode?: string | undefined;
  orientation?: ('portrait' | 'landscape') | undefined;
  scale?: number | undefined;
}

export function TemplatePreview({
  documentType,
  layoutConfig,
  paperCode = 'a4_portrait',
  orientation = 'portrait',
  scale = 0.85,
}: TemplatePreviewProps) {
  const { config: businessConfig } = useBusinessConfig();

  // Sample data payload
  const sampleInvoice: Invoice = {
    id: 1,
    uuid: 'sample-inv-uuid',
    invoice_number: 'INV-2026-000042',
    sales_order_number: 'SO-202608-019',
    customer_name: 'Apex Industrial Bakeries Ltd.',
    invoice_date: '2026-08-31',
    due_date: '2026-09-30',
    subtotal: '45200.00',
    tax_amount: '6780.00',
    discount_amount: '1200.00',
    shipping_amount: '500.00',
    round_off: '0.00',
    total_amount: '51280.00',
    paid_amount: '25000.00',
    due_amount: '26280.00',
    status: 'partially_paid',
    printed_count: 1,
    items: [
      {
        id: 1,
        uuid: 'inv-item-1',
        invoice_id: 1,
        product_id: 1,
        product_name: 'Infrared Cooker 2200W (SM-IC220)',
        description: 'FG-IC-2200',
        quantity: '10',
        unit_price: '3200.00',
        discount_amount: '500.00',
        tax_amount: '4725.00',
        line_total: '31500.00',
      },
      {
        id: 2,
        uuid: 'inv-item-2',
        invoice_id: 1,
        product_id: 2,
        product_name: 'Double Burner Gas Stove (Toughened Glass)',
        description: 'FG-GS-DOUBLE',
        quantity: '4',
        unit_price: '4800.00',
        discount_amount: '700.00',
        tax_amount: '2775.00',
        line_total: '18500.00',
      },
    ],
  };

  const sampleChallan: DeliveryOrder = {
    id: 1,
    uuid: 'sample-chl-uuid',
    delivery_number: 'CHL-2026-000018',
    sales_order_id: 1,
    sales_order_number: 'SO-202608-019',
    warehouse_id: 1,
    recipient_name: 'Apex Retail Appliances Ltd.',
    recipient_phone: '+880 1711-223344',
    delivery_type: 'road_courier',
    status: 'delivered',
    cod_amount: '0.00',
    cod_collected_amount: '0.00',
    cod_status: 'none',
    delivery_charge: '500.00',
    package_count: 14,
    items: [
      {
        id: 1,
        uuid: 'chl-item-1',
        delivery_order_id: 1,
        product_id: 1,
        product_name: 'Infrared Cooker 2200W (SM-IC220)',
        batch_code: 'BAT-IC-202608',
        quantity: '10',
        delivered_quantity: '10',
        returned_quantity: '0',
        unit_id: 2,
      },
    ],
  };

  const samplePO: PurchaseOrder = {
    id: 1,
    uuid: 'sample-po-uuid',
    po_number: 'PO-2026-000088',
    party_id: 1,
    supplier_name: 'Bengal Glass & Ceramic Ltd.',
    warehouse_id: 1,
    warehouse_name: 'Tejgaon Central Parts Warehouse',
    order_date: '2026-08-31',
    expected_delivery_date: '2026-09-07',
    currency_code: businessConfig.currencyCode || 'BDT',
    exchange_rate: '1.0',
    subtotal_amount: '90000.00',
    discount_amount: '0.00',
    tax_amount: '13500.00',
    grand_total: '103500.00',
    received_value: '0.00',
    billed_value: '0.00',
    status: 'approved',
    items: [
      {
        id: 1,
        uuid: 'po-item-1',
        purchase_order_id: 1,
        product_id: 1,
        product_name: 'Microcrystalline Ceramic Glass Panel (280x360mm)',
        quantity: '200',
        unit_id: 2,
        unit_code: 'PCS',
        unit_price: '450.00',
        discount_amount: '0.00',
        tax_rate: '15.00',
        tax_amount: '13500.00',
        subtotal_amount: '90000.00',
        total_amount: '103500.00',
        received_quantity: '0',
        billed_quantity: '0',
      },
    ],
  };

  const sampleGRN: GoodsReceipt = {
    id: 1,
    uuid: 'sample-grn-uuid',
    grn_number: 'GRN-2026-000031',
    party_id: 1,
    supplier_name: 'Bengal Glass & Ceramic Ltd.',
    warehouse_id: 1,
    warehouse_name: 'Tejgaon Central Parts Warehouse',
    purchase_order_id: 1,
    po_number: 'PO-2026-000088',
    receipt_date: '2026-08-31',
    status: 'completed',
    items: [
      {
        id: 1,
        uuid: 'grn-item-1',
        goods_receipt_id: 1,
        product_id: 1,
        product_name: 'Microcrystalline Ceramic Glass Panel (280x360mm)',
        batch_code: 'BAT-GLS-2608',
        received_quantity: '200',
        rejected_quantity: '0',
        accepted_quantity: '200',
        unit_id: 2,
        unit_code: 'PCS',
        unit_cost: '450.00',
        total_cost: '90000.00',
      },
    ],
  };

  const samplePayment: Payment = {
    id: 1,
    uuid: 'sample-pay-uuid',
    payment_number: 'REC-2026-000104',
    direction: 'in',
    customer_name: 'Apex Retail Appliances Ltd.',
    payment_date: '2026-08-31',
    method: 'bank_transfer',
    reference_number: 'TXN-EFTN-89214710',
    amount: '25000.00',
    allocated_amount: '25000.00',
    unallocated_amount: '0.00',
    currency_code: businessConfig.currencyCode || 'BDT',
    status: 'posted',
    notes: 'Advance installment against INV-2026-000042',
  };

  const sampleProduct: LabelProductItem = {
    id: 1,
    name: 'Infrared Cooker 2200W (SM-IC220)',
    sku: 'FG-IC-2200',
    barcode: '8901234567890',
    sale_price: '3200.00',
    mfg_date: '2026-08-31',
    exp_date: '2029-08-31',
  };

  const getContainerClass = () => {
    switch (paperCode) {
      case 'pos_80mm':
        return 'document-preview-sheet-80mm';
      case 'pos_58mm':
        return 'document-preview-sheet-58mm';
      case 'label_50x35':
        return 'document-preview-sheet-label';
      case 'a5_portrait':
        return orientation === 'landscape' ? 'document-preview-sheet-a5-landscape' : 'document-preview-sheet-a5';
      case 'a4_portrait':
      default:
        return orientation === 'landscape' ? 'document-preview-sheet-a4-landscape' : 'document-preview-sheet-a4';
    }
  };

  const renderContent = () => {
    switch (documentType) {
      case 'sales_invoice':
        return (
          <SalesInvoiceDocument
            invoice={sampleInvoice}
            businessConfig={businessConfig}
            copyType="ORIGINAL"
            signatureLabels={{
              preparedBy: layoutConfig?.signaturePreparedBy,
              checkedBy: layoutConfig?.signatureCheckedBy,
              authorizedBy: layoutConfig?.signatureAuthorizedBy,
              receiver: layoutConfig?.signatureReceiver,
            }}
          />
        );
      case 'delivery_challan':
        return <DeliveryChallanDocument delivery={sampleChallan} businessConfig={businessConfig} />;
      case 'purchase_order':
        return <PurchaseOrderDocument po={samplePO} businessConfig={businessConfig} />;
      case 'goods_receipt':
        return <GoodsReceiptDocument grn={sampleGRN} businessConfig={businessConfig} />;
      case 'payment_receipt':
        return <PaymentReceiptDocument payment={samplePayment} businessConfig={businessConfig} />;
      case 'pos_receipt_80mm':
      case 'pos_receipt_58mm':
        return <ThermalReceipt invoice={sampleInvoice} businessConfig={businessConfig} paperWidth={documentType === 'pos_receipt_58mm' ? '58mm' : '80mm'} />;
      case 'barcode_label':
        return <BarcodeLabel product={sampleProduct} preset="standard_50x35" />;
      default:
        return <SalesInvoiceDocument invoice={sampleInvoice} businessConfig={businessConfig} copyType="ORIGINAL" />;
    }
  };

  return (
    <div className="w-full h-full overflow-auto bg-surface-sunken p-4 flex justify-center items-start">
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          transition: 'transform 0.15s ease-out',
        }}
        className="print-doc shadow-2xl rounded-sm"
      >
        <div className={getContainerClass()}>{renderContent()}</div>
      </div>
    </div>
  );
}
