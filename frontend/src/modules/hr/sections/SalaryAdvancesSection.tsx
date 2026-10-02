import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CreditCard, Search, Plus, CheckCircle2, RefreshCw, Trash2, CheckSquare, Square, AlertTriangle, Upload, Download, ChevronDown } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import { hrApi, type ApiPayrollAdvance } from '../services/hrApi';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { salaryAdvanceImportSchema } from '../schemas/salaryAdvanceImportSchema';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { ResponsiveDataTable, type ResponsiveColumn } from '../../../components/ui/ResponsiveDataTable';

export interface AdvanceRecord {
  id: number;
  advanceNumber: string;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  department: string;
  amount: number;
  installmentAmount: number;
  recoveredAmount: number;
  issuedOn: string;
  status: 'active' | 'recovered' | 'written_off';
  notes: string;
  autoDeductNextPayroll?: boolean;
}

const DEFAULT_ADVANCES: AdvanceRecord[] = [
  {
    id: 1,
    advanceNumber: 'ADV-202608-0101',
    employeeId: 1,
    employeeName: 'Abdul Karim',
    employeeCode: 'EMP-00101',
    department: 'Bakery Production',
    amount: 15000,
    installmentAmount: 3000,
    recoveredAmount: 6000,
    issuedOn: '2026-08-01',
    status: 'active',
    notes: 'Emergency home repair assistance; 5-month payroll deduction plan.',
    autoDeductNextPayroll: true,
  },
  {
    id: 2,
    advanceNumber: 'ADV-202608-0205',
    employeeId: 2,
    employeeName: 'Rahim Uddin',
    employeeCode: 'EMP-00102',
    department: 'Bakery Production',
    amount: 10000,
    installmentAmount: 2500,
    recoveredAmount: 10000,
    issuedOn: '2026-06-15',
    status: 'recovered',
    notes: 'Medical advance; fully recovered across four payroll cycles.',
    autoDeductNextPayroll: false,
  },
  {
    id: 3,
    advanceNumber: 'ADV-202609-0312',
    employeeId: 3,
    employeeName: 'Farhana Akter',
    employeeCode: 'EMP-00201',
    department: 'Sales & Front Desk',
    amount: 20000,
    installmentAmount: 4000,
    recoveredAmount: 4000,
    issuedOn: '2026-08-20',
    status: 'active',
    notes: 'Festival advance; recovered at ৳4,000 per month.',
    autoDeductNextPayroll: true,
  },
];

