import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  Split,
  Trash2,
  X,
} from 'lucide-react';
import type { PosSession, PosCheckoutPayload, PosCheckoutPaymentPayload, PosCheckoutResult, PosHeldSale } from '../../types/api/pos';
import type { Product } from '../../types/api/catalog';
import type { Invoice } from '../../types/api/sales';
import { api } from '../../lib/api/client';
import { useCurrency } from '../../hooks/useCurrency';
import { notify } from '../../components/ui/Toast';
import { useDocumentPrint } from '../../components/print/useDocumentPrint';
import { ThermalReceipt } from '../../components/print/receipts/ThermalReceipt';
import { SalesInvoiceDocument } from '../../components/print/documents/SalesInvoiceDocument';
import { useBusinessConfig } from '../../lib/document/useBusinessConfig';
import { PosExchangeModal } from './components/PosExchangeModal';

export type PosPaymentMethod = 'cash' | 'card' | 'mobile_banking' | 'credit_adjustment';

export interface PosPaymentLine {
  id: string;
  method: PosPaymentMethod;
  amount: number;
  cashReceived?: number;
  changeGiven?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_type: 'flat' | 'percentage';
}

interface POSShellProps {
  session: PosSession;
  onExit: () => void;
}

interface CartSlot {
  id: number;
  label: string;
  cart: CartItem[];
  customerName: string;
  customerPhone: string;
  tenderMethod: PosPaymentMethod;
  cashTendered: string;
  isSplitPayment?: boolean;
  splitPayments?: PosPaymentLine[];
  order_discount_type?: 'flat' | 'percentage';
  order_discount_value?: string;
}

