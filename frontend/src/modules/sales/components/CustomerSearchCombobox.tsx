import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Check,
  X,
  Building2,
  Phone,
  CreditCard,
  UserPlus,
  ChevronDown,
  UserCheck,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';

export interface CustomerOption {
  id: string | number;
  party_id?: number | undefined;
  uuid?: string | undefined;
  name: string;
  code?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  type?: 'dealer' | 'wholesale' | 'retail' | 'corporate' | string | undefined;
  is_dealer?: boolean | undefined;
  credit_limit?: string | undefined;
  current_balance?: string | undefined;
  label?: string | undefined;
}

interface CustomerSearchComboboxProps {
  selectedPartyId: number | string | null;
  customerName: string;
  customerPhone: string;
  onChange: (data: {
    partyId: number | string | null;
    customerName: string;
    customerPhone: string;
    isDealer?: boolean;
  }) => void;
  disabled?: boolean;
}

const FALLBACK_CUSTOMERS: CustomerOption[] = [
  {
    id: 1,
    party_id: 1,
    uuid: 'cust-001',
    name: 'Bengal Textile Mills Ltd',
    code: 'CUST-001',
    phone: '+8801711223344',
    type: 'corporate',
    is_dealer: false,
    credit_limit: '1000000.00',
    current_balance: '345000.00',
  },
  {
    id: 2,
    party_id: 2,
    uuid: 'cust-002',
    name: 'Chittagong Packaging Solutions',
    code: 'CUST-002',
    phone: '+8801819988776',
    type: 'wholesale',
    is_dealer: false,
    credit_limit: '500000.00',
    current_balance: '120000.00',
  },
  {
    id: 3,
    party_id: 3,
    uuid: 'cust-003',
    name: 'Apex Footwear Dealer Network',
    code: 'CUST-003',
    phone: '+8801912345678',
    type: 'dealer',
    is_dealer: true,
    credit_limit: '1500000.00',
    current_balance: '820000.00',
  },
  {
    id: 4,
    party_id: 4,
    uuid: 'cust-004',
    name: 'Dhaka City Retail Mart',
    code: 'CUST-004',
    phone: '+8801755667788',
    type: 'retail',
    is_dealer: false,
    credit_limit: '200000.00',
    current_balance: '45000.00',
  },
];

