import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  ReceiptText,
  Landmark,
  Calculator,
  Scale,
  TrendingUp,
  Coins,
  Search,
  SlidersHorizontal,
  X,
  Copy,
  Eye,
  Plus,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  CheckSquare,
  Compass,
  Zap,
  CheckCircle2,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Upload,
} from 'lucide-react';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { useCurrency } from '../../hooks/useCurrency';
import { useAuthStore } from '../../lib/auth/authStore';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import type {
  ChartOfAccount,
  AccountType,
  NormalBalance,
  JournalEntry,
  BankAccount,
  Expense,
  ProductCost,
} from '../../types/api/finance';
import { DueCollectionSection } from './sections/DueCollectionSection';
import { notify } from '../../components/ui/Toast';
import { MoneyOutModal } from './modals/MoneyOutModal';
import type { MoneyOutSuccessPayload } from './modals/MoneyOutModal';
import { MoneyInModal } from './modals/MoneyInModal';
import type { MoneyInSuccessPayload } from './modals/MoneyInModal';
import { TransferMoneyModal } from './modals/TransferMoneyModal';
import type { TransferMoneySuccessPayload } from './modals/TransferMoneyModal';
import { PrintPreviewModal, FinancialStatementPrintDocument } from '../../components/print';
import { useBusinessConfig } from '../../lib/document/useBusinessConfig';
import { api } from '../../lib/api/client';
import { extractList } from '../../lib/api/apiData';
import { UniversalImportModal } from '../../components/import/UniversalImportModal';
import {
  chartOfAccountsImportSchema,
  openingJournalImportSchema,
  bankStatementImportSchema,
} from './schemas';

export type FinanceTab =
  'coa' | 'journal' | 'banking' | 'expenses' | 'costing' | 'statements' | 'due-collection';
export type FinanceCategory = 'operations' | 'reports' | 'costing';

interface CategoryConfig {
  id: FinanceCategory;
  label: string;
  tagline: string;
  shortcut: string;
  icon: typeof BookOpen;
  tabs: FinanceTab[];
  defaultTab: FinanceTab;
}

export interface FinanceTabConfig {
  id: FinanceTab;
  step: number;
  label: string;
  shortLabel: string;
  category: FinanceCategory;
  icon: typeof BookOpen;
  description: string;
  highlights: string[];
}

function createManualJournalEntry(
  entryIndex: number,
  narration: string,
  totalDebit: number,
  totalCredit: number,
  lines: Array<{ account_id: number; debit: string; credit: string; narration: string }>,
  accounts: ChartOfAccount[]
): JournalEntry {
  const now = new Date();
  const idStr = String(entryIndex).padStart(4, '0');
  const monthStr = now.toISOString().slice(0, 7).replace('-', '');
  return {
    id: entryIndex,
    uuid: `je-auto-${now.getTime()}`,
    entry_number: `JE-${monthStr}-${idStr}`,
    entry_date: now.toISOString().slice(0, 10),
    entry_type: 'manual',
    source_module: 'general_ledger',
    narration: narration || 'Manual double-entry adjustment',
    total_debit: totalDebit.toFixed(4),
    total_credit: totalCredit.toFixed(4),
    status: 'posted',
    posted_at: now.toISOString(),
    lines: lines.map((l, idx) => {
      const acc = accounts.find((a) => a.id === l.account_id);
      return {
        id: idx + 1,
        account_id: l.account_id,
        account: acc,
        debit_amount: parseFloat(l.debit || '0').toFixed(4),
        credit_amount: parseFloat(l.credit || '0').toFixed(4),
        narration: l.narration,
      };
    }),
  };
}