export function POSShell({ session, onExit }: POSShellProps) {
  const { formatCurrency, currencySymbol, currencyCode } = useCurrency();
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState<'catalog' | 'cart'>('catalog');
  
  // Multi-cart slots (up to 5 concurrent held transactions)
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [slots, setSlots] = useState<CartSlot[]>([
    { id: 1, label: 'Cart 1', cart: [], customerName: '', customerPhone: '', tenderMethod: 'cash', cashTendered: '', isSplitPayment: false, splitPayments: [], order_discount_type: 'flat', order_discount_value: '' },
    { id: 2, label: 'Cart 2 (Hold)', cart: [], customerName: '', customerPhone: '', tenderMethod: 'cash', cashTendered: '', isSplitPayment: false, splitPayments: [], order_discount_type: 'flat', order_discount_value: '' },
    { id: 3, label: 'Cart 3 (Hold)', cart: [], customerName: '', customerPhone: '', tenderMethod: 'cash', cashTendered: '', isSplitPayment: false, splitPayments: [], order_discount_type: 'flat', order_discount_value: '' },
  ]);

  const currentSlot = slots[activeSlotIndex] ?? slots[0]!;
  const cart = currentSlot.cart;
  const customerName = currentSlot.customerName;
  const customerPhone = currentSlot.customerPhone;
  const tenderMethod = currentSlot.tenderMethod;
  const cashTendered = currentSlot.cashTendered;
  const isSplitPayment = currentSlot.isSplitPayment ?? false;
  const splitPayments = currentSlot.splitPayments ?? [];

  const { printDocument } = useDocumentPrint();
  const { config: businessConfig } = useBusinessConfig();
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<PosCheckoutResult | null>(null);
  const [lastCompletedPayments, setLastCompletedPayments] = useState<PosCheckoutPaymentPayload[]>([]);
  const [isParkModalOpen, setIsParkModalOpen] = useState(false);
  const [parkNote, setParkNote] = useState('');
  const [isParkedDrawerOpen, setIsParkedDrawerOpen] = useState(false);
  const [holdingSale, setHoldingSale] = useState(false);
  
  // POS Counter Exchange State
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [exchangeInitialInvoiceId, setExchangeInitialInvoiceId] = useState<number | null>(null);
  const [exchangeInitialInvoiceNumber, setExchangeInitialInvoiceNumber] = useState<string | null>(null);
  const [exchangeInitialOrderItems, setExchangeInitialOrderItems] = useState<
    Array<{
      product_id: number;
      product_name?: string;
      quantity: number | string;
      unit_price: number | string;
    }>
  >([]);

  const handleOpenExchangeModal = (
    invoiceId?: number | null,
    invoiceNum?: string | null,
    items?: Array<{ product_id: number; product_name?: string; quantity: number | string; unit_price: number | string }>
  ) => {
    setExchangeInitialInvoiceId(invoiceId ?? null);
    setExchangeInitialInvoiceNumber(invoiceNum ?? null);
    setExchangeInitialOrderItems(items ?? []);
    setIsExchangeModalOpen(true);
  };
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const customerNameInputRef = useRef<HTMLInputElement>(null);
  const cashTenderedInputRef = useRef<HTMLInputElement>(null);
  const orderDiscountInputRef = useRef<HTMLInputElement>(null);

  const updateCurrentSlot = useCallback((updater: Partial<CartSlot> | ((prev: CartSlot) => CartSlot)) => {
    setSlots((prev) =>
      prev.map((s, idx) => {
        if (idx === activeSlotIndex) {
          return typeof updater === 'function' ? updater(s) : { ...s, ...updater };
        }
        return s;
      })
    );
  }, [activeSlotIndex]);

  const { data: products = [], isLoading: loadingProducts, isFetching: fetchingProducts, refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ['catalog', 'products', 'pos'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: Product[] } | Product[]>('/products?per_page=100');
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
        return list;
      } catch (err) {
        console.error('Failed to load products for POS', err);
        return [];
      }
    },
  });

  const { data: heldSales = [], refetch: refetchHeldSales } = useQuery<PosHeldSale[]>({
    queryKey: ['pos', 'held-sales', session.id],
    queryFn: async () => {
      try {
        const res = await api.get<PosHeldSale[] | { data: PosHeldSale[] }>(`/pos/held-sales?pos_session_id=${session.id}`);
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (raw as { data?: PosHeldSale[] })?.data ?? [];
        return list;
      } catch {
        return [];
      }
    },
  });

  // Global Keyboard Shortcuts for POS Cashier Velocity
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        customerNameInputRef.current?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        orderDiscountInputRef.current?.focus();
        orderDiscountInputRef.current?.select();
      } else if (e.key === 'F9') {
        e.preventDefault();
        const methods: readonly PosPaymentMethod[] = ['cash', 'card', 'mobile_banking', 'credit_adjustment'];
        const currentIdx = methods.indexOf(tenderMethod);
        const nextIdx = (currentIdx + 1) % methods.length;
        const nextMethod = methods[nextIdx] ?? 'cash';
        updateCurrentSlot({ tenderMethod: nextMethod });
      } else if (e.key === 'F10') {
        e.preventDefault();
        updateCurrentSlot({ tenderMethod: 'cash' });
        setTimeout(() => cashTenderedInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tenderMethod, updateCurrentSlot]);

  const addToCart = (product: Product) => {
    updateCurrentSlot((prev) => {
      const existing = prev.cart.find((item) => String(item.product.id) === String(product.id));
      const price = parseFloat(product.default_sale_price || product.standard_cost || '100') || 100;
      const updatedCart = existing
        ? prev.cart.map((item) =>
            String(item.product.id) === String(product.id)
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        : [
            ...prev.cart,
            {
              product,
              quantity: 1,
              unit_price: price,
              discount: 0,
              discount_type: 'flat' as const,
            },
          ];
      return { ...prev, cart: updatedCart };
    });
  };

  const updateQuantity = (productId: string | number, delta: number) => {
    updateCurrentSlot((prev) => {
      const updatedCart = prev.cart
        .map((item) => {
          if (String(item.product.id) === String(productId)) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
      return { ...prev, cart: updatedCart };
    });
  };

  const updateItemQuantity = (productId: string | number, qty: number) => {
    updateCurrentSlot((prev) => ({
      ...prev,
      cart: prev.cart.map((item) =>
        String(item.product.id) === String(productId) ? { ...item, quantity: Math.max(0.001, qty) } : item
      ),
    }));
  };

  const updateItemPrice = (productId: string | number, price: number) => {
    updateCurrentSlot((prev) => ({
      ...prev,
      cart: prev.cart.map((item) =>
        String(item.product.id) === String(productId) ? { ...item, unit_price: Math.max(0, price) } : item
      ),
    }));
  };

  const updateItemDiscount = (productId: string | number, discount: number) => {
    updateCurrentSlot((prev) => ({
      ...prev,
      cart: prev.cart.map((item) =>
        String(item.product.id) === String(productId) ? { ...item, discount: Math.max(0, discount) } : item
      ),
    }));
  };

  const toggleItemDiscountType = (productId: string | number) => {
    updateCurrentSlot((prev) => ({
      ...prev,
      cart: prev.cart.map((item) =>
        String(item.product.id) === String(productId)
          ? { ...item, discount_type: item.discount_type === 'percentage' ? 'flat' : 'percentage' }
          : item
      ),
    }));
  };

  const removeFromCart = (productId: string | number) => {
    updateCurrentSlot((prev) => ({
      ...prev,
      cart: prev.cart.filter((item) => String(item.product.id) !== String(productId)),
    }));
  };

  const clearCart = () => {
    updateCurrentSlot({
      cart: [],
      customerName: '',
      customerPhone: '',
      cashTendered: '',
      isSplitPayment: false,
      splitPayments: [],
      order_discount_type: 'flat',
      order_discount_value: '',
    });
  };

  // Calculations with dual-mode item discounts & order discount
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const itemDiscounts = cart.map((item) => {
    const lineGross = item.quantity * item.unit_price;
    const isPct = item.discount_type === 'percentage';
    const discAmt = isPct ? lineGross * (item.discount / 100) : Math.min(lineGross, item.discount || 0);
    const lineNet = Math.max(0, lineGross - discAmt);
    return {
      productId: item.product.id,
      lineGross,
      discAmt,
      lineNet,
    };
  });

  const totalLineDiscounts = itemDiscounts.reduce((sum, i) => sum + i.discAmt, 0);
  const netSubtotalBeforeOrderDisc = Math.max(0, subtotal - totalLineDiscounts);

  const orderDiscType = currentSlot.order_discount_type || 'flat';
  const orderDiscVal = Math.max(0, parseFloat(currentSlot.order_discount_value || '0') || 0);
  const orderDiscountAmount =
    orderDiscType === 'percentage'
      ? netSubtotalBeforeOrderDisc * (orderDiscVal / 100)
      : Math.min(netSubtotalBeforeOrderDisc, orderDiscVal);

  const discountTotal = totalLineDiscounts + orderDiscountAmount;
  const grandTotal = Math.max(0, netSubtotalBeforeOrderDisc - orderDiscountAmount);

  const singleChangeGiven =
    tenderMethod === 'cash' && parseFloat(cashTendered || '0') > grandTotal
      ? parseFloat(cashTendered) - grandTotal
      : 0;

  const splitTotalTendered = splitPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const splitTotalChange = splitPayments.reduce((sum, p) => sum + (Number(p.changeGiven) || 0), 0);
  const splitRemainingDue = Math.max(0, grandTotal - splitTotalTendered);
  const changeGiven = isSplitPayment ? splitTotalChange : singleChangeGiven;

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    let paymentsPayload: PosCheckoutPaymentPayload[];

    if (isSplitPayment) {
      const activePayments = splitPayments.filter((p) => p.amount > 0);
      const totalPaid = activePayments.reduce((s, p) => s + p.amount, 0);
      if (totalPaid < grandTotal - 0.01) {
        notify.warning('Payment incomplete', {
          description: `Please allocate remaining ${formatCurrency(grandTotal - totalPaid)} across payment methods.`,
        });
        return;
      }
      paymentsPayload = activePayments.map((p) => {
        const tenderAmt = p.method === 'cash' && (p.cashReceived ?? 0) > p.amount ? (p.cashReceived ?? 0) : p.amount;
        return {
          method: p.method,
          amount: tenderAmt.toFixed(4),
          change_given: (p.changeGiven ?? 0).toFixed(4),
        };
      });
    } else {
      const cashTenderNum = tenderMethod === 'cash' ? (parseFloat(cashTendered || '0') || grandTotal) : grandTotal;
      paymentsPayload = [
        {
          method: tenderMethod,
          amount: (tenderMethod === 'cash' && cashTenderNum >= grandTotal ? cashTenderNum : grandTotal).toFixed(4),
          change_given: singleChangeGiven.toFixed(4),
        },
      ];
    }

    setCheckingOut(true);

    const payload: PosCheckoutPayload = {
      pos_session_id: session.id,
      customer_name: customerName || 'Walk-in Customer',
      customer_phone: customerPhone || null,
      order_date: new Date().toISOString().slice(0, 10),
      order_discount_type: orderDiscType,
      order_discount_value: orderDiscVal.toFixed(4),
      discount_amount: discountTotal.toFixed(4),
      items: cart.map((item) => {
        const lineGross = item.quantity * item.unit_price;
        const isPct = item.discount_type === 'percentage';
        const discAmt = isPct ? lineGross * (item.discount / 100) : Math.min(lineGross, item.discount || 0);
        return {
          product_id: Number(item.product.product_id ?? item.product.id) || 1,
          quantity: item.quantity.toFixed(4),
          unit_id: Number(item.product.unit_id ?? item.product.base_unit_id) || 1,
          unit_price: item.unit_price.toFixed(4),
          discount_type: item.discount_type,
          ...(item.discount > 0 ? { discount_value: item.discount.toFixed(4) } : {}),
          ...(discAmt > 0 ? { discount_amount: discAmt.toFixed(4) } : {}),
          discount_percentage: isPct
            ? item.discount.toFixed(4)
            : lineGross > 0
            ? ((discAmt / lineGross) * 100).toFixed(4)
            : '0.0000',
        };
      }),
      payments: paymentsPayload,
    };

    try {
      const res = await api.post<PosCheckoutResult>('/pos/checkout', payload);
      const checkoutResult = res.data;

      if (!checkoutResult || !checkoutResult.order) {
        throw new Error('Invalid checkout response received from server');
      }

      setLastCompletedPayments(paymentsPayload);
      setLastReceipt(checkoutResult);
      clearCart();
      notify.success('Checkout completed', {
        description: `Order #${checkoutResult.order.order_number} confirmed.`,
      });
    } catch (err: unknown) {
      console.error('POS Checkout Failed', err);
      const apiErr = err as { message?: string; response?: { data?: { message?: string } } };
      notify.error('Checkout failed', {
        description:
          apiErr.message ||
          apiErr.response?.data?.message ||
          'Please ensure terminal session is active and stock is valid.',
      });
    } finally {
      setCheckingOut(false);
    }
  };

  const handlePrintReceipt = (format: 'thermal' | 'a4' = 'thermal') => {
    if (!lastReceipt) return;

    const printableInvoice: Invoice = {
      ...lastReceipt.invoice,
      customer_name: lastReceipt.order.customer_name || lastReceipt.invoice.customer_name || 'Walk-in Customer',
      sales_order_number: lastReceipt.order.order_number || lastReceipt.invoice.sales_order_number || 'DIRECT-POS',
      items: (lastReceipt.invoice.items && lastReceipt.invoice.items.length > 0)
        ? lastReceipt.invoice.items
        : (lastReceipt.order.items ?? []).map((it) => ({
            id: it.id,
            uuid: it.uuid || `item-${it.id}`,
            invoice_id: lastReceipt.invoice.id,
            product_id: it.product_id,
            product_name: it.product_name || 'Item',
            quantity: String(it.quantity),
            unit_price: String(it.unit_price),
            line_total: String(it.line_total),
            discount_amount: String(it.discount_amount ?? '0'),
            tax_amount: String(it.tax_amount ?? '0'),
            sort_order: 0,
          })),
    };

    const effectiveBusinessConfig = {
      ...businessConfig,
      currencySymbol: currencySymbol || businessConfig.currencySymbol || '৳',
      currencyCode: currencyCode || businessConfig.currencyCode || 'BDT',
    };

    if (format === 'a4') {
      printDocument(
        <SalesInvoiceDocument
          invoice={printableInvoice}
          businessConfig={effectiveBusinessConfig}
          copyType="CUSTOMER COPY"
        />,
        {
          pageClass: 'print-page-a4',
          documentTitle: `Tax-Invoice-${lastReceipt.invoice.invoice_number}`,
        }
      );
      return;
    }

    const cashTender = lastCompletedPayments.find((p) => p.method === 'cash');

    printDocument(
      <ThermalReceipt
        invoice={printableInvoice}
        businessConfig={effectiveBusinessConfig}
        paperWidth="80mm"
        cashierName={session.operator_name || 'Tanvir Hossain (Cashier A)'}
        terminalName={session.terminal_name || 'Gulshan Flagship - Counter 1'}
        {...(cashTender?.amount ? { tenderedCash: cashTender.amount } : {})}
        {...(cashTender?.change_given ? { changeAmount: cashTender.change_given } : {})}
      />,
      {
        pageClass: 'print-page-thermal-80',
        documentTitle: `Receipt-${lastReceipt.invoice.invoice_number}`,
      }
    );
  };

  const handleParkSale = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cart.length === 0) return;
    setHoldingSale(true);
    try {
      await api.post('/pos/held-sales', {
        pos_session_id: session.id,
        pos_terminal_id: session.terminal_id,
        reference_note: parkNote.trim() || `${customerName || 'Walk-in'} (${cart.length} items)`,
        subtotal: subtotal.toFixed(4),
        tax_amount: '0.0000',
        discount_amount: discountTotal.toFixed(4),
        total_amount: grandTotal.toFixed(4),
        cart_payload: {
          items: cart,
          customerName,
          customerPhone,
          tenderMethod,
          cashTendered,
          isSplitPayment,
          splitPayments,
        },
      });
      clearCart();
      setParkNote('');
      setIsParkModalOpen(false);
      refetchHeldSales();
      notify.success('Sale parked to drawer', {
        description: 'You can resume this transaction anytime from the parked sales drawer.',
      });
    } catch (err) {
      console.error('Failed to park sale', err);
      notify.error('Could not hold sale', {
        description: 'Failed to hold sale in cloud drawer. Please try again.',
      });
    } finally {
      setHoldingSale(false);
    }
  };

  const handleResumeSale = async (heldSale: PosHeldSale) => {
    if (cart.length > 0) {
      const confirmReplace = window.confirm(
        'The active cart already contains items. Overwrite active cart with this parked sale?'
      );
      if (!confirmReplace) return;
    }
    const payload = heldSale.cart_payload;
    const payloadExtra = payload as { isSplitPayment?: boolean; splitPayments?: PosPaymentLine[] };
    updateCurrentSlot({
      cart: (payload.items as unknown as CartItem[]) || [],
      customerName: payload.customerName || '',
      customerPhone: payload.customerPhone || '',
      tenderMethod: payload.tenderMethod || 'cash',
      cashTendered: payload.cashTendered || '',
      isSplitPayment: Boolean(payloadExtra.isSplitPayment),
      splitPayments: payloadExtra.splitPayments || [],
    });
    try {
      await api.delete(`/pos/held-sales/${heldSale.id}`);
      refetchHeldSales();
      setIsParkedDrawerOpen(false);
    } catch (err) {
      console.error('Error clearing resumed held sale', err);
    }
  };

  const handleDiscardHeldSale = async (id: number) => {
    if (!window.confirm('Are you sure you want to permanently discard this parked sale?')) return;
    try {
      await api.delete(`/pos/held-sales/${id}`);
      refetchHeldSales();
      notify.info('Parked sale discarded');
    } catch (err) {
      console.error('Error discarding held sale', err);
      notify.error('Failed to discard held sale');
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface text-default">
      {/* POS Top Bar */}
      <header className="flex h-14 items-center justify-between border-b border-default bg-surface-sunken/90 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            POS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-default">
                {session.terminal_name ?? 'POS Register'}
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ● Live Shift
              </span>
            </div>
            <p className="text-[11px] text-muted font-mono">Session: {session.session_number}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted">
            <div>
              Branch:{' '}
              <span className="text-default font-medium">
                {session.branch_name ?? 'Main Outlet'}
              </span>
            </div>
            <div>
              Expected Cash:{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                {formatCurrency(session.expected_cash)}
              </span>
            </div>
          </div>

          {/* Mobile Catalog / Cart Segmented Switcher */}
          <div className="lg:hidden flex items-center bg-surface-sunken p-0.5 rounded-xl border border-default">
            <button
              type="button"
              onClick={() => setMobileView('catalog')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all touch-target ${
                mobileView === 'catalog'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-muted hover:text-default'
              }`}
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => setMobileView('cart')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 touch-target ${
                mobileView === 'cart'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-muted hover:text-default'
              }`}
            >
              <ShoppingBag className="size-3" />
              <span>Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
            </button>
          </div>

          <button
            onClick={() => handleOpenExchangeModal()}
            className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-1.5 text-xs font-semibold text-default hover:bg-surface-sunken cursor-pointer transition-colors shadow-2xs"
            title="Process Counter Product Exchange / Return Swap"
          >
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Exchange</span>
          </button>

          <button
            onClick={() => setIsParkedDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-1.5 text-xs font-semibold text-default hover:bg-surface-sunken cursor-pointer transition-colors shadow-2xs"
            title="View Parked / Held Sales"
          >
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="hidden sm:inline">Parked Sales</span>
            <span className="rounded-full bg-amber-500/10 text-amber-600 px-1.5 py-0.2 text-[10px] font-bold border border-amber-500/20">
              {heldSales.length}
            </span>
          </button>

          <button
            onClick={onExit}
            className="flex items-center gap-1 rounded-xl border border-default bg-surface px-3 py-1.5 text-xs font-medium text-default hover:bg-surface-sunken cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
            Exit Terminal
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Product Catalog Grid */}
        <div className={`flex-1 flex-col border-r border-default p-3 sm:p-4 ${
          mobileView === 'catalog' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Search & Barcode Scan */}
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan barcode or search products (SKU, Name)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = search.trim().toLowerCase();
                    if (!trimmed) return;
                    const match =
                      products.find(
                        (p) =>
                          (p.barcode && p.barcode.toLowerCase() === trimmed) ||
                          p.sku.toLowerCase() === trimmed
                      ) || (filteredProducts.length === 1 ? filteredProducts[0] : null);
                    if (match) {
                      addToCart(match);
                      setSearch('');
                    }
                  }
                }}
                className="h-11 w-full rounded-xl border border-default bg-surface-sunken pl-10 pr-4 text-sm text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <button
              onClick={() => refetchProducts()}
              disabled={fetchingProducts}
              className="flex h-11 items-center gap-1 rounded-xl border border-default bg-surface-sunken px-3 text-muted hover:text-default cursor-pointer transition-colors"
              title="Refresh Products"
            >
              <RefreshCw className={`h-4 w-4 ${fetchingProducts ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loadingProducts ? (
              <div className="flex h-48 items-center justify-center text-xs text-muted">
                Loading products...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-muted">
                No products found matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex flex-col items-start rounded-xl border border-default bg-surface p-3 text-left transition-all hover:border-primary/50 hover:bg-surface-sunken active:scale-[0.98] cursor-pointer shadow-2xs"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      {p.name.charAt(0)}
                    </div>
                    <div className="mt-2 font-medium text-xs text-default line-clamp-1">
                      {p.name}
                    </div>
                    <div className="font-mono text-[10px] text-muted">{p.sku}</div>
                    <div className="mt-2 font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(parseFloat(p.default_sale_price || p.standard_cost || '100') || 100)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Sticky Quick-Checkout Bar when on Catalog View */}
          {cart.length > 0 && (
            <div className="lg:hidden mt-3 p-3 bg-surface rounded-2xl border border-primary/30 shadow-lg flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-muted font-medium truncate">
                  Active Cart: {cart.length} line item{cart.length > 1 ? 's' : ''}
                </p>
                <p className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(grandTotal)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileView('cart')}
                className="min-h-11 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 cursor-pointer touch-target-pos active:scale-95"
              >
                <ShoppingBag className="size-4" />
                <span>View Cart & Pay →</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Cart & Payment Tender Panel */}
        <div className={`w-full lg:w-96 flex-col bg-surface-sunken/40 p-3 sm:p-4 overflow-y-auto ${
          mobileView === 'cart' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Mobile Back to Catalog Button */}
          <div className="lg:hidden mb-3">
            <button
              type="button"
              onClick={() => setMobileView('catalog')}
              className="w-full min-h-11 px-3 rounded-xl border border-default bg-surface text-default hover:bg-surface-sunken font-bold text-xs flex items-center justify-center gap-2 touch-target shadow-2xs"
            >
              <span>← Back to Product Catalog</span>
            </button>
          </div>

          {/* Multi-Cart Hold & Resume Tab Switcher */}
          <div className="flex items-center gap-1.5 mb-3 bg-surface p-1 rounded-xl border border-default">
            {slots.map((slot, idx) => {
              const count = slot.cart.reduce((s, i) => s + i.quantity, 0);
              const isActive = idx === activeSlotIndex;
              return (
                <button
                  key={slot.id}
                  onClick={() => setActiveSlotIndex(idx)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-muted hover:text-default hover:bg-surface-sunken'
                  }`}
                >
                  <span>{slot.label}</span>
                  {count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-primary-hover text-white' : 'bg-surface-sunken text-emerald-600 dark:text-emerald-400 border border-default'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Cart Header */}
          <div className="flex items-center justify-between border-b border-default pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-sm text-default">{currentSlot.label} Order</span>
              <span className="rounded-full bg-surface-sunken border border-default px-2 py-0.5 text-[10px] font-bold text-muted">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsParkModalOpen(true)}
                disabled={cart.length === 0}
                className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
                title="Park this cart to resume later"
              >
                <PauseCircle className="h-3.5 w-3.5" />
                Hold Sale
              </button>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-default py-2">
            {cart.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-muted">
                <ShoppingBag className="h-8 w-8 stroke-1 text-muted mb-2" />
                <p className="text-xs">Cart is empty</p>
                <p className="text-[10px] text-muted">Scan barcode (F2) or click items to add</p>
              </div>
            ) : (
              cart.map((item) => {
                const lineGross = item.quantity * item.unit_price;
                const isPct = item.discount_type === 'percentage';
                const discAmt = isPct ? lineGross * (item.discount / 100) : Math.min(lineGross, item.discount || 0);
                const lineTotal = Math.max(0, lineGross - discAmt);
                return (
                  <div key={item.product.id} className="py-2.5 border-b border-default/60 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs text-default truncate" title={item.product.name}>
                          {item.product.name}
                        </p>
                        <p className="font-mono text-[10px] text-muted">
                          {item.product.sku}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-2 min-h-9.5 min-w-9.5 flex items-center justify-center text-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-xl cursor-pointer transition-colors touch-target"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Editable Quantity, Price, and Discount Strip */}
                    <div className="grid grid-cols-3 gap-1.5 bg-surface-sunken/50 p-1.5 rounded-lg border border-default/50 text-[11px]">
                      {/* Qty Input with - / + */}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-semibold text-muted">Qty</label>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="flex h-8 w-7 sm:h-7 sm:w-6 shrink-0 items-center justify-center rounded-lg border border-default bg-surface text-default hover:bg-surface-sunken cursor-pointer transition-colors active:scale-95 touch-target"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                            className="h-8 sm:h-7 w-full rounded-lg border border-default bg-surface px-1 text-center font-mono font-bold text-xs text-default focus:border-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="flex h-8 w-7 sm:h-7 sm:w-6 shrink-0 items-center justify-center rounded-lg border border-default bg-surface text-default hover:bg-surface-sunken cursor-pointer transition-colors active:scale-95 touch-target"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Unit Price (Rate) */}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-semibold text-muted">Price (৳)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unit_price}
                          onChange={(e) => updateItemPrice(item.product.id, parseFloat(e.target.value) || 0)}
                          className="h-7 w-full rounded border border-default bg-surface px-1 text-right font-mono font-bold text-xs text-default focus:border-primary focus:outline-none"
                        />
                      </div>

                      {/* Line Discount with Dual Mode Toggle */}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-semibold text-muted">
                          Disc ({item.discount_type === 'percentage' ? '%' : '৳'})
                        </label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={item.discount === 0 ? '' : item.discount}
                            onChange={(e) => updateItemDiscount(item.product.id, Math.max(0, parseFloat(e.target.value) || 0))}
                            className="h-7 w-full rounded-l border border-default bg-surface px-1 text-right font-mono font-bold text-xs text-rose-600 dark:text-rose-400 focus:border-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => toggleItemDiscountType(item.product.id)}
                            className="flex h-7 w-6 shrink-0 items-center justify-center rounded-r border border-l-0 border-default bg-surface-sunken hover:bg-surface font-bold text-[10px] text-muted hover:text-default cursor-pointer transition-colors"
                            title="Toggle Flat (৳) or Percentage (%)"
                          >
                            {item.discount_type === 'percentage' ? '%' : '৳'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Customer & Checkout Form */}
          <div className="border-t border-default pt-3 space-y-3">
            {/* Customer Inputs */}
            <div className="grid grid-cols-2 gap-2">
              <input
                ref={customerNameInputRef}
                type="text"
                placeholder="Customer Name (F4)"
                value={customerName}
                onChange={(e) => updateCurrentSlot({ customerName: e.target.value })}
                className="h-8 rounded-xl border border-default bg-surface px-2.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="Phone (017...)"
                value={customerPhone}
                onChange={(e) => updateCurrentSlot({ customerPhone: e.target.value })}
                className="h-8 rounded-xl border border-default bg-surface px-2.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            {/* Payment Section Header with Multi-Payment Toggle */}
            <div className="flex items-center justify-between border-t border-default pt-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Payment Method
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextSplit = !isSplitPayment;
                  updateCurrentSlot((prev) => ({
                    ...prev,
                    isSplitPayment: nextSplit,
                    splitPayments: nextSplit && (!prev.splitPayments || prev.splitPayments.length === 0)
                      ? [
                          { id: '1', method: prev.tenderMethod || 'cash', amount: grandTotal },
                        ]
                      : (prev.splitPayments ?? []),
                  }));
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSplitPayment
                    ? 'bg-primary text-white shadow-2xs'
                    : 'border border-default bg-surface text-muted hover:text-default hover:bg-surface-sunken'
                }`}
              >
                <Split className="h-3 w-3" />
                <span>{isSplitPayment ? 'Multi-Payment Active' : 'Split / Multiple'}</span>
              </button>
            </div>

            {!isSplitPayment ? (
              <>
                {/* Quick Single Payment Selector */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateCurrentSlot({ tenderMethod: 'cash' })}
                    className={`flex flex-col items-center justify-center min-h-12 gap-1 rounded-xl border py-2 text-[10px] font-semibold uppercase transition-all cursor-pointer active:scale-95 touch-target-pos ${
                      tenderMethod === 'cash'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-default bg-surface text-muted hover:bg-surface-sunken hover:text-default'
                    }`}
                  >
                    <DollarSign className="h-4 w-4" />
                    Cash (F10)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCurrentSlot({ tenderMethod: 'card' })}
                    className={`flex flex-col items-center justify-center min-h-12 gap-1 rounded-xl border py-2 text-[10px] font-semibold uppercase transition-all cursor-pointer active:scale-95 touch-target-pos ${
                      tenderMethod === 'card'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-default bg-surface text-muted hover:bg-surface-sunken hover:text-default'
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCurrentSlot({ tenderMethod: 'mobile_banking' })}
                    className={`flex flex-col items-center justify-center min-h-12 gap-1 rounded-xl border py-2 text-[10px] font-semibold uppercase transition-all cursor-pointer active:scale-95 touch-target-pos ${
                      tenderMethod === 'mobile_banking'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-default bg-surface text-muted hover:bg-surface-sunken hover:text-default'
                    }`}
                  >
                    <Smartphone className="h-4 w-4" />
                    bKash/Nagad
                  </button>
                </div>

                {/* Cash Tendered Input */}
                {tenderMethod === 'cash' && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-sunken border border-default p-2">
                    <span className="text-[11px] text-muted">Cash Received:</span>
                    <input
                      ref={cashTenderedInputRef}
                      type="number"
                      step="1"
                      placeholder={grandTotal.toString()}
                      value={cashTendered}
                      onChange={(e) => updateCurrentSlot({ cashTendered: e.target.value })}
                      className="h-7 w-28 rounded-lg border border-default bg-surface px-2 text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
              </>
            ) : (
              /* Multi-Payment / Split Tender Panel */
              <div className="space-y-2 rounded-xl border border-default bg-surface-sunken p-2.5">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                  {splitPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex flex-col gap-1.5 p-2 rounded-lg bg-surface border border-default shadow-2xs"
                    >
                      <div className="flex items-center gap-1.5">
                        <select
                          value={payment.method}
                          onChange={(e) => {
                            const val = e.target.value as PosPaymentMethod;
                            updateCurrentSlot((prev) => ({
                              ...prev,
                              splitPayments: (prev.splitPayments ?? []).map((p) =>
                                p.id === payment.id ? { ...p, method: val } : p
                              ),
                            }));
                          }}
                          className="h-7 flex-1 rounded-lg border border-default bg-surface-sunken px-1.5 text-xs font-medium text-default focus:border-primary focus:outline-none"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card / POS</option>
                          <option value="mobile_banking">bKash / Nagad</option>
                          <option value="credit_adjustment">Customer Credit / Due</option>
                        </select>

                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted font-bold">৳</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={payment.amount || ''}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              updateCurrentSlot((prev) => ({
                                ...prev,
                                splitPayments: (prev.splitPayments ?? []).map((p) =>
                                  p.id === payment.id ? { ...p, amount: val } : p
                                ),
                              }));
                            }}
                            placeholder="Amount"
                            className="h-7 w-full rounded-lg border border-default bg-surface-sunken pl-5 pr-2 text-right font-mono font-bold text-xs text-default focus:border-primary focus:outline-none"
                          />
                        </div>

                        {splitPayments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              updateCurrentSlot((prev) => ({
                                ...prev,
                                splitPayments: (prev.splitPayments ?? []).filter((p) => p.id !== payment.id),
                              }));
                            }}
                            className="p-1 rounded-md text-muted hover:text-rose-500 hover:bg-surface-sunken cursor-pointer transition-colors"
                            title="Remove payment line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Cash received calculator per cash split */}
                      {payment.method === 'cash' && (
                        <div className="flex items-center justify-between text-[11px] bg-surface-sunken/60 px-2 py-1 rounded border border-default/50 font-mono">
                          <span className="text-muted">Cash Rcvd:</span>
                          <input
                            type="number"
                            min="0"
                            placeholder={payment.amount.toString()}
                            value={payment.cashReceived ?? ''}
                            onChange={(e) => {
                              const rcvd = parseFloat(e.target.value) || 0;
                              const chg = Math.max(0, rcvd - payment.amount);
                              updateCurrentSlot((prev) => ({
                                ...prev,
                                splitPayments: (prev.splitPayments ?? []).map((p) =>
                                  p.id === payment.id ? { ...p, cashReceived: rcvd, changeGiven: chg } : p
                                ),
                              }));
                            }}
                            className="h-5 w-20 rounded border border-default bg-surface px-1 text-right text-xs font-bold focus:outline-none"
                          />
                          {(payment.changeGiven ?? 0) > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                              Change: {formatCurrency(payment.changeGiven ?? 0)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-default/60">
                  <button
                    type="button"
                    onClick={() => {
                      const currentSum = splitPayments.reduce((s, p) => s + p.amount, 0);
                      const rem = Math.max(0, grandTotal - currentSum);
                      updateCurrentSlot((prev) => ({
                        ...prev,
                        splitPayments: [
                          ...(prev.splitPayments ?? []),
                          {
                            id: String(Date.now()),
                            method: (prev.splitPayments ?? []).some((p) => p.method === 'cash')
                              ? 'mobile_banking'
                              : 'cash',
                            amount: rem,
                          },
                        ],
                      }));
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    Add Method
                  </button>

                  <div className="text-[11px] font-mono font-bold">
                    {splitRemainingDue <= 0.001 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✓ Fully Allocated</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        {formatCurrency(splitRemainingDue)} remaining
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Order Summary Breakdown */}
            <div className="space-y-1.5 text-xs text-muted border-t border-default pt-2 font-mono">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {totalLineDiscounts > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                  <span>Item Discounts:</span>
                  <span>-{formatCurrency(totalLineDiscounts)}</span>
                </div>
              )}
              {/* Order Discount Row with Dual-Mode Toggle */}
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="font-medium text-default font-sans">Order Discount (F8):</span>
                <div className="flex items-center">
                  <input
                    ref={orderDiscountInputRef}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={currentSlot.order_discount_value || ''}
                    onChange={(e) => updateCurrentSlot({ order_discount_value: e.target.value })}
                    className="h-6 w-16 rounded-l border border-default bg-surface px-1 text-right font-mono font-bold text-xs text-rose-600 dark:text-rose-400 focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateCurrentSlot({
                        order_discount_type: (currentSlot.order_discount_type || 'flat') === 'flat' ? 'percentage' : 'flat',
                      })
                    }
                    className="flex h-6 w-5 items-center justify-center rounded-r border border-l-0 border-default bg-surface-sunken hover:bg-surface font-bold text-[10px] text-muted hover:text-default cursor-pointer transition-colors"
                    title="Toggle Flat (৳) or Percentage (%)"
                  >
                    {(currentSlot.order_discount_type || 'flat') === 'percentage' ? '%' : '৳'}
                  </button>
                </div>
              </div>
              {orderDiscountAmount > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                  <span>Order Disc Amount:</span>
                  <span>-{formatCurrency(orderDiscountAmount)}</span>
                </div>
              )}
              {discountTotal > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold border-t border-default/40 pt-1">
                  <span>Total Discount:</span>
                  <span>-{formatCurrency(discountTotal)}</span>
                </div>
              )}
              {changeGiven > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Change Return:</span>
                  <span>{formatCurrency(changeGiven)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-default pt-1 border-t border-default/60">
                <span className="font-sans">Total Payable:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkingOut || (isSplitPayment && splitRemainingDue > 0.01)}
              className="w-full min-h-12.5 rounded-xl bg-primary py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] cursor-pointer touch-target-pos"
            >
              {checkingOut
                ? 'Processing...'
                : isSplitPayment && splitRemainingDue > 0.01
                ? `Complete Sale (${formatCurrency(splitRemainingDue)} remaining)`
                : `Complete Sale (${formatCurrency(grandTotal)})`}
            </button>

            {/* Cashier Velocity Hotkey Bar */}
            <div className="flex items-center justify-between text-[10px] text-muted pt-1 font-mono">
              <span>[F2] Search</span>
              <span>[F4] Customer</span>
              <span>[F8] Disc</span>
              <span>[F9] Pay</span>
              <span>[F10] Cash</span>
            </div>
          </div>
        </div>
      </div>

      {/* Park Sale Modal */}
      {isParkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-default">Hold / Park Active Cart</h3>
              </div>
              <button
                onClick={() => setIsParkModalOpen(false)}
                className="text-muted hover:text-default cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleParkSale} className="space-y-3">
              <p className="text-xs text-muted">
                This will save the current cart with {cart.length} item(s) totalling{' '}
                <span className="font-bold text-default font-mono">{formatCurrency(grandTotal)}</span> to the server queue so you can serve the next customer.
              </p>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1">
                  Reference / Customer Note
                </label>
                <input
                  type="text"
                  value={parkNote}
                  onChange={(e) => setParkNote(e.target.value)}
                  placeholder={`e.g. ${customerName || 'Customer'} - Waiting for cash / Table 3`}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-sm text-default focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={() => setIsParkModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium border border-default rounded-xl hover:bg-surface-sunken text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={holdingSale}
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {holdingSale ? 'Holding...' : 'Confirm & Hold Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Parked Sales Drawer Modal */}
      {isParkedDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-default">Parked / Held Sales Queue</h3>
                <span className="rounded-full bg-amber-500/10 text-amber-600 px-2 py-0.5 text-xs font-bold border border-amber-500/20">
                  {heldSales.length} on hold
                </span>
              </div>
              <button
                onClick={() => setIsParkedDrawerOpen(false)}
                className="text-muted hover:text-default cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {heldSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted">
                  <PauseCircle className="h-10 w-10 stroke-1 mb-2 text-muted" />
                  <p className="text-sm font-medium">No sales are currently held</p>
                  <p className="text-xs text-muted">When a customer needs time to pay, click "Hold Sale" in the cart.</p>
                </div>
              ) : (
                heldSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 rounded-xl border border-default bg-surface-sunken flex items-center justify-between gap-4 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-default truncate">
                          {sale.reference_note || 'Held Sale'}
                        </span>
                        <span className="text-[10px] font-mono text-muted bg-surface px-2 py-0.5 rounded border border-default">
                          {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        {sale.cart_payload?.items?.length ?? 0} item(s) • Total:{' '}
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatCurrency(sale.total_amount)}
                        </span>
                      </p>
                      {sale.cart_payload?.customerName && (
                        <p className="text-[11px] text-muted">
                          Customer: <span className="text-default font-medium">{sale.cart_payload.customerName}</span>{' '}
                          {sale.cart_payload.customerPhone && `(${sale.cart_payload.customerPhone})`}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleResumeSale(sale)}
                        className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Resume Cart
                      </button>
                      <button
                        onClick={() => handleDiscardHeldSale(sale.id)}
                        className="p-1.5 rounded-xl border border-default text-muted hover:text-rose-600 hover:bg-surface cursor-pointer transition-colors"
                        title="Discard held sale"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-default flex justify-between items-center text-xs text-muted">
              <span>Resuming a cart will load items into your active register slot.</span>
              <button
                onClick={() => setIsParkedDrawerOpen(false)}
                className="px-4 py-2 border border-default rounded-xl hover:bg-surface-sunken text-default font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {lastReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-center text-base font-bold text-default">Sale Completed!</h3>
            <p className="text-center font-mono text-xs text-muted mt-1">
              Invoice #{lastReceipt.invoice.invoice_number}
            </p>

            {(() => {
              const receiptTotalChange = lastCompletedPayments.reduce(
                (sum, p) => sum + (parseFloat(p.change_given ?? '0') || 0),
                0
              );
              return (
                <div className="mt-4 rounded-xl border border-default bg-surface-sunken p-4 font-mono text-xs space-y-2.5">
                  <div className="flex justify-between text-muted">
                    <span>Order No:</span>
                    <span className="text-default font-semibold">{lastReceipt.order.order_number}</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Total Bill:</span>
                    <span className="text-default font-bold">
                      {formatCurrency(lastReceipt.order.total_amount)}
                    </span>
                  </div>

                  {lastCompletedPayments.length > 0 && (
                    <div className="border-t border-default/60 pt-2 space-y-1.5 text-[11px]">
                      <div className="flex justify-between text-muted font-sans font-semibold">
                        <span>Tender Breakdown:</span>
                        {lastCompletedPayments.length > 1 && <span>Amount</span>}
                      </div>
                      {lastCompletedPayments.map((p, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="capitalize text-default">
                            {p.method === 'mobile_banking'
                              ? 'bKash / Nagad'
                              : p.method === 'credit_adjustment'
                              ? 'Credit Adjustment'
                              : p.method === 'cash'
                              ? 'Cash Tendered'
                              : p.method === 'card'
                              ? 'Card / POS'
                              : p.method}:
                          </span>
                          <span className="font-bold text-default">{formatCurrency(parseFloat(p.amount))}</span>
                        </div>
                      ))}
                      {receiptTotalChange > 0 && (
                        <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-lg font-bold text-xs mt-1">
                          <span className="font-sans">Change Returned:</span>
                          <span className="font-mono">{formatCurrency(receiptTotalChange)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between border-t border-default/60 pt-2 text-muted">
                    <span className="font-semibold text-default font-sans">Net Paid:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      {formatCurrency(lastReceipt.order.total_amount)}
                    </span>
                  </div>

                  <div className="flex justify-between text-muted text-[10px] pt-0.5">
                    <span>Session:</span>
                    <span className="text-default">{lastReceipt.session.session_number}</span>
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintReceipt('thermal')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-default bg-surface-sunken py-2.5 px-3 text-xs font-semibold text-default hover:bg-surface hover:border-primary/50 cursor-pointer transition-all shadow-2xs"
                  title="Print 80mm POS Thermal Receipt"
                >
                  <Printer className="h-3.5 w-3.5 text-primary" />
                  Thermal (80mm)
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintReceipt('a4')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-default bg-surface-sunken py-2.5 px-3 text-xs font-semibold text-default hover:bg-surface hover:border-primary/50 cursor-pointer transition-all shadow-2xs"
                  title="Print standard full-page A4 Tax Invoice"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  A4 Invoice
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const invoiceId = lastReceipt.invoice.id;
                  const invoiceNum = lastReceipt.invoice.invoice_number;
                  const orderItems = (lastReceipt.order.items ?? []).map((it) => ({
                    product_id: it.product_id,
                    ...(it.product_name ? { product_name: it.product_name } : {}),
                    quantity: it.quantity,
                    unit_price: it.unit_price,
                  }));
                  setLastReceipt(null);
                  handleOpenExchangeModal(invoiceId, invoiceNum, orderItems);
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/5 py-2 px-3 text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-all shadow-2xs"
                title="Start Exchange for items from this sale"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                Exchange Items from This Sale
              </button>
              <button
                type="button"
                onClick={() => setLastReceipt(null)}
                className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-white hover:bg-primary-hover cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                Next Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Counter Product Exchange Modal */}
      <PosExchangeModal
        isOpen={isExchangeModalOpen}
        onClose={() => setIsExchangeModalOpen(false)}
        session={session}
        products={products}
        initialInvoiceId={exchangeInitialInvoiceId}
        initialInvoiceNumber={exchangeInitialInvoiceNumber}
        initialOrderItems={exchangeInitialOrderItems}
        onExchangeCompleted={() => {
          refetchProducts();
        }}
      />
    </div>
  );
}
