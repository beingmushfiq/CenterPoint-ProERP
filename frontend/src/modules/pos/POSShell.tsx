import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlignJustify,
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard,
  FileText,
  Filter,
  History,
  Package,
  Keyboard,
  Minus,
  PauseCircle,
  Phone,
  PlayCircle,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Smartphone,
  Split,
  StickyNote,
  Store,
  Trash2,
  User,
  Wallet,
  Tag,
  BarChart3,
  X,
} from 'lucide-react';
import type { PosSession, PosCheckoutPayload, PosCheckoutPaymentPayload, PosCheckoutResult, PosHeldSale } from '../../types/api/pos';
import type { Product, Category } from '../../types/api/catalog';
import type { Invoice } from '../../types/api/sales';
import { api } from '../../lib/api/client';
import { cn } from '../../lib/utils';
import { useCurrency } from '../../hooks/useCurrency';
import { notify } from '../../components/ui/Toast';
import { useDocumentPrint } from '../../components/print/useDocumentPrint';
import { ThermalReceipt } from '../../components/print/receipts/ThermalReceipt';
import { SalesInvoiceDocument } from '../../components/print/documents/SalesInvoiceDocument';
import { useBusinessConfig } from '../../lib/document/useBusinessConfig';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';
import { PosExchangeModal } from './components/PosExchangeModal';
import { PosReturnModal } from './components/PosReturnModal';
import { MidShiftSummaryModal } from './components/MidShiftSummaryModal';
import './POSShell.css';

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
  customerPartyId?: number | null;
  customerName: string;
  customerPhone: string;
  tenderMethod: PosPaymentMethod;
  cashTendered: string;
  isSplitPayment?: boolean;
  splitPayments?: PosPaymentLine[];
  order_discount_type?: 'flat' | 'percentage';
  order_discount_value?: string;
  notes?: string;
}