export function CustomerSearchCombobox({
  selectedPartyId,
  customerName,
  customerPhone,
  onChange,
  disabled = false,
}: CustomerSearchComboboxProps) {
  const { formatCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<'all' | 'dealer' | 'wholesale' | 'retail'>('all');
  const [isWalkinMode, setIsWalkinMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch active customers from /parties/options or /parties?is_customer=true
  const { data: customerOptions = FALLBACK_CUSTOMERS } = useQuery<CustomerOption[]>({
    queryKey: ['parties', 'customer-options'],
    queryFn: async (): Promise<CustomerOption[]> => {
      try {
        const res = await api.get<{ data?: CustomerOption[] } | CustomerOption[]>(
          '/parties/options?is_customer=true'
        );
        const raw = res.data;
        const list = (Array.isArray(raw) ? raw : (raw?.data ?? [])) as unknown as Array<Record<string, unknown>>;
        if (list.length > 0) {
          const mapped: CustomerOption[] = list.map((item, idx) => {
            const rawPartyId = item['party_id'];
            const rawId = item['id'];
            const numPartyId = rawPartyId && !isNaN(Number(rawPartyId))
              ? Number(rawPartyId)
              : (typeof rawId === 'number' || (typeof rawId === 'string' && !isNaN(Number(rawId))) ? Number(rawId) : undefined);
            return {
              id: (item['party_id'] ?? item['id'] ?? idx + 1) as string | number,
              party_id: numPartyId,
              uuid: String(item['uuid'] ?? item['id'] ?? `cust-${idx + 1}`),
              name: String(item['name'] || (typeof item['label'] === 'string' ? item['label'].split(' (')[0] : 'Customer')),
              code: String(item['code'] || (typeof item['label'] === 'string' ? item['label'].match(/\(([^)]+)\)/)?.[1] : `CUST-${idx + 1}`)),
              phone: String(item['phone'] ?? ''),
              email: String(item['email'] ?? ''),
              type: String(item['type'] || (item['is_dealer'] ? 'dealer' : 'retail')),
              is_dealer: Boolean(item['is_dealer'] || item['type'] === 'dealer'),
              credit_limit: String(item['credit_limit'] ?? '0.00'),
              current_balance: String(item['current_balance'] ?? '0.00'),
            };
          });
          return mapped;
        }
      } catch {
        // Fallback to demo customers if catalogue is not populated yet
      }
      return FALLBACK_CUSTOMERS;
    },
    staleTime: 60_000,
  });

  // Find currently selected customer
  const selectedCustomer = useMemo(() => {
    if (!selectedPartyId) return null;
    return (
      customerOptions.find((c) =>
        String(c.party_id) === String(selectedPartyId) ||
        String(c.id) === String(selectedPartyId) ||
        String(c.uuid) === String(selectedPartyId)
      ) ?? null
    );
  }, [customerOptions, selectedPartyId]);

  // Filter customers by search term and tab
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customerOptions.filter((cust) => {
      // Tab filter
      if (activeTab !== 'all') {
        const cType = (cust.type || '').toLowerCase();
        if (activeTab === 'dealer' && !cust.is_dealer && cType !== 'dealer') return false;
        if (activeTab === 'wholesale' && cType !== 'wholesale') return false;
        if (activeTab === 'retail' && cType !== 'retail') return false;
      }
      if (!q) return true;
      return (
        cust.name.toLowerCase().includes(q) ||
        (cust.code && cust.code.toLowerCase().includes(q)) ||
        (cust.phone && cust.phone.includes(q)) ||
        (cust.email && cust.email.toLowerCase().includes(q))
      );
    });
  }, [customerOptions, searchQuery, activeTab]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCustomer = (customer: CustomerOption) => {
    setIsWalkinMode(false);
    const resolvedPartyId =
      customer.party_id && !isNaN(Number(customer.party_id))
        ? Number(customer.party_id)
        : (typeof customer.id === 'number' || (typeof customer.id === 'string' && !isNaN(Number(customer.id)))
            ? Number(customer.id)
            : customer.uuid || customer.id);

    onChange({
      partyId: resolvedPartyId,
      customerName: customer.name,
      customerPhone: customer.phone || customerPhone || '',
      isDealer: customer.is_dealer || customer.type === 'dealer',
    });
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClearSelection = () => {
    onChange({
      partyId: null,
      customerName: '',
      customerPhone: '',
    });
    setSearchQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleUseAsWalkin = (name: string) => {
    setIsWalkinMode(true);
    onChange({
      partyId: null,
      customerName: name.trim() || 'Walk-in Customer',
      customerPhone: customerPhone || '',
      isDealer: false,
    });
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredCustomers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredCustomers.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredCustomers[highlightedIndex]) {
        handleSelectCustomer(filteredCustomers[highlightedIndex]);
      } else if (searchQuery.trim()) {
        handleUseAsWalkin(searchQuery);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getTierBadge = (type?: string, isDealer?: boolean) => {
    if (isDealer || type === 'dealer') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          Dealer
        </span>
      );
    }
    if (type === 'wholesale') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Wholesale
        </span>
      );
    }
    if (type === 'corporate') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          Corporate
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
        Retail
      </span>
    );
  };

  return (
    <div ref={containerRef} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-default">
          <Building2 className="size-3.5 text-primary" />
          <span>Customer & Account</span>
          <span className="text-rose-500">*</span>
        </label>
        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => {
              setIsWalkinMode(false);
              setIsOpen(true);
            }}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
              !isWalkinMode && selectedPartyId
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted hover:text-default'
            }`}
          >
            Database Search
          </button>
          <span className="text-muted/40">•</span>
          <button
            type="button"
            onClick={() => {
              setIsWalkinMode(true);
              onChange({
                partyId: null,
                customerName: customerName || 'Walk-in Customer',
                customerPhone: customerPhone || '',
                isDealer: false,
              });
              setIsOpen(false);
            }}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
              isWalkinMode || (!selectedPartyId && customerName)
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                : 'text-muted hover:text-default'
            }`}
          >
            Walk-in / New
          </button>
        </div>
      </div>

      {/* Selected Customer Card View */}
      {selectedCustomer && !isWalkinMode ? (
        <div className="relative rounded-xl border border-primary/30 bg-primary/5 p-2.5 flex items-center justify-between transition-all animate-in fade-in duration-150">
          <div className="flex items-start gap-2.5">
            <div className="size-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary mt-0.5">
              <UserCheck className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-xs text-default">{selectedCustomer.name}</span>
                {selectedCustomer.code && (
                  <span className="text-[10px] font-mono text-muted bg-surface-sunken px-1.5 py-0.5 rounded border border-default">
                    {selectedCustomer.code}
                  </span>
                )}
                {getTierBadge(selectedCustomer.type, selectedCustomer.is_dealer)}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted mt-0.5 flex-wrap">
                {selectedCustomer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-2.5" /> {selectedCustomer.phone}
                  </span>
                )}
                {selectedCustomer.credit_limit && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <CreditCard className="size-2.5" />
                    Credit: {formatCurrency(Number(selectedCustomer.credit_limit))}
                  </span>
                )}
                {Number(selectedCustomer.current_balance || 0) > 0 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    Due: {formatCurrency(Number(selectedCustomer.current_balance))}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearSelection}
            disabled={disabled}
            className="rounded-lg p-1 text-muted hover:text-danger hover:bg-surface border border-transparent hover:border-default transition-colors cursor-pointer"
            title="Change or remove customer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        /* Search Combobox Input */
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 size-3.5 text-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              disabled={disabled}
              value={isWalkinMode ? customerName : searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                if (isWalkinMode) {
                  onChange({
                    partyId: null,
                    customerName: val,
                    customerPhone,
                    isDealer: false,
                  });
                } else {
                  setSearchQuery(val);
                  setIsOpen(true);
                  setHighlightedIndex(-1);
                }
              }}
              onFocus={() => {
                if (!isWalkinMode) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                isWalkinMode
                  ? 'Enter walk-in or new customer name...'
                  : 'Search customer by name, code, phone (e.g. Apex, +88017...)'
              }
              className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-8 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none transition-colors"
            />
            {searchQuery && !isWalkinMode && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-muted hover:text-default cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
            {!isWalkinMode && (
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="absolute right-2.5 text-muted hover:text-default cursor-pointer"
              >
                <ChevronDown className={`size-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {/* Floating Dropdown */}
          {isOpen && !isWalkinMode && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-default bg-surface shadow-2xl overflow-hidden animate-in fade-in-50 duration-100 max-h-72 flex flex-col">
              {/* Quick Filter Tabs */}
              <div className="flex items-center gap-1 p-1.5 border-b border-default bg-surface-sunken/60 text-[10px] overflow-x-auto">
                {(['all', 'dealer', 'wholesale', 'retail'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                      activeTab === tab
                        ? 'bg-surface text-primary shadow-xs font-semibold'
                        : 'text-muted hover:text-default'
                    }`}
                  >
                    {tab === 'all' ? 'All Customers' : `${tab}s`}
                  </button>
                ))}
              </div>

              {/* Options List */}
              <div className="overflow-y-auto divide-y divide-default/50 flex-1">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((cust, idx) => {
                    const isSelected = Boolean(
                      selectedPartyId && (
                        String(selectedPartyId) === String(cust.party_id) ||
                        String(selectedPartyId) === String(cust.id) ||
                        String(selectedPartyId) === String(cust.uuid)
                      )
                    );
                    const isHighlighted = highlightedIndex === idx;

                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        key={cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`w-full text-left p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isHighlighted
                            ? 'bg-primary/10'
                            : isSelected
                            ? 'bg-primary/5'
                            : 'hover:bg-surface-sunken'
                        }`}
                      >
                        <div className="space-y-0.5 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-default">{cust.name}</span>
                            {cust.code && (
                              <span className="text-[9px] font-mono text-muted bg-surface-sunken px-1 rounded border border-default">
                                {cust.code}
                              </span>
                            )}
                            {getTierBadge(cust.type, cust.is_dealer)}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted">
                            {cust.phone && (
                              <span className="flex items-center gap-0.5">
                                <Phone className="size-2.5" /> {cust.phone}
                              </span>
                            )}
                            {cust.credit_limit && Number(cust.credit_limit) > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Limit: {formatCurrency(Number(cust.credit_limit))}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && <Check className="size-4 text-primary shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-muted">
                    <p>No customer found matching "{searchQuery}".</p>
                  </div>
                )}
              </div>

              {/* Quick Use as Walk-in Action */}
              {searchQuery.trim() && (
                <div className="p-2 border-t border-default bg-surface-sunken/80">
                  <button
                    type="button"
                    onClick={() => handleUseAsWalkin(searchQuery)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    <UserPlus className="size-3.5" />
                    <span>Use "{searchQuery.trim()}" as Walk-in Customer</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