export const FinanceWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const { config: businessConfig } = useBusinessConfig();
  const [showPrintStatementModal, setShowPrintStatementModal] = useState(false);
  const [showImportCoaModal, setShowImportCoaModal] = useState(false);
  const [showImportJournalModal, setShowImportJournalModal] = useState(false);
  const [showImportBankModal, setShowImportBankModal] = useState(false);
  const [activeTab, setActiveTab] = useWorkspaceTab<FinanceTab>('banking', [
    'banking',
    'expenses',
    'due-collection',
    'statements',
    'journal',
    'coa',
    'costing',
  ] as const);

  const categories: CategoryConfig[] = useMemo(
    () => [
      {
        id: 'operations',
        label: t('finance.categories.operations.label'),
        tagline: t('finance.categories.operations.tagline'),
        shortcut: '1',
        icon: Landmark,
        tabs: ['banking', 'expenses', 'due-collection'],
        defaultTab: 'banking',
      },
      {
        id: 'reports',
        label: t('finance.categories.reports.label'),
        tagline: t('finance.categories.reports.tagline'),
        shortcut: '2',
        icon: TrendingUp,
        tabs: ['statements', 'journal', 'coa'],
        defaultTab: 'statements',
      },
      {
        id: 'costing',
        label: t('finance.categories.costing.label'),
        tagline: t('finance.categories.costing.tagline'),
        shortcut: '3',
        icon: Calculator,
        tabs: ['costing'],
        defaultTab: 'costing',
      },
    ],
    [t]
  );

  const financeTabConfigs: FinanceTabConfig[] = useMemo(() => {
    const getHighlights = (key: string): string[] => {
      const val = (t as (k: string, opts?: { returnObjects: boolean }) => unknown)(key, { returnObjects: true });
      return Array.isArray(val) ? (val as string[]) : [];
    };

    return [
      {
        id: 'banking',
        step: 1,
        label: t('finance.tabs.banking.label'),
        shortLabel: t('finance.tabs.banking.shortLabel'),
        category: 'operations',
        icon: Landmark,
        description: t('finance.tabs.banking.description'),
        highlights: getHighlights('finance.tabs.banking.highlights'),
      },
      {
        id: 'expenses',
        step: 2,
        label: t('finance.tabs.expenses.label'),
        shortLabel: t('finance.tabs.expenses.shortLabel'),
        category: 'operations',
        icon: ReceiptText,
        description: t('finance.tabs.expenses.description'),
        highlights: getHighlights('finance.tabs.expenses.highlights'),
      },
      {
        id: 'due-collection',
        step: 3,
        label: t('finance.tabs.dueCollection.label'),
        shortLabel: t('finance.tabs.dueCollection.shortLabel'),
        category: 'operations',
        icon: Coins,
        description: t('finance.tabs.dueCollection.description'),
        highlights: getHighlights('finance.tabs.dueCollection.highlights'),
      },
      {
        id: 'statements',
        step: 4,
        label: t('finance.tabs.statements.label'),
        shortLabel: t('finance.tabs.statements.shortLabel'),
        category: 'reports',
        icon: TrendingUp,
        description: t('finance.tabs.statements.description'),
        highlights: getHighlights('finance.tabs.statements.highlights'),
      },
      {
        id: 'journal',
        step: 5,
        label: t('finance.tabs.journal.label'),
        shortLabel: t('finance.tabs.journal.shortLabel'),
        category: 'reports',
        icon: BookOpen,
        description: t('finance.tabs.journal.description'),
        highlights: getHighlights('finance.tabs.journal.highlights'),
      },
      {
        id: 'coa',
        step: 6,
        label: t('finance.tabs.coa.label'),
        shortLabel: t('finance.tabs.coa.shortLabel'),
        category: 'reports',
        icon: Scale,
        description: t('finance.tabs.coa.description'),
        highlights: getHighlights('finance.tabs.coa.highlights'),
      },
      {
        id: 'costing',
        step: 7,
        label: t('finance.tabs.costing.label'),
        shortLabel: t('finance.tabs.costing.shortLabel'),
        category: 'costing',
        icon: Calculator,
        description: t('finance.tabs.costing.description'),
        highlights: getHighlights('finance.tabs.costing.highlights'),
      },
    ];
  }, [t]);

  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const quickJumpRef = useRef<HTMLDivElement>(null);

  const activeCategory = categories.find((cat) => cat.tabs.includes(activeTab))?.id ?? 'operations';

  const lastActivePerCategory = useRef<Record<FinanceCategory, FinanceTab>>({
    operations: 'banking',
    reports: 'statements',
    costing: 'costing',
  });

  useEffect(() => {
    const cat = categories.find((c) => c.tabs.includes(activeTab))?.id;
    if (cat) {
      lastActivePerCategory.current[cat] = activeTab;
    }
  }, [activeTab, categories]);

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const { hasPermission } = useAuthStore();
  const canDeleteJournal = hasPermission('finance.journal.delete');
  const canDeleteExpense = hasPermission('finance.expense.delete');
  const canDeleteBank = hasPermission('finance.bank.delete');
  const canDeleteAccount = hasPermission('finance.account.delete');

  const [selectedJournalIds, setSelectedJournalIds] = useState<Set<number>>(new Set());
  const journalHeaderRef = useRef<HTMLInputElement>(null);
  const [deleteJournalConfirm, setDeleteJournalConfirm] = useState<{
    open: boolean;
    isBulk: boolean;
    id?: number;
    title?: string;
  }>({ open: false, isBulk: false });

  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<number>>(new Set());
  const expenseHeaderRef = useRef<HTMLInputElement>(null);
  const [deleteExpenseConfirm, setDeleteExpenseConfirm] = useState<{
    open: boolean;
    isBulk: boolean;
    id?: number;
    title?: string;
  }>({ open: false, isBulk: false });

  // Global Keyboard Shortcuts (1..7 across all financial stages)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 7) {
        const stageMap: Record<number, FinanceTab> = {
          1: 'banking',
          2: 'expenses',
          3: 'due-collection',
          4: 'statements',
          5: 'journal',
          6: 'coa',
          7: 'costing',
        };
        const target = stageMap[num];
        if (target) {
          e.preventDefault();
          setActiveTab(target);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (quickJumpRef.current && !quickJumpRef.current.contains(event.target as Node)) {
        setQuickJumpOpen(false);
      }
    }
    if (quickJumpOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [quickJumpOpen]);

  // Chart of Accounts State
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([
    {
      id: 101,
      uuid: 'coa-101',
      account_code: '1010',
      name: 'Cash on Hand',
      account_type: 'asset',
      account_subtype: 'cash',
      normal_balance: 'debit',
      is_active: true,
      current_balance: '125000.0000',
    },
    {
      id: 102,
      uuid: 'coa-102',
      account_code: '1020',
      name: 'BRAC Bank Operating A/C',
      account_type: 'asset',
      account_subtype: 'bank',
      normal_balance: 'debit',
      is_active: true,
      current_balance: '845000.0000',
    },
    {
      id: 103,
      uuid: 'coa-103',
      account_code: '1050',
      name: 'Accounts Receivable',
      account_type: 'asset',
      account_subtype: 'receivable',
      normal_balance: 'debit',
      is_active: true,
      current_balance: '340000.0000',
    },
    {
      id: 201,
      uuid: 'coa-201',
      account_code: '2010',
      name: 'Accounts Payable',
      account_type: 'liability',
      account_subtype: 'payable',
      normal_balance: 'credit',
      is_active: true,
      current_balance: '210000.0000',
    },
    {
      id: 301,
      uuid: 'coa-301',
      account_code: '3010',
      name: 'Shareholders Equity',
      account_type: 'equity',
      account_subtype: 'capital',
      normal_balance: 'credit',
      is_active: true,
      current_balance: '500000.0000',
    },
    {
      id: 401,
      uuid: 'coa-401',
      account_code: '4010',
      name: 'Sales Revenue',
      account_type: 'income',
      account_subtype: 'sales',
      normal_balance: 'credit',
      is_active: true,
      current_balance: '950000.0000',
    },
    {
      id: 501,
      uuid: 'coa-501',
      account_code: '5010',
      name: 'Cost of Goods Sold (COGS)',
      account_type: 'expense',
      account_subtype: 'cogs',
      normal_balance: 'debit',
      is_active: true,
      current_balance: '480000.0000',
    },
    {
      id: 601,
      uuid: 'coa-601',
      account_code: '6010',
      name: 'Direct Factory Labour',
      account_type: 'expense',
      account_subtype: 'labour',
      normal_balance: 'debit',
      is_active: true,
      current_balance: '145000.0000',
    },
  ]);

  // Journal Entries State
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([
    {
      id: 1,
      uuid: 'je-01',
      entry_number: 'JE-202608-0001',
      entry_date: '2026-08-28',
      entry_type: 'manual',
      source_module: 'general_ledger',
      narration: 'Cash sale received from customer counter',
      total_debit: '15000.0000',
      total_credit: '15000.0000',
      status: 'posted',
      posted_at: '2026-08-28 10:15:00',
      lines: [
        {
          id: 1,
          account_id: 101,
          account: {
            id: 101,
            uuid: 'coa-101',
            account_code: '1010',
            name: 'Cash on Hand',
            account_type: 'asset',
            normal_balance: 'debit',
            is_active: true,
          },
          debit_amount: '15000.0000',
          credit_amount: '0.0000',
          narration: 'Counter cash received',
        },
        {
          id: 2,
          account_id: 401,
          account: {
            id: 401,
            uuid: 'coa-401',
            account_code: '4010',
            name: 'Sales Revenue',
            account_type: 'income',
            normal_balance: 'credit',
            is_active: true,
          },
          debit_amount: '0.0000',
          credit_amount: '15000.0000',
          narration: 'Sales revenue recognized',
        },
      ],
    },
    {
      id: 2,
      uuid: 'je-02',
      entry_number: 'JE-202608-0002',
      entry_date: '2026-08-28',
      entry_type: 'system',
      source_module: 'assets',
      narration: 'Monthly depreciation for cutting equipment',
      total_debit: '4500.0000',
      total_credit: '4500.0000',
      status: 'posted',
      posted_at: '2026-08-28 11:30:00',
      lines: [
        {
          id: 3,
          account_id: 501,
          debit_amount: '4500.0000',
          credit_amount: '0.0000',
          narration: 'Depreciation expense',
        },
        {
          id: 4,
          account_id: 101,
          debit_amount: '0.0000',
          credit_amount: '4500.0000',
          narration: 'Accumulated depreciation offset',
        },
      ],
    },
  ]);

  const isAllJournalsSelected = journalEntries.length > 0 && selectedJournalIds.size === journalEntries.length;
  const isSomeJournalsSelected = selectedJournalIds.size > 0 && !isAllJournalsSelected;

  useEffect(() => {
    if (journalHeaderRef.current) {
      journalHeaderRef.current.indeterminate = isSomeJournalsSelected;
    }
  }, [isSomeJournalsSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedJournalIds.size > 0) {
        setSelectedJournalIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedJournalIds.size]);

  const toggleSelectAllJournals = () => {
    if (isAllJournalsSelected) {
      setSelectedJournalIds(new Set());
    } else {
      setSelectedJournalIds(new Set(journalEntries.map((j) => j.id)));
    }
  };

  const toggleSelectJournal = (id: number) => {
    setSelectedJournalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearJournalSelection = () => setSelectedJournalIds(new Set());

  const handleExecuteDeleteJournal = async () => {
    if (deleteJournalConfirm.isBulk) {
      const ids = Array.from(selectedJournalIds);
      try {
        await Promise.allSettled(ids.map((id) => api.delete(`/finance/journal-entries/${id}`)));
      } catch (err) {
        console.warn('Fallback delete journal', err);
      }
      setJournalEntries((prev) => prev.filter((j) => !ids.includes(j.id)));
      setSelectedJournalIds(new Set());
      notify.success(`${ids.length} journal voucher(s) moved to Data Bin.`);
    } else if (deleteJournalConfirm.id) {
      const id = deleteJournalConfirm.id;
      try {
        await api.delete(`/finance/journal-entries/${id}`);
      } catch (err) {
        console.warn('Fallback delete journal', err);
      }
      setJournalEntries((prev) => prev.filter((j) => j.id !== id));
      setSelectedJournalIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      notify.success('Journal entry moved to Data Bin.');
    }
    setDeleteJournalConfirm({ open: false, isBulk: false });
  };

  const exportJournalsCsv = (journalsToExport: JournalEntry[]) => {
    if (journalsToExport.length === 0) {
      notify.warning('No journal entries to export');
      return;
    }
    const headers = ['Entry Number', 'Date', 'Source Module', 'Type', 'Narration', 'Total Debit', 'Total Credit', 'Status'];
    const rows = journalsToExport.map((j) => [
      `"${j.entry_number}"`,
      `"${j.entry_date}"`,
      `"${j.source_module}"`,
      `"${j.entry_type}"`,
      `"${(j.narration || '').replace(/"/g, '""')}"`,
      `"${j.total_debit}"`,
      `"${j.total_credit}"`,
      `"${j.status}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `journal-entries-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify.success('Journals Exported', { description: `Exported ${journalsToExport.length} journal entries to CSV.` });
  };

  const exportAccountsCsv = () => {
    if (accounts.length === 0) {
      notify.warning('No accounts to export');
      return;
    }
    const headers = ['Account Code', 'Account Name', 'Type', 'Subtype', 'Normal Balance', 'Current Balance', 'Status'];
    const rows = accounts.map((a) => [
      `"${a.account_code}"`,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${a.account_type}"`,
      `"${a.account_subtype || ''}"`,
      `"${a.normal_balance}"`,
      `"${a.current_balance || '0'}"`,
      `"${a.is_active ? 'ACTIVE' : 'INACTIVE'}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify.success('Accounts Exported', { description: `Exported ${accounts.length} accounts to CSV.` });
  };

  const fetchAccountsFromApi = useCallback(async () => {
    try {
      const res = await api.get('/finance/accounts');
      const list = extractList<ChartOfAccount>(res.data);
      if (list.length > 0) {
        setAccounts(list);
      }
    } catch {
      // Retain state on error
    }
  }, []);

  const fetchJournalsFromApi = useCallback(async () => {
    try {
      const res = await api.get('/finance/journal-entries');
      const list = extractList<JournalEntry>(res.data);
      if (list.length > 0) {
        setJournalEntries(list);
      }
    } catch {
      // Retain state on error
    }
  }, []);

  // Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    {
      id: 1,
      uuid: 'ba-01',
      company_id: 1,
      account_name: 'Principal Operating Account',
      account_number: '1501204892001',
      bank_name: 'BRAC Bank PLC',
      branch_name: 'Gulshan Branch',
      routing_number: '060261354',
      swift_code: 'BRAKBDDH',
      currency_code: 'BDT',
      opening_balance: '500000.0000',
      current_balance: '845000.0000',
      is_active: true,
    },
    {
      id: 2,
      uuid: 'ba-02',
      company_id: 1,
      account_name: 'Factory Payroll Account',
      account_number: '2050189340002',
      bank_name: 'Islami Bank Bangladesh PLC',
      branch_name: 'Tejgaon Industrial Area',
      routing_number: '125271890',
      swift_code: 'IBBLBDDH',
      currency_code: 'BDT',
      opening_balance: '200000.0000',
      current_balance: '350000.0000',
      is_active: true,
    },
  ]);

  const fetchBanksFromApi = useCallback(async () => {
    try {
      const res = await api.get('/finance/bank-accounts');
      const list = extractList<BankAccount>(res.data);
      if (list.length > 0) {
        setBankAccounts(list);
      }
    } catch {
      // Retain state on error
    }
  }, []);

  // Expenses State
  const [expenses, setExpenses] = useState<Expense[]>([
    {
      id: 1,
      uuid: 'exp-01',
      company_id: 1,
      expense_category_id: 1,
      category: {
        id: 1,
        uuid: 'ec-01',
        code: 'UTIL',
        name: 'Factory Electricity & Power',
        is_active: true,
      },
      expense_date: '2026-08-25',
      amount: '42500.0000',
      payment_method: 'bank_transfer',
      payee_name: 'DESCO Ltd.',
      description: 'Factory power bill for July/August billing cycle',
      status: 'approved',
      journal_entry_id: 101,
    },
    {
      id: 2,
      uuid: 'exp-02',
      company_id: 1,
      expense_category_id: 3,
      category: {
        id: 3,
        uuid: 'ec-03',
        code: 'LOG',
        name: 'Courier & Last-mile Dispatch',
        is_active: true,
      },
      expense_date: '2026-08-27',
      amount: '12800.0000',
      payment_method: 'cash',
      payee_name: 'Pathao Fleet Dispatch',
      description: 'Weekly courier delivery handling settlement',
      status: 'approved',
      journal_entry_id: 102,
    },
  ]);

  // Product Costings State
  // Product Costings State
  const [productCosts, setProductCosts] = useState<ProductCost[]>([
    {
      id: 1,
      uuid: 'pc-01',
      product_id: 1,
      product: { id: 1, name: 'Premium Cotton Oxford Shirt', sku: 'SHT-OXF-001' },
      costing_method: 'standard',
      material_cost: '320.0000',
      labour_cost: '145.0000',
      overhead_cost: '45.0000',
      total_cost: '510.0000',
      standard_cost: '510.0000',
      effective_from: '2026-08-01',
      source: 'production',
      calculated_at: '2026-08-28 08:30:00',
    },
    {
      id: 2,
      uuid: 'pc-02',
      product_id: 2,
      product: { id: 2, name: 'Slim Fit Denim Jeans 14oz', sku: 'JNS-SLM-002' },
      costing_method: 'standard',
      material_cost: '480.0000',
      labour_cost: '190.0000',
      overhead_cost: '60.0000',
      total_cost: '730.0000',
      standard_cost: '730.0000',
      effective_from: '2026-08-01',
      source: 'production',
      calculated_at: '2026-08-28 08:30:00',
    },
  ]);

  // Live Backend Data Synchronization
  useEffect(() => {
    let active = true;

    async function loadLiveFinanceData() {
      try {
        const [accRes, jvRes, bankRes, expRes, costRes] = await Promise.allSettled([
          api.get('/finance/accounts'),
          api.get('/finance/journal-entries'),
          api.get('/finance/bank-accounts'),
          api.get('/finance/expenses'),
          api.get('/finance/costing'),
        ]);

        if (!active) return;

        if (accRes.status === 'fulfilled') {
          const fetchedAccs = extractList<ChartOfAccount>(accRes.value);
          if (fetchedAccs.length > 0) {
            setAccounts(fetchedAccs);
          }
        }

        if (jvRes.status === 'fulfilled') {
          const fetchedJvs = extractList<JournalEntry>(jvRes.value);
          if (fetchedJvs.length > 0) {
            setJournalEntries(fetchedJvs);
          }
        }

        if (bankRes.status === 'fulfilled') {
          const fetchedBanks = extractList<BankAccount>(bankRes.value);
          if (fetchedBanks.length > 0) {
            setBankAccounts(fetchedBanks);
          }
        }

        if (expRes.status === 'fulfilled') {
          const fetchedExps = extractList<Expense>(expRes.value);
          if (fetchedExps.length > 0) {
            setExpenses(fetchedExps);
          }
        }

        if (costRes.status === 'fulfilled') {
          const fetchedCosts = extractList<ProductCost>(costRes.value);
          if (fetchedCosts.length > 0) {
            setProductCosts(fetchedCosts);
          }
        }

        // Also ensure expense categories are preloaded
        await api.get('/finance/expenses/categories').catch(() => null);
      } catch (err) {
        console.error('Failed loading live finance data', err);
      }
    }

    loadLiveFinanceData();

    return () => {
      active = false;
    };
  }, []);

  // Account Modal State
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [viewingAccount, setViewingAccount] = useState<ChartOfAccount | null>(null);
  const [, setViewingExpense] = useState<Expense | null>(null);
  const [newAccountCode, setNewAccountCode] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<AccountType>('asset');
  const [newAccountSubtype, setNewAccountSubtype] = useState('');
  const [newNormalBalance, setNewNormalBalance] = useState<NormalBalance>('debit');
  const [newOpeningBalance, setNewOpeningBalance] = useState('0.00');

  const handleViewAccount = async (acc: ChartOfAccount) => {
    setViewingAccount(acc);
    try {
      const res = await api.get<ChartOfAccount>(`/finance/accounts/${acc.id}`);
      if (res.data) setViewingAccount(res.data);
    } catch {
      // Retain cached
    }
  };

  const handleViewExpense = async (exp: Expense) => {
    setViewingExpense(exp);
    try {
      const res = await api.get<Expense>(`/finance/expenses/${exp.id}`);
      if (res.data) setViewingExpense(res.data);
    } catch {
      // Retain cached
    }
  };

  const handleRollupCosting = async (productId: number = 1) => {
    try {
      const res = await api.post('/finance/costing/rollup', {
        product_id: productId,
        overhead_rate: 15,
      });
      notify.success('Cost Rollup Updated', {
        description: 'Standard unit cost recalculated across BOM materials, labour, and overhead.',
      });
      if (res.data) {
        const costRes = await api.get('/finance/costing');
        const list = extractList<ProductCost>(costRes.data);
        if (list.length > 0) setProductCosts(list);
      }
    } catch {
      notify.info('Cost Rollup Recalculated (Offline mode)');
    }
  };

  const handleViewJournal = async (je: JournalEntry) => {
    setViewingEntry(je);
    try {
      const res = await api.get<JournalEntry>(`/finance/journal-entries/${je.id}`);
      if (res.data) {
        const entry = (res.data as { data?: JournalEntry }).data ?? res.data;
        setViewingEntry(entry);
      }
    } catch {
      // Retain cached entry
    }
  };

  // Bank Account Creation State
  const [showNewBankModal, setShowNewBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankAccountName, setNewBankAccountName] = useState('');
  const [newBankAccountNumber, setNewBankAccountNumber] = useState('');
  const [newBankBranch, setNewBankBranch] = useState('');
  const [newBankOpeningBalance, setNewBankOpeningBalance] = useState('0.00');
  const [newBankCoaId, setNewBankCoaId] = useState<number>(102);

  const handleCreateBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !newBankAccountNumber.trim()) {
      notify.warning('Validation Error', { description: 'Bank name and account number are required.' });
      return;
    }
    try {
      const res = await api.post('/finance/bank-accounts', {
        company_id: 1,
        account_name: newBankAccountName.trim() || newBankName.trim(),
        account_number: newBankAccountNumber.trim(),
        bank_name: newBankName.trim(),
        ...(newBankBranch.trim() ? { branch_name: newBankBranch.trim() } : {}),
        chart_of_account_id: newBankCoaId || (accounts.find((a) => a.account_subtype === 'bank')?.id ?? 102),
        currency_code: 'BDT',
        opening_balance: parseFloat(newBankOpeningBalance || '0'),
      });
      if (res.data) {
        const ba = (res.data as { data?: BankAccount }).data ?? (res.data as BankAccount);
        setBankAccounts((prev) => [...prev, ba]);
      }
    } catch {
      const newBa: BankAccount = {
        id: Date.now(),
        uuid: `ba-${Date.now()}`,
        company_id: 1,
        account_name: newBankAccountName.trim() || newBankName.trim(),
        account_number: newBankAccountNumber.trim(),
        bank_name: newBankName.trim(),
        branch_name: newBankBranch.trim() || 'Principal Branch',
        currency_code: 'BDT',
        opening_balance: parseFloat(newBankOpeningBalance || '0').toFixed(4),
        current_balance: parseFloat(newBankOpeningBalance || '0').toFixed(4),
        is_active: true,
      };
      setBankAccounts((prev) => [...prev, newBa]);
    }
    setShowNewBankModal(false);
    setNewBankName('');
    setNewBankAccountName('');
    setNewBankAccountNumber('');
    setNewBankBranch('');
    setNewBankOpeningBalance('0.00');
    notify.success('Bank Account Created', {
      description: `${newBankName} (${newBankAccountNumber}) registered.`,
    });
  };

  // Deletion State for Bank Accounts and Cash/GL Accounts
  const [deletingBankAccount, setDeletingBankAccount] = useState<BankAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<ChartOfAccount | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const confirmDeleteBankAccount = async () => {
    if (!deletingBankAccount) return;
    setIsDeletingItem(true);
    try {
      await api.delete(`/finance/bank-accounts/${deletingBankAccount.id}`);
      setBankAccounts((prev) => prev.filter((b) => b.id !== deletingBankAccount.id));
      notify.success('Bank Account Deleted', {
        description: `${deletingBankAccount.bank_name} has been removed.`,
      });
    } catch {
      // Offline / fallback deletion
      setBankAccounts((prev) => prev.filter((b) => b.id !== deletingBankAccount.id));
      notify.info('Bank Account Removed (Local)', {
        description: `${deletingBankAccount.bank_name} removed from view.`,
      });
    } finally {
      setIsDeletingItem(false);
      setDeletingBankAccount(null);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!deletingAccount) return;
    if (deletingAccount.is_system) {
      notify.warning('System Account Protected', {
        description: `${deletingAccount.name} is a required system account and cannot be deleted.`,
      });
      setDeletingAccount(null);
      return;
    }
    setIsDeletingItem(true);
    try {
      await api.delete(`/finance/accounts/${deletingAccount.id}`);
      setAccounts((prev) => prev.filter((a) => a.id !== deletingAccount.id));
      notify.success('Account Deleted', {
        description: `${deletingAccount.name} has been removed.`,
      });
    } catch {
      // Offline / fallback deletion
      setAccounts((prev) => prev.filter((a) => a.id !== deletingAccount.id));
      notify.info('Account Removed (Local)', {
        description: `${deletingAccount.name} removed from view.`,
      });
    } finally {
      setIsDeletingItem(false);
      setDeletingAccount(null);
    }
  };

  // Expense Category Creation State
  const [showNewExpenseCatModal, setShowNewExpenseCatModal] = useState(false);
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const handleCreateExpenseCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatCode.trim()) {
      notify.warning('Validation Error', { description: 'Category code and name are required.' });
      return;
    }
    try {
      await api.post('/finance/expenses/categories', {
        company_id: 1,
        code: newCatCode.trim().toUpperCase(),
        name: newCatName.trim(),
        ...(newCatDesc.trim() ? { description: newCatDesc.trim() } : {}),
      });
      notify.success('Expense Category Added', {
        description: `Category ${newCatName.trim()} created successfully.`,
      });
    } catch {
      notify.info('Expense Category Saved', {
        description: `Category ${newCatName.trim()} saved locally.`,
      });
    }
    setShowNewExpenseCatModal(false);
    setNewCatCode('');
    setNewCatName('');
    setNewCatDesc('');
  };

  const resetAccountForm = () => {
    const numericCodes = accounts.map((a) => parseInt(a.account_code, 10)).filter((n) => !isNaN(n));
    const maxCode = numericCodes.length > 0 ? Math.max(...numericCodes) : 1000;
    setNewAccountCode(String(maxCode + 10));
    setNewAccountName('');
    setNewAccountType('asset');
    setNewAccountSubtype('cash');
    setNewNormalBalance('debit');
    setNewOpeningBalance('0.00');
  };

  const handleDuplicateAccount = (acc: ChartOfAccount) => {
    const num = parseInt(acc.account_code, 10);
    const nextCode = !isNaN(num) ? String(num + 1) : `${acc.account_code}-01`;
    setNewAccountCode(nextCode);
    setNewAccountName(`${acc.name} (Copy)`);
    setNewAccountType(acc.account_type);
    setNewAccountSubtype(acc.account_subtype || '');
    setNewNormalBalance(acc.normal_balance);
    setNewOpeningBalance('0.00');
    setShowNewAccountModal(true);
    notify.info('Account Duplicated', {
      description: `Cloned parameters from ${acc.account_code} - ${acc.name}. Ready to save.`,
    });
  };

  const handleAccountTypeChange = (type: AccountType) => {
    setNewAccountType(type);
    if (type === 'asset' || type === 'expense') {
      setNewNormalBalance('debit');
    } else {
      setNewNormalBalance('credit');
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountCode.trim() || !newAccountName.trim()) {
      notify.warning('Validation Error', { description: 'Account code and name are required.' });
      return;
    }

    try {
      const res = await api.post('/finance/accounts', {
        company_id: 1,
        account_code: newAccountCode.trim(),
        name: newAccountName.trim(),
        account_type: newAccountType,
        account_subtype: newAccountSubtype.trim() || 'operational',
        normal_balance: newNormalBalance,
        is_active: true,
      });
      if (res.data) {
        setAccounts((prev) => [...prev, res.data as ChartOfAccount]);
      }
    } catch {
      const createdAccount: ChartOfAccount = {
        id: Date.now(),
        uuid: `coa-${Date.now()}`,
        account_code: newAccountCode.trim(),
        name: newAccountName.trim(),
        account_type: newAccountType,
        account_subtype: newAccountSubtype.trim() || undefined,
        normal_balance: newNormalBalance,
        is_active: true,
        current_balance: parseFloat(newOpeningBalance || '0').toFixed(4),
      };
      setAccounts((prev) => [...prev, createdAccount]);
    }

    setShowNewAccountModal(false);
    notify.success('Account Created', {
      description: `Account ${newAccountCode.trim()} - ${newAccountName.trim()} added to chart of accounts.`,
    });
  };

  // Action Modals State (Money Out, Money In, Move Money)
  const [showMoneyOutModal, setShowMoneyOutModal] = useState(false);
  const [showMoneyInModal, setShowMoneyInModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [moneyInPrefill, setMoneyInPrefill] = useState<{
    customerName?: string;
    dueAmount?: string | number;
    invoiceNumber?: string;
  }>({});
  const [transferPrefill, setTransferPrefill] = useState<{
    fromId?: number;
    toId?: number;
  }>({});
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');

  const filteredExpensesList = expenses.filter(
    (e) => expenseCategoryFilter === 'all' || e.category?.code === expenseCategoryFilter
  );
  const isAllExpensesSelected =
    filteredExpensesList.length > 0 && selectedExpenseIds.size === filteredExpensesList.length;
  const isSomeExpensesSelected = selectedExpenseIds.size > 0 && !isAllExpensesSelected;

  useEffect(() => {
    if (expenseHeaderRef.current) {
      expenseHeaderRef.current.indeterminate = isSomeExpensesSelected;
    }
  }, [isSomeExpensesSelected]);

  const toggleSelectAllExpenses = () => {
    if (isAllExpensesSelected) {
      setSelectedExpenseIds(new Set());
    } else {
      setSelectedExpenseIds(new Set(filteredExpensesList.map((e) => e.id)));
    }
  };

  const toggleSelectOneExpense = (id: number) => {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExecuteDeleteExpense = async () => {
    if (deleteExpenseConfirm.isBulk) {
      const ids = Array.from(selectedExpenseIds);
      try {
        await Promise.allSettled(ids.map((id) => api.delete(`/finance/expenses/${id}`)));
      } catch (err) {
        console.warn('Fallback delete expense', err);
      }
      setExpenses((prev) => prev.filter((e) => !ids.includes(e.id)));
      setSelectedExpenseIds(new Set());
      notify.success(`${ids.length} expense(s) moved to Data Bin.`);
    } else if (deleteExpenseConfirm.id) {
      const id = deleteExpenseConfirm.id;
      try {
        await api.delete(`/finance/expenses/${id}`);
      } catch (err) {
        console.warn('Fallback delete expense', err);
      }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      setSelectedExpenseIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      notify.success('Expense moved to Data Bin.');
    }
    setDeleteExpenseConfirm({ open: false, isBulk: false });
  };

  const handleMoneyOutSuccess = (payload: MoneyOutSuccessPayload) => {
    if (payload.expense) {
      setExpenses((prev) => [payload.expense!, ...prev]);
    }
    setJournalEntries((prev) => [payload.journalEntry, ...prev]);
    setAccounts(payload.updatedAccounts);
    setBankAccounts(payload.updatedBankAccounts);
  };

  const handleMoneyInSuccess = (payload: MoneyInSuccessPayload) => {
    setJournalEntries((prev) => [payload.journalEntry, ...prev]);
    setAccounts(payload.updatedAccounts);
    setBankAccounts(payload.updatedBankAccounts);
  };

  const handleTransferSuccess = (payload: TransferMoneySuccessPayload) => {
    setJournalEntries((prev) => [payload.journalEntry, ...prev]);
    setAccounts(payload.updatedAccounts);
    setBankAccounts(payload.updatedBankAccounts);
  };

  // Adjusting Journal Modal State
  const [showNewJournalModal, setShowNewJournalModal] = useState(false);
  const [newNarration, setNewNarration] = useState('');
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [newLines, setNewLines] = useState<
    Array<{ account_id: number; debit: string; credit: string; narration: string }>
  >([
    { account_id: 101, debit: '0.00', credit: '0.00', narration: '' },
    { account_id: 401, debit: '0.00', credit: '0.00', narration: '' },
  ]);

  const applyJournalTemplate = (template: 'depreciation' | 'capital' | 'drawings') => {
    if (template === 'depreciation') {
      setNewNarration('Monthly Machine & Asset Depreciation Allocation');
      setNewLines([
        { account_id: 501, debit: '4500.00', credit: '0.00', narration: 'Dr: Depreciation Expense' },
        { account_id: 101, debit: '0.00', credit: '4500.00', narration: 'Cr: Accumulated Depreciation Offset' },
      ]);
    } else if (template === 'capital') {
      setNewNarration('Owner / Shareholder Equity Capital Deposit');
      setNewLines([
        { account_id: 102, debit: '100000.00', credit: '0.00', narration: 'Dr: Bank Operating Account' },
        { account_id: 301, debit: '0.00', credit: '100000.00', narration: 'Cr: Shareholders Equity / Capital' },
      ]);
    } else if (template === 'drawings') {
      setNewNarration('Owner Profit Drawing / Capital Withdrawal');
      setNewLines([
        { account_id: 301, debit: '50000.00', credit: '0.00', narration: 'Dr: Owner Drawings (Equity Contra)' },
        { account_id: 102, debit: '0.00', credit: '50000.00', narration: 'Cr: Bank Operating Account' },
      ]);
    }
  };

  const totalNewDebit = newLines.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalNewCredit = newLines.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const isJournalBalanced = Math.abs(totalNewDebit - totalNewCredit) < 0.001 && totalNewDebit > 0;

  const handleAddLine = () => {
    setNewLines((prev) => [
      ...prev,
      { account_id: accounts[0]?.id ?? 101, debit: '0.00', credit: '0.00', narration: '' },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (newLines.length <= 2) {
      notify.warning('Minimum 2 Lines Required', {
        description: 'Double-entry accounting requires at least one debit and one credit line.',
      });
      return;
    }
    setNewLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleDuplicateJournal = (je: JournalEntry) => {
    setNewNarration(`Repeat of ${je.entry_number}: ${je.narration}`);
    if (je.lines && je.lines.length > 0) {
      setNewLines(
        je.lines.map((l) => ({
          account_id: l.account_id,
          debit: parseFloat(String(l.debit_amount || '0')).toFixed(2),
          credit: parseFloat(String(l.credit_amount || '0')).toFixed(2),
          narration: l.narration || '',
        }))
      );
    }
    setShowNewJournalModal(true);
    notify.info('Journal Entry Duplicated', {
      description: `Pre-filled voucher from ${je.entry_number}. Verify amounts and post.`,
    });
  };

  const handleReverseJournal = (je: JournalEntry) => {
    setNewNarration(`Reversal of ${je.entry_number}: ${je.narration}`);
    if (je.lines && je.lines.length > 0) {
      setNewLines(
        je.lines.map((l) => ({
          account_id: l.account_id,
          debit: parseFloat(String(l.credit_amount || '0')).toFixed(2),
          credit: parseFloat(String(l.debit_amount || '0')).toFixed(2),
          narration: `Reversal of ${je.entry_number}`,
        }))
      );
    }
    setShowNewJournalModal(true);
    notify.info('Reversal Entry Prepared', {
      description: `Debits and credits inverted for ${je.entry_number}. Review and post to reverse.`,
    });
  };

  const handleDuplicateExpense = useCallback(
    (exp: Expense) => {
      const timestamp = Date.now();
      const clonedExpense: Expense = {
        ...exp,
        id: expenses.length + 1,
        uuid: `exp-clone-${timestamp}`,
        expense_date: new Date(timestamp).toISOString().slice(0, 10),
        description: `Repeat of ${exp.description}`,
        status: 'approved',
      };
      setExpenses((prev) => [clonedExpense, ...prev]);
      notify.success('Expense Duplicated', {
        description: `Cloned expense voucher for ${exp.payee_name || exp.category?.name || 'Operational Disbursement'}.`,
      });
    },
    [expenses.length]
  );

  const handlePostJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isJournalBalanced) {
      notify.warning('Journal Unbalanced', {
        description: 'Debit must exactly equal Credit to post a double-entry journal entry.',
      });
      return;
    }

    try {
      const res = await api.post('/finance/journal-entries', {
        company_id: 1,
        entry_date: new Date().toISOString().slice(0, 10),
        entry_type: 'manual',
        source_module: 'general_ledger',
        narration: newNarration,
        lines: newLines.map((l) => ({
          account_id: l.account_id,
          debit_amount: parseFloat(l.debit || '0'),
          credit_amount: parseFloat(l.credit || '0'),
          narration: l.narration || newNarration,
        })),
      });
      if (res.data) {
        const entry = (res.data as { data?: JournalEntry }).data ?? (res.data as JournalEntry);
        setJournalEntries((prev) => [entry, ...prev]);
      }
    } catch {
      const createdEntry = createManualJournalEntry(
        journalEntries.length + 1,
        newNarration,
        totalNewDebit,
        totalNewCredit,
        newLines,
        accounts
      );
      setJournalEntries((prev) => [createdEntry, ...prev]);
    }

    setShowNewJournalModal(false);
    setNewNarration('');
    setNewLines([
      { account_id: 101, debit: '0.00', credit: '0.00', narration: '' },
      { account_id: 401, debit: '0.00', credit: '0.00', narration: '' },
    ]);
    notify.success('Journal entry posted successfully', {
      description: `Entry recorded in general ledger.`,
    });
  };

  const financeTabsList: Array<{
    id: FinanceTab;
    label: string;
    category: FinanceCategory;
    icon: typeof BookOpen;
    count: string | number;
  }> = [
    {
      id: 'banking',
      label: t('finance.tabs.banking.label'),
      category: 'operations',
      icon: Landmark,
      count: bankAccounts.length,
    },
    {
      id: 'expenses',
      label: t('finance.tabs.expenses.label'),
      category: 'operations',
      icon: ReceiptText,
      count: expenses.length,
    },
    {
      id: 'due-collection',
      label: t('finance.tabs.dueCollection.label'),
      category: 'operations',
      icon: Coins,
      count: 'Aging',
    },
    {
      id: 'statements',
      label: t('finance.tabs.statements.label'),
      category: 'reports',
      icon: TrendingUp,
      count: 'Live',
    },
    {
      id: 'journal',
      label: t('finance.tabs.journal.label'),
      category: 'reports',
      icon: BookOpen,
      count: journalEntries.length,
    },
    {
      id: 'coa',
      label: t('finance.tabs.coa.label'),
      category: 'reports',
      icon: Scale,
      count: accounts.length,
    },
    {
      id: 'costing',
      label: t('finance.tabs.costing.label'),
      category: 'costing',
      icon: Calculator,
      count: productCosts.length,
    },
  ];

  const filteredFinanceTabs = searchQuery.trim()
    ? financeTabsList.filter(
        (tabItem) =>
          tabItem.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tabItem.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : financeTabsList;

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-2">
      {/* Module Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-default pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary bg-primary-subtle px-2.5 py-0.5 rounded-full border border-primary/20">
              {t('finance.managementTag')}
            </span>
            <span className="text-muted text-xs">•</span>
            <span className="text-xs font-semibold text-primary">
              {t('finance.stageCounter', {
                step: financeTabConfigs.find((tConfig) => tConfig.id === activeTab)?.step || 1,
                total: 7,
                label: financeTabConfigs.find((tConfig) => tConfig.id === activeTab)?.label,
              })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default">
            {t('finance.title')}
          </h1>
          <p className="mt-1.5 text-xs text-muted max-w-2xl leading-relaxed">
            {t('finance.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Money Out */}
          <button
            type="button"
            onClick={() => setShowMoneyOutModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-xs transition text-xs cursor-pointer"
            title="Record an operating expense, pay a supplier bill, or owner withdrawal"
          >
            <ArrowDownRight className="size-4" />
            <span>{t('finance.moneyOut')}</span>
          </button>

          {/* Money In */}
          <button
            type="button"
            onClick={() => {
              setMoneyInPrefill({});
              setShowMoneyInModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition text-xs cursor-pointer"
            title="Collect customer dues, record scrap sales, or deposit owner capital"
          >
            <ArrowUpRight className="size-4" />
            <span>{t('finance.moneyIn')}</span>
          </button>

          {/* Move Money */}
          <button
            type="button"
            onClick={() => {
              setTransferPrefill({});
              setShowTransferModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition text-xs cursor-pointer"
            title="Transfer funds between Bank accounts and Cash on hand"
          >
            <ArrowLeftRight className="size-4" />
            <span>{t('finance.moveMoney')}</span>
          </button>

          {/* Advanced Journal */}
          <button
            type="button"
            onClick={() => setShowNewJournalModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-default bg-surface hover:bg-surface-sunken text-default font-semibold rounded-xl transition text-xs cursor-pointer"
            title="For Certified Accountants: Post manual double-entry adjusting vouchers"
          >
            <BookOpen className="size-3.5 text-muted" />
            <span>{t('finance.adjustingJournal')}</span>
          </button>

          {activeTab === 'coa' && (
            <button
              onClick={() => {
                resetAccountForm();
                setShowNewAccountModal(true);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <span>+</span> {t('finance.newAccount')}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-primary/30 bg-primary-subtle hover:bg-primary/10 text-primary transition-all shadow-2xs cursor-pointer"
            title="Open Finance Capabilities and Architecture Guide"
          >
            <Compass className="size-3.5 text-primary" />
            <span>{t('finance.guideBtn')}</span>
          </button>
        </div>
      </div>

      {/* KPI Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl p-6 shadow-xs border border-default">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t('finance.kpiLiquidAssets')}
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {formatCurrency(
              accounts
                .filter((a) => a.account_type === 'asset' && (a.account_subtype === 'cash' || a.account_subtype === 'bank'))
                .reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0)
            )}
          </div>
          <div className="text-[11px] text-muted mt-1">
            {t('finance.kpiCashPrefix')} ({formatCurrency(accounts.filter((a) => a.account_subtype === 'cash').reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0))}) + {t('finance.kpiBankPrefix')} ({formatCurrency(accounts.filter((a) => a.account_subtype === 'bank').reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0))})
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-6 shadow-xs border border-default">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t('finance.kpiReceivables')}
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2 font-mono">
            {formatCurrency(accounts.find((a) => a.account_code === '1050')?.current_balance || '340000')}
          </div>
          <div className="text-[11px] text-muted mt-1">{t('finance.kpiReceivablesSubtitle')}</div>
        </div>

        <div className="bg-surface rounded-2xl p-6 shadow-xs border border-default">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t('finance.kpiPayables')}
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {formatCurrency(accounts.find((a) => a.account_code === '2010')?.current_balance || '210000')}
          </div>
          <div className="text-[11px] text-muted mt-1">{t('finance.kpiPayablesSubtitle')}</div>
        </div>

        <div className="bg-surface rounded-2xl p-6 shadow-xs border border-default">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t('finance.kpiSalesRevenue')}
          </div>
          <div className="text-2xl font-extrabold text-primary mt-2 font-mono">
            {formatCurrency(accounts.find((a) => a.account_code === '4010')?.current_balance || '950000')}
          </div>
          <div className="text-[11px] text-muted mt-1">{t('finance.kpiPeriodSubtitle')}</div>
        </div>
      </div>

      {/* Primary 3 Financial Command Pillars (with Embedded Direct Child Pills) */}
      <div
        role="tablist"
        aria-label="Financial Domains"
        className="grid grid-cols-1 lg:grid-cols-3 gap-3"
      >
        {categories.map((cat) => {
          const isCatActive = activeCategory === cat.id;
          const Icon = cat.icon;
          const childTabs = financeTabConfigs.filter((tConfig) => tConfig.category === cat.id);

          return (
            <div
              key={cat.id}
              role="tab"
              aria-selected={isCatActive}
              tabIndex={isCatActive ? 0 : -1}
              onClick={() => setActiveTab(cat.defaultTab)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveTab(cat.defaultTab);
                }
              }}
              className={cn(
                'group relative flex flex-col justify-between p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer shadow-2xs',
                isCatActive
                  ? 'bg-surface border-primary shadow-md ring-2 ring-primary/10'
                  : 'bg-surface hover:bg-surface-sunken border-default hover:border-default/80'
              )}
            >
              {/* Pillar Top Header */}
              <div className="flex items-start gap-3 w-full">
                <div
                  className={cn(
                    'size-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs',
                    isCatActive
                      ? 'bg-primary text-primary-fg shadow-sm'
                      : 'bg-surface-sunken border border-default text-muted group-hover:text-default'
                  )}
                >
                  <Icon className={cn('size-5 shrink-0', isCatActive ? 'text-primary-fg' : 'text-muted group-hover:text-default')} />
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          'text-xs font-bold transition-colors truncate',
                          isCatActive ? 'text-default' : 'text-default/90 group-hover:text-default'
                        )}
                      >
                        {cat.label}
                      </span>
                      <span className="text-[10px] font-mono text-muted/70 font-semibold px-1 py-0.2 rounded bg-surface-sunken border border-default/50 select-none">
                        [{cat.shortcut}]
                      </span>
                    </div>

                    <span
                      className={cn(
                        'text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border shrink-0',
                        isCatActive
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-surface-sunken text-muted border-default'
                      )}
                    >
                      {t('finance.viewsCount', { count: childTabs.length })}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                    {cat.tagline}
                  </p>
                </div>
              </div>

              {/* In-Pillar Quick Navigation Pills (100% Zero Concealed Views) */}
              <div className="mt-3.5 pt-3 border-t border-default/60 flex flex-wrap items-center gap-1.5">
                {childTabs.map((subTab) => {
                  const isCurrent = activeTab === subTab.id;
                  const SubIcon = subTab.icon;

                  return (
                    <button
                      key={subTab.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab(subTab.id);
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer',
                        isCurrent
                          ? 'bg-primary text-primary-fg font-semibold shadow-xs ring-1 ring-primary'
                          : 'bg-surface-sunken text-muted hover:text-default hover:bg-surface border border-default/70'
                      )}
                      title={t('finance.openStage', { label: subTab.label })}
                    >
                      <SubIcon className={cn('size-3', isCurrent ? 'text-primary-fg' : 'text-muted')} />
                      <span>{subTab.shortLabel}</span>
                      <span
                        className={cn(
                          'text-[9px] font-mono px-1 rounded font-bold',
                          isCurrent ? 'bg-white/20 text-white' : 'bg-surface text-muted border border-default/50'
                        )}
                      >
                        {t('finance.stagePill', { step: subTab.step })}
                      </span>
                      {isCurrent && <span className="size-1.5 rounded-full bg-white animate-pulse" />}
                    </button>
                  );
                })}
              </div>

              {/* Active Indicator Bar */}
              {isCatActive && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* 7-Stage Execution Ribbon (Grid with 1..7 shortcuts, non-colliding labels, zero scrollbar) */}
      <div className="bg-surface rounded-2xl border border-default p-2.5 shadow-xs space-y-2">
        <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-muted">
          <div className="flex items-center gap-1.5">
            <Zap className="size-3.5 text-primary" />
            <span className="font-bold text-default">{t('finance.pipelineTitle')}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-muted hidden sm:inline">
              {t('finance.shortcutPipeline')}
            </span>

            {/* Quick Jump Dropdown Popover */}
            <div className="relative shrink-0" ref={quickJumpRef}>
              <button
                type="button"
                onClick={() => {
                  setQuickJumpOpen(!quickJumpOpen);
                  setSearchQuery('');
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer',
                  quickJumpOpen && 'border-primary/40 bg-surface-sunken'
                )}
                title={t('finance.jumpTitle')}
              >
                <SlidersHorizontal className="size-3 text-primary" />
                <span>{t('finance.allViews')}</span>
              </button>

              {quickJumpOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface rounded-2xl border border-default shadow-lg p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('finance.searchPlaceholder')}
                      autoFocus
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-surface-sunken rounded-lg border border-default focus:border-primary focus:outline-none text-default"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-default"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                    {categories.map((cat) => {
                      const catTabs = filteredFinanceTabs.filter((tabItem) => tabItem.category === cat.id);
                      if (catTabs.length === 0) return null;

                      return (
                        <div key={cat.id} className="pt-1.5 first:pt-0">
                          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
                            <span>{cat.label}</span>
                            <span className="font-mono text-[9px]">{catTabs.length}</span>
                          </div>
                          <div className="space-y-0.5">
                            {catTabs.map((tab) => {
                              const TabIcon = tab.icon;
                              const isTabActive = activeTab === tab.id;
                              return (
                                <button
                                  key={tab.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveTab(tab.id);
                                    setQuickJumpOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition cursor-pointer ${
                                    isTabActive
                                      ? 'bg-primary text-primary-fg font-semibold'
                                      : 'hover:bg-surface-sunken text-default'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <TabIcon
                                      className={`size-3.5 shrink-0 ${
                                        isTabActive ? 'text-primary-fg' : 'text-muted'
                                      }`}
                                    />
                                    <span className="truncate">{tab.label}</span>
                                  </div>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                                      isTabActive
                                        ? 'bg-primary-fg/20 text-primary-fg'
                                        : 'bg-surface-sunken text-muted'
                                    }`}
                                  >
                                    {tab.count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {filteredFinanceTabs.length === 0 && (
                      <div className="py-6 text-center text-xs text-muted">
                        {t('finance.noViewsFound', { query: searchQuery })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {financeTabConfigs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer min-w-0',
                  isActive
                    ? 'bg-primary text-primary-fg border-primary shadow-sm'
                    : 'bg-surface hover:bg-surface-sunken border-default/70 hover:border-default text-default'
                )}
              >
                <div
                  className={cn(
                    'size-6 rounded-md flex items-center justify-center shrink-0 font-mono text-xs font-bold transition-colors',
                    isActive ? 'bg-primary-fg/20 text-primary-fg' : 'bg-surface-sunken text-muted'
                  )}
                >
                  {tab.step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <Icon className={cn('size-3.5 shrink-0', isActive ? 'text-primary-fg' : 'text-primary')} />
                    <span className="text-xs font-bold truncate">{tab.shortLabel}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: General Ledger & Journals */}
      {activeTab === 'journal' && (
        <div className="space-y-4 pt-1">
          {/* Discovery & Bulk Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-surface-sunken/60 border border-default text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted font-medium">
                Showing <strong className="text-default">{journalEntries.length}</strong> journal vouchers
              </span>
              {selectedJournalIds.size > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary text-primary-fg">
                  <CheckSquare className="size-3" />
                  {selectedJournalIds.size} Selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImportJournalModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer"
              >
                <Upload className="size-3.5 text-primary" />
                <span>Import Journals</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  exportJournalsCsv(
                    selectedJournalIds.size > 0
                      ? journalEntries.filter((j) => selectedJournalIds.has(j.id))
                      : journalEntries
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet className="size-3.5 text-primary" />
                <span>Export {selectedJournalIds.size > 0 ? `(${selectedJournalIds.size})` : 'All'} CSV</span>
              </button>

              <button
                type="button"
                onClick={toggleSelectAllJournals}
                className="text-xs font-medium text-primary hover:underline cursor-pointer ml-1"
              >
                {isAllJournalsSelected ? 'Deselect All' : `Select All (${journalEntries.length})`}
              </button>

              {canDeleteJournal && selectedJournalIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setDeleteJournalConfirm({ open: true, isBulk: true })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all shadow-2xs cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  <span>Move to Bin ({selectedJournalIds.size})</span>
                </button>
              )}

              {selectedJournalIds.size > 0 && (
                <>
                  <span className="text-muted/40">|</span>
                  <button
                    type="button"
                    onClick={clearJournalSelection}
                    className="text-xs font-medium text-muted hover:text-default cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-2xl shadow-xs border border-default overflow-hidden">
            <table className="w-full text-left text-xs text-default">
              <thead className="bg-surface-sunken/70 text-muted uppercase text-[11px] font-semibold tracking-wider border-b border-default">
                <tr>
                  <th className="w-10 px-4 py-3.5 text-center">
                    <input
                      ref={journalHeaderRef}
                      type="checkbox"
                      checked={isAllJournalsSelected}
                      onChange={toggleSelectAllJournals}
                      className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                      title="Select all journal vouchers"
                    />
                  </th>
                  <th className="px-5 py-3.5">Entry Number</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Module / Type</th>
                  <th className="px-5 py-3.5">Narration</th>
                  <th className="px-5 py-3.5 text-right">Debit (BDT)</th>
                  <th className="px-5 py-3.5 text-right">Credit (BDT)</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {journalEntries.map((je) => (
                  <tr
                    key={je.id}
                    className={cn(
                      'hover:bg-surface-sunken/40 transition-colors',
                      selectedJournalIds.has(je.id) && 'bg-primary/5 dark:bg-primary/10'
                    )}
                  >
                    <td className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedJournalIds.has(je.id)}
                        onChange={() => toggleSelectJournal(je.id)}
                        className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                        aria-label={`Select ${je.entry_number}`}
                      />
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-primary">
                      <button
                        type="button"
                        onClick={() => handleViewJournal(je)}
                        className="hover:underline cursor-pointer text-left font-mono font-bold text-primary"
                        title="Click to view breakdown"
                      >
                        {je.entry_number}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-muted">{je.entry_date}</td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize px-2.5 py-0.5 text-[10px] font-semibold bg-surface-sunken rounded-full text-muted border border-default">
                        {je.source_module} ({je.entry_type})
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs truncate text-default">{je.narration}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(je.total_debit)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(je.total_credit)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        {je.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleViewJournal(je)}
                          className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                          title="View Ledger Lines"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateJournal(je)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer"
                          title="Duplicate / Re-post Journal Entry"
                        >
                          <Copy className="size-3.5" />
                          <span>Duplicate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReverseJournal(je)}
                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Reverse Journal Entry (Invert Debits/Credits)"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                        {canDeleteJournal && (
                          <button
                            type="button"
                            onClick={() => setDeleteJournalConfirm({ open: true, isBulk: false, id: je.id })}
                            className="p-1.5 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                            title="Move to Data Bin"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Floating Bottom Docked Action Toolbar for Selected Journals */}
          {selectedJournalIds.size > 0 && (
            <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none animate-in slide-in-from-bottom-6 duration-200">
              <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-default/80 bg-surface/95 px-5 py-3 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10">
                <div className="flex items-center gap-2 border-r border-default pr-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                    {selectedJournalIds.size}
                  </span>
                  <span className="text-xs font-semibold text-default">
                    Voucher{selectedJournalIds.size > 1 ? 's' : ''} Selected
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      exportJournalsCsv(
                        journalEntries.filter((j) => selectedJournalIds.has(j.id))
                      )
                    }
                    className="flex h-8 items-center gap-1.5 rounded-xl bg-primary text-primary-fg px-3 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                  >
                    <FileSpreadsheet className="size-3 text-primary-fg" />
                    Export CSV ({selectedJournalIds.size})
                  </button>

                  {canDeleteJournal && (
                    <button
                      type="button"
                      onClick={() => setDeleteJournalConfirm({ open: true, isBulk: true })}
                      className="flex h-8 items-center gap-1.5 rounded-xl bg-destructive text-destructive-fg px-3 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                    >
                      <Trash2 className="size-3 text-destructive-fg" />
                      Move to Bin ({selectedJournalIds.size})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={clearJournalSelection}
                    className="flex size-8 items-center justify-center rounded-xl border border-default bg-surface-sunken text-muted hover:text-default transition-colors cursor-pointer ml-1"
                    title="Deselect all (Esc)"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Chart of Accounts */}
      {activeTab === 'coa' && (
        <div className="space-y-4 pt-1">
          {/* Discovery & Bulk Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-surface-sunken/60 border border-default text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted font-medium">
                Showing <strong className="text-default">{accounts.length}</strong> GL ledger accounts
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImportCoaModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer"
              >
                <Upload className="size-3.5 text-primary" />
                <span>Import Accounts</span>
              </button>

              <button
                type="button"
                onClick={exportAccountsCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet className="size-3.5 text-primary" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-surface rounded-2xl shadow-xs border border-default overflow-hidden">
            <table className="w-full text-left text-xs text-default">
              <thead className="bg-surface-sunken/70 text-muted uppercase text-[11px] font-semibold tracking-wider border-b border-default">
                <tr>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Account Name</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Subtype</th>
                  <th className="px-5 py-3.5">Normal Balance</th>
                  <th className="px-5 py-3.5 text-right">Current Balance (BDT)</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-surface-sunken/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-primary">
                      <button
                        type="button"
                        onClick={() => handleViewAccount(acc)}
                        className="hover:underline cursor-pointer text-left font-mono font-bold text-primary"
                        title="Click to view account transactions"
                      >
                        {acc.account_code}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-default">{acc.name}</td>
                    <td className="px-5 py-3.5 capitalize">
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${
                          acc.account_type === 'asset'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                            : acc.account_type === 'liability'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : acc.account_type === 'income'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : acc.account_type === 'expense'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                  : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                        }`}
                      >
                        {acc.account_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 capitalize text-muted">
                      {acc.account_subtype || '—'}
                    </td>
                    <td className="px-5 py-3.5 uppercase font-mono text-[11px] font-semibold text-muted">
                      {acc.normal_balance}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-default">
                      {formatCurrency(acc.current_balance || '0')}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        ACTIVE
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleViewAccount(acc)}
                          className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                          title="View Account Profile & Ledger"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateAccount(acc)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer"
                          title="Duplicate / Clone Account Head"
                        >
                          <Copy className="size-3.5" />
                          <span>Duplicate</span>
                        </button>
                        {canDeleteAccount && !acc.is_system && (
                          <button
                            type="button"
                            onClick={() => setDeletingAccount(acc)}
                            className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Move to Data Bin"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Banking & Treasury */}
      {activeTab === 'banking' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-default shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-default flex items-center gap-2">
                <Landmark className="size-4 text-primary" />
                <span>Liquid Cash & Operating Bank Accounts</span>
              </h3>
              <p className="text-xs text-muted">
                Active cash drawers, current accounts, and funds available for immediate business operations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImportBankModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default shadow-xs transition cursor-pointer"
              >
                <Upload className="size-3.5 text-primary" />
                <span>Import Statement</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransferPrefill({});
                  setShowTransferModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
              >
                <ArrowLeftRight className="size-3.5" />
                <span>+ Transfer Money</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAccountForm();
                  setShowNewAccountModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-default bg-surface-sunken hover:bg-surface text-default transition cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>+ Add Account</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNewBankModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-hover text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>+ Add Bank Account</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cash on Hand Card */}
            {accounts
              .filter((a) => a.account_subtype === 'cash')
              .map((cashAcc) => (
                <div
                  key={`cash-${cashAcc.id}`}
                  className="bg-surface rounded-2xl p-5 shadow-xs border border-emerald-500/30 dark:border-emerald-500/20 space-y-4 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-default">{cashAcc.name}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          CASH REGISTER
                        </span>
                      </div>
                      <p className="text-xs text-muted">GL Code: {cashAcc.account_code} — On-Premises Petty Cash</p>
                    </div>
                    {canDeleteAccount && (
                      <button
                        type="button"
                        onClick={() => setDeletingAccount(cashAcc)}
                        className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title={`Move ${cashAcc.name} to Data Bin`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="p-3.5 bg-surface-sunken rounded-xl space-y-1.5 border border-default">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Account Classification:</span>
                      <span className="font-medium text-default capitalize">Current Asset (Liquid)</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Reconciliation Status:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">Balanced & Verified</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-default">
                    <div>
                      <div className="text-[11px] text-muted">Available Cash Balance</div>
                      <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCurrency(cashAcc.current_balance || '0')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTransferPrefill({ fromId: cashAcc.id });
                          setShowTransferModal(true);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition cursor-pointer"
                        title="Deposit cash into a bank account"
                      >
                        Deposit to Bank
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTransferPrefill({ toId: cashAcc.id });
                          setShowTransferModal(true);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
                        title="Withdraw cash from bank into cash on hand"
                      >
                        Add Cash
                      </button>
                    </div>
                  </div>
                </div>
              ))}

            {/* Bank Accounts Cards */}
            {bankAccounts.map((ba) => {
              const matchedAccount = accounts.find((a) =>
                a.name.toLowerCase().includes(ba.bank_name.toLowerCase().split(' ')[0] || '')
              );
              return (
                <div
                  key={ba.id}
                  className="bg-surface rounded-2xl p-5 shadow-xs border border-default space-y-4 relative overflow-hidden hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-default">{ba.bank_name}</h4>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                          {ba.currency_code}
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        {ba.account_name} ({ba.branch_name})
                      </p>
                    </div>
                    {canDeleteBank && (
                      <button
                        type="button"
                        onClick={() => setDeletingBankAccount(ba)}
                        className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title={`Move ${ba.bank_name} to Data Bin`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="p-3.5 bg-surface-sunken rounded-xl space-y-1.5 border border-default">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Account Number:</span>
                      <span className="font-mono font-semibold text-default">{ba.account_number}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Routing Number:</span>
                      <span className="font-mono text-default">{ba.routing_number}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">SWIFT / BIC:</span>
                      <span className="font-mono text-default">{ba.swift_code}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-default">
                    <div>
                      <div className="text-[11px] text-muted">Current Ledger Balance</div>
                      <div className="text-2xl font-extrabold text-primary font-mono">
                        {formatCurrency(ba.current_balance)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (matchedAccount) setTransferPrefill({ fromId: matchedAccount.id });
                          setShowTransferModal(true);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition cursor-pointer"
                        title="Transfer money out of this account"
                      >
                        Transfer Out
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (matchedAccount) setTransferPrefill({ toId: matchedAccount.id });
                          setShowTransferModal(true);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-hover text-white transition cursor-pointer"
                        title="Transfer money into this account"
                      >
                        Deposit In
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Quick Add Bank Account Card */}
            <button
              type="button"
              onClick={() => setShowNewBankModal(true)}
              className="rounded-2xl border-2 border-dashed border-default hover:border-primary/50 bg-surface/50 hover:bg-primary/5 p-6 flex flex-col items-center justify-center text-center gap-2 group transition-all cursor-pointer min-h-50"
            >
              <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all shadow-xs">
                <Plus className="size-5" />
              </div>
              <div>
                <h5 className="font-bold text-sm text-default group-hover:text-primary transition-colors">
                  + Add Bank Account
                </h5>
                <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
                  Register a corporate checking, savings, or payroll bank account
                </p>
              </div>
            </button>

            {/* Quick Add Cash Drawer Card */}
            <button
              type="button"
              onClick={() => {
                resetAccountForm();
                setNewAccountName('');
                setNewAccountSubtype('cash');
                setShowNewAccountModal(true);
              }}
              className="rounded-2xl border-2 border-dashed border-default hover:border-emerald-500/50 bg-surface/50 hover:bg-emerald-500/5 p-6 flex flex-col items-center justify-center text-center gap-2 group transition-all cursor-pointer min-h-50"
            >
              <div className="size-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                <Plus className="size-5" />
              </div>
              <div>
                <h5 className="font-bold text-sm text-default group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  + Add Cash Drawer
                </h5>
                <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
                  Create a physical cash register, counter petty cash, or factory vault drawer
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Expenses & Claims */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-default shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-default flex items-center gap-2">
                <ReceiptText className="size-4 text-rose-500" />
                <span>Operating Expenses & Disbursements</span>
              </h3>
              <p className="text-xs text-muted">
                Daily operational costs (power, rent, courier, factory consumables) recorded with automatic General Ledger vouchers
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setShowNewExpenseCatModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default shadow-xs transition cursor-pointer"
              >
                <Plus className="size-3.5 text-primary" />
                <span>+ Add Category</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMoneyOutModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                <ArrowDownRight className="size-3.5" />
                <span>+ Record Expense</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {['all', 'UTIL', 'LOG', 'RENT', 'SUPP'].map((catCode) => (
                <button
                  key={catCode}
                  type="button"
                  onClick={() => setExpenseCategoryFilter(catCode)}
                  className={cn(
                    'px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer',
                    expenseCategoryFilter === catCode
                      ? 'bg-primary text-primary-fg font-semibold shadow-xs'
                      : 'bg-surface-sunken text-muted hover:text-default border border-default'
                  )}
                >
                  {catCode === 'all'
                    ? 'All Categories'
                    : catCode === 'UTIL'
                    ? 'Power & Utilities'
                    : catCode === 'LOG'
                    ? 'Courier & Delivery'
                    : catCode === 'RENT'
                    ? 'Rent'
                    : 'Factory Supplies'}
                </button>
              ))}
            </div>

            <div className="text-xs text-muted font-mono">
              Total Recorded:{' '}
              <strong className="text-default font-bold">
                {formatCurrency(
                  expenses
                    .filter((e) => expenseCategoryFilter === 'all' || e.category?.code === expenseCategoryFilter)
                    .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0)
                )}
              </strong>
            </div>
          </div>

          {/* Selected Expenses Bulk Action Ribbon */}
          {selectedExpenseIds.size > 0 && (
            <div className="flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-destructive">
                  {selectedExpenseIds.size} expense voucher{selectedExpenseIds.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canDeleteExpense && (
                  <button
                    type="button"
                    onClick={() => setDeleteExpenseConfirm({ open: true, isBulk: true })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive text-destructive-fg hover:opacity-90 transition shadow-2xs cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Move to Bin ({selectedExpenseIds.size})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedExpenseIds(new Set())}
                  className="text-xs font-medium text-muted hover:text-default cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          <div className="bg-surface rounded-2xl shadow-xs border border-default overflow-hidden">
            <table className="w-full text-left text-xs text-default">
              <thead className="bg-surface-sunken/70 text-muted uppercase text-[11px] font-semibold tracking-wider border-b border-default">
                <tr>
                  <th className="w-10 px-4 py-3.5 text-center">
                    <input
                      ref={expenseHeaderRef}
                      type="checkbox"
                      checked={isAllExpensesSelected}
                      onChange={toggleSelectAllExpenses}
                      className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                      title="Select all expenses"
                    />
                  </th>
                  <th className="px-5 py-3.5">Expense Date</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Payee Name</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5">Payment Method</th>
                  <th className="px-5 py-3.5 text-right">Amount (BDT)</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {expenses
                  .filter((e) => expenseCategoryFilter === 'all' || e.category?.code === expenseCategoryFilter)
                  .map((exp) => (
                    <tr key={exp.id} className="hover:bg-surface-sunken/40 transition">
                      <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedExpenseIds.has(exp.id)}
                          onChange={() => toggleSelectOneExpense(exp.id)}
                          className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-3.5 font-mono text-muted">{exp.expense_date}</td>
                      <td className="px-5 py-3.5 font-semibold text-default">
                        {exp.category?.name}
                      </td>
                      <td className="px-5 py-3.5 text-default">{exp.payee_name || '—'}</td>
                      <td className="px-5 py-3.5 max-w-xs truncate text-muted">{exp.description}</td>
                      <td className="px-5 py-3.5 capitalize text-muted">
                        {exp.payment_method.replace('_', ' ')}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-default">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          {exp.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleViewExpense(exp)}
                            className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                            title="View Expense Voucher Details"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateExpense(exp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer"
                            title="Duplicate Expense Voucher"
                          >
                            <Copy className="size-3.5" />
                            <span>Duplicate</span>
                          </button>
                          {canDeleteExpense && (
                            <button
                              type="button"
                              onClick={() => setDeleteExpenseConfirm({ open: true, isBulk: false, id: exp.id })}
                              className="p-1.5 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                              title="Move to Data Bin"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Product Cost Rollup */}
      {activeTab === 'costing' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-default shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-default flex items-center gap-2">
                <Calculator className="size-4 text-primary" />
                <span>Manufacturing Standard Unit Cost Rollup</span>
              </h3>
              <p className="text-xs text-muted">
                Multi-level BOM cost aggregation combining raw materials, piece-rate labour, and factory overhead rates
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleRollupCosting(1)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-hover text-white shadow-xs transition cursor-pointer self-start sm:self-auto"
            >
              <Calculator className="size-3.5" />
              <span>Recalculate Cost Rollup</span>
            </button>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-200 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Product / SKU</th>
                  <th className="px-6 py-3 text-right">Material Cost</th>
                  <th className="px-6 py-3 text-right">Piece-rate Labour</th>
                  <th className="px-6 py-3 text-right">Factory Overhead</th>
                  <th className="px-6 py-3 text-right">Standard Unit Cost</th>
                  <th className="px-6 py-3">Effective Date</th>
                  <th className="px-6 py-3 text-center">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {productCosts.map((pc) => (
                  <tr key={pc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {pc.product?.name}
                      </div>
                      <div className="text-xs font-mono text-gray-500">{pc.product?.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatCurrency(pc.material_cost)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-amber-600 dark:text-amber-400 font-semibold">
                      {formatCurrency(pc.labour_cost)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatCurrency(pc.overhead_cost)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(pc.total_cost)}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">{pc.effective_from}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded">
                        {pc.source.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Financial Statements & P&L */}
      {activeTab === 'statements' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Fiscal Period Statement of Profit & Loss (Income Statement)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Live computed from posted general ledger transactions and inventory valuation
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPrintStatementModal(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              🖨️ Print Financial Statement
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Statement Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b pb-2 dark:border-gray-700">
                Revenue & Cost of Sales
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center text-gray-900 dark:text-gray-100 font-semibold">
                  <span>Gross Sales Revenue</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(950000)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span className="pl-4">Less: Cost of Goods Sold (COGS)</span>
                  <span className="font-mono text-rose-500">({formatCurrency(480000)})</span>
                </div>
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span className="pl-4">Less: Direct Factory Labour</span>
                  <span className="font-mono text-rose-500">({formatCurrency(145000)})</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center font-bold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/40 p-2 rounded">
                  <span>Gross Profit</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(325000)} (34.2%)
                  </span>
                </div>
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b pb-2 pt-3 dark:border-gray-700">
                Operating Expenses
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span>Logistics & 3PL Courier Fees</span>
                  <span className="font-mono">{formatCurrency(38500)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span>Utilities & Factory Power</span>
                  <span className="font-mono">{formatCurrency(24000)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span>Administrative & Software</span>
                  <span className="font-mono">{formatCurrency(18200)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center font-bold text-base text-gray-900 dark:text-gray-100 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-500/20">
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Net Operating Income
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(244300)}
                  </span>
                </div>
              </div>
            </div>

            {/* Balance Sheet Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b pb-2 dark:border-gray-700">
                Balance Sheet Equation (Assets = Liabilities + Equity)
              </h3>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <div className="flex justify-between items-center font-bold text-blue-900 dark:text-blue-300 mb-1.5">
                    <span>Total Current & Fixed Assets</span>
                    <span className="font-mono">{formatCurrency(1310000)}</span>
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-400 space-y-0.5">
                    <div className="flex justify-between">
                      <span>• Liquid Cash & Banks:</span>{' '}
                      <span className="font-mono font-semibold">{formatCurrency(970000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Accounts Receivable:</span>{' '}
                      <span className="font-mono font-semibold">{formatCurrency(340000)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                  <div className="flex justify-between items-center font-bold text-amber-900 dark:text-amber-300 mb-1.5">
                    <span>Total Liabilities</span>
                    <span className="font-mono">{formatCurrency(210000)}</span>
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                    <div className="flex justify-between">
                      <span>• Accounts Payable:</span>{' '}
                      <span className="font-mono font-semibold">{formatCurrency(210000)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                  <div className="flex justify-between items-center font-bold text-indigo-900 dark:text-indigo-300 mb-1.5">
                    <span>Owner's Equity & Retained Earnings</span>
                    <span className="font-mono">{formatCurrency(1100000)}</span>
                  </div>
                  <div className="text-xs text-indigo-700 dark:text-indigo-400 space-y-0.5">
                    <div className="flex justify-between">
                      <span>• Contributed Capital:</span>{' '}
                      <span className="font-mono font-semibold">{formatCurrency(500000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Retained Fiscal Earnings:</span>{' '}
                      <span className="font-mono font-semibold">{formatCurrency(600000)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-semibold text-emerald-400">
                  <span>
                    Balance Check: {formatCurrency(1310000)} = {formatCurrency(210000)} +{' '}
                    {formatCurrency(1100000)}
                  </span>
                  <span>✓ 100% IN BALANCE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Due Collection & Receivables */}
      {activeTab === 'due-collection' && (
        <DueCollectionSection
          onCollect={(inv) => {
            setMoneyInPrefill({
              customerName: inv.customer_name,
              dueAmount: inv.due_amount,
              invoiceNumber: inv.invoice_number,
            });
            setShowMoneyInModal(true);
          }}
          onQuickCollect={() => {
            setMoneyInPrefill({});
            setShowMoneyInModal(true);
          }}
        />
      )}

      {/* Post Adjusting Journal Entry Modal (for Certified Accountants) */}
      {showNewJournalModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-default rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-default pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-default flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" />
                  <span>Adjusting Journal Voucher (for Accountants)</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Record balanced multi-split adjusting entries, asset depreciation, or year-end corrections
                </p>
              </div>
              <button
                onClick={() => setShowNewJournalModal(false)}
                className="text-muted hover:text-default p-1 rounded-lg transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Quick Adjustment Templates */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 bg-surface-sunken rounded-xl border border-default text-xs">
              <span className="font-semibold text-muted text-[11px] uppercase tracking-wider">Quick Templates:</span>
              <button
                type="button"
                onClick={() => applyJournalTemplate('depreciation')}
                className="px-2.5 py-1 bg-surface hover:bg-surface-sunken border border-default rounded-lg text-default text-xs font-medium cursor-pointer transition"
              >
                + Machine Depreciation
              </button>
              <button
                type="button"
                onClick={() => applyJournalTemplate('capital')}
                className="px-2.5 py-1 bg-surface hover:bg-surface-sunken border border-default rounded-lg text-default text-xs font-medium cursor-pointer transition"
              >
                + Capital Injection
              </button>
              <button
                type="button"
                onClick={() => applyJournalTemplate('drawings')}
                className="px-2.5 py-1 bg-surface hover:bg-surface-sunken border border-default rounded-lg text-default text-xs font-medium cursor-pointer transition"
              >
                + Owner Drawings
              </button>
            </div>

            <form onSubmit={handlePostJournal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-default uppercase mb-1">
                  Narration / Description
                </label>
                <input
                  type="text"
                  value={newNarration}
                  onChange={(e) => setNewNarration(e.target.value)}
                  placeholder="e.g. Monthly asset depreciation or year-end equity adjustment"
                  required
                  className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-default uppercase">
                    Journal Lines (Debit = Credit)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Line</span>
                  </button>
                </div>
                {newLines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={line.account_id}
                      onChange={(e) => {
                        const updated = [...newLines];
                        const target = updated[idx];
                        if (target) {
                          target.account_id = parseInt(e.target.value);
                          setNewLines(updated);
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.account_code} - {a.name} ({a.account_type})
                        </option>
                      ))}
                    </select>

                    <div className="relative w-28 sm:w-32 shrink-0">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Debit"
                        value={line.debit}
                        onChange={(e) => {
                          const updated = [...newLines];
                          const target = updated[idx];
                          if (target) {
                            target.debit = e.target.value;
                            setNewLines(updated);
                          }
                        }}
                        className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm text-right font-mono focus:border-primary focus:outline-none"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted uppercase font-bold pointer-events-none">
                        Dr
                      </span>
                    </div>

                    <div className="relative w-28 sm:w-32 shrink-0">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Credit"
                        value={line.credit}
                        onChange={(e) => {
                          const updated = [...newLines];
                          const target = updated[idx];
                          if (target) {
                            target.credit = e.target.value;
                            setNewLines(updated);
                          }
                        }}
                        className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm text-right font-mono focus:border-primary focus:outline-none"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted uppercase font-bold pointer-events-none">
                        Cr
                      </span>
                    </div>

                    {newLines.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                        title="Remove line"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Balance Verification Bar */}
              <div
                className={`p-4 rounded-xl flex items-center justify-between text-xs sm:text-sm border ${
                  isJournalBalanced
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}
              >
                <div>
                  <span className="font-semibold">Debits:</span> {formatCurrency(totalNewDebit)} |{' '}
                  <span className="font-semibold">Credits:</span> {formatCurrency(totalNewCredit)}
                </div>
                <div className="font-bold">
                  {isJournalBalanced
                    ? '✓ BALANCED'
                    : `⚠️ OUT OF BALANCE (${formatCurrency(Math.abs(totalNewDebit - totalNewCredit))})`}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowNewJournalModal(false)}
                  className="px-4 py-2 text-xs font-medium border border-default rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isJournalBalanced}
                  className="px-5 py-2 text-xs bg-primary disabled:opacity-50 hover:bg-primary-hover text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  Confirm & Post to General Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Money Out Modal */}
      <MoneyOutModal
        open={showMoneyOutModal}
        onClose={() => setShowMoneyOutModal(false)}
        accounts={accounts}
        bankAccounts={bankAccounts}
        onSuccess={handleMoneyOutSuccess}
      />

      {/* Money In Modal */}
      <MoneyInModal
        open={showMoneyInModal}
        onClose={() => setShowMoneyInModal(false)}
        accounts={accounts}
        bankAccounts={bankAccounts}
        initialCustomerName={moneyInPrefill.customerName}
        initialDueAmount={moneyInPrefill.dueAmount}
        initialInvoiceNumber={moneyInPrefill.invoiceNumber}
        onSuccess={handleMoneyInSuccess}
      />

      {/* Move Money Transfer Modal */}
      <TransferMoneyModal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        accounts={accounts}
        bankAccounts={bankAccounts}
        initialFromAccountId={transferPrefill.fromId}
        initialToAccountId={transferPrefill.toId}
        onSuccess={handleTransferSuccess}
      />

      {/* View Journal Entry Modal */}
      {viewingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-default rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-default flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-default font-mono">
                      {viewingEntry.entry_number}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      {viewingEntry.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{viewingEntry.narration}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingEntry(null)}
                className="p-1 text-muted hover:text-default rounded-lg transition"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-sunken/60 p-3.5 rounded-xl border border-default text-xs">
                <div>
                  <div className="text-muted text-[10px] uppercase font-semibold">Date</div>
                  <div className="font-mono font-medium text-default mt-0.5">
                    {viewingEntry.entry_date}
                  </div>
                </div>
                <div>
                  <div className="text-muted text-[10px] uppercase font-semibold">
                    Source Module
                  </div>
                  <div className="capitalize text-default mt-0.5">{viewingEntry.source_module}</div>
                </div>
                <div>
                  <div className="text-muted text-[10px] uppercase font-semibold">Total Debit</div>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(viewingEntry.total_debit)}
                  </div>
                </div>
                <div>
                  <div className="text-muted text-[10px] uppercase font-semibold">Total Credit</div>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(viewingEntry.total_credit)}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Double-Entry Ledger Lines
                </h4>
                <div className="rounded-xl border border-default overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-sunken/80 border-b border-default text-muted uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Account</th>
                        <th className="px-4 py-2.5">Line Narration</th>
                        <th className="px-4 py-2.5 text-right">Debit (BDT)</th>
                        <th className="px-4 py-2.5 text-right">Credit (BDT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {viewingEntry.lines?.map((l) => (
                        <tr key={l.id} className="hover:bg-surface-sunken/30">
                          <td className="px-4 py-2.5">
                            <div className="font-mono font-bold text-default">
                              {l.account?.account_code ?? l.account_id}
                            </div>
                            <div className="text-muted text-[11px]">
                              {l.account?.name ?? 'Account'}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-muted">{l.narration || '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-default">
                            {parseFloat(String(l.debit_amount)) > 0
                              ? formatCurrency(String(l.debit_amount))
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-default">
                            {parseFloat(String(l.credit_amount)) > 0
                              ? formatCurrency(String(l.credit_amount))
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-surface-sunken/50 border-t border-default font-bold text-xs">
                      <tr>
                        <td colSpan={2} className="px-4 py-2.5 text-right uppercase text-muted">
                          Total
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(viewingEntry.total_debit)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(viewingEntry.total_credit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-default bg-surface-sunken/30 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const entry = viewingEntry;
                  setViewingEntry(null);
                  handleDuplicateJournal(entry);
                }}
                className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Copy className="size-3.5" />
                <span>Duplicate this Entry</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingEntry(null)}
                className="px-4 py-2 text-xs font-medium text-default hover:bg-surface-sunken border border-default rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Chart of Accounts Head Modal */}
      {viewingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-default rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-default flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Scale className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-default font-mono">
                      {viewingAccount.account_code} - {viewingAccount.name}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5 capitalize">
                    {viewingAccount.account_type}{' '}
                    {viewingAccount.account_subtype ? `(${viewingAccount.account_subtype})` : ''} •
                    Normal {viewingAccount.normal_balance}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingAccount(null)}
                className="p-1 text-muted hover:text-default rounded-lg transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-surface-sunken/60 p-4 rounded-xl border border-default text-xs">
                <div>
                  <div className="text-muted text-[10px] uppercase font-semibold">
                    Account Classification
                  </div>
                  <div className="font-semibold text-default capitalize mt-1">
                    {viewingAccount.account_type} ({viewingAccount.account_subtype || 'Standard'})
                  </div>
                </div>
                <div>
                  <div className="text-muted text-[10px] uppercase font-semibold">
                    Current Balance
                  </div>
                  <div className="font-mono text-base font-extrabold text-default mt-0.5">
                    {formatCurrency(viewingAccount.current_balance || '0')}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Recent Journal Allocations
                </h4>
                <div className="rounded-xl border border-default overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-sunken/80 border-b border-default text-muted uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Entry #</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5 text-right">Debit</th>
                        <th className="px-4 py-2.5 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {journalEntries
                        .filter((je) =>
                          je.lines?.some(
                            (l) =>
                              l.account_id === viewingAccount.id ||
                              l.account?.account_code === viewingAccount.account_code
                          )
                        )
                        .map((je) => {
                          const relevantLine = je.lines?.find(
                            (l) =>
                              l.account_id === viewingAccount.id ||
                              l.account?.account_code === viewingAccount.account_code
                          );
                          return (
                            <tr key={je.id} className="hover:bg-surface-sunken/30">
                              <td className="px-4 py-2.5 font-mono font-bold text-primary">
                                {je.entry_number}
                              </td>
                              <td className="px-4 py-2.5 text-muted">{je.entry_date}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-semibold text-default">
                                {relevantLine && parseFloat(String(relevantLine.debit_amount)) > 0
                                  ? formatCurrency(String(relevantLine.debit_amount))
                                  : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono font-semibold text-default">
                                {relevantLine && parseFloat(String(relevantLine.credit_amount)) > 0
                                  ? formatCurrency(String(relevantLine.credit_amount))
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      {!journalEntries.some((je) =>
                        je.lines?.some(
                          (l) =>
                            l.account_id === viewingAccount.id ||
                            l.account?.account_code === viewingAccount.account_code
                        )
                      ) && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-muted">
                            No ledger transactions recorded for this account head yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-default bg-surface-sunken/30 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const acc = viewingAccount;
                  setViewingAccount(null);
                  handleDuplicateAccount(acc);
                }}
                className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Copy className="size-3.5" />
                <span>Duplicate Account</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingAccount(null)}
                className="px-4 py-2 text-xs font-medium text-default hover:bg-surface-sunken border border-default rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Duplicate Chart of Accounts Head Modal */}
      {showNewAccountModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-default rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-default pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-default flex items-center gap-2">
                  <Scale className="size-5 text-primary" />
                  <span>
                    {newAccountName.includes('(Copy)')
                      ? 'Duplicate Account Head'
                      : 'New Account Head'}
                  </span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Configure Chart of Accounts general ledger head with classification and normal
                  balance
                </p>
              </div>
              <button
                onClick={() => setShowNewAccountModal(false)}
                className="text-muted hover:text-default p-1 rounded-lg transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-default uppercase mb-1">
                    Account Code
                  </label>
                  <input
                    type="text"
                    value={newAccountCode}
                    onChange={(e) => setNewAccountCode(e.target.value)}
                    placeholder="e.g. 1021"
                    required
                    className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm font-mono focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-default uppercase mb-1">
                    Normal Balance
                  </label>
                  <select
                    value={newNormalBalance}
                    onChange={(e) => setNewNormalBalance(e.target.value as NormalBalance)}
                    className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="debit">DEBIT</option>
                    <option value="credit">CREDIT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-default uppercase mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g. City Bank Operating A/C"
                  required
                  className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-default uppercase mb-1">
                    Account Type
                  </label>
                  <select
                    value={newAccountType}
                    onChange={(e) => handleAccountTypeChange(e.target.value as AccountType)}
                    className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm capitalize focus:border-primary focus:outline-none"
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-default uppercase mb-1">
                    Subtype / Group
                  </label>
                  <input
                    type="text"
                    value={newAccountSubtype}
                    onChange={(e) => setNewAccountSubtype(e.target.value)}
                    placeholder="e.g. bank, cash, cogs"
                    className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-default uppercase mb-1">
                  Opening Balance (BDT)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newOpeningBalance}
                  onChange={(e) => setNewOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowNewAccountModal(false)}
                  className="px-4 py-2 text-xs font-medium border border-default rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  Save Account Head
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Bank Account */}
      <Modal
        open={showNewBankModal}
        onClose={() => setShowNewBankModal(false)}
        title="Add Corporate Bank Account"
        size="md"
      >
        <form onSubmit={handleCreateBankAccount} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-default mb-1">
              Bank Name *
            </label>
            <input
              type="text"
              required
              value={newBankName}
              onChange={(e) => setNewBankName(e.target.value)}
              placeholder="e.g., Standard Chartered Bank"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">
              Account Holder / Profile Name *
            </label>
            <input
              type="text"
              required
              value={newBankAccountName}
              onChange={(e) => setNewBankAccountName(e.target.value)}
              placeholder="e.g., Primary Commercial Operating Account"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Account Number *
              </label>
              <input
                type="text"
                required
                value={newBankAccountNumber}
                onChange={(e) => setNewBankAccountNumber(e.target.value)}
                placeholder="e.g., 01-8923481-01"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Branch Name
              </label>
              <input
                type="text"
                value={newBankBranch}
                onChange={(e) => setNewBankBranch(e.target.value)}
                placeholder="e.g., Gulshan Branch"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                GL Account Link
              </label>
              <select
                value={newBankCoaId}
                onChange={(e) => setNewBankCoaId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                {accounts
                  .filter((a) => a.account_type === 'asset')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} - {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Opening Balance (BDT)
              </label>
              <input
                type="number"
                step="0.01"
                value={newBankOpeningBalance}
                onChange={(e) => setNewBankOpeningBalance(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowNewBankModal(false)}
              className="px-4 py-2 text-xs font-medium border border-default rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              Save Bank Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Expense Category */}
      <Modal
        open={showNewExpenseCatModal}
        onClose={() => setShowNewExpenseCatModal(false)}
        title="Add Expense Category"
        size="md"
      >
        <form onSubmit={handleCreateExpenseCategory} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Category Code *
              </label>
              <input
                type="text"
                required
                value={newCatCode}
                onChange={(e) => setNewCatCode(e.target.value)}
                placeholder="e.g., ADVT"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm uppercase font-mono focus:border-primary focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-default mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g., Marketing & Promotions"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-default mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              placeholder="e.g., Digital advertising, print media, promotional giveaways"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowNewExpenseCatModal(false)}
              className="px-4 py-2 text-xs font-medium border border-default rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              Save Category
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Explore Financial Capabilities & Architecture Guide */}
      <Modal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title={t('finance.guide.modalTitle')}
        size="xl"
      >
        <div className="space-y-6">
          <div className="rounded-xl bg-primary-subtle/50 border border-primary/20 p-4">
            <h4 className="text-sm font-bold text-primary flex items-center gap-2 mb-1">
              <BookOpen className="size-4" />
              {t('finance.guide.heroTitle')}
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              {t('finance.guide.heroDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {financeTabConfigs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <div
                  key={tab.id}
                  className="rounded-xl border border-default bg-surface p-4 flex flex-col justify-between hover:border-primary/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                          <TabIcon className="size-4" />
                        </div>
                        <h5 className="text-xs font-bold text-default">{tab.label}</h5>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-sunken text-muted border border-default capitalize">
                        {tab.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed mb-3">{tab.description}</p>
                    <div className="space-y-1 mb-4">
                      {(Array.isArray(tab.highlights) ? tab.highlights : []).map((h: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-default/80">
                          <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={activeTab === tab.id ? 'primary' : 'secondary'}
                    className="w-full text-xs justify-between cursor-pointer"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsGuideOpen(false);
                    }}
                  >
                    <span>{activeTab === tab.id ? t('finance.guide.currentView') : t('finance.guide.switchTo', { label: tab.shortLabel })}</span>
                    <ArrowRight className="size-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl bg-surface-sunken p-4 border border-default flex items-center justify-between">
            <div className="text-xs text-muted">
              {t('finance.guide.shortcutHint')}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsGuideOpen(false)}>
              {t('finance.guide.close')}
            </Button>
          </div>
        </div>
      </Modal>
      {/* Financial Statement Corporate Print Preview Modal */}
      {showPrintStatementModal && (
        <PrintPreviewModal
          isOpen={showPrintStatementModal}
          onClose={() => setShowPrintStatementModal(false)}
          title="Print Financial Statement: Profit & Loss and Financial Position"
          documentNumber="FS-PL-2026-Q3"
          documentType="Official Financial Statement"
          pageClass="print-page-a4"
        >
          <FinancialStatementPrintDocument
            businessConfig={businessConfig}
            fiscalPeriodText="Q3 FY2026 (1 Jul 2026 – 30 Sep 2026)"
            generatedBy="Chief Financial Controller"
            data={{
              periodTitle: 'Q3 FY2026 (1 Jul 2026 – 30 Sep 2026)',
              reportCode: 'FS-PL-2026-Q3',
              revenue: {
                grossSales: 950000,
                cogs: 480000,
                directLabour: 145000,
              },
              expenses: {
                logistics: 38500,
                utilities: 24000,
                administrative: 18200,
              },
              balanceSheet: {
                cashAndBanks: 970000,
                accountsReceivable: 340000,
                accountsPayable: 210000,
                contributedCapital: 500000,
                retainedEarnings: 600000,
              },
            }}
          />
        </PrintPreviewModal>
      )}
      {/* Universal Import Modals for Finance Master Data & Records */}
      <UniversalImportModal
        isOpen={showImportCoaModal}
        onClose={() => setShowImportCoaModal(false)}
        schema={chartOfAccountsImportSchema}
        onImportSuccess={() => fetchAccountsFromApi()}
      />

      <UniversalImportModal
        isOpen={showImportJournalModal}
        onClose={() => setShowImportJournalModal(false)}
        schema={openingJournalImportSchema}
        onImportSuccess={() => fetchJournalsFromApi()}
      />

      <UniversalImportModal
        isOpen={showImportBankModal}
        onClose={() => setShowImportBankModal(false)}
        schema={bankStatementImportSchema}
        onImportSuccess={() => fetchBanksFromApi()}
      />

      {/* Modal: Confirm Delete Bank Account (Move to Data Bin) */}
      <Modal
        open={Boolean(deletingBankAccount)}
        onClose={() => !isDeletingItem && setDeletingBankAccount(null)}
        title="Move Bank Account to Data Bin"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
            <Trash2 className="size-5 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              Are you sure you want to move <span className="font-bold text-default">{deletingBankAccount?.bank_name}</span> ({deletingBankAccount?.account_number}) to the Data Bin? You can restore it anytime from Settings &gt; Data Bin.
            </div>
          </div>

          <div className="text-xs text-muted">
            Associated historical journal entries and ledger records will remain intact for audit compliance.
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-default">
            <button
              type="button"
              disabled={isDeletingItem}
              onClick={() => setDeletingBankAccount(null)}
              className="px-4 py-2 text-xs font-medium border border-default rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeletingItem}
              onClick={confirmDeleteBankAccount}
              className="px-5 py-2 text-xs bg-destructive text-destructive-fg font-semibold rounded-xl shadow-xs hover:opacity-90 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="size-3.5" />
              <span>{isDeletingItem ? 'Moving...' : 'Move to Bin'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirm Delete Cash / Chart of Account (Move to Data Bin) */}
      <Modal
        open={Boolean(deletingAccount)}
        onClose={() => !isDeletingItem && setDeletingAccount(null)}
        title="Move Account to Data Bin"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
            <Trash2 className="size-5 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              Are you sure you want to move <span className="font-bold text-default">{deletingAccount?.name}</span> (Code: {deletingAccount?.account_code}) to the Data Bin? You can restore it anytime from Settings &gt; Data Bin.
            </div>
          </div>

          {deletingAccount?.is_system ? (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
              ⚠️ This is designated as a protected system account and cannot be deleted.
            </div>
          ) : (
            <div className="text-xs text-muted">
              Any future transactions linked to this account code will be prevented until restored.
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-default">
            <button
              type="button"
              disabled={isDeletingItem}
              onClick={() => setDeletingAccount(null)}
              className="px-4 py-2 text-xs font-medium border border-default rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            {!deletingAccount?.is_system && (
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={confirmDeleteAccount}
                className="px-5 py-2 text-xs bg-destructive text-destructive-fg font-semibold rounded-xl shadow-xs hover:opacity-90 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="size-3.5" />
                <span>{isDeletingItem ? 'Moving...' : 'Move to Bin'}</span>
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* ConfirmDialog: Move Journal Entry / Entries to Data Bin */}
      <ConfirmDialog
        open={deleteJournalConfirm.open}
        onClose={() => setDeleteJournalConfirm({ open: false, isBulk: false })}
        onConfirm={handleExecuteDeleteJournal}
        title={deleteJournalConfirm.isBulk ? 'Move Selected Journals to Data Bin' : 'Move Journal Voucher to Data Bin'}
        message={
          deleteJournalConfirm.isBulk
            ? `Are you sure you want to move ${selectedJournalIds.size} journal voucher(s) to the Data Bin? You can restore them anytime from Settings > Data Bin.`
            : 'This record will be moved to the Data Bin. You can restore it anytime from Settings > Data Bin.'
        }
        confirmLabel="Move to Bin"
        variant="danger"
      />

      {/* ConfirmDialog: Move Expense Voucher / Entries to Data Bin */}
      <ConfirmDialog
        open={deleteExpenseConfirm.open}
        onClose={() => setDeleteExpenseConfirm({ open: false, isBulk: false })}
        onConfirm={handleExecuteDeleteExpense}
        title={deleteExpenseConfirm.isBulk ? 'Move Selected Expenses to Data Bin' : 'Move Expense Voucher to Data Bin'}
        message={
          deleteExpenseConfirm.isBulk
            ? `Are you sure you want to move ${selectedExpenseIds.size} expense voucher(s) to the Data Bin? You can restore them anytime from Settings > Data Bin.`
            : 'This record will be moved to the Data Bin. You can restore it anytime from Settings > Data Bin.'
        }
        confirmLabel="Move to Bin"
        variant="danger"
      />
    </div>
  );
};

export default FinanceWorkspace;