export function POSShell({ session, onExit }: POSShellProps) {
  const { formatCurrency, currencySymbol, currencyCode } = useCurrency();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart' | 'recent' | 'held' | 'shift'>('catalog');

  // Recent Sales & Invoices in POS
  const { data: recentInvoices = [], isLoading: loadingRecentInvoices, refetch: refetchRecentInvoices } = useQuery<Invoice[]>({
    queryKey: ['pos', 'recent-sales', session.id],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: Invoice[] } | Invoice[]>('/sales/invoices?per_page=15');
        const raw = res.data;
        return Array.isArray(raw) ? raw : (raw?.data ?? []);
      } catch {
        return [];
      }
    },
    enabled: mobileTab === 'recent',
  });

  // Terminal Drawer (left slide-in overlay)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Mid-Shift X-Report Summary Modal
  const [showMidShiftSummary, setShowMidShiftSummary] = useState(false);

  // Coupon code state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    desc: string;
    type: 'flat' | 'percentage';
    value: number;
  } | null>(null);

  // Live clock state
  const [liveClock, setLiveClock] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  // Customer pill dropdown
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);

  // Category scroll & collapse state (Default: compact single-row bar as preferred)
  const [isCategoriesCollapsed, setIsCategoriesCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pos_category_collapsed');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const toggleCategoriesCollapsed = (collapsed: boolean) => {
    setIsCategoriesCollapsed(collapsed);
    try {
      localStorage.setItem('pos_category_collapsed', String(collapsed));
    } catch {
      // ignore
    }
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      categoryScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Sale Note expansion state
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  
  // Multi-cart slots (up to 5 concurrent held transactions)
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [slots, setSlots] = useState<CartSlot[]>([
    { id: 1, label: 'Cart 1', cart: [], customerPartyId: null, customerName: '', customerPhone: '', tenderMethod: 'cash', cashTendered: '', isSplitPayment: false, splitPayments: [], order_discount_type: 'flat', order_discount_value: '', notes: '' },
    { id: 2, label: 'Cart 2 (Hold)', cart: [], customerPartyId: null, customerName: '', customerPhone: '', tenderMethod: 'cash', cashTendered: '', isSplitPayment: false, splitPayments: [], order_discount_type: 'flat', order_discount_value: '', notes: '' },
    { id: 3, label: 'Cart 3 (Hold)', cart: [], customerPartyId: null, customerName: '', customerPhone: '', tenderMethod: 'cash', cashTendered: '', isSplitPayment: false, splitPayments: [], order_discount_type: 'flat', order_discount_value: '', notes: '' },
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

  // POS Counter Return & Refund State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnInitialInvoiceId, setReturnInitialInvoiceId] = useState<number | null>(null);
  const [returnInitialInvoiceNumber, setReturnInitialInvoiceNumber] = useState<string | null>(null);
  const [returnInitialOrderItems, setReturnInitialOrderItems] = useState<
    Array<{
      product_id: number;
      product_name?: string;
      quantity: number | string;
      unit_price: number | string;
    }>
  >([]);

  const handleOpenReturnModal = (
    invoiceId?: number | null,
    invoiceNum?: string | null,
    items?: Array<{ product_id: number; product_name?: string; quantity: number | string; unit_price: number | string }>
  ) => {
    setReturnInitialInvoiceId(invoiceId ?? null);
    setReturnInitialInvoiceNumber(invoiceNum ?? null);
    setReturnInitialOrderItems(items ?? []);
    setIsReturnModalOpen(true);
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
        // Backend enforces max per_page of 100
        const res = await api.get<{ data?: Product[]; meta?: { last_page?: number } } | Product[]>(
          '/products?per_page=100&include=category,images'
        );
        const raw = res.data;
        let list: Product[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
        
        // If multiple pages exist, load remaining pages up to page 5 (up to 500 catalog items)
        const lastPage = !Array.isArray(raw) && raw?.meta?.last_page ? raw.meta.last_page : 1;
        if (lastPage > 1) {
          const fetchPromises: Array<ReturnType<typeof api.get<Product[] | { data?: Product[] }>>> = [];
          for (let p = 2; p <= Math.min(lastPage, 5); p++) {
            fetchPromises.push(
              api.get<Product[] | { data?: Product[] }>(`/products?page=${p}&per_page=100&include=category,images`)
            );
          }
          const results = await Promise.allSettled(fetchPromises);
          for (const r of results) {
            if (r.status === 'fulfilled') {
              const pageData = r.value.data;
              const pageList = Array.isArray(pageData) ? pageData : (pageData?.data ?? []);
              list = list.concat(pageList);
            }
          }
        }

        return list;
      } catch (err) {
        console.error('Failed to load products for POS', err);
        return [];
      }
    },
  });

  // Query categories for smart category filtering in POS
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['catalog', 'categories', 'pos'],
    queryFn: async () => {
      try {
        const res = await api.get<Category[] | { data: Category[] }>('/categories');
        const raw = res.data;
        return Array.isArray(raw) ? raw : (raw?.data ?? []);
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  interface PosCustomerOption {
    id: string | number;
    party_id?: number;
    name: string;
    code?: string;
    phone?: string;
    email?: string;
    type?: string;
    is_dealer?: boolean;
  }

  // Query existing active customers for quick selection
  const { data: customerOptions = [] } = useQuery<PosCustomerOption[]>({
    queryKey: ['parties', 'customer-options', 'pos'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: PosCustomerOption[] } | PosCustomerOption[]>('/parties/options?is_customer=true');
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
        return list;
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
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

  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    const KNOWN_COUPONS: Record<string, { desc: string; type: 'flat' | 'percentage'; value: number }> = {
      WELCOME10: { desc: '10% Welcome Discount', type: 'percentage', value: 10 },
      FLAT50: { desc: '৳50 Off First Purchase', type: 'flat', value: 50 },
      VIP15: { desc: '15% VIP Retail Voucher', type: 'percentage', value: 15 },
      SUMMER20: { desc: '20% Summer Promotional Off', type: 'percentage', value: 20 },
      SAVE100: { desc: '৳100 Mega Savings', type: 'flat', value: 100 },
      PROMO5: { desc: '5% Checkout Saver', type: 'percentage', value: 5 },
    };

    const promo = KNOWN_COUPONS[code];
    if (promo) {
      setAppliedCoupon({ code, ...promo });
      updateCurrentSlot({
        order_discount_type: promo.type,
        order_discount_value: promo.value.toString(),
      });
      notify.success(`Applied coupon: ${code}`, {
        description: `${promo.desc} applied to cart`,
      });
    } else {
      const pctMatch = code.match(/(\d+)$/);
      if (pctMatch && parseInt(pctMatch[1] ?? '0', 10) <= 50) {
        const val = parseInt(pctMatch[1] ?? '0', 10);
        setAppliedCoupon({ code, desc: `${val}% Promotional Discount`, type: 'percentage', value: val });
        updateCurrentSlot({
          order_discount_type: 'percentage',
          order_discount_value: val.toString(),
        });
        notify.success(`Applied coupon: ${code}`, {
          description: `${val}% discount applied`,
        });
      } else {
        notify.error('Invalid Coupon Code', {
          description: 'Try WELCOME10, VIP15, SUMMER20, FLAT50 or SAVE100',
        });
      }
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    updateCurrentSlot({
      order_discount_value: '',
    });
    notify.info('Coupon removed');
  };

  // Live clock — ticks every second
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLiveClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Close customer dropdown on outside click
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setIsCustomerDropdownOpen(false);
        setCustomerSearchQuery('');
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // ESC closes terminal drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const addToCart = useCallback((product: Product) => {
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
  }, [updateCurrentSlot]);

  // Audio synthesis for POS scanner feedback (Web Audio API)
  const playPosBeep = useCallback((type: 'success' | 'error' = 'success') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Audio context policy fallback
    }
  }, []);

  // Universal Barcode Scan & Search Auto-Add Engine
  const handleBarcodeScanOrSearch = useCallback(async (barcodeRaw: string): Promise<boolean> => {
    // 1. Sanitize incoming barcode/SKU: strip quotes, control chars, newlines, tabs, and outer whitespace
    const code = barcodeRaw.replace(/["'\r\n\t\x00-\x1F\x7F-\x9F]/g, '').trim();
    if (!code) return false;
    const lower = code.toLowerCase();

    const clearInput = () => {
      setSearch('');
      if (barcodeInputRef.current) {
        barcodeInputRef.current.value = '';
      }
    };

    // 2. Check in-memory products (instant zero-latency exact match)
    const inMemoryMatch = products.find((p) => {
      const b = p.barcode ? p.barcode.replace(/["'\r\n\t\x00-\x1F\x7F-\x9F]/g, '').trim().toLowerCase() : '';
      const s = p.sku ? p.sku.replace(/["'\r\n\t\x00-\x1F\x7F-\x9F]/g, '').trim().toLowerCase() : '';
      const n = p.name ? p.name.trim().toLowerCase() : '';
      return (b && b === lower) || (s && s === lower) || (n && n === lower);
    });

    if (inMemoryMatch) {
      addToCart(inMemoryMatch);
      playPosBeep('success');
      notify.success(`Added to Cart: ${inMemoryMatch.name}`, {
        description: `SKU: ${inMemoryMatch.sku} • ${currencySymbol}${parseFloat(inMemoryMatch.default_sale_price || inMemoryMatch.standard_cost || '100').toFixed(2)}`,
      });
      clearInput();
      barcodeInputRef.current?.focus();
      return true;
    }

    // 3. Fallback: Search backend catalog for barcode / SKU
    try {
      const res = await api.get<{ data?: Product[] } | Product[]>(
        `/products?search=${encodeURIComponent(code)}&per_page=5&include=category,images`
      );
      const raw = res.data;
      const list: Product[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
      const exactOrFirst =
        list.find((p) => {
          const b = p.barcode ? p.barcode.replace(/["'\r\n\t\x00-\x1F\x7F-\x9F]/g, '').trim().toLowerCase() : '';
          const s = p.sku ? p.sku.replace(/["'\r\n\t\x00-\x1F\x7F-\x9F]/g, '').trim().toLowerCase() : '';
          return (b && b === lower) || (s && s === lower);
        }) || list[0];

      if (exactOrFirst) {
        addToCart(exactOrFirst);
        playPosBeep('success');
        notify.success(`Added to Cart: ${exactOrFirst.name}`, {
          description: `SKU: ${exactOrFirst.sku} • ${currencySymbol}${parseFloat(exactOrFirst.default_sale_price || exactOrFirst.standard_cost || '100').toFixed(2)}`,
        });
        clearInput();
        barcodeInputRef.current?.focus();
        return true;
      }
    } catch (err) {
      console.warn('Backend barcode lookup error', err);
    }

    // 4. Fallback: If search matches exactly 1 product across catalog
    const matches = products.filter((p) => {
      const b = p.barcode ? p.barcode.toLowerCase() : '';
      const s = p.sku ? p.sku.toLowerCase() : '';
      const n = p.name ? p.name.toLowerCase() : '';
      return n.includes(lower) || s.includes(lower) || b.includes(lower);
    });
    if (matches.length === 1 && matches[0]) {
      const p = matches[0];
      addToCart(p);
      playPosBeep('success');
      notify.success(`Added to Cart: ${p.name}`, {
        description: `SKU: ${p.sku}`,
      });
      clearInput();
      barcodeInputRef.current?.focus();
      return true;
    }

    playPosBeep('error');
    notify.error('Product Not Found', {
      description: `No product matching barcode or SKU "${code}"`,
    });
    return false;
  }, [products, addToCart, playPosBeep, currencySymbol]);

  // HID Hardware Barcode Scanner Buffer & Burst Detector
  const scannerBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const scanBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScannerKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      const isBarcodeInput = target === barcodeInputRef.current;
      const isOtherInput = isInput && !isBarcodeInput;

      // Don't hijack keystrokes if cashier is actively typing in Customer Name, Phone, Sale Note, or Discount
      if (isOtherInput) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Enter or Tab indicates end of a scanned barcode
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (scanBurstTimerRef.current) {
          clearTimeout(scanBurstTimerRef.current);
          scanBurstTimerRef.current = null;
        }

        const buffer = scannerBufferRef.current.trim();
        const inputVal = isBarcodeInput ? (barcodeInputRef.current?.value || '').trim() : '';
        const candidate = inputVal || buffer;
        scannerBufferRef.current = '';

        if (candidate.length >= 2) {
          e.preventDefault();
          e.stopPropagation();
          handleBarcodeScanOrSearch(candidate);
          if (isBarcodeInput && barcodeInputRef.current) {
            barcodeInputRef.current.value = '';
            setSearch('');
          }
        }
        return;
      }

      // Ignore modifier or non-character keys
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Scanners type at high speed (<70ms between characters)
      if (timeDiff > 70) {
        scannerBufferRef.current = e.key;
      } else {
        scannerBufferRef.current += e.key;
      }

      // Clear any pending burst timer
      if (scanBurstTimerRef.current) {
        clearTimeout(scanBurstTimerRef.current);
      }

      // Handle barcode scanners configured without an Enter suffix:
      // When characters stop arriving after a rapid burst, trigger auto-add
      if (scannerBufferRef.current.length >= 3) {
        scanBurstTimerRef.current = setTimeout(() => {
          const finalBuffer = scannerBufferRef.current.trim();
          scannerBufferRef.current = '';
          if (finalBuffer.length >= 3) {
            handleBarcodeScanOrSearch(finalBuffer);
            if (isBarcodeInput && barcodeInputRef.current) {
              barcodeInputRef.current.value = '';
              setSearch('');
            }
          }
        }, 75);
      }
    };

    window.addEventListener('keydown', handleScannerKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleScannerKeyDown, true);
      if (scanBurstTimerRef.current) clearTimeout(scanBurstTimerRef.current);
    };
  }, [handleBarcodeScanOrSearch]);

  // Global Paste Listener (Ctrl+V anywhere in POS immediately adds product)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      const isBarcodeInput = target === barcodeInputRef.current;
      const isOtherInput = isInput && !isBarcodeInput;

      // Don't hijack paste if cashier is specifically editing customer name/phone/notes/discount
      if (isOtherInput) return;

      const pasted = e.clipboardData?.getData('text');
      if (pasted && pasted.trim()) {
        e.preventDefault();
        const clean = pasted.replace(/["'\r\n\t]/g, '').trim();
        handleBarcodeScanOrSearch(clean);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handleBarcodeScanOrSearch]);

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
      customerPartyId: null,
      customerName: '',
      customerPhone: '',
      cashTendered: '',
      isSplitPayment: false,
      splitPayments: [],
      order_discount_type: 'flat',
      order_discount_value: '',
      notes: '',
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
      ...(currentSlot.customerPartyId ? { party_id: currentSlot.customerPartyId } : {}),
      customer_name: customerName || 'Walk-in Customer',
      customer_phone: customerPhone || null,
      order_date: new Date().toISOString().slice(0, 10),
      order_discount_type: orderDiscType,
      order_discount_value: orderDiscVal.toFixed(4),
      discount_amount: discountTotal.toFixed(4),
      ...(currentSlot.notes?.trim() ? { notes: currentSlot.notes.trim() } : {}),
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
        {...(lastReceipt.order.notes ? { orderNotes: lastReceipt.order.notes } : {})}
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
          customerPartyId: currentSlot.customerPartyId || null,
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
    void api.get<PosHeldSale>(`/pos/held-sales/${heldSale.id}`).catch(() => {});
    const payload = heldSale.cart_payload;
    const payloadExtra = payload as { isSplitPayment?: boolean; splitPayments?: PosPaymentLine[]; customerPartyId?: number | null };
    updateCurrentSlot({
      cart: (payload.items as unknown as CartItem[]) || [],
      customerPartyId: payloadExtra.customerPartyId ?? heldSale.customer_party_id ?? null,
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

  // Smart category tabs derived from actual products & category records
  const categoryTabs = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    const catNameMap = new Map<string, string>();
    categories.forEach((c) => {
      catNameMap.set(String(c.id), c.name);
    });

    products.forEach((p) => {
      const catId = p.category_id ? String(p.category_id) : 'uncategorized';
      const catName =
        p.category_name ||
        p.category?.name ||
        (p.category_id ? catNameMap.get(String(p.category_id)) : null) ||
        (catId === 'uncategorized' ? 'General / Others' : catId);

      const existing = counts.get(catId);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(catId, { id: catId, name: catName, count: 1 });
      }
    });

    const list = Array.from(counts.values()).sort((a, b) => b.count - a.count);
    return [
      { id: 'all', name: 'All Products', count: products.length },
      ...list,
    ];
  }, [products, categories]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      // 1. Smart Category Filter
      if (selectedCategory !== 'all') {
        const pCatId = p.category_id ? String(p.category_id) : 'uncategorized';
        if (pCatId !== selectedCategory) return false;
      }

      // 2. Search Filter
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
  }, [products, search, selectedCategory]);

  // Filtered customer options for customer pill dropdown
  const filteredCustomerOptions = useMemo(() => {
    if (!customerSearchQuery.trim()) return customerOptions;
    const q = customerSearchQuery.toLowerCase();
    return customerOptions.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q))
    );
  }, [customerOptions, customerSearchQuery]);

  // Operator initials for cashier avatar
  const operatorInitials = useMemo(() => {
    const name = session.operator_name || 'POS';
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }, [session.operator_name]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base text-default">

      {/* ── Terminal Drawer Backdrop ─────────────────────────────────── */}
      <div
        className={`pos-drawer-backdrop ${isDrawerOpen ? 'open' : ''}`}
        onClick={() => setIsDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* ── Left Terminal Drawer ─────────────────────────────────────── */}
      <aside className={`pos-drawer ${isDrawerOpen ? 'open' : ''}`} aria-label="Terminal Navigation">
        {/* Drawer Header */}
        <div className="pos-drawer-header">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 font-black text-xs border border-emerald-500/20">
              POS
            </div>
            <div>
              <p className="font-bold text-sm text-default">
                {session.terminal_name ?? 'POS Terminal'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="pos-status-dot" />
                <span className="text-[11px] text-muted">
                  Live — {session.session_number}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-default text-muted hover:text-default hover:bg-surface-raised transition-all cursor-pointer"
            title="Close drawer (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="pos-drawer-body">

          {/* Live Clock Section */}
          <div className="pos-drawer-section flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Live Clock</span>
            </div>
            <span className="pos-live-clock">{liveClock}</span>
          </div>

          {/* Session KPIs */}
          <div className="pos-drawer-section">
            <div className="pos-drawer-section-title">
              <Store className="h-3.5 w-3.5 text-sky-400" />
              Branch &amp; Session
            </div>
            <div className="pos-drawer-kpi-grid">
              <div className="pos-drawer-kpi-card">
                <span className="pos-drawer-kpi-label">Branch</span>
                <span className="pos-drawer-kpi-value text-xs leading-tight">
                  {session.branch_name ?? 'Main Outlet'}
                </span>
              </div>
              <div className="pos-drawer-kpi-card">
                <span className="pos-drawer-kpi-label">Expected Cash</span>
                <span className="pos-drawer-kpi-value text-emerald-400">
                  {formatCurrency(session.expected_cash)}
                </span>
              </div>
              <div className="pos-drawer-kpi-card" style={{ gridColumn: 'span 2' }}>
                <span className="pos-drawer-kpi-label">Operator</span>
                <span className="pos-drawer-kpi-value">
                  {session.operator_name ?? 'Cashier'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Operations */}
          <div className="pos-drawer-section">
            <div className="pos-drawer-section-title">
              <AlignJustify className="h-3.5 w-3.5 text-amber-400" />
              Quick Operations
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setShowMidShiftSummary(true); setIsDrawerOpen(false); }}
                className="pos-drawer-nav-item"
              >
                <div className="pos-drawer-nav-icon bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-default">Mid-Shift X-Report</p>
                  <p className="text-[10px] text-muted">Drawer &amp; tender breakdown</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setIsParkedDrawerOpen(true); setIsDrawerOpen(false); }}
                className="pos-drawer-nav-item"
              >
                <div className="pos-drawer-nav-icon bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-default">Parked / Held Sales</p>
                  <p className="text-[10px] text-muted">Resume parked customer carts</p>
                </div>
                {heldSales.length > 0 && (
                  <span className="pos-held-badge">{heldSales.length}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => { handleOpenExchangeModal(); setIsDrawerOpen(false); }}
                className="pos-drawer-nav-item"
              >
                <div className="pos-drawer-nav-icon bg-primary/10 border border-primary/20 text-primary">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-default">Product Exchange</p>
                  <p className="text-[10px] text-muted">Swap items from previous sale</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { handleOpenReturnModal(); setIsDrawerOpen(false); }}
                className="pos-drawer-nav-item"
              >
                <div className="pos-drawer-nav-icon bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-default">Return &amp; Refund</p>
                  <p className="text-[10px] text-muted">Process customer returns</p>
                </div>
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts Reference */}
          <div className="pos-drawer-section">
            <div className="pos-drawer-section-title">
              <Keyboard className="h-3.5 w-3.5 text-indigo-400" />
              Keyboard Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
              {[
                ['F2', 'Barcode / Search'],
                ['F4', 'Customer'],
                ['F8', 'Order Discount'],
                ['F9', 'Next Payment'],
                ['F10', 'Cash & Focus'],
                ['Esc', 'Close Panels'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-1.5 bg-surface border border-default rounded-lg px-2 py-1.5">
                  <span className="bg-surface-raised border border-strong rounded px-1 text-[9px] font-bold text-default">
                    {key}
                  </span>
                  <span className="text-muted text-[9px] leading-tight">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Language + Exit */}
          <div className="flex gap-2">
            <div className="flex-1">
              <LanguageSwitcher />
            </div>
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-2 text-xs font-medium text-default hover:bg-surface-raised cursor-pointer transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Exit
            </button>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="pos-drawer-footer">
          <div className="text-[10px] text-muted font-mono">
            Session #{session.session_number}
          </div>
          <span className="pos-live-clock text-sm">{liveClock}</span>
        </div>
      </aside>

      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-default bg-surface-sunken px-3 sm:px-4 z-40">
        {/* Left: Drawer toggle + Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-default bg-surface text-muted hover:text-default hover:bg-surface-raised transition-all cursor-pointer"
            title="Open Terminal Menu"
          >
            <AlignJustify className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 font-black text-[11px] border border-emerald-500/20">
              POS
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-default leading-tight">
                  {session.terminal_name ?? 'POS Register'}
                </span>
                <span className="hidden md:inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500 border border-emerald-500/20">
                  <span className="pos-status-dot" style={{ width: 5, height: 5 }} />
                  Live
                </span>
              </div>
              <p className="text-[10px] text-muted font-mono leading-tight">
                {session.branch_name ?? 'Main Outlet'}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Live clock (desktop) */}
        <div className="hidden lg:flex flex-col items-center">
          <span className="pos-live-clock text-base">{liveClock}</span>
          <span className="text-[9px] text-subtle font-mono">
            {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile: Segmented View Controller (< 1024px) */}
          <div className="lg:hidden flex items-center bg-surface-sunken p-1 rounded-xl border border-default gap-1">
            <button
              type="button"
              onClick={() => setMobileTab('catalog')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${mobileTab === 'catalog' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-default'}`}
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('cart')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${mobileTab === 'cart' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-default'}`}
            >
              <ShoppingBag className="size-3" />
              <span>Cart</span>
              {cart.length > 0 && (
                <span className="rounded-full bg-white/20 px-1 text-[9px] font-black">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('recent')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${mobileTab === 'recent' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-default'}`}
            >
              <History className="size-3" />
              <span>Recent</span>
            </button>
          </div>

          {/* Held Sales */}
          <button
            onClick={() => setIsParkedDrawerOpen(true)}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs font-semibold text-default hover:bg-surface-raised cursor-pointer transition-colors"
            title="Parked / Held Sales"
          >
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="hidden md:inline">Held</span>
            {heldSales.length > 0 && <span className="pos-held-badge">{heldSales.length}</span>}
          </button>

          {/* Mid-Shift X-Report Shortcut */}
          <button
            type="button"
            onClick={() => setShowMidShiftSummary(true)}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs font-semibold text-default hover:bg-surface-raised cursor-pointer transition-colors"
            title="Mid-Shift X-Report (Tender & Drawer Summary)"
          >
            <BarChart3 className="h-4 w-4 text-emerald-500" />
            <span className="hidden md:inline">X-Report</span>
          </button>

          {/* Cashier Avatar Chip */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="pos-cashier-chip"
            title="Terminal Menu"
          >
            <div className="pos-cashier-avatar">{operatorInitials}</div>
            <div className="hidden sm:block">
              <p className="text-[11px] font-bold text-default leading-tight">
                {session.operator_name ?? 'Cashier'}
              </p>
              <p className="text-[9px] text-muted">
                {session.session_number}
              </p>
            </div>
          </button>

          {/* Exit */}
          <button
            onClick={onExit}
            className="flex items-center gap-1 rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs font-medium text-default hover:bg-surface-raised cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* ── Main Workspace ─────────────────────────────────────────── */}
      <div className="pos-main-workspace flex flex-1 overflow-hidden relative">

        {/* ── LEFT: Product Catalog ───────────────────────────────── */}
        <div className={`flex-1 flex-col border-r border-default p-3 sm:p-4 overflow-hidden ${
          mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'
        }`}>

          {/* Search & Barcode Scan */}
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan barcode or search products (SKU, Name)..."
                value={search}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted && pasted.trim()) {
                    e.preventDefault();
                    const clean = pasted.replace(/["'\r\n\t]/g, '').trim();
                    handleBarcodeScanOrSearch(clean);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearch(val);

                  const cleanVal = val.replace(/["'\r\n\t]/g, '').trim().toLowerCase();
                  if (cleanVal.length >= 3) {
                    // Immediate exact match check against loaded products by SKU or Barcode
                    const exactMatch = products.find((p) => {
                      const b = p.barcode ? p.barcode.trim().toLowerCase() : '';
                      const s = p.sku ? p.sku.trim().toLowerCase() : '';
                      return (b && b === cleanVal) || (s && s === cleanVal);
                    });

                    if (exactMatch) {
                      handleBarcodeScanOrSearch(val.trim());
                      return;
                    }

                    // Auto-detect standard 8-14 digit EAN/UPC scanned without Enter
                    if (/^\d{8,14}$/.test(val.trim())) {
                      handleBarcodeScanOrSearch(val.trim());
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const query = (barcodeInputRef.current?.value || search).trim();
                    if (query) {
                      handleBarcodeScanOrSearch(query);
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

          {/* Smart Category Navigation Bar */}
          <div className="mb-3">
            {isCategoriesCollapsed ? (
              <div className="flex items-center justify-between rounded-xl border border-default bg-surface px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-semibold text-muted text-[11px]">Category:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-7 rounded-lg border border-default bg-surface-sunken px-2 text-xs font-semibold text-default focus:border-primary focus:outline-none cursor-pointer"
                  >
                    {categoryTabs.map((tab) => (
                      <option key={tab.id} value={tab.id}>
                        {tab.name} ({tab.count})
                      </option>
                    ))}
                  </select>
                  {selectedCategory !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategoriesCollapsed(false)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-default bg-surface-sunken hover:bg-surface px-2.5 py-1 rounded-lg border border-default transition-all cursor-pointer"
                  title="Expand Category Pills"
                >
                  <span>Categories</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollCategories('left')}
                  className="h-8 w-7 shrink-0 rounded-xl border border-default bg-surface hover:bg-surface-sunken flex items-center justify-center text-muted hover:text-default transition-all cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div
                  ref={categoryScrollRef}
                  onWheel={(e) => {
                    if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY;
                  }}
                  className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1 scroll-smooth no-scrollbar"
                >
                  {categoryTabs.map((tab) => {
                    const isActive = selectedCategory === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedCategory(tab.id)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none ${
                          isActive
                            ? 'bg-primary text-white shadow-sm font-bold'
                            : 'border border-default bg-surface text-muted hover:bg-surface-sunken hover:text-default'
                        }`}
                      >
                        <span>{tab.name}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-surface-sunken text-muted'}`}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => scrollCategories('right')}
                  className="h-8 w-7 shrink-0 rounded-xl border border-default bg-surface hover:bg-surface-sunken flex items-center justify-center text-muted hover:text-default transition-all cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleCategoriesCollapsed(true)}
                  className="h-8 shrink-0 px-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-default transition-all cursor-pointer"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Collapse</span>
                </button>
              </div>
            )}
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto pr-0.5">
            {loadingProducts ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="pos-product-card animate-pulse"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="pos-product-no-img" style={{ background: 'var(--color-surface-sunken)', border: 'none' }} />
                    <div className="h-3 w-3/4 rounded bg-surface-sunken mb-1" />
                    <div className="h-3 w-1/2 rounded bg-surface-sunken" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col h-48 items-center justify-center text-xs text-muted gap-2">
                <p>No products found matching your search or category filter.</p>
                {(selectedCategory !== 'all' || search) && (
                  <button
                    type="button"
                    onClick={() => { setSelectedCategory('all'); setSearch(''); }}
                    className="text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Clear filters and show all
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4">
                {filteredProducts.map((p) => {
                  const imageUrl =
                    p.image_url ||
                    p.images?.find((img) => img.is_primary)?.url ||
                    p.images?.[0]?.url ||
                    (p.online_meta as { image_url?: string } | null)?.image_url ||
                    null;
                  const price = parseFloat(p.default_sale_price || p.standard_cost || '100') || 100;
                  const catName = p.category_name || p.category?.name;
                  const cartQty = cart.find((ci) => String(ci.product.id) === String(p.id))?.quantity;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className="pos-product-card"
                    >
                      {imageUrl ? (
                        <div className="pos-product-img-wrap">
                          <img
                            src={imageUrl}
                            alt={p.name}
                            role="presentation"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const fallback = target.parentElement?.querySelector('.pos-img-fallback') as HTMLElement | null;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div
                            className="pos-img-fallback absolute inset-0 hidden items-center justify-center font-black text-2xl text-primary"
                            style={{ background: 'var(--color-primary-subtle)' }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          {/* Stock badge */}
                          {cartQty && cartQty > 0 ? (
                            <span
                              className="pos-product-badge"
                              style={{ background: 'rgba(16,185,129,0.85)', color: '#fff' }}
                            >
                              ✓ {cartQty} in cart
                            </span>
                          ) : (
                            catName && (
                              <span
                                className="pos-product-badge"
                                style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.9)' }}
                              >
                                {catName}
                              </span>
                            )
                          )}
                          <div className="pos-add-btn" aria-hidden="true">
                            <Plus className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      ) : (
                        <div className="pos-product-no-img">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {catName && !imageUrl && (
                        <span className="mb-1 inline-block truncate max-w-full rounded bg-surface-sunken px-1.5 py-0.5 text-[9px] font-medium text-muted uppercase tracking-wider">
                          {catName}
                        </span>
                      )}

                      <div
                        className="font-semibold text-xs text-default line-clamp-2 leading-snug"
                        title={p.name}
                      >
                        {p.name}
                      </div>
                      <div className="font-mono text-[9px] text-subtle mt-0.5">{p.sku}</div>
                      <div className="mt-auto pt-2 font-mono font-bold text-sm text-emerald-500">
                        {formatCurrency(price)}
                      </div>

                      {cartQty && cartQty > 0 && !imageUrl && (
                        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[9px] font-black">
                          {cartQty}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile Sticky Quick-Checkout Bar */}
          {cart.length > 0 && (
            <div className="lg:hidden sticky bottom-2 z-20 mt-3 p-3 bg-surface/95 backdrop-blur-md rounded-2xl border border-primary/30 shadow-xl flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-muted font-medium truncate">
                  {cart.length} line item{cart.length > 1 ? 's' : ''} in cart
                </p>
                <p className="font-mono font-black text-sm text-emerald-500">
                  {formatCurrency(grandTotal)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileTab('cart')}
                className="min-h-11 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <ShoppingBag className="size-4" />
                <span>View Cart →</span>
              </button>
            </div>
          )}
        </div>

        {/* ── MOBILE: Recent Sales / Invoices View (< 1024px) ──────── */}
        {mobileTab === 'recent' && (
          <div className="flex-1 lg:hidden flex flex-col p-3 sm:p-4 overflow-y-auto bg-surface space-y-3">
            <div className="flex items-center justify-between border-b border-default pb-2.5">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm text-default">Recent Terminal Invoices</h3>
              </div>
              <button
                type="button"
                onClick={() => refetchRecentInvoices()}
                className="p-1.5 rounded-lg border border-default text-muted hover:text-default bg-surface-sunken cursor-pointer"
                title="Refresh sales list"
              >
                <RefreshCw className={cn('size-3.5', loadingRecentInvoices && 'animate-spin')} />
              </button>
            </div>

            {loadingRecentInvoices ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted text-xs">
                <RefreshCw className="size-5 animate-spin text-primary" />
                <span>Loading recent terminal sales...</span>
              </div>
            ) : recentInvoices.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted text-xs">
                <FileText className="size-8 text-muted/40" />
                <span>No recent sales recorded yet.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="p-3 rounded-xl border border-default bg-surface-sunken/40 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-xs text-primary">{inv.invoice_number}</span>
                        <div className="text-[10px] text-muted">
                          {inv.invoice_date || new Date().toLocaleDateString()}
                          {inv.customer_name ? ` • ${inv.customer_name}` : ' • Walk-in'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-xs text-emerald-500">
                          {formatCurrency(inv.total_amount || 0)}
                        </div>
                        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface border border-default text-muted uppercase">
                          {inv.status || 'posted'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-default/40">
                      <button
                        type="button"
                        onClick={() => printDocument('pos-thermal', { invoice: inv, session })}
                        className="flex-1 min-h-[38px] px-2.5 rounded-lg bg-surface border border-default text-default hover:bg-surface-raised text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="size-3.5 text-muted" />
                        <span>Print Receipt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReturnModal(inv.id, inv.invoice_number)}
                        className="flex-1 min-h-[38px] px-2.5 rounded-lg bg-surface border border-default text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>Return</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── RIGHT: Cart & Payment Panel ─────────────────────────── */}
        <div className={`w-full lg:w-96 xl:w-112 2xl:w-128 shrink-0 flex-col border-l border-default bg-(--color-surface-sunken)/40 overflow-hidden ${
          mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Scrollable cart content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5">

            {/* Mobile Back Button */}
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setMobileTab('catalog')}
                className="w-full min-h-11 px-3 rounded-xl border border-default bg-surface text-default hover:bg-surface-raised font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Product Catalog
              </button>
            </div>

            {/* Multi-Cart Slot Tabs */}
            <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-default shadow-xs">
              {slots.map((slot, idx) => {
                const count = slot.cart.reduce((s, i) => s + i.quantity, 0);
                const slotTotal = slot.cart.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
                const isActive = idx === activeSlotIndex;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setActiveSlotIndex(idx)}
                    className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted hover:text-default hover:bg-surface-sunken'
                    }`}
                  >
                    <span className="truncate">{slot.label}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-surface-sunken text-emerald-500 border border-default'
                      }`}>
                        {count} {slotTotal > 0 && <span className="hidden xl:inline font-mono">({currencySymbol}{Math.round(slotTotal)})</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-default pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-bold text-sm text-default">{currentSlot.label} Order</span>
                  <span className="ml-2 rounded-full bg-surface-sunken border border-default px-2 py-0.5 text-[10px] font-bold text-muted font-mono">
                    {cart.reduce((s, i) => s + i.quantity, 0)} {cart.reduce((s, i) => s + i.quantity, 0) === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsParkModalOpen(true)}
                  disabled={cart.length === 0}
                  className="text-xs font-semibold text-amber-500 hover:text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
                  title="Hold this sale"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  <span>Hold</span>
                </button>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1"
                    title="Clear current cart"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items */}
            <div className="space-y-2">
              {cart.length === 0 ? (
                <div className="flex h-44 flex-col items-center justify-center text-muted border-2 border-dashed border-default/70 rounded-2xl bg-surface/40 p-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-sunken border border-default mb-3 text-muted">
                    <ShoppingBag className="h-6 w-6 stroke-1.5" />
                  </div>
                  <p className="text-sm font-bold text-default">Your cart is empty</p>
                  <p className="text-xs text-muted mt-0.5">Scan product barcode <span className="font-mono text-primary font-semibold">[F2]</span> or click items from catalog</p>
                  <div className="flex items-center gap-2 mt-3 text-[10px] font-mono text-subtle">
                    <span className="px-2 py-0.5 rounded bg-surface-sunken border border-default">F2 Search</span>
                    <span className="px-2 py-0.5 rounded bg-surface-sunken border border-default">F4 Customer</span>
                    <span className="px-2 py-0.5 rounded bg-surface-sunken border border-default">F10 Cash</span>
                  </div>
                </div>
              ) : (
                cart.map((item) => {
                  const lineGross = item.quantity * item.unit_price;
                  const isPct = item.discount_type === 'percentage';
                  const discAmt = isPct ? lineGross * (item.discount / 100) : Math.min(lineGross, item.discount || 0);
                  const lineTotal = Math.max(0, lineGross - discAmt);
                  return (
                    <div key={item.product.id} className="pos-cart-item bg-surface rounded-xl p-3 border border-default shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-xs text-default truncate" title={item.product.name}>
                              {item.product.name}
                            </p>
                            <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-surface-sunken text-muted border border-default">
                              {item.product.sku}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted mt-0.5 flex items-center gap-2">
                            <span>Unit: {formatCurrency(item.unit_price)}</span>
                            {discAmt > 0 && (
                              <span className="text-rose-500 font-semibold font-mono text-[10px]">
                                Discount: -{formatCurrency(discAmt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-black text-sm text-emerald-500">
                            {formatCurrency(lineTotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1.5 text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Controls row: Quantity Stepper, Unit Price, and Item Discount */}
                      <div className="mt-2.5 pt-2 border-t border-default/60 grid grid-cols-12 gap-2 items-center text-xs">
                        {/* Quantity Stepper */}
                        <div className="col-span-4 flex flex-col gap-0.5">
                          <label className="text-[10px] font-semibold text-muted">Qty</label>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-default bg-surface-sunken hover:bg-surface text-default cursor-pointer transition-colors font-bold"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                              className="h-7 w-full rounded-lg border border-default bg-surface px-1 text-center font-mono font-bold text-xs text-default focus:border-primary focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-default bg-surface-sunken hover:bg-surface text-default cursor-pointer transition-colors font-bold"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Unit Price input */}
                        <div className="col-span-3 flex flex-col gap-0.5">
                          <label className="text-[10px] font-semibold text-muted">Price ({currencySymbol})</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_price}
                            onChange={(e) => updateItemPrice(item.product.id, parseFloat(e.target.value) || 0)}
                            className="h-7 w-full rounded-lg border border-default bg-surface px-1.5 text-right font-mono font-bold text-xs text-default focus:border-primary focus:outline-none"
                          />
                        </div>

                        {/* Discount input & toggle */}
                        <div className="col-span-5 flex flex-col gap-0.5">
                          <label className="text-[10px] font-semibold text-muted">
                            Discount ({item.discount_type === 'percentage' ? '%' : currencySymbol})
                          </label>
                          <div className="flex items-center">
                            <div className="inline-flex rounded-l-lg border border-r-0 border-default bg-surface-sunken p-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.discount_type !== 'flat') toggleItemDiscountType(item.product.id);
                                }}
                                className={cn(
                                  "px-1.5 py-0.5 text-[9px] font-bold rounded cursor-pointer transition-colors",
                                  item.discount_type !== 'percentage'
                                    ? "bg-primary text-primary-fg"
                                    : "text-muted hover:text-default"
                                )}
                                title="Flat discount (cash off)"
                              >
                                {currencySymbol}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.discount_type !== 'percentage') toggleItemDiscountType(item.product.id);
                                }}
                                className={cn(
                                  "px-1.5 py-0.5 text-[9px] font-bold rounded cursor-pointer transition-colors",
                                  item.discount_type === 'percentage'
                                    ? "bg-primary text-primary-fg"
                                    : "text-muted hover:text-default"
                                )}
                                title="Percentage discount (%)"
                              >
                                %
                              </button>
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={item.discount === 0 ? '' : item.discount}
                              onChange={(e) => updateItemDiscount(item.product.id, Math.max(0, parseFloat(e.target.value) || 0))}
                              className="h-7 w-full rounded-r-lg border border-default bg-surface px-1.5 text-right font-mono font-bold text-xs text-rose-500 focus:border-primary focus:outline-none"
                            />
                          </div>
                          {/* Quick chips */}
                          <div className="flex items-center gap-1 mt-0.5 overflow-x-auto no-scrollbar">
                            {item.discount_type === 'percentage' ? (
                              [5, 10, 15, 20].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => updateItemDiscount(item.product.id, pct)}
                                  className={cn(
                                    "px-1 py-0.2 rounded border text-[9px] font-semibold transition-colors cursor-pointer shrink-0",
                                    item.discount === pct
                                      ? "bg-primary/10 border-primary text-primary font-bold"
                                      : "border-default/60 bg-surface-sunken text-muted hover:text-default"
                                  )}
                                >
                                  {pct}%
                                </button>
                              ))
                            ) : (
                              [10, 20, 50, 100].map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => updateItemDiscount(item.product.id, amt)}
                                  className={cn(
                                    "px-1 py-0.2 rounded border text-[9px] font-semibold transition-colors cursor-pointer shrink-0",
                                    item.discount === amt
                                      ? "bg-primary/10 border-primary text-primary font-bold"
                                      : "border-default/60 bg-surface-sunken text-muted hover:text-default"
                                  )}
                                >
                                  +{amt}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Customer Selector */}
            <div className="space-y-2 border-t border-default pt-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" />
                  <span>Customer Details</span>
                </label>
                {currentSlot.customerPartyId && (
                  <button
                    type="button"
                    onClick={() => updateCurrentSlot({ customerPartyId: null, customerName: '', customerPhone: '' })}
                    className="text-[10px] text-primary hover:underline cursor-pointer font-semibold"
                  >
                    Reset to Walk-in
                  </button>
                )}
              </div>

              {/* Customer Pill & Dropdown */}
              <div className="relative" ref={customerDropdownRef}>
                <button
                  type="button"
                  className={`pos-customer-pill ${currentSlot.customerPartyId ? 'has-customer' : ''}`}
                  onClick={() => {
                    setIsCustomerDropdownOpen((prev) => !prev);
                    setTimeout(() => customerSearchRef.current?.focus(), 60);
                  }}
                  aria-expanded={isCustomerDropdownOpen}
                >
                  <div className="pos-customer-avatar">
                    {currentSlot.customerPartyId
                      ? (currentSlot.customerName?.charAt(0).toUpperCase() || 'C')
                      : <User className="h-4 w-4" />
                    }
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold text-default truncate">
                      {currentSlot.customerName || 'Walk-in Customer'}
                    </p>
                    {currentSlot.customerPhone && (
                      <p className="text-[10px] text-muted">{currentSlot.customerPhone}</p>
                    )}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted shrink-0 transition-transform ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCustomerDropdownOpen && (
                  <div className="pos-customer-dropdown">
                    <div className="pos-customer-dropdown-search">
                      <Search className="h-3.5 w-3.5 text-muted shrink-0" />
                      <input
                        ref={customerSearchRef}
                        type="text"
                        placeholder="Search by name or phone..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-xs text-default placeholder:text-muted focus:outline-none"
                        autoComplete="off"
                      />
                    </div>
                    <div className="pos-customer-dropdown-list">
                      {/* Walk-in option */}
                      <button
                        type="button"
                        className={`pos-customer-option ${!currentSlot.customerPartyId ? 'active' : ''}`}
                        onClick={() => {
                          updateCurrentSlot({ customerPartyId: null, customerName: '', customerPhone: '' });
                          setIsCustomerDropdownOpen(false);
                          setCustomerSearchQuery('');
                        }}
                      >
                        <div className="pos-customer-avatar" style={{ width: 26, height: 26, borderRadius: 7, fontSize: 10 }}>
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-semibold text-default">Walk-in Customer</p>
                          <p className="text-[10px] text-muted">General Retail Sale</p>
                        </div>
                      </button>
                      {filteredCustomerOptions.map((c) => (
                        <button
                          key={c.party_id || c.id}
                          type="button"
                          className={`pos-customer-option ${String(currentSlot.customerPartyId) === String(c.party_id || c.id) ? 'active' : ''}`}
                          onClick={() => {
                            updateCurrentSlot({
                              customerPartyId: Number(c.party_id || c.id),
                              customerName: c.name,
                              customerPhone: c.phone || '',
                            });
                            setIsCustomerDropdownOpen(false);
                            setCustomerSearchQuery('');
                          }}
                        >
                          <div
                            className="pos-customer-avatar"
                            style={{ width: 26, height: 26, borderRadius: 7, fontSize: 10, background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-left min-w-0">
                            <p className="text-xs font-semibold text-default truncate">{c.name}</p>
                            <p className="text-[10px] text-muted">
                              {c.phone ?? ''} {c.type ? `· ${c.type}` : ''}
                            </p>
                          </div>
                        </button>
                      ))}
                      {filteredCustomerOptions.length === 0 && customerSearchQuery && (
                        <p className="text-center text-[10px] text-muted py-4">No customers found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual name/phone inputs for walk-in override */}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
                  <input
                    ref={customerNameInputRef}
                    type="text"
                    placeholder="Name (F4)"
                    value={customerName}
                    onChange={(e) => updateCurrentSlot({ customerName: e.target.value })}
                    className="h-8.5 w-full rounded-xl border border-default bg-surface pl-8 pr-2.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={customerPhone}
                    onChange={(e) => updateCurrentSlot({ customerPhone: e.target.value })}
                    className="h-8.5 w-full rounded-xl border border-default bg-surface pl-8 pr-2.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Sale Note */}
            <div className="rounded-xl border border-default bg-surface p-2.5 space-y-1.5 shadow-xs">
              <button
                type="button"
                onClick={() => setIsNoteExpanded(!isNoteExpanded)}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted hover:text-default cursor-pointer transition-colors w-full"
              >
                <StickyNote className="h-3.5 w-3.5 text-primary" />
                <span>Sale Note</span>
                {currentSlot.notes?.trim() && (
                  <span className="rounded-full bg-(--color-primary)/10 text-primary px-1.5 py-0.5 text-[9px] font-bold lowercase">
                    added
                  </span>
                )}
                <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${isNoteExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isNoteExpanded && (
                <div className="pt-1 space-y-1">
                  <textarea
                    rows={2}
                    placeholder="Add note for this sale..."
                    value={currentSlot.notes || ''}
                    onChange={(e) => updateCurrentSlot({ notes: e.target.value })}
                    className="w-full rounded-lg border border-default bg-surface-sunken p-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none resize-none"
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span>Printed on receipt</span>
                    <span>{(currentSlot.notes || '').length}/500</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method — 2×2 Large Icon Grid */}
            <div className="space-y-2.5 border-t border-default pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-primary" />
                  <span>Payment Method</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextSplit = !isSplitPayment;
                    updateCurrentSlot((prev) => ({
                      ...prev,
                      isSplitPayment: nextSplit,
                      splitPayments: nextSplit && (!prev.splitPayments || prev.splitPayments.length === 0)
                        ? [{ id: '1', method: prev.tenderMethod || 'cash', amount: grandTotal }]
                        : (prev.splitPayments ?? []),
                    }));
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSplitPayment
                      ? 'bg-primary text-white shadow-sm'
                      : 'border border-default bg-surface text-muted hover:text-default hover:bg-surface-sunken'
                  }`}
                >
                  <Split className="h-3 w-3" />
                  <span>{isSplitPayment ? 'Multi-Pay (Split)' : 'Split'}</span>
                </button>
              </div>

              {!isSplitPayment ? (
                <>
                  {/* 2×2 Large Payment Buttons */}
                  <div className="pos-payment-grid">
                    <button
                      type="button"
                      onClick={() => updateCurrentSlot({ tenderMethod: 'cash' })}
                      className={`pos-payment-btn ${tenderMethod === 'cash' ? 'active' : ''}`}
                    >
                      <span className="pos-payment-shortcut">F10</span>
                      <Banknote className="h-6 w-6" />
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCurrentSlot({ tenderMethod: 'card' })}
                      className={`pos-payment-btn ${tenderMethod === 'card' ? 'active' : ''}`}
                    >
                      <CreditCard className="h-6 w-6" />
                      <span>Card / POS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCurrentSlot({ tenderMethod: 'mobile_banking' })}
                      className={`pos-payment-btn ${tenderMethod === 'mobile_banking' ? 'active' : ''}`}
                    >
                      <Smartphone className="h-6 w-6" />
                      <span>bKash / Nagad</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCurrentSlot({ tenderMethod: 'credit_adjustment' })}
                      className={`pos-payment-btn ${tenderMethod === 'credit_adjustment' ? 'active' : ''}`}
                    >
                      <Wallet className="h-6 w-6" />
                      <span>Credit / Due</span>
                    </button>
                  </div>

                  {/* Cash Tendered & Quick Cash Suggestions */}
                  {tenderMethod === 'cash' && (
                    <div className="rounded-xl bg-surface border border-default p-2.5 space-y-2 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted flex items-center gap-1.5">
                          <Banknote className="size-4 text-emerald-500" />
                          <span>Cash Received:</span>
                        </span>
                        <div className="relative w-36">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-muted">
                            {currencySymbol}
                          </span>
                          <input
                            ref={cashTenderedInputRef}
                            type="number"
                            step="any"
                            placeholder={grandTotal > 0 ? grandTotal.toString() : '0'}
                            value={cashTendered}
                            onChange={(e) => updateCurrentSlot({ cashTendered: e.target.value })}
                            className="h-8.5 w-full rounded-lg border border-default bg-surface-sunken pl-6 pr-2 text-right font-mono font-bold text-sm text-emerald-500 focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Quick Cash Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-default/50">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider mr-1">Quick:</span>
                        <button
                          type="button"
                          onClick={() => updateCurrentSlot({ cashTendered: grandTotal.toString() })}
                          className="px-2 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[10px] hover:bg-emerald-500/20 transition-all cursor-pointer"
                          title="Exact payable amount"
                        >
                          Exact ({formatCurrency(grandTotal)})
                        </button>
                        {[100, 500, 1000, 2000].map((amt) => {
                          if (grandTotal > amt * 2) return null;
                          return (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => updateCurrentSlot({ cashTendered: String(amt) })}
                              className={cn(
                                "px-2 py-1 rounded-lg border font-mono font-bold text-[10px] transition-all cursor-pointer",
                                cashTendered === String(amt)
                                  ? "bg-primary border-primary text-white"
                                  : "border-default bg-surface-sunken text-muted hover:text-default hover:bg-surface"
                              )}
                            >
                              {currencySymbol}{amt}
                            </button>
                          );
                        })}
                        {[50, 100, 500].map((delta) => (
                          <button
                            key={`add-${delta}`}
                            type="button"
                            onClick={() => {
                              const curr = parseFloat(cashTendered || '0') || 0;
                              updateCurrentSlot({ cashTendered: String(curr + delta) });
                            }}
                            className="px-1.5 py-1 rounded-lg border border-default bg-surface-sunken text-muted hover:text-default text-[10px] font-mono font-semibold transition-all cursor-pointer"
                            title={`Add ${currencySymbol}${delta} to received`}
                          >
                            +{delta}
                          </button>
                        ))}
                        {cashTendered && parseFloat(cashTendered) > 0 && (
                          <button
                            type="button"
                            onClick={() => updateCurrentSlot({ cashTendered: '' })}
                            className="px-1.5 py-1 text-[10px] text-rose-500 hover:underline cursor-pointer ml-auto"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Change calculation pill */}
                      {singleChangeGiven > 0 && (
                        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-lg text-xs font-mono font-bold">
                          <span>Change to Return:</span>
                          <span className="text-sm font-black">{formatCurrency(singleChangeGiven)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Multi-Payment / Split Tender Panel */
                <div className="space-y-2 rounded-xl border border-default bg-surface-sunken p-2.5 shadow-xs">
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                    {splitPayments.map((payment) => (
                      <div key={payment.id} className="flex flex-col gap-1.5 p-2 rounded-lg bg-surface border border-default">
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
                            <option value="credit_adjustment">Customer Credit</option>
                          </select>

                          <div className="relative w-32">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted font-bold">{currencySymbol}</span>
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
                              onClick={() => updateCurrentSlot((prev) => ({
                                ...prev,
                                splitPayments: (prev.splitPayments ?? []).filter((p) => p.id !== payment.id),
                              }))}
                              className="p-1 rounded-md text-muted hover:text-rose-500 hover:bg-surface-sunken cursor-pointer transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {payment.method === 'cash' && (
                          <div className="flex items-center justify-between text-[11px] bg-(--color-surface-sunken)/60 px-2 py-1 rounded border border-(--color-border)/50 font-mono">
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
                              <span className="text-emerald-500 font-bold text-[10px]">
                                Change: {formatCurrency(payment.changeGiven ?? 0)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-(--color-border)/60">
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
                              method: (prev.splitPayments ?? []).some((p) => p.method === 'cash') ? 'mobile_banking' : 'cash',
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
                        <span className="text-emerald-500">✓ Fully Allocated</span>
                      ) : (
                        <span className="text-amber-500">{formatCurrency(splitRemainingDue)} remaining</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary & Financials */}
            <div className="space-y-2 text-xs text-muted border-t border-default pt-2.5 font-mono">
              <div className="flex justify-between items-center text-default font-medium">
                <span>Subtotal:</span>
                <span className="font-bold">{formatCurrency(subtotal)}</span>
              </div>
              {totalLineDiscounts > 0 && (
                <div className="flex justify-between items-center text-rose-500">
                  <span>Item Discounts:</span>
                  <span className="font-semibold">-{formatCurrency(totalLineDiscounts)}</span>
                </div>
              )}
              {/* Promo Coupon Code Field */}
              <div className="flex items-center justify-between gap-2 py-1 font-sans bg-surface rounded-xl p-2 border border-default shadow-xs">
                <span className="font-semibold text-default text-xs flex items-center gap-1.5">
                  <Tag className="size-3.5 text-primary" />
                  <span>Coupon Code:</span>
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="e.g. WELCOME10"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyCoupon();
                      }
                    }}
                    className="h-7 w-32 rounded-lg border border-default bg-surface-sunken px-2 font-mono text-xs uppercase text-default placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="h-7 px-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 font-sans">
                  <span>Promo <strong>{appliedCoupon.code}</strong>: {appliedCoupon.desc}</span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-rose-500 hover:text-rose-700 font-bold ml-1.5 cursor-pointer text-xs"
                    title="Remove coupon"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Order Discount (F8) */}
              <div className="space-y-1.5 py-1 border-t border-(--color-border)/40">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-default font-sans flex items-center gap-1">
                    Order Discount <span className="text-[10px] text-muted font-mono font-normal">(F8)</span>:
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="inline-flex rounded-lg border border-default bg-surface-sunken p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCurrentSlot({ order_discount_type: 'flat' })}
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors",
                          (currentSlot.order_discount_type || 'flat') !== 'percentage'
                            ? "bg-primary text-primary-fg shadow-xs"
                            : "text-muted hover:text-default"
                        )}
                        title="Flat discount (cash off)"
                      >
                        {currencySymbol} Flat
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCurrentSlot({ order_discount_type: 'percentage' })}
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors",
                          (currentSlot.order_discount_type || 'flat') === 'percentage'
                            ? "bg-primary text-primary-fg shadow-xs"
                            : "text-muted hover:text-default"
                        )}
                        title="Percentage discount (%)"
                      >
                        %
                      </button>
                    </div>
                    <input
                      ref={orderDiscountInputRef}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={currentSlot.order_discount_value || ''}
                      onChange={(e) => updateCurrentSlot({ order_discount_value: e.target.value })}
                      className="h-7 w-20 rounded-lg border border-default bg-surface px-1.5 text-right font-mono font-bold text-xs text-rose-500 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1 justify-end flex-wrap">
                  {(currentSlot.order_discount_type || 'flat') === 'percentage' ? (
                    [5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => updateCurrentSlot({ order_discount_value: String(pct) })}
                        className={cn(
                          "px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-colors cursor-pointer",
                          currentSlot.order_discount_value === String(pct)
                            ? "bg-primary/10 border-primary text-primary font-bold"
                            : "border-default bg-surface-sunken text-muted hover:text-default"
                        )}
                      >
                        {pct}%
                      </button>
                    ))
                  ) : (
                    [20, 50, 100, 200, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => updateCurrentSlot({ order_discount_value: String(amt) })}
                        className={cn(
                          "px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-colors cursor-pointer",
                          currentSlot.order_discount_value === String(amt)
                            ? "bg-primary/10 border-primary text-primary font-bold"
                            : "border-default bg-surface-sunken text-muted hover:text-default"
                        )}
                      >
                        +{amt}
                      </button>
                    ))
                  )}
                  {parseFloat(currentSlot.order_discount_value || '0') > 0 && (
                    <button
                      type="button"
                      onClick={() => updateCurrentSlot({ order_discount_value: '' })}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-rose-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {orderDiscountAmount > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>Order Disc Amount:</span>
                  <span className="font-semibold">-{formatCurrency(orderDiscountAmount)}</span>
                </div>
              )}
              {discountTotal > 0 && (
                <div className="flex justify-between text-rose-500 font-bold border-t border-(--color-border)/40 pt-1">
                  <span>Total Savings / Discount:</span>
                  <span>-{formatCurrency(discountTotal)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Sticky Checkout Footer ─────────────────────────────── */}
          <div className="pos-checkout-footer">
            <div className="pos-checkout-total">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Payable</p>
                <p className="font-mono font-black text-2xl text-default leading-tight">
                  {formatCurrency(grandTotal)}
                </p>
              </div>
              {changeGiven > 0 && (
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Change Due</p>
                  <p className="font-mono font-black text-xl text-amber-500 leading-tight">{formatCurrency(changeGiven)}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkingOut || (isSplitPayment && splitRemainingDue > 0.01)}
              className="pos-checkout-btn"
            >
              {checkingOut
                ? 'Processing…'
                : isSplitPayment && splitRemainingDue > 0.01
                ? `Complete Sale (${formatCurrency(splitRemainingDue)} remaining)`
                : `Pay / Complete Sale`}
            </button>

            {/* Shortcut hints */}
            <div className="flex items-center justify-between text-[10px] text-subtle pt-2 font-mono">
              <span>[F2] Search</span>
              <span>[F4] Customer</span>
              <span>[F8] Discount</span>
              <span>[F9] Pay Mode</span>
              <span>[F10] Cash</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Bottom Tab Bar ──────────────────────────────────── */}
      <nav className="pos-mobile-tabbar" aria-label="POS Navigation">
        <button
          type="button"
          className={`pos-mobile-tab ${mobileTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setMobileTab('catalog')}
        >
          <Search className="h-5 w-5" />
          <span>Catalog</span>
        </button>
        <button
          type="button"
          className={`pos-mobile-tab ${mobileTab === 'cart' ? 'active' : ''}`}
          onClick={() => setMobileTab('cart')}
        >
          <ShoppingBag className="h-5 w-5" />
          <span>Cart</span>
          {cart.length > 0 && (
            <span className="pos-mobile-tab-badge">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`pos-mobile-tab ${mobileTab === 'held' ? 'active' : ''}`}
          onClick={() => { setIsParkedDrawerOpen(true); }}
        >
          <Clock className="h-5 w-5" />
          <span>Held</span>
          {heldSales.length > 0 && (
            <span className="pos-mobile-tab-badge" style={{ background: 'var(--color-warning)', color: '#000' }}>
              {heldSales.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`pos-mobile-tab ${mobileTab === 'shift' ? 'active' : ''}`}
          onClick={() => setIsDrawerOpen(true)}
        >
          <Store className="h-5 w-5" />
          <span>Terminal</span>
        </button>
      </nav>

      {/* ── Park Sale Modal ────────────────────────────────────────── */}
      {isParkModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-default">Hold / Park Active Cart</h3>
              </div>
              <button onClick={() => setIsParkModalOpen(false)} className="text-muted hover:text-default cursor-pointer text-sm">✕</button>
            </div>
            <form onSubmit={handleParkSale} className="space-y-3">
              <p className="text-xs text-muted">
                This will save the current cart with {cart.length} item(s) totalling{' '}
                <span className="font-bold text-default font-mono">{formatCurrency(grandTotal)}</span> to the server queue.
              </p>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1">Reference / Note</label>
                <input
                  type="text"
                  value={parkNote}
                  onChange={(e) => setParkNote(e.target.value)}
                  placeholder={`e.g. ${customerName || 'Customer'} — Waiting`}
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
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {holdingSale ? 'Holding…' : 'Confirm & Hold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Parked Sales Drawer Modal ──────────────────────────────── */}
      {isParkedDrawerOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-default">Parked / Held Sales Queue</h3>
                <span className="rounded-full bg-amber-500/10 text-amber-500 px-2 py-0.5 text-xs font-bold border border-amber-500/20">
                  {heldSales.length} on hold
                </span>
              </div>
              <button onClick={() => setIsParkedDrawerOpen(false)} className="text-muted hover:text-default cursor-pointer text-sm">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {heldSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted">
                  <PauseCircle className="h-10 w-10 stroke-1 mb-2" />
                  <p className="text-sm font-medium">No sales are currently held</p>
                  <p className="text-xs">Click "Hold" in the cart when a customer needs time to pay.</p>
                </div>
              ) : (
                heldSales.map((sale) => (
                  <div key={sale.id} className="p-4 rounded-xl border border-default bg-surface-sunken flex items-center justify-between gap-4 hover:border-amber-500/40 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-default truncate">{sale.reference_note || 'Held Sale'}</span>
                        <span className="text-[10px] font-mono text-muted bg-surface px-2 py-0.5 rounded border border-default">
                          {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        {sale.cart_payload?.items?.length ?? 0} item(s) • Total:{' '}
                        <span className="font-bold text-emerald-500 font-mono">{formatCurrency(sale.total_amount)}</span>
                      </p>
                      {sale.cart_payload?.customerName && (
                        <p className="text-[11px] text-muted">
                          Customer: <span className="text-default font-medium">{sale.cart_payload.customerName}</span>
                          {sale.cart_payload.customerPhone && ` (${sale.cart_payload.customerPhone})`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleResumeSale(sale)}
                        className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Resume
                      </button>
                      <button
                        onClick={() => handleDiscardHeldSale(sale.id)}
                        className="p-1.5 rounded-xl border border-default text-muted hover:text-rose-500 hover:bg-surface cursor-pointer transition-colors"
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
              <span>Resuming a cart loads items into your active register slot.</span>
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

      {/* ── Receipt Modal ──────────────────────────────────────────── */}
      {lastReceipt && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-center text-emerald-500 mb-2">
              <CheckCircle2 className="h-12 w-12" />
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
                    <span className="text-default font-bold">{formatCurrency(lastReceipt.order.total_amount)}</span>
                  </div>
                  {lastCompletedPayments.length > 0 && (
                    <div className="border-t border-(--color-border)/60 pt-2 space-y-1.5 text-[11px]">
                      <div className="flex justify-between text-muted font-sans font-semibold">
                        <span>Tender Breakdown:</span>
                        {lastCompletedPayments.length > 1 && <span>Amount</span>}
                      </div>
                      {lastCompletedPayments.map((p, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="capitalize text-default">
                            {p.method === 'mobile_banking' ? 'bKash / Nagad' : p.method === 'credit_adjustment' ? 'Credit' : p.method === 'cash' ? 'Cash Tendered' : 'Card / POS'}:
                          </span>
                          <span className="font-bold text-default">{formatCurrency(parseFloat(p.amount))}</span>
                        </div>
                      ))}
                      {receiptTotalChange > 0 && (
                        <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-2 py-1 rounded-lg font-bold text-xs mt-1">
                          <span className="font-sans">Change Returned:</span>
                          <span className="font-mono">{formatCurrency(receiptTotalChange)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between border-t border-(--color-border)/60 pt-2 text-muted">
                    <span className="font-semibold text-default font-sans">Net Paid:</span>
                    <span className="text-emerald-500 font-bold text-sm">{formatCurrency(lastReceipt.order.total_amount)}</span>
                  </div>
                  {lastReceipt.order.notes && (
                    <div className="border-t border-(--color-border)/60 pt-2 text-left space-y-0.5">
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                        <StickyNote className="h-3 w-3 text-primary" /> Sale Note:
                      </span>
                      <p className="text-default font-sans text-xs italic pl-4">{lastReceipt.order.notes}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-5 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintReceipt('thermal')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-default bg-surface-sunken py-2.5 px-3 text-xs font-semibold text-default hover:bg-surface hover:border-(--color-primary)/50 cursor-pointer transition-all"
                >
                  <Printer className="h-3.5 w-3.5 text-primary" />
                  Thermal (80mm)
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintReceipt('a4')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-default bg-surface-sunken py-2.5 px-3 text-xs font-semibold text-default hover:bg-surface hover:border-(--color-primary)/50 cursor-pointer transition-all"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
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
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-(--color-primary)/40 bg-(--color-primary)/5 py-2 px-3 text-xs font-semibold text-primary hover:bg-(--color-primary)/10 cursor-pointer transition-all"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Exchange Items from This Sale
              </button>
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
                  handleOpenReturnModal(invoiceId, invoiceNum, orderItems);
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/5 py-2 px-3 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Return Items from This Sale
              </button>
              <button
                type="button"
                onClick={() => setLastReceipt(null)}
                className="pos-checkout-btn"
                style={{ minHeight: 44, fontSize: 13 }}
              >
                Next Sale →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POS Exchange Modal ────────────────────────────────────── */}
      <PosExchangeModal
        isOpen={isExchangeModalOpen}
        onClose={() => setIsExchangeModalOpen(false)}
        session={session}
        products={products}
        initialInvoiceId={exchangeInitialInvoiceId}
        initialInvoiceNumber={exchangeInitialInvoiceNumber}
        initialOrderItems={exchangeInitialOrderItems}
        onExchangeCompleted={() => { refetchProducts(); }}
      />

      {/* ── POS Return Modal ──────────────────────────────────────── */}
      <PosReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        session={session}
        products={products}
        initialInvoiceId={returnInitialInvoiceId}
        initialInvoiceNumber={returnInitialInvoiceNumber}
        initialOrderItems={returnInitialOrderItems}
        onReturnCompleted={() => { refetchProducts(); }}
      />

      {/* ── POS Mid-Shift Summary (X-Report) Modal ─────────────────── */}
      <MidShiftSummaryModal
        isOpen={showMidShiftSummary}
        onClose={() => setShowMidShiftSummary(false)}
        session={session}
      />
    </div>
  );
}