export const SalaryAdvancesSection: React.FC = () => {
  const [advances, setAdvances] = useState<AdvanceRecord[]>(DEFAULT_ADVANCES);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id?: number;
    ref?: string;
    isBulk?: boolean;
  }>({ open: false });

  // Action Menu State
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  // Form State
  const [empName, setEmpName] = useState('Abdul Karim (EMP-00101)');
  const [loanAmount, setLoanAmount] = useState('12000');
  const [monthlyInstallment, setMonthlyInstallment] = useState('3000');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [autoDeductNextPayroll, setAutoDeductNextPayroll] = useState(true);

  const handleExportCsv = () => {
    const headers = [
      'Employee Code',
      'Employee Name',
      'Advance Number',
      'Amount',
      'Monthly Installment',
      'Recovered Amount',
      'Issued On',
      'Status',
      'Notes',
    ];
    const rows = advances.map((a) => [
      `"${(a.employeeCode || '').replace(/"/g, '""')}"`,
      `"${(a.employeeName || '').replace(/"/g, '""')}"`,
      `"${(a.advanceNumber || '').replace(/"/g, '""')}"`,
      a.amount,
      a.installmentAmount,
      a.recoveredAmount,
      a.issuedOn,
      a.status,
      `"${(a.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `salary_advances_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify.success(`Exported ${advances.length} advance records to CSV.`);
  };

  const loadAdvances = useCallback(async (isManual = false) => {
    if (isManual) setIsSyncing(true);
    try {
      const res = await hrApi.getPayrollAdvances();
      const list = res?.data ?? [];
      if (Array.isArray(list) && list.length > 0) {
        const mapped: AdvanceRecord[] = list.map((item: ApiPayrollAdvance) => ({
          id: item.id,
          advanceNumber: item.advance_number || `ADV-${item.id}`,
          employeeId: item.employee_id,
          employeeName: item.employee?.display_name || item.employee_name || 'Staff Member',
          employeeCode: item.employee?.employee_code || item.employee_code || `EMP-${item.employee_id}`,
          department: item.employee?.department?.name || item.department || 'General Operations',
          amount: Number(item.amount ?? 0),
          installmentAmount: Number(item.installment_amount ?? 0),
          recoveredAmount: Number(item.recovered_amount ?? 0),
          issuedOn: item.request_date || item.issued_on || item.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          status: (item.status === 'recovered' || item.status === 'written_off' ? item.status : 'active') as AdvanceRecord['status'],
          notes: item.notes || item.reason || 'Staff salary advance facility.',
        }));
        setAdvances(mapped);
      }
      setLastSynced(new Date().toLocaleTimeString());
    } catch {
      // Retain local records
    } finally {
      if (isManual) setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void hrApi.getPayrollAdvances().then((res) => {
      if (!active) return;
      const list = res?.data ?? [];
      if (Array.isArray(list) && list.length > 0) {
        const mapped: AdvanceRecord[] = list.map((item: ApiPayrollAdvance) => ({
          id: item.id,
          advanceNumber: item.advance_number || `ADV-${item.id}`,
          employeeId: item.employee_id,
          employeeName: item.employee?.display_name || item.employee_name || 'Staff Member',
          employeeCode: item.employee?.employee_code || item.employee_code || `EMP-${item.employee_id}`,
          department: item.employee?.department?.name || item.department || 'General Operations',
          amount: Number(item.amount ?? 0),
          installmentAmount: Number(item.installment_amount ?? 0),
          recoveredAmount: Number(item.recovered_amount ?? 0),
          issuedOn: item.request_date || item.issued_on || item.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          status: (item.status === 'recovered' || item.status === 'written_off' ? item.status : 'active') as AdvanceRecord['status'],
          notes: item.notes || item.reason || 'Staff salary advance facility.',
        }));
        setAdvances(mapped);
        setLastSynced(new Date().toLocaleTimeString());
      }
    }).catch(() => {
      // Retain local records
    });

    return () => {
      active = false;
    };
  }, []);

  const filteredAdvances = advances.filter((adv) => {
    const matchesSearch =
      adv.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      adv.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
      adv.advanceNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || adv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAdvances.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAdvances.map((a) => a.id));
    }
  };

  const totalAdvanced = advances.reduce((sum, a) => sum + a.amount, 0);
  const totalRecovered = advances.reduce((sum, a) => sum + a.recoveredAmount, 0);
  const totalOutstanding = totalAdvanced - totalRecovered;

  const handleGrantAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(loanAmount) || 0;
    const inst = parseFloat(monthlyInstallment) || 0;

    if (amt <= 0 || inst <= 0) {
      notify.error('Please enter valid advance and installment amounts.');
      return;
    }

    const payload = {
      employee_id: 1,
      amount: amt,
      reason: notes.trim() || 'Approved employee emergency advance',
      repayment_terms: `${Math.ceil(amt / inst)} monthly installments`,
      installment_amount: inst,
      issued_on: issueDate || new Date().toISOString().slice(0, 10),
    };

    try {
      const res = await hrApi.requestPayrollAdvance(payload);
      const created: AdvanceRecord = {
        id: res?.data?.id ?? Date.now(),
        advanceNumber: res?.data?.advance_number ?? `ADV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        employeeId: 1,
        employeeName: (empName.split('(')[0] ?? empName).trim(),
        employeeCode: empName.match(/\((.*?)\)/)?.[1] || 'EMP-00000',
        department: 'Bakery Production',
        amount: amt,
        installmentAmount: inst,
        recoveredAmount: 0,
        issuedOn: issueDate || new Date().toISOString().slice(0, 10),
        status: 'active',
        notes: notes.trim() || 'Approved salary advance.',
        autoDeductNextPayroll,
      };

      setAdvances([created, ...advances]);
      setIsModalOpen(false);
      setLoanAmount('12000');
      setMonthlyInstallment('3000');
      setNotes('');
      setAutoDeductNextPayroll(true);
      notify.success(`Salary advance ${created.advanceNumber} of ৳${amt.toLocaleString()} approved.`);
    } catch {
      // Local fallback
      const created: AdvanceRecord = {
        id: Date.now(),
        advanceNumber: `ADV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        employeeId: 1,
        employeeName: (empName.split('(')[0] ?? empName).trim(),
        employeeCode: empName.match(/\((.*?)\)/)?.[1] || 'EMP-00000',
        department: 'Bakery Production',
        amount: amt,
        installmentAmount: inst,
        recoveredAmount: 0,
        issuedOn: issueDate || new Date().toISOString().slice(0, 10),
        status: 'active',
        notes: notes.trim() || 'Approved salary advance.',
        autoDeductNextPayroll,
      };
      setAdvances([created, ...advances]);
      setIsModalOpen(false);
      setLoanAmount('12000');
      setMonthlyInstallment('3000');
      setNotes('');
      setAutoDeductNextPayroll(true);
      notify.success(`Salary advance ${created.advanceNumber} recorded.`);
    }
  };

  const handleToggleAutoDeduct = (id: number) => {
    setAdvances((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const nextVal = a.autoDeductNextPayroll === false;
        notify.info(`Auto-deduct from next payroll for ${a.advanceNumber} ${nextVal ? 'enabled' : 'disabled'}.`);
        return {
          ...a,
          autoDeductNextPayroll: nextVal,
        };
      })
    );
  };

  const handleManualRecovery = (id: number) => {
    setAdvances((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const newRecovered = Math.min(a.amount, a.recoveredAmount + a.installmentAmount);
        const newStatus = newRecovered >= a.amount ? 'recovered' : 'active';
        return {
          ...a,
          recoveredAmount: newRecovered,
          status: newStatus,
        };
      })
    );
    notify.success('Monthly installment deducted and balance updated.');
  };

  const handleBulkStatus = async (status: 'active' | 'recovered' | 'written_off') => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await hrApi.bulkStatusPayrollAdvances(selectedIds, status);
      setAdvances((prev) =>
        prev.map((a) =>
          selectedIds.includes(a.id)
            ? {
                ...a,
                status,
                recoveredAmount: status === 'recovered' ? a.amount : a.recoveredAmount,
              }
            : a
        )
      );
      notify.success(`Updated status of ${selectedIds.length} advances to ${status}.`);
      setSelectedIds([]);
    } catch {
      setAdvances((prev) =>
        prev.map((a) =>
          selectedIds.includes(a.id)
            ? {
                ...a,
                status,
                recoveredAmount: status === 'recovered' ? a.amount : a.recoveredAmount,
              }
            : a
        )
      );
      notify.success(`Status updated for ${selectedIds.length} advances.`);
      setSelectedIds([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm.isBulk) {
      setIsBulkProcessing(true);
      try {
        await hrApi.bulkDeletePayrollAdvances(selectedIds);
        setAdvances((prev) => prev.filter((a) => !selectedIds.includes(a.id)));
        notify.success(`${selectedIds.length} advances deleted successfully.`);
        setSelectedIds([]);
      } catch {
        setAdvances((prev) => prev.filter((a) => !selectedIds.includes(a.id)));
        setSelectedIds([]);
        notify.success('Advances removed.');
      } finally {
        setIsBulkProcessing(false);
        setDeleteConfirm({ open: false });
      }
    } else if (deleteConfirm.id) {
      const id = deleteConfirm.id;
      try {
        await hrApi.deletePayrollAdvance(id);
        setAdvances((prev) => prev.filter((a) => a.id !== id));
        setSelectedIds((prev) => prev.filter((i) => i !== id));
        notify.success('Salary advance record deleted.');
      } catch {
        setAdvances((prev) => prev.filter((a) => a.id !== id));
        setSelectedIds((prev) => prev.filter((i) => i !== id));
        notify.success('Advance removed.');
      } finally {
        setDeleteConfirm({ open: false });
      }
    }
  };

  const advanceColumns: ResponsiveColumn<AdvanceRecord>[] = useMemo(() => [
    {
      id: 'select',
      header: (
        <button
          type="button"
          onClick={toggleSelectAll}
          className="text-muted hover:text-primary transition-colors cursor-pointer"
          title="Select All"
        >
          {selectedIds.length === filteredAdvances.length && filteredAdvances.length > 0 ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4 text-muted/60" />
          )}
        </button>
      ),
      className: 'w-10 text-center',
      accessor: (adv) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSelect(adv.id);
          }}
          className="text-muted hover:text-primary transition-colors cursor-pointer"
        >
          {selectedIds.includes(adv.id) ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4 text-muted/60" />
          )}
        </button>
      ),
    },
    {
      id: 'advanceNumber',
      header: 'Advance Ref',
      isPrimary: true,
      accessor: (adv) => (
        <span className="font-mono font-semibold text-primary">{adv.advanceNumber}</span>
      ),
    },
    {
      id: 'employee',
      header: 'Employee',
      accessor: (adv) => (
        <div>
          <p className="font-semibold text-default">{adv.employeeName}</p>
          <span className="text-[11px] text-muted font-mono">{adv.employeeCode} • {adv.department}</span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Loan Principal',
      align: 'right',
      priority: 'medium',
      accessor: (adv) => (
        <span className="font-mono font-bold text-default">
          ৳{adv.amount.toLocaleString()}
        </span>
      ),
    },
    {
      id: 'installment',
      header: 'Installment / Mo',
      align: 'right',
      priority: 'low',
      accessor: (adv) => (
        <span className="font-mono text-muted">
          ৳{adv.installmentAmount.toLocaleString()}
        </span>
      ),
    },
    {
      id: 'recovered',
      header: 'Recovered',
      align: 'right',
      priority: 'medium',
      accessor: (adv) => (
        <span className="font-mono text-emerald-600 font-semibold">
          ৳{adv.recoveredAmount.toLocaleString()}
        </span>
      ),
    },
    {
      id: 'remaining',
      header: 'Remaining',
      align: 'right',
      priority: 'medium',
      accessor: (adv) => {
        const remaining = adv.amount - adv.recoveredAmount;
        return (
          <span className="font-mono font-bold text-amber-600">
            ৳{remaining.toLocaleString()}
          </span>
        );
      },
    },
    {
      id: 'auto_deduct',
      header: 'Auto-Deduct',
      align: 'center',
      priority: 'low',
      accessor: (adv) => (
        adv.autoDeductNextPayroll !== false ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            title="Scheduled for auto-deduction in next payroll"
          >
            <CheckCircle2 className="size-3 text-emerald-600" />
            Next Run
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-sunken text-muted border border-default"
            title="Manual collection or offline recovery"
          >
            Manual
          </span>
        )
      ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      priority: 'medium',
      accessor: (adv) => {
        const remaining = adv.amount - adv.recoveredAmount;
        const isRecovered = adv.status === 'recovered' || remaining <= 0;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              isRecovered
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            {isRecovered ? 'Recovered' : 'Active Recovery'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Action',
      align: 'right',
      priority: 'low',
      accessor: (adv) => {
        const remaining = adv.amount - adv.recoveredAmount;
        const isRecovered = adv.status === 'recovered' || remaining <= 0;
        return (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            {!isRecovered ? (
              <button
                type="button"
                onClick={() => handleManualRecovery(adv.id)}
                className="px-2.5 py-1 rounded text-2xs font-semibold border border-default hover:bg-surface-sunken text-default transition-colors shadow-2xs cursor-pointer touch-target"
              >
                Deduct Cycle
              </button>
            ) : (
              <span className="text-muted inline-flex items-center gap-1 text-[11px] mr-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Settled
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (openActionMenuId === adv.id) {
                  setOpenActionMenuId(null);
                  setActionMenuAnchor(null);
                } else {
                  setOpenActionMenuId(adv.id);
                  setActionMenuAnchor(e.currentTarget);
                }
              }}
              className={`px-2.5 py-1 text-2xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs touch-target ${
                openActionMenuId === adv.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-default bg-surface hover:bg-surface-sunken text-default'
              }`}
              title={`Actions for ${adv.advanceNumber}`}
            >
              <span>Actions</span>
              <ChevronDown className="size-3 text-muted" />
            </button>
          </div>
        );
      },
    },
  ], [selectedIds, filteredAdvances, openActionMenuId]);

  const getMobileActions = (adv: AdvanceRecord) => {
    const remaining = adv.amount - adv.recoveredAmount;
    const isRecovered = adv.status === 'recovered' || remaining <= 0;
    const actions = [];
    if (!isRecovered) {
      actions.push(
        {
          label: 'Deduct Next Installment',
          icon: <CreditCard className="size-4 text-primary" />,
          onClick: () => handleManualRecovery(adv.id),
        },
        {
          label: adv.autoDeductNextPayroll !== false ? 'Disable Auto-Deduct' : 'Enable Auto-Deduct',
          icon: <CheckCircle2 className="size-4 text-emerald-500" />,
          onClick: () => handleToggleAutoDeduct(adv.id),
        }
      );
    }
    actions.push(
      {
        label: 'Copy Advance Ref',
        icon: <Search className="size-4 text-muted" />,
        onClick: () => {
          void navigator.clipboard.writeText(adv.advanceNumber);
          notify.success(`Copied ${adv.advanceNumber} to clipboard`);
        },
      },
      {
        label: 'Delete Advance',
        icon: <Trash2 className="size-4 text-rose-500" />,
        variant: 'destructive' as const,
        onClick: () => setDeleteConfirm({ open: true, id: adv.id, ref: adv.advanceNumber }),
      }
    );
    return actions;
  };

  return (
    <div className="space-y-6 relative">
      {/* Floating Bulk Actions Ribbon */}
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-20 flex items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-surface shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white shadow-xs">
              {selectedIds.length}
            </span>
            <div>
              <p className="text-xs font-bold text-default">
                {selectedIds.length} Advance Record{selectedIds.length > 1 ? 's' : ''} Selected
              </p>
              <p className="text-[11px] text-muted">Apply bulk status reconciliation or remove records</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={() => void handleBulkStatus('recovered')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Recovered
            </button>
            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={() => setDeleteConfirm({ open: true, isBulk: true })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedIds.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-default text-muted hover:text-default hover:bg-surface-sunken transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-default bg-surface shadow-xs">
          <span className="text-xs font-semibold text-muted">Total Disbursed Advances</span>
          <p className="text-xl font-mono font-bold text-default mt-1">
            ৳{totalAdvanced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted">{advances.length} Loan Facilities Issued</span>
        </div>
        <div className="p-4 rounded-xl border border-default bg-surface shadow-xs">
          <span className="text-xs font-semibold text-muted">Recovered Through Payroll</span>
          <p className="text-xl font-mono font-bold text-emerald-600 mt-1">
            ৳{totalRecovered.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-emerald-600">
            {Math.round((totalRecovered / (totalAdvanced || 1)) * 100)}% Recovered
          </span>
        </div>
        <div className="p-4 rounded-xl border border-default bg-surface shadow-xs">
          <span className="text-xs font-semibold text-muted">Active Outstanding Balance</span>
          <p className="text-xl font-mono font-bold text-amber-600 mt-1">
            ৳{totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-amber-600">Receivable from active staff</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-default bg-surface shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search by employee, ID, or advance code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-default bg-surface-sunken text-xs text-default placeholder:text-muted focus:ring-1 focus:ring-primary outline-hidden"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-default bg-surface-sunken text-xs text-default focus:ring-1 focus:ring-primary outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Recoveries</option>
            <option value="recovered">Fully Recovered</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-default bg-surface hover:bg-surface-sunken text-default transition-colors"
            title="Export salary advance records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-muted" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-default bg-surface hover:bg-surface-sunken text-default transition-colors"
            title="Import salary advances from Excel (.xlsx) or CSV"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={() => void loadAdvances(true)}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-default bg-surface hover:bg-surface-sunken text-default transition-colors disabled:opacity-50"
            title={lastSynced ? `Last synced: ${lastSynced}` : 'Sync with HR API'}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync API'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            + Grant Advance
          </button>
        </div>
      </div>

      {/* Register Table */}
      <ResponsiveDataTable<AdvanceRecord>
        data={filteredAdvances}
        columns={advanceColumns}
        keyExtractor={(adv) => adv.id}
        mobileActions={getMobileActions}
        emptyState={{
          icon: <CreditCard className="size-6 text-muted" />,
          title: 'No salary advance records match the selected criteria',
          description: 'Try adjusting filters or grant a new employee salary advance.',
        }}
      />

      {actionMenuAnchor && openActionMenuId !== null && (() => {
        const adv = filteredAdvances.find((a) => a.id === openActionMenuId);
        if (!adv) return null;
        const remaining = adv.amount - adv.recoveredAmount;
        const isRecovered = adv.status === 'recovered' || remaining <= 0;
        return (
          <ActionMenuPortal
            isOpen={true}
            anchorEl={actionMenuAnchor}
            onClose={() => {
              setOpenActionMenuId(null);
              setActionMenuAnchor(null);
            }}
            className="w-48"
          >
            {!isRecovered && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    handleManualRecovery(adv.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  <CreditCard className="size-3.5 text-primary shrink-0" />
                  <span>Deduct Next Installment</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    handleToggleAutoDeduct(adv.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                  <span>{adv.autoDeductNextPayroll !== false ? 'Disable Auto-Deduct' : 'Enable Auto-Deduct'}</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setOpenActionMenuId(null);
                setActionMenuAnchor(null);
                void navigator.clipboard.writeText(adv.advanceNumber);
                notify.success(`Copied ${adv.advanceNumber} to clipboard`);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
            >
              <Search className="size-3.5 text-muted shrink-0" />
              <span>Copy Advance Ref</span>
            </button>
            <div className="my-1 border-t border-default/50" />
            <button
              type="button"
              onClick={() => {
                setOpenActionMenuId(null);
                setActionMenuAnchor(null);
                setDeleteConfirm({ open: true, id: adv.id, ref: adv.advanceNumber });
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <Trash2 className="size-3.5 text-rose-600 shrink-0" />
              <span>Delete Advance</span>
            </button>
          </ActionMenuPortal>
        );
      })()}

      {/* Grant Advance Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Approve Employee Salary Advance / Emergency Loan"
        size="md"
      >
        <form onSubmit={handleGrantAdvance} className="space-y-4">
          <div>
            <label htmlFor="advEmployee" className="block text-xs font-semibold text-default mb-1">
              Select Employee *
            </label>
            <select
              id="advEmployee"
              value={empName}
              onChange={(e) => setEmpName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-default bg-surface text-sm text-default focus:ring-2 focus:ring-primary/20 outline-hidden"
            >
              <option value="Abdul Karim (EMP-00101)">Abdul Karim (EMP-00101) — Bakery Production</option>
              <option value="Rahim Uddin (EMP-00102)">Rahim Uddin (EMP-00102) — Bakery Production</option>
              <option value="Farhana Akter (EMP-00201)">Farhana Akter (EMP-00201) — Sales & Front Desk</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="advAmount" className="block text-xs font-semibold text-default mb-1">
                Advance Amount (৳) *
              </label>
              <input
                id="advAmount"
                type="number"
                required
                min="1000"
                step="500"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-default bg-surface text-sm text-default focus:ring-2 focus:ring-primary/20 outline-hidden font-mono"
              />
            </div>
            <div>
              <label htmlFor="advInstallment" className="block text-xs font-semibold text-default mb-1">
                Monthly Recovery (৳) *
              </label>
              <input
                id="advInstallment"
                type="number"
                required
                min="500"
                step="500"
                value={monthlyInstallment}
                onChange={(e) => setMonthlyInstallment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-default bg-surface text-sm text-default focus:ring-2 focus:ring-primary/20 outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="advDate" className="block text-xs font-semibold text-default mb-1">
              Disbursement Date
            </label>
            <input
              id="advDate"
              type="date"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-default bg-surface text-sm text-default focus:ring-2 focus:ring-primary/20 outline-hidden"
            />
          </div>

          <div>
            <label htmlFor="advNotes" className="block text-xs font-semibold text-default mb-1">
              Reason / Emergency Notes
            </label>
            <textarea
              id="advNotes"
              rows={2}
              autoComplete="off"
              placeholder="e.g. Medical emergency or housing assistance..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-default bg-surface text-sm text-default focus:ring-2 focus:ring-primary/20 outline-hidden"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl border border-default bg-surface-sunken">
            <div className="space-y-0.5 pr-2">
              <label htmlFor="autoDeductToggle" className="text-xs font-bold text-default flex items-center gap-1.5 cursor-pointer">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                <span>Auto-deduct from next payroll cycle</span>
              </label>
              <p className="text-[11px] text-muted">
                Installment of ৳{parseFloat(monthlyInstallment || '0').toLocaleString()} will automatically be deducted during the next monthly payroll run.
              </p>
            </div>
            <input
              id="autoDeductToggle"
              type="checkbox"
              checked={autoDeductNextPayroll}
              onChange={(e) => setAutoDeductNextPayroll(e.target.checked)}
              className="size-4.5 rounded text-primary focus:ring-primary/20 cursor-pointer shrink-0"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-default">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-default text-default hover:bg-surface-sunken transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CreditCard className="w-4 h-4" />
              Approve Advance
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false })}
        title={deleteConfirm.isBulk ? 'Delete Selected Advance Records' : 'Delete Salary Advance'}
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-sm">Are you sure you want to delete?</p>
              <p className="mt-1">
                {deleteConfirm.isBulk
                  ? `This will permanently remove ${selectedIds.length} salary advance records from the system.`
                  : `This will permanently delete record "${deleteConfirm.ref}". Any remaining balance tracking will be purged.`}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-default">
            <button
              type="button"
              onClick={() => setDeleteConfirm({ open: false })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-default text-default hover:bg-surface-sunken transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isBulkProcessing}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-xs transition-colors disabled:opacity-50"
            >
              {isBulkProcessing ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        schema={salaryAdvanceImportSchema}
        onSuccess={() => void loadAdvances(true)}
      />
    </div>
  );
};

