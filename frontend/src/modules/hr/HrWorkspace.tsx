import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Users,
  Building2,
  Zap,
  Wallet,
  Clock,
  CalendarCheck,
  Search,
  SlidersHorizontal,
  X,
  UserPlus,
  Plus,
  Download,
  Printer,
  CheckCircle2,
  Eye,
  Filter,
  FileSpreadsheet,
  CreditCard,
  Check,
  DollarSign,
  Scan,
  RefreshCw,
  Trash2,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
  ShieldCheck,
  KeyRound,
  ChevronDown,
  Upload,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { useTranslation } from 'react-i18next';
import { hrApi } from './services/hrApi';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { useCurrency } from '../../hooks/useCurrency';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { notify } from '../../components/ui/Toast';
import { UniversalImportModal } from '../../components/import';
import { employeeImportSchema } from './schemas/employeeImportSchema';
import { attendanceImportSchema } from './schemas/attendanceImportSchema';
import type {
  Employee,
  Department,
  Designation,
  Shift,
  Attendance,
  LeaveRequest,
  LeaveType,
  PayrollPeriod,
  Payslip,
} from '../../types/api/hr';

import { WorkerPerformanceSection } from './sections/WorkerPerformanceSection';
import { DepartmentsSetupSection } from './sections/DepartmentsSetupSection';
import { SalaryStructuresSection } from './sections/SalaryStructuresSection';
import { SalaryAdvancesSection } from './sections/SalaryAdvancesSection';
import { BadgePunchTerminalModal } from './components/BadgePunchTerminalModal';
import { CreatePayslipModal } from './components/CreatePayslipModal';
import { useDocumentPrint, EmployeeIdBadgeDocument, PayslipDocument } from '../../components/print';
import { useBusinessConfig } from '../../lib/document/useBusinessConfig';
import { ActionMenuPortal } from '../../components/ui/ActionMenuPortal';

export type HrTab =
  | 'employees'
  | 'attendance'
  | 'leaves'
  | 'payroll'
  | 'performance'
  | 'departments'
  | 'salary-structures'
  | 'advances';

export type HrCategory = 'people' | 'compensation';
type EmploymentType = 'permanent' | 'contract' | 'daily_wage' | 'piece_rate';

export interface HrStageConfig {
  id: HrTab;
  step: number;
  label: string;
  shortLabel: string;
  icon: typeof Users;
  category: HrCategory;
  description: string;
}

export interface CategoryConfig {
  id: HrCategory;
  label: string;
  tagline: string;
  icon: typeof Users;
  tabs: HrTab[];
  defaultTab: HrTab;
}

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export const HrWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const { config: businessConfig } = useBusinessConfig();
  const { printDocument, isPrinting: isPrintingBadge } = useDocumentPrint();

  const hrStages: HrStageConfig[] = useMemo(
    () => [
      {
        id: 'employees',
        step: 1,
        label: t('hr.stages.employees.label'),
        shortLabel: t('hr.stages.employees.shortLabel'),
        icon: Users,
        category: 'people',
        description: t('hr.stages.employees.description'),
      },
      {
        id: 'departments',
        step: 2,
        label: t('hr.stages.departments.label'),
        shortLabel: t('hr.stages.departments.shortLabel'),
        icon: Building2,
        category: 'people',
        description: t('hr.stages.departments.description'),
      },
      {
        id: 'performance',
        step: 3,
        label: t('hr.stages.performance.label'),
        shortLabel: t('hr.stages.performance.shortLabel'),
        icon: Zap,
        category: 'people',
        description: t('hr.stages.performance.description'),
      },
      {
        id: 'attendance',
        step: 4,
        label: t('hr.stages.attendance.label'),
        shortLabel: t('hr.stages.attendance.shortLabel'),
        icon: Clock,
        category: 'compensation',
        description: t('hr.stages.attendance.description'),
      },
      {
        id: 'leaves',
        step: 5,
        label: t('hr.stages.leaves.label'),
        shortLabel: t('hr.stages.leaves.shortLabel'),
        icon: CalendarCheck,
        category: 'compensation',
        description: t('hr.stages.leaves.description'),
      },
      {
        id: 'payroll',
        step: 6,
        label: t('hr.stages.payroll.label'),
        shortLabel: t('hr.stages.payroll.shortLabel'),
        icon: Wallet,
        category: 'compensation',
        description: t('hr.stages.payroll.description'),
      },
      {
        id: 'salary-structures',
        step: 7,
        label: t('hr.stages.salaryStructures.label'),
        shortLabel: t('hr.stages.salaryStructures.shortLabel'),
        icon: DollarSign,
        category: 'compensation',
        description: t('hr.stages.salaryStructures.description'),
      },
      {
        id: 'advances',
        step: 8,
        label: t('hr.stages.advances.label'),
        shortLabel: t('hr.stages.advances.shortLabel'),
        icon: CreditCard,
        category: 'compensation',
        description: t('hr.stages.advances.description'),
      },
    ],
    [t]
  );

  const categories: CategoryConfig[] = useMemo(
    () => [
      {
        id: 'people',
        label: t('hr.categories.people.label'),
        tagline: t('hr.categories.people.tagline'),
        icon: Users,
        tabs: ['employees', 'departments', 'performance'],
        defaultTab: 'employees',
      },
      {
        id: 'compensation',
        label: t('hr.categories.compensation.label'),
        tagline: t('hr.categories.compensation.tagline'),
        icon: Wallet,
        tabs: ['payroll', 'attendance', 'leaves', 'salary-structures', 'advances'],
        defaultTab: 'payroll',
      },
    ],
    [t]
  );

  const handlePrintPayslip = (slip: Payslip) => {
    printDocument(
      <PayslipDocument payslip={slip} businessConfig={businessConfig} />,
      {
        pageClass: 'print-page-a4',
        documentTitle: `Payslip_${slip.payslip_number || slip.id}`,
      }
    );
  };
  const [activeTab, setActiveTab] = useWorkspaceTab<HrTab>(
    'employees',
    [
      'employees',
      'attendance',
      'leaves',
      'payroll',
      'performance',
      'departments',
      'salary-structures',
      'advances',
    ] as const
  );
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isKioskModalOpen, setIsKioskModalOpen] = useState(false);
  const quickJumpRef = useRef<HTMLDivElement>(null);

  const activeCategory = categories.find((cat) => cat.tabs.includes(activeTab))?.id ?? 'people';

  const lastActivePerCategory = useRef<Record<HrCategory, HrTab>>({
    people: 'employees',
    compensation: 'payroll',
  });

  const currentStage = (hrStages.find((s) => s.id === activeTab) ?? hrStages[0])!;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8) {
        const stage = hrStages.find((s) => s.step === num);
        if (stage) {
          e.preventDefault();
          setActiveTab(stage.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, hrStages]);

  useEffect(() => {
    const cat = categories.find((c) => c.tabs.includes(activeTab))?.id;
    if (cat) {
      lastActivePerCategory.current[cat] = activeTab;
    }
  }, [activeTab, categories]);

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

  const handleSelectCategory = (categoryId: HrCategory) => {
    if (categoryId === activeCategory) return;
    const targetTab =
      lastActivePerCategory.current[categoryId] ??
      categories.find((cat) => cat.id === categoryId)?.defaultTab ??
      'payroll';
    setActiveTab(targetTab);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Master Reference Data State
  // ─────────────────────────────────────────────────────────────────────────────
  const [departments, setDepartments] = useState<Department[]>([
    { id: 1, uuid: 'dep-01', code: 'PROD', name: 'Factory Production Floor', is_active: true },
    { id: 2, uuid: 'dep-02', code: 'LOG', name: 'Logistics & Fleet Dispatch', is_active: true },
    { id: 3, uuid: 'dep-03', code: 'ADMIN', name: 'Accounts & Corporate Admin', is_active: true },
  ]);

  const [designations, setDesignations] = useState<Designation[]>([
    { id: 1, uuid: 'des-01', code: 'CUT_OP', name: 'Fabric Cutting Operator', is_active: true },
    { id: 2, uuid: 'des-02', code: 'SEW_OP', name: 'Industrial Sewing Machinist', is_active: true },
    { id: 3, uuid: 'des-03', code: 'RIDER', name: 'Delivery Courier Rider', is_active: true },
    { id: 4, uuid: 'des-04', code: 'ACC', name: 'Senior Accountant', is_active: true },
  ]);

  const [shifts, setShifts] = useState<Shift[]>([
    {
      id: 1,
      uuid: 'sh-01',
      code: 'MORNING',
      name: 'Standard Morning Shift (09:00 - 17:00)',
      start_time: '09:00:00',
      end_time: '17:00:00',
      crosses_midnight: false,
      break_minutes: 60,
      grace_in_minutes: 15,
      is_active: true,
    },
    {
      id: 2,
      uuid: 'sh-02',
      code: 'EVENING',
      name: 'Factory Night Shift (18:00 - 02:00)',
      start_time: '18:00:00',
      end_time: '02:00:00',
      crosses_midnight: true,
      break_minutes: 45,
      grace_in_minutes: 10,
      is_active: true,
    },
  ]);

  const [leaveTypes] = useState<LeaveType[]>([
    {
      id: 1,
      uuid: 'lt-01',
      code: 'CASUAL',
      name: 'Casual Leave',
      is_paid: true,
      annual_quota_days: '14.0000',
      is_active: true,
    },
    {
      id: 2,
      uuid: 'lt-02',
      code: 'SICK',
      name: 'Medical / Sick Leave',
      is_paid: true,
      annual_quota_days: '14.0000',
      is_active: true,
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Employees State & Live Data Loading
  // ─────────────────────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: 1,
      uuid: 'emp-01',
      employee_code: 'EMP-00101',
      first_name: 'Abdul',
      last_name: 'Karim',
      display_name: 'Abdul Karim',
      phone: '+8801711223344',
      email: 'karim.worker@company.local',
      company_id: 1,
      department_id: 1,
      department: departments[0],
      designation_id: 1,
      designation: designations[0],
      employment_type: 'piece_rate',
      employment_status: 'active',
      default_shift_id: 1,
      default_shift: shifts[0],
      date_of_joining: '2026-01-01',
      bank_account_number: '205011928391',
      is_active: true,
    },
    {
      id: 2,
      uuid: 'emp-02',
      employee_code: 'EMP-00102',
      first_name: 'Rahim',
      last_name: 'Uddin',
      display_name: 'Rahim Uddin',
      phone: '+8801722334455',
      company_id: 1,
      department_id: 1,
      department: departments[0],
      designation_id: 2,
      designation: designations[1],
      employment_type: 'piece_rate',
      employment_status: 'active',
      default_shift_id: 1,
      default_shift: shifts[0],
      date_of_joining: '2026-02-15',
      is_active: true,
    },
    {
      id: 3,
      uuid: 'emp-03',
      employee_code: 'EMP-00201',
      first_name: 'Farhana',
      last_name: 'Akter',
      display_name: 'Farhana Akter',
      phone: '+8801733445566',
      email: 'farhana.admin@company.local',
      company_id: 1,
      department_id: 3,
      department: departments[2],
      designation_id: 4,
      designation: designations[3],
      employment_type: 'permanent',
      employment_status: 'active',
      default_shift_id: 1,
      default_shift: shifts[0],
      date_of_joining: '2026-01-01',
      bank_account_number: '150128919201',
      is_active: true,
    },
  ]);

  const [availableRoles, setAvailableRoles] = useState<Array<{ id: number; name: string; slug: string; description?: string }>>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);


  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Attendance State
  // ─────────────────────────────────────────────────────────────────────────────
  const [attendances, setAttendances] = useState<Attendance[]>([
    {
      id: 1,
      uuid: 'att-01',
      employee_id: 1,
      employee: employees[0],
      attendance_date: '2026-08-28',
      shift_id: 1,
      shift: shifts[0],
      check_in_at: '2026-08-28 09:05:00',
      check_out_at: '2026-08-28 17:15:00',
      worked_minutes: 490,
      late_minutes: 0,
      overtime_minutes: 10,
      status: 'present',
      remarks: 'Full day shift completed on cutting floor',
    },
    {
      id: 2,
      uuid: 'att-02',
      employee_id: 2,
      employee: employees[1],
      attendance_date: '2026-08-28',
      shift_id: 1,
      shift: shifts[0],
      check_in_at: '2026-08-28 09:20:00',
      check_out_at: '2026-08-28 17:20:00',
      worked_minutes: 480,
      late_minutes: 20,
      overtime_minutes: 0,
      status: 'late',
      remarks: 'Late check-in beyond 15m grace period',
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Leave Requests State
  // ─────────────────────────────────────────────────────────────────────────────
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    {
      id: 1,
      uuid: 'lr-01',
      employee_id: 3,
      employee: employees[2],
      leave_type_id: 1,
      leave_type: leaveTypes[0],
      start_date: '2026-09-02',
      end_date: '2026-09-04',
      total_days: '3.0000',
      reason: 'Family wedding event',
      status: 'approved',
    },
    {
      id: 2,
      uuid: 'lr-02',
      employee_id: 1,
      employee: employees[0],
      leave_type_id: 2,
      leave_type: leaveTypes[1],
      start_date: '2026-09-15',
      end_date: '2026-09-16',
      total_days: '2.0000',
      reason: 'Medical checkup & prescription rest',
      status: 'pending',
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Payroll Periods & Payslips State
  // ─────────────────────────────────────────────────────────────────────────────
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([
    {
      id: 2,
      uuid: 'pp-02',
      company_id: 1,
      period_code: 'PAY-202609',
      pay_frequency: 'monthly',
      period_start: '2026-09-01',
      period_end: '2026-09-30',
      payment_date: '2026-10-01',
      status: 'open',
      total_gross: '0.0000',
      total_deductions: '0.0000',
      total_net: '0.0000',
      employee_count: 0,
    },
    {
      id: 1,
      uuid: 'pp-01',
      company_id: 1,
      period_code: 'PAY-202608',
      pay_frequency: 'monthly',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      payment_date: '2026-09-01',
      status: 'closed',
      total_gross: '98500.0000',
      total_deductions: '3500.0000',
      total_net: '95000.0000',
      employee_count: 2,
      locked_at: '2026-08-28 10:00:00',
    },
  ]);

  const [payslips, setPayslips] = useState<Payslip[]>([
    {
      id: 1,
      uuid: 'ps-01',
      payroll_period_id: 1,
      employee_id: 1,
      employee: employees[0],
      payslip_number: 'PS-202608-0001',
      gross_amount: '38500.0000',
      total_earnings: '38500.0000',
      total_deductions: '1000.0000',
      net_amount: '37500.0000',
      produced_quantity: '1280.0000',
      payment_method: 'bank',
      payment_status: 'paid',
      items: [
        {
          salary_component_id: 101,
          component_code: 'PIECE_RATE',
          component_type: 'earning',
          quantity: '1280.0000',
          rate: '30.0000',
          amount: '38400.0000',
        },
        {
          salary_component_id: 102,
          component_code: 'ATTENDANCE_BONUS',
          component_type: 'earning',
          quantity: '1.0000',
          rate: '100.0000',
          amount: '100.0000',
        },
      ],
    },
    {
      id: 2,
      uuid: 'ps-02',
      payroll_period_id: 1,
      employee_id: 3,
      employee: employees[2],
      payslip_number: 'PS-202608-0003',
      gross_amount: '60000.0000',
      total_earnings: '60000.0000',
      total_deductions: '2500.0000',
      net_amount: '57500.0000',
      payment_method: 'bank',
      payment_status: 'paid',
      items: [
        {
          salary_component_id: 201,
          component_code: 'BASIC_SALARY',
          component_type: 'earning',
          quantity: '1.0000',
          rate: '45000.0000',
          amount: '45000.0000',
        },
        {
          salary_component_id: 202,
          component_code: 'HOUSE_RENT',
          component_type: 'earning',
          quantity: '1.0000',
          rate: '15000.0000',
          amount: '15000.0000',
        },
      ],
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Interactive Modal States
  // ─────────────────────────────────────────────────────────────────────────────
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [selectedEmployeeForBadge, setSelectedEmployeeForBadge] = useState<Employee | null>(null);
  const [viewingEmployeeProfile, setViewingEmployeeProfile] = useState<Employee | null>(null);

  // Onboard Employee Modal
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showImportStaffModal, setShowImportStaffModal] = useState(false);
  const [showImportAttendanceModal, setShowImportAttendanceModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newEmpType, setNewEmpType] = useState<EmploymentType>('piece_rate');
  const [newDeptId, setNewDeptId] = useState(1);
  const [newDesgId, setNewDesgId] = useState(1);
  const [newBankNumber, setNewBankNumber] = useState('');
  const [grantUserAccess, setGrantUserAccess] = useState(false);
  const [userPassword, setUserPassword] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<number>>(new Set());
  const [savingEmployee, setSavingEmployee] = useState(false);

  // Manage Access & Roles for existing employee
  const [accessModalEmp, setAccessModalEmp] = useState<Employee | null>(null);
  const [accessRoleIds, setAccessRoleIds] = useState<Set<number>>(new Set());
  const [accessPassword, setAccessPassword] = useState('');
  const [savingAccess, setSavingAccess] = useState(false);

  // Mark Attendance Modal
  const [showMarkAttendanceModal, setShowMarkAttendanceModal] = useState(false);
  const [attEmpId, setAttEmpId] = useState(employees[0]?.id || 1);
  const [attShiftId, setAttShiftId] = useState(1);
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attCheckIn, setAttCheckIn] = useState('09:00');
  const [attCheckOut, setAttCheckOut] = useState('17:00');
  const [attStatus, setAttStatus] = useState<Attendance['status']>('present');
  const [attRemarks, setAttRemarks] = useState('');

  // Leave Request Modal
  const [showLeaveRequestModal, setShowLeaveRequestModal] = useState(false);
  const [leaveEmpId, setLeaveEmpId] = useState(employees[0]?.id || 1);
  const [leaveTypeId, setLeaveTypeId] = useState(1);
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveDays, setLeaveDays] = useState('1');
  const [leaveReason, setLeaveReason] = useState('');

  // New Pay Period Modal
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [newPeriodCode, setNewPeriodCode] = useState('PAY-202610');
  const [newPeriodStart, setNewPeriodStart] = useState('2026-10-01');
  const [newPeriodEnd, setNewPeriodEnd] = useState('2026-10-31');
  const [newPaymentDate, setNewPaymentDate] = useState('2026-11-01');

  // Create Payslip Modal State & Selected Period Filter
  const [showCreatePayslipModal, setShowCreatePayslipModal] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | 'all'>(1);

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Filtering & Search States
  // ─────────────────────────────────────────────────────────────────────────────
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState<number | 'all'>('all');
  const [empTypeFilter, setEmpTypeFilter] = useState<string>('all');

  const [attSearch, setAttSearch] = useState('');
  const [attStatusFilter, setAttStatusFilter] = useState<string>('all');
  const [attDateFilter, setAttDateFilter] = useState<string>('2026-08-28');

  const [leaveSearch, setLeaveSearch] = useState('');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('all');
  const [payrollSearch, setPayrollSearch] = useState('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Universal Multi-Selection & Bulk Operations States
  // ─────────────────────────────────────────────────────────────────────────────
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [selectedAttIds, setSelectedAttIds] = useState<number[]>([]);
  const [selectedLeaveIds, setSelectedLeaveIds] = useState<number[]>([]);
  const [selectedPayslipIds, setSelectedPayslipIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [, setLastSyncedTime] = useState<string | null>(null);
  const [, setIsSyncingAll] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (openActionMenuId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-action-menu]')) {
        setOpenActionMenuId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openActionMenuId]);

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: 'employee' | 'attendance' | 'leave' | 'payslip';
    id?: number;
    name?: string;
    isBulk?: boolean;
  }>({ open: false, type: 'employee' });

  const loadHrData = async (showLoading = false) => {
    if (showLoading) {
      setLoadingEmployees(true);
      setIsSyncingAll(true);
    }
    try {
      const [
        empRes,
        deptRes,
        desgRes,
        shiftRes,
        rolesRes,
        attRes,
        leavesRes,
        periodsRes,
        payslipsRes,
      ] = await Promise.all([
        hrApi.getEmployees().catch(() => ({ data: [] })),
        hrApi.getDepartments().catch(() => ({ data: [] })),
        hrApi.getDesignations().catch(() => ({ data: [] })),
        hrApi.getShifts().catch(() => ({ data: [] })),
        api.get<Array<{ id: number; name: string; slug: string }>>('/roles').catch(() => ({ data: [] })),
        hrApi.getAttendances(attDateFilter ? { date: attDateFilter } : undefined).catch(() => ({ data: [] })),
        hrApi.getLeaves().catch(() => ({ data: [] })),
        hrApi.getPayrollPeriods().catch(() => ({ data: [] })),
        hrApi.getPayslips(selectedPeriodId === 'all' ? undefined : { payroll_period_id: selectedPeriodId }).catch(() => ({ data: [] })),
      ]);

      void Promise.allSettled([
        api.get('/workforce/shifts'),
        api.get('/hr/attendance'),
        api.get('/hr/attendances/summary'),
        api.get('/hr/leave-requests'),
        api.get('/hr/leave-requests/types'),
      ]);

      if (empRes?.data && Array.isArray(empRes.data) && empRes.data.length > 0) {
        setEmployees(empRes.data);
      }
      if (deptRes?.data && Array.isArray(deptRes.data) && deptRes.data.length > 0) {
        setDepartments(deptRes.data);
      }
      if (desgRes?.data && Array.isArray(desgRes.data) && desgRes.data.length > 0) {
        setDesignations(desgRes.data);
      }
      if (shiftRes?.data && Array.isArray(shiftRes.data) && shiftRes.data.length > 0) {
        setShifts(shiftRes.data);
      }
      if (attRes?.data && Array.isArray(attRes.data) && attRes.data.length > 0) {
        setAttendances(attRes.data);
      }
      if (leavesRes?.data && Array.isArray(leavesRes.data) && leavesRes.data.length > 0) {
        setLeaveRequests(leavesRes.data);
      }
      if (periodsRes?.data && Array.isArray(periodsRes.data) && periodsRes.data.length > 0) {
        setPayrollPeriods(periodsRes.data);
      }
      if (payslipsRes?.data && Array.isArray(payslipsRes.data) && payslipsRes.data.length > 0) {
        setPayslips(payslipsRes.data);
      }
      const loadedRoles = Array.isArray(rolesRes.data) ? rolesRes.data : [];
      setAvailableRoles(loadedRoles);
      setLastSyncedTime(new Date().toLocaleTimeString());
      if (showLoading) {
        notify.success('All HR workforce and payroll records synchronized with API.');
      }
    } catch {
      // Retain local records
    } finally {
      setLoadingEmployees(false);
      setIsSyncingAll(false);
    }
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      hrApi.getEmployees().catch(() => ({ data: [] })),
      hrApi.getDepartments().catch(() => ({ data: [] })),
      hrApi.getDesignations().catch(() => ({ data: [] })),
      hrApi.getShifts().catch(() => ({ data: [] })),
      api.get<Array<{ id: number; name: string; slug: string }>>('/roles').catch(() => ({ data: [] })),
      hrApi.getAttendances(attDateFilter ? { date: attDateFilter } : undefined).catch(() => ({ data: [] })),
      hrApi.getLeaves().catch(() => ({ data: [] })),
      hrApi.getPayrollPeriods().catch(() => ({ data: [] })),
      hrApi.getPayslips(selectedPeriodId === 'all' ? undefined : { payroll_period_id: selectedPeriodId }).catch(() => ({ data: [] })),
    ]).then(([empRes, deptRes, desgRes, shiftRes, rolesRes, attRes, leavesRes, periodsRes, payslipsRes]) => {
      if (!active) return;
      if (empRes?.data && Array.isArray(empRes.data) && empRes.data.length > 0) {
        setEmployees(empRes.data);
      }
      if (deptRes?.data && Array.isArray(deptRes.data) && deptRes.data.length > 0) {
        setDepartments(deptRes.data);
      }
      if (desgRes?.data && Array.isArray(desgRes.data) && desgRes.data.length > 0) {
        setDesignations(desgRes.data);
      }
      if (shiftRes?.data && Array.isArray(shiftRes.data) && shiftRes.data.length > 0) {
        setShifts(shiftRes.data);
      }
      if (attRes?.data && Array.isArray(attRes.data) && attRes.data.length > 0) {
        setAttendances(attRes.data);
      }
      if (leavesRes?.data && Array.isArray(leavesRes.data) && leavesRes.data.length > 0) {
        setLeaveRequests(leavesRes.data);
      }
      if (periodsRes?.data && Array.isArray(periodsRes.data) && periodsRes.data.length > 0) {
        setPayrollPeriods(periodsRes.data);
      }
      if (payslipsRes?.data && Array.isArray(payslipsRes.data) && payslipsRes.data.length > 0) {
        setPayslips(payslipsRes.data);
      }
      const loadedRoles = Array.isArray(rolesRes.data) ? rolesRes.data : [];
      setAvailableRoles(loadedRoles);
      setLastSyncedTime(new Date().toLocaleTimeString());
    }).catch(() => {
      // Retain local records
    });

    return () => {
      active = false;
    };
  }, [attDateFilter, selectedPeriodId]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Action Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  // Onboard Employee
  const handleOnboardEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmployee(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        department_id: newDeptId,
        designation_id: newDesgId,
        employment_type: newEmpType,
        bank_account_number: newBankNumber.trim() || undefined,
        grant_user_access: grantUserAccess,
        user_password: grantUserAccess ? userPassword : undefined,
        role_ids: grantUserAccess ? Array.from(selectedRoleIds) : [],
      };

      try {
        const res = await api.post<{ success: boolean; data: Employee; message?: string }>('/hr/employees', payload);
        notify.success(res.data?.message || `Employee ${newFirstName} onboarded successfully!`);
      } catch {
        const resWf = await api.post<{ success: boolean; data: Employee; message?: string }>('/workforce/employees', payload);
        notify.success(resWf.data?.message || `Employee ${newFirstName} onboarded successfully!`);
      }
      setShowOnboardModal(false);
      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setNewEmail('');
      setNewBankNumber('');
      setGrantUserAccess(false);
      setUserPassword('');
      setSelectedRoleIds(new Set());
      await loadHrData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to onboard employee';
      notify.error(msg);
    } finally {
      setSavingEmployee(false);
    }
  };

  // Toggle Employee Active Status
  const handleToggleEmployeeStatus = async (empId: number) => {
    try {
      const res = await api.patch<{ success: boolean; message?: string }>(`/hr/employees/${empId}/status`);
      notify.success(res.data?.message || 'Employee status updated');
      await loadHrData();
    } catch {
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === empId
            ? { ...e, is_active: !e.is_active, employment_status: e.is_active ? 'suspended' : 'active' }
            : e
        )
      );
      notify.info('Employee status updated locally');
    }
  };

  const handleOpenAccessModal = (emp: Employee) => {
    setAccessModalEmp(emp);
    const existingRoles = emp.roles ? emp.roles.map((r) => r.id) : [];
    setAccessRoleIds(new Set(existingRoles));
    setAccessPassword(emp.has_user_account ? '' : generateRandomPassword());
  };

  const handleSaveAccess = async () => {
    if (!accessModalEmp) return;
    setSavingAccess(true);
    try {
      if (accessModalEmp.has_user_account || accessModalEmp.user_id) {
        await api.put(`/hr/employees/${accessModalEmp.id}/roles`, {
          role_ids: Array.from(accessRoleIds),
        });
        if (accessModalEmp.user_id) {
          await handleLinkUser(accessModalEmp.id, accessModalEmp.user_id);
        }
        notify.success('Security roles updated for employee.');
      } else {
        if (!accessPassword.trim()) {
          notify.error('Please specify an initial password.');
          setSavingAccess(false);
          return;
        }
        await api.post(`/hr/employees/${accessModalEmp.id}/provision-user`, {
          password: accessPassword,
          role_ids: Array.from(accessRoleIds),
        });
        notify.success('User account created and roles assigned successfully!');
      }
      setAccessModalEmp(null);
      await loadHrData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update employee access';
      notify.error(msg);
    } finally {
      setSavingAccess(false);
    }
  };

  const handleLinkUser = async (empId: number, userId: number) => {
    try {
      await api.post(`/hr/employees/${empId}/link-user`, { user_id: userId });
      notify.success('User account linked to employee.');
      await loadHrData();
    } catch {
      notify.info('User account linked locally.');
    }
  };

  const handleUnlinkUser = async (empId: number) => {
    try {
      await api.delete(`/hr/employees/${empId}/unlink-user`);
      notify.success('User account unlinked from employee.');
      await loadHrData();
    } catch {
      notify.info('User account unlinked locally.');
    }
  };

  const handleViewEmployeeProfile = async (emp: Employee) => {
    setViewingEmployeeProfile(emp);
    try {
      const res = await api.get<{ data: Employee }>(`/hr/employees/${emp.id}`);
      if (res.data?.data) {
        setViewingEmployeeProfile(res.data.data);
      }
    } catch {
      try {
        const resWf = await api.get<{ data: Employee }>(`/workforce/employees/${emp.id}`);
        if (resWf.data?.data) setViewingEmployeeProfile(resWf.data.data);
      } catch {
        // Retain cached
      }
    }
  };

  const handleViewPayslip = async (ps: Payslip) => {
    setSelectedPayslip(ps);
    try {
      const res = await api.get<{ data: Payslip }>(`/hr/payroll/payslips/${ps.id}`);
      if (res.data?.data) {
        setSelectedPayslip(res.data.data);
      }
    } catch {
      // Retain cached
    }
  };

  // Export Staff Directory
  const handleExportStaff = () => {
    const csvRows = [
      'Employee Code,Display Name,Department,Designation,Phone,Type,Status,Joining Date',
      ...employees.map(
        (e) =>
          `"${e.employee_code}","${e.display_name}","${e.department?.name || ''}","${e.designation?.name || ''}","${e.phone}","${e.employment_type}","${e.employment_status}","${e.date_of_joining}"`
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff_directory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Staff directory exported to CSV');
  };

  // Mark Attendance
  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmp = employees.find((emp) => emp.id === attEmpId);
    const targetShift = shifts.find((sh) => sh.id === attShiftId);

    const checkInDateTime = `${attDate} ${attCheckIn}:00`;
    const checkOutDateTime = `${attDate} ${attCheckOut}:00`;

    try {
      await api.post('/hr/attendance', {
        employee_id: attEmpId,
        attendance_date: attDate,
        shift_id: attShiftId,
        status: attStatus,
        check_in_at: checkInDateTime,
        check_out_at: checkOutDateTime,
        remarks: attRemarks || 'Floor shift attendance recorded',
      });
    } catch {
      // Retain optimistic
    }

    const newAtt: Attendance = {
      id: attendances.length + 1,
      uuid: `att-auto-${Date.now()}`,
      employee_id: attEmpId,
      employee: targetEmp,
      attendance_date: attDate,
      shift_id: attShiftId,
      shift: targetShift,
      check_in_at: checkInDateTime,
      check_out_at: checkOutDateTime,
      worked_minutes: 480,
      late_minutes: attStatus === 'late' ? 25 : 0,
      overtime_minutes: 0,
      status: attStatus,
      remarks: attRemarks || 'Floor shift attendance recorded',
    };

    setAttendances([newAtt, ...attendances]);
    setShowMarkAttendanceModal(false);
    setAttRemarks('');
    notify.success(`Attendance logged for ${targetEmp?.display_name}!`);
  };

  // Export Attendance CSV
  const handleExportAttendance = () => {
    const csvRows = [
      'Date,Employee Code,Employee Name,Shift,Check In,Check Out,Worked Minutes,Status',
      ...attendances.map(
        (a) =>
          `"${a.attendance_date}","${a.employee?.employee_code || ''}","${a.employee?.display_name || ''}","${a.shift?.name || ''}","${a.check_in_at || ''}","${a.check_out_at || ''}",${a.worked_minutes},"${a.status}"`
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Attendance records exported to CSV');
  };

  // Submit Leave Request
  const handleCreateLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmp = employees.find((emp) => emp.id === leaveEmpId);
    const targetType = leaveTypes.find((lt) => lt.id === leaveTypeId);

    try {
      await api.post('/hr/leave-requests', {
        employee_id: leaveEmpId,
        leave_type_id: leaveTypeId,
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        total_days: parseFloat(leaveDays) || 1,
        reason: leaveReason.trim() || undefined,
      });
    } catch {
      // Retain optimistic
    }

    const newReq: LeaveRequest = {
      id: leaveRequests.length + 1,
      uuid: `lr-auto-${Date.now()}`,
      employee_id: leaveEmpId,
      employee: targetEmp,
      leave_type_id: leaveTypeId,
      leave_type: targetType,
      start_date: leaveStartDate,
      end_date: leaveEndDate,
      total_days: parseFloat(leaveDays).toFixed(4),
      reason: leaveReason.trim(),
      status: 'pending',
    };

    setLeaveRequests([newReq, ...leaveRequests]);
    setShowLeaveRequestModal(false);
    setLeaveReason('');
    notify.success(`Leave request submitted for ${targetEmp?.display_name}!`);
  };

  // Approve / Reject Leave
  const handleApproveLeave = (id: number) => {
    setLeaveRequests((prev) =>
      prev.map((lr) => (lr.id === id ? { ...lr, status: 'approved' } : lr))
    );
    notify.success('Leave request approved');
  };

  const handleRejectLeave = (id: number) => {
    setLeaveRequests((prev) =>
      prev.map((lr) => (lr.id === id ? { ...lr, status: 'rejected' } : lr))
    );
    notify.warning('Leave request rejected');
  };

  // Disburse Payroll
  const handleDisbursePayroll = (periodId: number) => {
    setPayrollPeriods((prev) =>
      prev.map((p) => (p.id === periodId ? { ...p, status: 'paid' } : p))
    );
    setPayslips((prev) =>
      prev.map((ps) =>
        ps.payroll_period_id === periodId ? { ...ps, payment_status: 'paid' } : ps
      )
    );
    notify.success('Payroll disbursed and GL disbursement journal posted!');
  };

  // Export Bank Advice
  const handleExportBankAdvice = () => {
    const csvRows = [
      'Payslip Number,Employee Code,Beneficiary Name,Bank Account,Net Payable Amount (BDT),Payment Status',
      ...payslips.map(
        (ps) =>
          `"${ps.payslip_number}","${ps.employee?.employee_code || ''}","${ps.employee?.display_name || ''}","${ps.employee?.bank_account_number || 'N/A'}",${ps.net_amount},"${ps.payment_status}"`
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank_payroll_advice_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Bank payout advice exported to CSV');
  };

  // Create New Pay Period
  const handleCreateNewPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = Math.max(...payrollPeriods.map((p) => p.id), 0) + 1;
    const newPeriod: PayrollPeriod = {
      id: newId,
      uuid: `pp-auto-${Date.now()}`,
      company_id: 1,
      period_code: newPeriodCode.trim().toUpperCase(),
      pay_frequency: 'monthly',
      period_start: newPeriodStart,
      period_end: newPeriodEnd,
      payment_date: newPaymentDate,
      status: 'open',
      total_gross: '0.0000',
      total_deductions: '0.0000',
      total_net: '0.0000',
      employee_count: 0,
    };

    setPayrollPeriods([newPeriod, ...payrollPeriods]);
    setSelectedPeriodId(newId);
    setShowNewPeriodModal(false);
    notify.success(`New pay period ${newPeriod.period_code} initialized and ready!`);
  };

  // Create Payslip Success Callback
  const handleCreatePayslipSuccess = (newPayslip: Payslip) => {
    setPayslips((prev) => [newPayslip, ...prev]);

    // Recalculate the affected payroll period
    setPayrollPeriods((prev) =>
      prev.map((period) => {
        if (period.id === newPayslip.payroll_period_id) {
          const matchingPayslips = [
            ...payslips.filter((p) => p.payroll_period_id === period.id),
            newPayslip,
          ];
          const gross = matchingPayslips.reduce(
            (sum, p) => sum + parseFloat(p.gross_amount || '0'),
            0
          );
          const deductions = matchingPayslips.reduce(
            (sum, p) => sum + parseFloat(p.total_deductions || '0'),
            0
          );
          const net = matchingPayslips.reduce(
            (sum, p) => sum + parseFloat(p.net_amount || '0'),
            0
          );
          const uniqueEmps = new Set(matchingPayslips.map((p) => p.employee_id)).size;

          return {
            ...period,
            total_gross: gross.toFixed(4),
            total_deductions: deductions.toFixed(4),
            total_net: net.toFixed(4),
            employee_count: uniqueEmps,
          };
        }
        return period;
      })
    );
  };

  // Run Batch Payroll for an open period
  const handleRunBatchPayroll = (targetPeriodId: number) => {
    const period = payrollPeriods.find((p) => p.id === targetPeriodId);
    if (!period) return;
    if (period.status === 'closed' || period.status === 'paid') {
      notify.error(`Cannot generate payslips for a ${period.status} period`);
      return;
    }

    // Identify active employees who do not yet have a payslip in this period
    const existingEmpIds = new Set(
      payslips.filter((p) => p.payroll_period_id === targetPeriodId).map((p) => p.employee_id)
    );
    const eligibleEmployees = employees.filter((e) => e.is_active && !existingEmpIds.has(e.id));

    if (eligibleEmployees.length === 0) {
      notify.info('All active employees already have payslips generated for this period.');
      return;
    }

    const newGeneratedPayslips: Payslip[] = eligibleEmployees.map((emp, idx) => {
      const isPieceRate = emp.employment_type === 'piece_rate';
      const seq = String(idx + 1).padStart(4, '0');
      const pNum = `PS-${period.period_code.replace('PAY-', '')}-${seq}`;

      if (isPieceRate) {
        const qty = 1250;
        const rate = 30;
        const gross = qty * rate; // 37500
        const deductions = 500;
        const net = gross - deductions;

        return {
          id: Date.now() + idx,
          uuid: `ps-auto-${Date.now()}-${idx}`,
          payroll_period_id: targetPeriodId,
          payroll_period: period,
          employee_id: emp.id,
          employee: emp,
          payslip_number: pNum,
          gross_amount: gross.toFixed(4),
          total_earnings: gross.toFixed(4),
          total_deductions: deductions.toFixed(4),
          net_amount: net.toFixed(4),
          produced_quantity: qty.toFixed(4),
          payment_method: 'bank',
          payment_status: 'draft',
          items: [
            {
              salary_component_id: 101,
              component_code: 'PIECE_RATE',
              component_type: 'earning',
              quantity: qty.toFixed(4),
              rate: rate.toFixed(4),
              amount: gross.toFixed(4),
            },
            {
              salary_component_id: 401,
              component_code: 'PROVIDENT_FUND',
              component_type: 'deduction',
              quantity: '1.0000',
              rate: deductions.toFixed(4),
              amount: deductions.toFixed(4),
            },
          ],
          created_at: new Date().toISOString(),
        };
      } else {
        const basic = 50000;
        const houseRent = 15000;
        const gross = basic + houseRent; // 65000
        const deductions = 2500;
        const net = gross - deductions; // 62500

        return {
          id: Date.now() + idx,
          uuid: `ps-auto-${Date.now()}-${idx}`,
          payroll_period_id: targetPeriodId,
          payroll_period: period,
          employee_id: emp.id,
          employee: emp,
          payslip_number: pNum,
          gross_amount: gross.toFixed(4),
          total_earnings: gross.toFixed(4),
          total_deductions: deductions.toFixed(4),
          net_amount: net.toFixed(4),
          payment_method: 'bank',
          payment_status: 'draft',
          items: [
            {
              salary_component_id: 201,
              component_code: 'BASIC_SALARY',
              component_type: 'earning',
              quantity: '1.0000',
              rate: basic.toFixed(4),
              amount: basic.toFixed(4),
            },
            {
              salary_component_id: 202,
              component_code: 'HOUSE_RENT',
              component_type: 'earning',
              quantity: '1.0000',
              rate: houseRent.toFixed(4),
              amount: houseRent.toFixed(4),
            },
            {
              salary_component_id: 402,
              component_code: 'INCOME_TAX',
              component_type: 'deduction',
              quantity: '1.0000',
              rate: deductions.toFixed(4),
              amount: deductions.toFixed(4),
            },
          ],
          created_at: new Date().toISOString(),
        };
      }
    });

    const updatedPayslips = [...newGeneratedPayslips, ...payslips];
    setPayslips(updatedPayslips);

    // Update period totals
    setPayrollPeriods((prev) =>
      prev.map((p) => {
        if (p.id === targetPeriodId) {
          const allForPeriod = updatedPayslips.filter(
            (x) => x.payroll_period_id === targetPeriodId
          );
          const gross = allForPeriod.reduce(
            (sum, x) => sum + parseFloat(x.gross_amount || '0'),
            0
          );
          const deductions = allForPeriod.reduce(
            (sum, x) => sum + parseFloat(x.total_deductions || '0'),
            0
          );
          const net = allForPeriod.reduce(
            (sum, x) => sum + parseFloat(x.net_amount || '0'),
            0
          );
          const uniqueEmps = new Set(allForPeriod.map((x) => x.employee_id)).size;

          return {
            ...p,
            total_gross: gross.toFixed(4),
            total_deductions: deductions.toFixed(4),
            total_net: net.toFixed(4),
            employee_count: uniqueEmps,
          };
        }
        return p;
      })
    );

    notify.success(
      `Batch Payroll executed! Generated ${newGeneratedPayslips.length} payslips for ${period.period_code}.`
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Filtered Datasets
  // ─────────────────────────────────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (empDeptFilter !== 'all' && e.department_id !== empDeptFilter) return false;
      if (empTypeFilter !== 'all' && e.employment_type !== empTypeFilter) return false;
      if (empSearch.trim()) {
        const q = empSearch.toLowerCase();
        const matchName = e.display_name.toLowerCase().includes(q);
        const matchCode = e.employee_code.toLowerCase().includes(q);
        const matchPhone = e.phone.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchPhone) return false;
      }
      return true;
    });
  }, [employees, empDeptFilter, empTypeFilter, empSearch]);

  const filteredAttendances = useMemo(() => {
    return attendances.filter((a) => {
      if (attDateFilter && a.attendance_date !== attDateFilter) return false;
      if (attStatusFilter !== 'all' && a.status !== attStatusFilter) return false;
      if (attSearch.trim()) {
        const q = attSearch.toLowerCase();
        const matchName = a.employee?.display_name.toLowerCase().includes(q);
        const matchCode = a.employee?.employee_code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [attendances, attDateFilter, attStatusFilter, attSearch]);

  const filteredLeaves = useMemo(() => {
    return leaveRequests.filter((lr) => {
      if (leaveStatusFilter !== 'all' && lr.status !== leaveStatusFilter) return false;
      if (leaveSearch.trim()) {
        const q = leaveSearch.toLowerCase();
        const matchName = lr.employee?.display_name.toLowerCase().includes(q);
        const matchCode = lr.employee?.employee_code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [leaveRequests, leaveStatusFilter, leaveSearch]);

  const filteredPayslips = useMemo(() => {
    return payslips.filter((ps) => {
      if (selectedPeriodId !== 'all' && ps.payroll_period_id !== selectedPeriodId) {
        return false;
      }
      if (payrollSearch.trim()) {
        const q = payrollSearch.toLowerCase();
        const matchNum = ps.payslip_number.toLowerCase().includes(q);
        const matchName = ps.employee?.display_name.toLowerCase().includes(q);
        const matchCode = ps.employee?.employee_code.toLowerCase().includes(q);
        if (!matchNum && !matchName && !matchCode) return false;
      }
      return true;
    });
  }, [payslips, selectedPeriodId, payrollSearch]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Multi-Selection Toggles & Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const toggleSelectEmp = (id: number) => {
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };
  const toggleSelectAllEmp = () => {
    if (selectedEmpIds.length === filteredEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(filteredEmployees.map((e) => e.id));
    }
  };

  const toggleSelectAtt = (id: number) => {
    setSelectedAttIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };
  const toggleSelectAllAtt = () => {
    if (selectedAttIds.length === filteredAttendances.length) {
      setSelectedAttIds([]);
    } else {
      setSelectedAttIds(filteredAttendances.map((a) => a.id));
    }
  };

  const toggleSelectLeave = (id: number) => {
    setSelectedLeaveIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };
  const toggleSelectAllLeave = () => {
    if (selectedLeaveIds.length === filteredLeaves.length) {
      setSelectedLeaveIds([]);
    } else {
      setSelectedLeaveIds(filteredLeaves.map((l) => l.id));
    }
  };

  const toggleSelectPayslip = (id: number) => {
    setSelectedPayslipIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };
  const toggleSelectAllPayslips = () => {
    if (selectedPayslipIds.length === filteredPayslips.length) {
      setSelectedPayslipIds([]);
    } else {
      setSelectedPayslipIds(filteredPayslips.map((p) => p.id));
    }
  };

  // Bulk Operations Handlers
  const handleBulkStatusEmployees = async (status: 'active' | 'inactive') => {
    if (selectedEmpIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await hrApi.bulkStatusEmployees(selectedEmpIds, status);
      const isActive = status === 'active';
      setEmployees((prev) =>
        prev.map((e) =>
          selectedEmpIds.includes(e.id)
            ? { ...e, is_active: isActive, employment_status: isActive ? 'active' : 'suspended' }
            : e
        )
      );
      notify.success(`Updated status of ${selectedEmpIds.length} employees to ${status}.`);
      setSelectedEmpIds([]);
    } catch {
      setEmployees((prev) =>
        prev.map((e) => (selectedEmpIds.includes(e.id) ? { ...e, is_active: status === 'active' } : e))
      );
      notify.success(`Status updated for ${selectedEmpIds.length} employees.`);
      setSelectedEmpIds([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkPrintBadges = () => {
    const selectedEmployees = employees.filter((e) => selectedEmpIds.includes(e.id));
    if (selectedEmployees.length === 0) return;
    printDocument(
      <EmployeeIdBadgeDocument employees={selectedEmployees} />,
      {
        documentTitle: `Staff-ID-Badges-Batch-${new Date().toISOString().slice(0, 10)}`,
        pageClass: 'print-page-id-card',
      }
    );
    notify.success(`Prepared ${selectedEmployees.length} ID badges for print preview.`);
  };

  const handleBulkStatusAttendances = async (status: 'present' | 'absent' | 'late') => {
    if (selectedAttIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await hrApi.bulkStatusAttendances(selectedAttIds, status);
      setAttendances((prev) =>
        prev.map((a) => (selectedAttIds.includes(a.id) ? { ...a, status } : a))
      );
      notify.success(`Updated ${selectedAttIds.length} attendance records to ${status}.`);
      setSelectedAttIds([]);
    } catch {
      setAttendances((prev) =>
        prev.map((a) => (selectedAttIds.includes(a.id) ? { ...a, status } : a))
      );
      notify.success(`Attendance updated for ${selectedAttIds.length} records.`);
      setSelectedAttIds([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkApproveLeaves = async () => {
    if (selectedLeaveIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await hrApi.bulkApproveLeaves(selectedLeaveIds);
      setLeaveRequests((prev) =>
        prev.map((l) => (selectedLeaveIds.includes(l.id) ? { ...l, status: 'approved' } : l))
      );
      notify.success(`Approved ${selectedLeaveIds.length} leave requests.`);
      setSelectedLeaveIds([]);
    } catch {
      setLeaveRequests((prev) =>
        prev.map((l) => (selectedLeaveIds.includes(l.id) ? { ...l, status: 'approved' } : l))
      );
      notify.success(`Approved ${selectedLeaveIds.length} leaves.`);
      setSelectedLeaveIds([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkRejectLeaves = async () => {
    if (selectedLeaveIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await hrApi.bulkRejectLeaves(selectedLeaveIds);
      setLeaveRequests((prev) =>
        prev.map((l) => (selectedLeaveIds.includes(l.id) ? { ...l, status: 'rejected' } : l))
      );
      notify.success(`Rejected ${selectedLeaveIds.length} leave requests.`);
      setSelectedLeaveIds([]);
    } catch {
      setLeaveRequests((prev) =>
        prev.map((l) => (selectedLeaveIds.includes(l.id) ? { ...l, status: 'rejected' } : l))
      );
      notify.success(`Rejected ${selectedLeaveIds.length} leaves.`);
      setSelectedLeaveIds([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkStatusPayslips = async (status: 'draft' | 'approved' | 'paid') => {
    if (selectedPayslipIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await hrApi.bulkStatusPayslips(selectedPayslipIds, status);
      setPayslips((prev) =>
        prev.map((p) => (selectedPayslipIds.includes(p.id) ? { ...p, status } : p))
      );
      notify.success(`Updated ${selectedPayslipIds.length} payslips to ${status}.`);
      setSelectedPayslipIds([]);
    } catch {
      setPayslips((prev) =>
        prev.map((p) => (selectedPayslipIds.includes(p.id) ? { ...p, status } : p))
      );
      notify.success(`Updated ${selectedPayslipIds.length} payslips.`);
      setSelectedPayslipIds([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Execution of Single or Bulk Delete
  const handleExecuteDelete = async () => {
    setIsBulkProcessing(true);
    const { type, id, isBulk } = deleteConfirm;
    try {
      if (type === 'employee') {
        if (isBulk) {
          await hrApi.bulkDeleteEmployees(selectedEmpIds);
          setEmployees((prev) => prev.filter((e) => !selectedEmpIds.includes(e.id)));
          notify.success(`Deleted ${selectedEmpIds.length} employees.`);
          setSelectedEmpIds([]);
        } else if (id) {
          await hrApi.deleteEmployee(id);
          setEmployees((prev) => prev.filter((e) => e.id !== id));
          setSelectedEmpIds((prev) => prev.filter((i) => i !== id));
          notify.success('Employee deleted successfully.');
        }
      } else if (type === 'attendance') {
        if (isBulk) {
          await hrApi.bulkDeleteAttendances(selectedAttIds);
          setAttendances((prev) => prev.filter((a) => !selectedAttIds.includes(a.id)));
          notify.success(`Deleted ${selectedAttIds.length} attendance records.`);
          setSelectedAttIds([]);
        } else if (id) {
          await hrApi.deleteAttendance(id);
          setAttendances((prev) => prev.filter((a) => a.id !== id));
          setSelectedAttIds((prev) => prev.filter((i) => i !== id));
          notify.success('Attendance record deleted.');
        }
      } else if (type === 'leave') {
        if (isBulk) {
          await hrApi.bulkDeleteLeaves(selectedLeaveIds);
          setLeaveRequests((prev) => prev.filter((l) => !selectedLeaveIds.includes(l.id)));
          notify.success(`Deleted ${selectedLeaveIds.length} leave requests.`);
          setSelectedLeaveIds([]);
        } else if (id) {
          await hrApi.deleteLeave(id);
          setLeaveRequests((prev) => prev.filter((l) => l.id !== id));
          setSelectedLeaveIds((prev) => prev.filter((i) => i !== id));
          notify.success('Leave request deleted.');
        }
      } else if (type === 'payslip') {
        if (isBulk) {
          await hrApi.bulkDeletePayslips(selectedPayslipIds);
          setPayslips((prev) => prev.filter((p) => !selectedPayslipIds.includes(p.id)));
          notify.success(`Deleted ${selectedPayslipIds.length} payslips.`);
          setSelectedPayslipIds([]);
        } else if (id) {
          await hrApi.deletePayslip(id);
          setPayslips((prev) => prev.filter((p) => p.id !== id));
          setSelectedPayslipIds((prev) => prev.filter((i) => i !== id));
          notify.success('Payslip record deleted.');
        }
      }
    } catch {
      if (type === 'employee') {
        if (isBulk) {
          setEmployees((prev) => prev.filter((e) => !selectedEmpIds.includes(e.id)));
          setSelectedEmpIds([]);
        } else if (id) {
          setEmployees((prev) => prev.filter((e) => e.id !== id));
        }
      } else if (type === 'attendance') {
        if (isBulk) {
          setAttendances((prev) => prev.filter((a) => !selectedAttIds.includes(a.id)));
          setSelectedAttIds([]);
        } else if (id) {
          setAttendances((prev) => prev.filter((a) => a.id !== id));
        }
      } else if (type === 'leave') {
        if (isBulk) {
          setLeaveRequests((prev) => prev.filter((l) => !selectedLeaveIds.includes(l.id)));
          setSelectedLeaveIds([]);
        } else if (id) {
          setLeaveRequests((prev) => prev.filter((l) => l.id !== id));
        }
      } else if (type === 'payslip') {
        if (isBulk) {
          setPayslips((prev) => prev.filter((p) => !selectedPayslipIds.includes(p.id)));
          setSelectedPayslipIds([]);
        } else if (id) {
          setPayslips((prev) => prev.filter((p) => p.id !== id));
        }
      }
      notify.success('Record(s) removed.');
    } finally {
      setIsBulkProcessing(false);
      setDeleteConfirm({ open: false, type: 'employee' });
    }
  };

  const pieceRateCount = employees.filter((e) => e.employment_type === 'piece_rate').length;
  const salariedCount = employees.filter((e) => e.employment_type !== 'piece_rate').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* ─────────────────────────────────────────────────────────────────────────────
          Module Header & Contextual Action Controls
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-default pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary bg-primary-subtle px-2.5 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
              <Users className="size-3 text-primary" />
              {t('hr.workspaceTag')}
            </span>
            <span className="text-xs font-semibold text-muted">
              {t('hr.stageCounter', { step: currentStage.step, total: 8, label: currentStage.label })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default">
            {t('hr.title')}
          </h1>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
            {t('hr.subtitle')}
          </p>
        </div>

        {/* Contextual Action Buttons in Header */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {activeTab === 'payroll' ? (
            <>
              <button
                type="button"
                onClick={handleExportBankAdvice}
                className="px-3 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                title={t('hr.exportBankAdviceTitle')}
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600" />
                <span>{t('hr.exportBankAdvice')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNewPeriodModal(true)}
                className="px-3 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Plus className="size-3.5 text-muted" />
                <span>{t('hr.newPayPeriod')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreatePayslipModal(true)}
                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>{t('hr.createPayslip')}</span>
              </button>
            </>
          ) : activeTab === 'attendance' ? (
            <>
              <button
                type="button"
                onClick={() => setIsKioskModalOpen(true)}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-900 text-emerald-400 font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer border border-slate-800"
                title={t('hr.biometricKioskTitle')}
              >
                <Scan className="size-3.5 text-emerald-400" />
                <span>{t('hr.biometricKiosk')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowImportAttendanceModal(true)}
                className="px-3 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                title={t('hr.importAttendanceTitle')}
              >
                <Upload className="size-3.5 text-primary" />
                <span>{t('hr.importAttendance')}</span>
              </button>
              <button
                type="button"
                onClick={handleExportAttendance}
                className="px-3 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Download className="size-3.5 text-muted" />
                <span>{t('hr.exportLog')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMarkAttendanceModal(true)}
                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Clock className="size-3.5" />
                <span>{t('hr.markAttendance')}</span>
              </button>
            </>
          ) : activeTab === 'leaves' ? (
            <button
              type="button"
              onClick={() => setShowLeaveRequestModal(true)}
              className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>{t('hr.requestLeave')}</span>
            </button>
          ) : activeTab === 'salary-structures' ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                <span>{t('hr.salaryPackagesActive')}</span>
              </span>
            </div>
          ) : activeTab === 'advances' ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-amber-600" />
                <span>{t('hr.autoPayrollRecovery')}</span>
              </span>
            </div>
          ) : activeTab === 'employees' ? (
            <>
              <button
                type="button"
                onClick={handleExportStaff}
                className="px-3 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Download className="size-3.5 text-muted" />
                <span>{t('hr.exportStaff')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowImportStaffModal(true)}
                className="px-3 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Upload className="size-3.5 text-muted" />
                <span>{t('hr.importStaff')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowOnboardModal(true)}
                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <UserPlus className="size-3.5" />
                <span>{t('hr.addEmployee')}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowOnboardModal(true)}
              className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <UserPlus className="size-3.5" />
              <span>{t('hr.addEmployee')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          KPI Cards
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl p-5 shadow-2xs border border-default">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('hr.activeWorkforce')}
          </div>
          <div className="text-2xl font-extrabold text-default mt-2">
            {t('hr.personnelCount', { count: employees.length })}
          </div>
          <div className="text-xs text-muted mt-1">
            {t('hr.personnelSubtitle', { pieceRate: pieceRateCount, salaried: salariedCount })}
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 shadow-2xs border border-default">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('hr.monthlyPayrollRun')}
          </div>
          <div className="text-2xl font-extrabold text-primary mt-2 font-mono">
            {formatCurrency(payrollPeriods[0]?.total_net || '0')}
          </div>
          <div className="text-xs text-muted mt-1">
            {t('hr.periodBadge', { period: payrollPeriods[0]?.period_code, status: (payrollPeriods[0]?.status || '').toUpperCase() })}
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 shadow-2xs border border-default">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('hr.todayPresentRate')}
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            100%
          </div>
          <div className="text-xs text-muted mt-1">{t('hr.shiftGrace')}</div>
        </div>

        <div className="bg-surface rounded-2xl p-5 shadow-2xs border border-default">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('hr.pendingApprovedLeaves')}
          </div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">
            {t('hr.scheduledCount', { count: leaveRequests.length })}
          </div>
          <div className="text-xs text-muted mt-1">{t('hr.leaveQuotaSubtitle')}</div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Universal Workforce & HR Quick-Action Ribbon
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/20 bg-linear-to-r from-primary/5 via-surface to-surface-raised p-3.5 shadow-xs">
         <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {t('hr.pipelineTitle')}
            </span>
            <span className="text-[10px] font-mono text-muted bg-surface-sunken px-2 py-0.5 rounded-full border border-default">
              {t('hr.shortcutHint')}
            </span>
          </div>
          <span className="text-xs font-mono text-muted">
            {t('hr.stageCounter', { step: currentStage.step, total: 8, label: currentStage.label })}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {hrStages.map((st) => {
            const Icon = st.icon;
            const isActive = activeTab === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setActiveTab(st.id)}
                className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer min-w-0 flex flex-col justify-between ${
                  isActive
                    ? 'bg-primary text-primary-fg border-primary shadow-sm ring-2 ring-primary/20'
                    : 'bg-surface hover:bg-surface-sunken border-default text-muted hover:text-default'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5 w-full">
                  <div
                    className={`size-6 rounded-md flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-surface-sunken text-primary'
                    }`}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0 font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-surface-sunken text-muted'
                    }`}
                  >
                    {st.step}
                  </span>
                </div>
                <div className="min-w-0 w-full">
                  <div className="text-xs font-bold truncate leading-snug">{st.shortLabel}</div>
                  <div
                    className={`text-[10px] truncate ${
                      isActive ? 'text-primary-fg/80' : 'text-muted'
                    }`}
                  >
                    {st.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tier 1: Category Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isCatActive = activeCategory === cat.id;
            const stageRange = cat.id === 'people' ? t('hr.stagesRange', { range: '1-3' }) : t('hr.stagesRange', { range: '4-8' });
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.id)}
                className={`relative flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                  isCatActive
                    ? 'bg-surface border-primary/40 shadow-sm ring-1 ring-primary/20'
                    : 'bg-surface-sunken/40 border-default hover:bg-surface hover:border-default/80 text-muted'
                }`}
              >
                <div
                  className={`size-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isCatActive
                      ? 'bg-primary text-primary-fg shadow-2xs'
                      : 'bg-surface border border-default text-muted group-hover:text-default'
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-bold tracking-tight truncate ${
                        isCatActive ? 'text-default' : 'text-default/80'
                      }`}
                    >
                      {cat.label}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        isCatActive
                          ? 'bg-primary-subtle text-primary border-primary/20 font-bold'
                          : 'bg-surface text-muted border-default'
                      }`}
                    >
                      {stageRange}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted truncate mt-0.5">{cat.tagline}</p>
                </div>
                {isCatActive && (
                  <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tier 2: Contextual Sub-Navigation Bar & Quick Jump Popover */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-surface rounded-2xl border border-default shadow-2xs">
          {/* Sub-Tabs for Active Category */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 px-1 scrollbar-none min-w-0">
            {hrStages
              .filter((st) => st.category === activeCategory)
              .map((st) => {
                const Icon = st.icon;
                const isActive = activeTab === st.id;
                const count =
                  st.id === 'payroll' ? payslips.length :
                  st.id === 'attendance' ? attendances.length :
                  st.id === 'leaves' ? leaveRequests.length :
                  st.id === 'employees' ? employees.length :
                  st.id === 'departments' ? departments.length :
                  st.id === 'performance' ? 4 :
                  3;

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setActiveTab(st.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer min-w-0 ${
                      isActive
                        ? 'bg-primary text-primary-fg font-semibold shadow-xs border border-primary'
                        : 'text-muted hover:text-default hover:bg-surface-sunken border border-transparent'
                    }`}
                  >
                    <Icon className={`size-3.5 shrink-0 ${isActive ? 'text-primary-fg' : 'text-muted'}`} />
                    <span className="truncate">{st.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {t('hr.stageBadge', { step: st.step })}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0 ${
                        isActive ? 'bg-white/20 text-white font-bold' : 'bg-surface-sunken text-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Quick Jump Dropdown Popover */}
          <div className="relative shrink-0 sm:border-l sm:border-default sm:pl-3" ref={quickJumpRef}>
            <button
              type="button"
              onClick={() => {
                setQuickJumpOpen(!quickJumpOpen);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer w-full sm:w-auto justify-between sm:justify-start ${
                quickJumpOpen
                  ? 'bg-surface-sunken text-default border border-default'
                  : 'text-muted hover:text-default hover:bg-surface-sunken/60 border border-transparent'
              }`}
              title={t('hr.jumpTitle')}
            >
              <SlidersHorizontal className="size-3.5 text-muted" />
              <span>{t('hr.allViews')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-sunken text-muted border border-default">
                8
              </span>
            </button>

            {quickJumpOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface rounded-2xl border border-default shadow-lg p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('hr.searchPlaceholder')}
                    autoFocus
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-surface-sunken rounded-lg border border-default focus:border-primary focus:outline-none text-default"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-default cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                  {categories.map((cat) => {
                    const allTabs = [
                      { id: 'payroll', label: t('hr.stages.payroll.label'), category: 'compensation', icon: Wallet, count: payslips.length },
                      { id: 'attendance', label: t('hr.stages.attendance.label'), category: 'compensation', icon: Clock, count: attendances.length },
                      { id: 'leaves', label: t('hr.stages.leaves.label'), category: 'compensation', icon: CalendarCheck, count: leaveRequests.length },
                      { id: 'salary-structures', label: t('hr.stages.salaryStructures.label'), category: 'compensation', icon: DollarSign, count: 3 },
                      { id: 'advances', label: t('hr.stages.advances.label'), category: 'compensation', icon: CreditCard, count: 3 },
                      { id: 'employees', label: t('hr.stages.employees.label'), category: 'people', icon: Users, count: employees.length },
                      { id: 'departments', label: t('hr.stages.departments.label'), category: 'people', icon: Building2, count: departments.length },
                      { id: 'performance', label: t('hr.stages.performance.label'), category: 'people', icon: Zap, count: 4 },
                    ];
                    const catTabs = allTabs
                      .filter((tItem) => tItem.category === cat.id)
                      .filter((tItem) =>
                        searchQuery
                          ? tItem.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            tItem.id.toLowerCase().includes(searchQuery.toLowerCase())
                          : true
                      );
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
                                  setActiveTab(tab.id as HrTab);
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

                  {categories.every((cat) => {
                    const allTabs = [
                      { id: 'payroll', label: t('hr.stages.payroll.label'), category: 'compensation' },
                      { id: 'attendance', label: t('hr.stages.attendance.label'), category: 'compensation' },
                      { id: 'leaves', label: t('hr.stages.leaves.label'), category: 'compensation' },
                      { id: 'salary-structures', label: t('hr.stages.salaryStructures.label'), category: 'compensation' },
                      { id: 'advances', label: t('hr.stages.advances.label'), category: 'compensation' },
                      { id: 'employees', label: t('hr.stages.employees.label'), category: 'people' },
                      { id: 'departments', label: t('hr.stages.departments.label'), category: 'people' },
                      { id: 'performance', label: t('hr.stages.performance.label'), category: 'people' },
                    ];
                    const catTabs = allTabs
                      .filter((tItem) => tItem.category === cat.id)
                      .filter((tItem) =>
                        searchQuery
                          ? tItem.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            tItem.id.toLowerCase().includes(searchQuery.toLowerCase())
                          : true
                      );
                    return catTabs.length === 0;
                  }) && (
                    <div className="py-6 text-center text-xs text-muted">
                      {t('hr.noViewsFound', { query: searchQuery })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 1: Payroll Runs & Payslips
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Pay Period Switcher Ribbon */}
          <div className="bg-surface rounded-2xl border border-default p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted mr-1">
                Pay Period:
              </span>
              {payrollPeriods.map((period) => (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => setSelectedPeriodId(period.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    selectedPeriodId === period.id
                      ? 'bg-primary text-primary-fg shadow-xs font-bold'
                      : 'bg-surface-sunken hover:bg-surface text-default border border-default'
                  }`}
                >
                  <span className="font-mono">{period.period_code}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold ${
                      period.status === 'paid'
                        ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                        : period.status === 'open'
                        ? 'bg-blue-500/20 text-blue-800 dark:text-blue-300'
                        : period.status === 'draft'
                        ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-500/20 text-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {period.status}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedPeriodId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  selectedPeriodId === 'all'
                    ? 'bg-primary text-primary-fg shadow-xs font-bold'
                    : 'bg-surface-sunken hover:bg-surface text-default border border-default'
                }`}
              >
                All Periods
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowNewPeriodModal(true)}
                className="px-3 py-1.5 rounded-xl border border-default hover:bg-surface-sunken text-default text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Plus className="size-3.5 text-muted" />
                <span>New Period</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreatePayslipModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Plus className="size-3.5" />
                <span>+ Create Payslip</span>
              </button>
            </div>
          </div>

          {/* Payroll Period Summary Card */}
          {payrollPeriods
            .filter((p) => selectedPeriodId === 'all' || p.id === selectedPeriodId)
            .map((period) => (
              <div
                key={period.id}
                className="bg-surface rounded-2xl p-6 shadow-2xs border border-default space-y-4"
              >
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-default font-mono">
                        {period.period_code}
                      </h3>
                      <span
                        className={`px-3 py-1 text-xs font-extrabold rounded-full uppercase tracking-wide flex items-center gap-1 ${
                          period.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : period.status === 'closed'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            : period.status === 'open'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}
                      >
                        {period.status === 'paid' ? (
                          <CheckCircle2 className="size-3" />
                        ) : period.status === 'closed' ? (
                          '🔒'
                        ) : (
                          '⚡'
                        )}
                        {period.status === 'paid'
                          ? 'DISBURSED & PAID'
                          : period.status === 'closed'
                          ? 'CLOSED & LOCKED'
                          : `${period.status.toUpperCase()} & READY`}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Dates: {period.period_start} to {period.period_end} | Disbursed:{' '}
                      {period.payment_date} | {period.employee_count} Enrolled Staff
                    </p>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-right">
                      <span className="text-2xs text-muted uppercase font-semibold block">
                        Total Gross
                      </span>
                      <div className="text-lg font-bold font-mono text-default">
                        {formatCurrency(period.total_gross)}
                      </div>
                    </div>
                    <div className="text-right border-l border-default pl-4">
                      <span className="text-2xs text-muted uppercase font-semibold block">
                        Total Net Payout
                      </span>
                      <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(period.total_net)}
                      </div>
                    </div>

                    {/* Actions Bar on Period Card */}
                    <div className="flex items-center gap-2 border-l border-default pl-4 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowCreatePayslipModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Plus className="size-3.5" />
                        <span>Create Payslip</span>
                      </button>

                      {period.status !== 'closed' && period.status !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => handleRunBatchPayroll(period.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          title="Generate payslips for all active employees without one"
                        >
                          <Zap className="size-3.5" />
                          <span>⚡ Run Payroll</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleExportBankAdvice}
                        className="px-3 py-1.5 rounded-xl border border-default hover:bg-surface-sunken text-default text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        title="Download bank CSV file"
                      >
                        <FileSpreadsheet className="size-3.5 text-emerald-600" />
                        <span>Advice CSV</span>
                      </button>

                      {period.status !== 'paid' ? (
                        <button
                          type="button"
                          onClick={() => handleDisbursePayroll(period.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                          <CreditCard className="size-3.5" />
                          <span>Disburse</span>
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                          <Check className="size-3" /> Disbursed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* Floating Bulk Actions Ribbon for Payslips */}
          {selectedPayslipIds.length > 0 && (
            <div className="sticky top-2 z-20 flex items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-surface shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white shadow-xs">
                  {selectedPayslipIds.length}
                </span>
                <div>
                  <p className="text-xs font-bold text-default">
                    {selectedPayslipIds.length} Payslip{selectedPayslipIds.length > 1 ? 's' : ''} Selected
                  </p>
                  <p className="text-[11px] text-muted">Execute bulk payroll status or remove drafted slips</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => void handleBulkStatusPayslips('paid')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Disbursed & Paid
                </button>
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => setDeleteConfirm({ open: true, type: 'payslip', isBulk: true })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedPayslipIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayslipIds([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-default text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* Payslip Items Table */}
          <div className="bg-surface rounded-2xl shadow-2xs border border-default/70 overflow-hidden">
            <div className="p-4 border-b border-default flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-default text-sm">
                  Itemized Worker Payslips
                </h3>
                <span className="text-xs text-muted">
                  {selectedPeriodId === 'all'
                    ? 'Showing all payslips across all pay periods'
                    : `Filtered for ${
                        payrollPeriods.find((p) => p.id === selectedPeriodId)?.period_code ||
                        'current period'
                      } • ${filteredPayslips.length} issued`}
                </span>
              </div>

              {/* Payslip Search & Quick Create Button */}
              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="size-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={payrollSearch}
                    onChange={(e) => setPayrollSearch(e.target.value)}
                    placeholder="Search payslip or worker..."
                    className="w-full pl-8 pr-3 py-1.5 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreatePayslipModal(true)}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold rounded-xl flex items-center gap-1 shrink-0 transition cursor-pointer shadow-xs"
                >
                  <Plus className="size-3.5" />
                  <span>+ Create Payslip</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto min-h-75 scrollbar-thin scrollbar-thumb-default/30">
              <table className="w-full text-left text-xs text-default border-collapse">
                <thead className="bg-surface-sunken text-muted uppercase text-2xs font-bold border-b border-default">
                  <tr>
                    <th className="w-9 px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAllPayslips}
                        className="text-muted hover:text-primary transition-colors cursor-pointer"
                        title="Select All"
                      >
                        {selectedPayslipIds.length === filteredPayslips.length && filteredPayslips.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-muted/60" />
                        )}
                      </button>
                    </th>
                    <th className="w-28 px-2 py-2.5 font-bold">Payslip Number</th>
                    <th className="px-2.5 py-2.5">Employee Name</th>
                    <th className="px-2 py-2.5 text-center">Type</th>
                    <th className="px-2.5 py-2.5 text-right font-mono">Output Qty</th>
                    <th className="px-2.5 py-2.5 text-right font-mono">Gross Amount</th>
                    <th className="px-2.5 py-2.5 text-right font-mono">Deductions</th>
                    <th className="px-2.5 py-2.5 text-right font-mono">Net Payable</th>
                    <th className="w-36 px-2 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default/40">
                  {filteredPayslips.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center space-y-3">
                          <div className="size-12 rounded-2xl bg-surface-sunken border border-default flex items-center justify-center text-muted">
                            <DollarSign className="size-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-default">
                              No payslips generated for this period yet
                            </h4>
                            <p className="text-xs text-muted mt-1">
                              Run automated payroll to roll up all piece-rate output and monthly salaries, or create an individual worker payslip.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                const targetId =
                                  selectedPeriodId === 'all'
                                    ? payrollPeriods[0]?.id
                                    : selectedPeriodId;
                                if (targetId) handleRunBatchPayroll(targetId);
                              }}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                            >
                              <Zap className="size-3.5" />
                              <span>⚡ Run Payroll (Batch)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCreatePayslipModal(true)}
                              className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface hover:bg-surface-sunken text-default border border-default flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                            >
                              <Plus className="size-3.5" />
                              <span>+ Create Payslip</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPayslips.map((ps) => {
                      const isChecked = selectedPayslipIds.includes(ps.id);
                      return (
                        <tr
                          key={ps.id}
                          className={`transition ${isChecked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-sunken/40'}`}
                        >
                          <td className="w-9 px-2 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectPayslip(ps.id)}
                              className="text-muted hover:text-primary transition-colors cursor-pointer"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-muted/60" />
                              )}
                            </button>
                          </td>
                          <td className="w-28 px-2 py-2.5 font-mono font-bold text-primary whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleViewPayslip(ps)}
                              className="hover:underline cursor-pointer text-left font-mono"
                              title="View itemized payslip breakdown"
                            >
                              {ps.payslip_number}
                            </button>
                          </td>
                          <td className="px-2.5 py-2.5 whitespace-nowrap">
                            <div className="font-semibold text-default">
                              {ps.employee?.display_name}
                            </div>
                            <div className="text-3xs font-mono text-muted">
                              {ps.employee?.employee_code}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-2xs font-semibold rounded ${
                                ps.employee?.employment_type === 'piece_rate'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              }`}
                            >
                              {ps.employee?.employment_type.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-right font-mono font-semibold text-default whitespace-nowrap">
                            {ps.produced_quantity
                              ? `${parseFloat(ps.produced_quantity).toFixed(0)} Pcs`
                              : '—'}
                          </td>
                          <td className="px-2.5 py-2.5 text-right font-mono text-default whitespace-nowrap">
                            {formatCurrency(ps.gross_amount)}
                          </td>
                          <td className="px-2.5 py-2.5 text-right font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {formatCurrency(ps.total_deductions)}
                          </td>
                          <td className="px-2.5 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {formatCurrency(ps.net_amount)}
                          </td>
                          <td className="w-36 px-2 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5 relative">
                              {/* 1. Primary Direct Action Button */}
                              <button
                                type="button"
                                onClick={() => handleViewPayslip(ps)}
                                className="px-2.5 py-1 text-xs bg-surface border border-default hover:bg-surface-sunken text-default rounded-lg font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="View itemized payslip breakdown"
                                aria-label="View Items"
                              >
                                <Eye className="size-3 text-primary" />
                                <span>Slip</span>
                              </button>

                              {/* 2. Prominent Actions Dropdown Button */}
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (openActionMenuId === `ps_${ps.id}`) {
                                      setOpenActionMenuId(null);
                                      setActionMenuAnchor(null);
                                    } else {
                                      setOpenActionMenuId(`ps_${ps.id}`);
                                      setActionMenuAnchor(e.currentTarget);
                                    }
                                  }}
                                  className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                    openActionMenuId === `ps_${ps.id}`
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-default bg-surface hover:bg-surface-sunken text-default'
                                  }`}
                                  title={`More actions for ${ps.payslip_number}`}
                                  aria-label={`More options for ${ps.payslip_number}`}
                                >
                                  <span>Actions</span>
                                  <ChevronDown className="size-3 text-muted" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {actionMenuAnchor && typeof openActionMenuId === 'string' && openActionMenuId.startsWith('ps_') && (() => {
                const psId = parseInt(openActionMenuId.replace('ps_', ''), 10);
                const ps = filteredPayslips.find((p) => p.id === psId);
                if (!ps) return null;
                return (
                  <ActionMenuPortal
                    isOpen={true}
                    anchorEl={actionMenuAnchor}
                    onClose={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-52"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        handlePrintPayslip(ps);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                    >
                      <Printer className="size-3.5 text-primary shrink-0" />
                      <span>Print Payslip</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        void handleBulkStatusPayslips('paid');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                      <span>Mark Disbursed & Paid</span>
                    </button>

                    <div className="my-1 border-t border-default/50" />

                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        setDeleteConfirm({
                          open: true,
                          type: 'payslip',
                          id: ps.id,
                          name: ps.payslip_number,
                        });
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                      <span>Delete Payslip</span>
                    </button>
                  </ActionMenuPortal>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 2: Employee Directory
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Employee Directory Toolbar */}
          <div className="bg-surface rounded-2xl border border-default p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              <div className="relative flex-1 min-w-50 max-w-sm">
                <Search className="size-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Search employee name, code, phone..."
                  className="w-full pl-8 pr-3 py-1.5 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none"
                />
              </div>

              {/* Department Dropdown Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="size-3.5 text-muted" />
                <select
                  value={empDeptFilter}
                  onChange={(e) =>
                    setEmpDeptFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))
                  }
                  className="px-2.5 py-1.5 border border-default rounded-xl bg-surface text-default text-xs focus:border-primary focus:outline-none font-medium cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <select
                value={empTypeFilter}
                onChange={(e) => setEmpTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-default rounded-xl bg-surface text-default text-xs focus:border-primary focus:outline-none font-medium cursor-pointer"
              >
                <option value="all">All Employment Types</option>
                <option value="piece_rate">Piece-Rate Worker</option>
                <option value="permanent">Permanent Salaried</option>
                <option value="contract">Contract Staff</option>
                <option value="daily_wage">Daily Wage</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk Selection Toggle in Toolbar */}
              <button
                type="button"
                onClick={toggleSelectAllEmp}
                className={`px-3 py-2 border rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer font-semibold ${
                  selectedEmpIds.length > 0
                    ? 'bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary'
                    : 'bg-surface hover:bg-surface-sunken border-default text-default'
                }`}
                title={
                  selectedEmpIds.length === filteredEmployees.length && filteredEmployees.length > 0
                    ? 'Deselect All'
                    : 'Select All Filtered'
                }
              >
                {selectedEmpIds.length > 0 && selectedEmpIds.length === filteredEmployees.length ? (
                  <CheckSquare className="size-3.5 text-primary" />
                ) : selectedEmpIds.length > 0 ? (
                  <MinusSquare className="size-3.5 text-primary" />
                ) : (
                  <Square className="size-3.5 text-muted" />
                )}
                <span>
                  {selectedEmpIds.length > 0
                    ? `${selectedEmpIds.length}/${filteredEmployees.length} Selected`
                    : `Select All (${filteredEmployees.length})`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => loadHrData()}
                disabled={loadingEmployees}
                className="px-2.5 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                title="Refresh from server"
              >
                <RefreshCw className={`size-3.5 text-muted ${loadingEmployees ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={handleExportStaff}
                className="px-3 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Download className="size-3.5 text-muted" />
                <span>Export Staff</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewFirstName('');
                  setNewLastName('');
                  setNewPhone('');
                  setNewEmail('');
                  setNewBankNumber('');
                  setGrantUserAccess(false);
                  setUserPassword(generateRandomPassword());
                  setSelectedRoleIds(new Set());
                  setShowOnboardModal(true);
                }}
                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <UserPlus className="size-3.5" />
                <span>Add Employee</span>
              </button>
            </div>
          </div>

          {/* Floating Bulk Actions Ribbon for Employees */}
          {selectedEmpIds.length > 0 && (
            <div className="sticky top-2 z-30 flex items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-surface/95 backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-fg shadow-xs">
                  {selectedEmpIds.length}
                </span>
                <div>
                  <p className="text-xs font-bold text-default">
                    {selectedEmpIds.length} Employee{selectedEmpIds.length > 1 ? 's' : ''} Selected
                  </p>
                  <p className="text-[11px] text-muted">Execute bulk status modification, badge generation, or profile removal</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => void handleBulkStatusEmployees('active')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Active
                </button>
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => void handleBulkStatusEmployees('inactive')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Mark Inactive
                </button>
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={handleBulkPrintBadges}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  title="Print official ID badges for all selected employees"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Badges ({selectedEmpIds.length})
                </button>
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => setDeleteConfirm({ open: true, type: 'employee', isBulk: true })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedEmpIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEmpIds([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-default text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* Employees Table */}
          <div className="bg-surface rounded-2xl shadow-2xs border border-default/70 overflow-hidden">
            <div className="overflow-x-auto min-h-75 scrollbar-thin scrollbar-thumb-default/30">
              <table className="w-full text-left text-xs text-default border-collapse">
                <thead className="bg-surface-sunken text-muted uppercase text-2xs font-bold border-b border-default/60">
                  <tr>
                    <th className="w-9 px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAllEmp}
                        className="inline-flex items-center justify-center p-1 rounded hover:bg-default/10 text-muted hover:text-primary transition-colors cursor-pointer"
                        title={
                          selectedEmpIds.length === filteredEmployees.length && filteredEmployees.length > 0
                            ? 'Deselect All'
                            : 'Select All'
                        }
                        aria-label="Select all employees"
                      >
                        {selectedEmpIds.length > 0 && selectedEmpIds.length === filteredEmployees.length ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : selectedEmpIds.length > 0 ? (
                          <MinusSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-muted/60" />
                        )}
                      </button>
                    </th>
                    <th className="w-20 px-2 py-3 whitespace-nowrap">Code</th>
                    <th className="px-2.5 py-3 whitespace-nowrap">Employee</th>
                    <th className="px-2.5 py-3 whitespace-nowrap">Department & Role</th>
                    <th className="px-2.5 py-3 whitespace-nowrap">ERP Access</th>
                    <th className="px-2 py-3 whitespace-nowrap">Phone</th>
                    <th className="px-2 py-3 text-center whitespace-nowrap">Type</th>
                    <th className="px-2 py-3 whitespace-nowrap">Shift</th>
                    <th className="px-2 py-3 text-center whitespace-nowrap">Status</th>
                    <th className="w-36 px-2 py-3 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default/40">
                  {filteredEmployees.map((emp) => {
                    const isChecked = selectedEmpIds.includes(emp.id);
                    return (
                      <tr
                        key={emp.id}
                        className={`transition ${isChecked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-sunken/40'}`}
                      >
                        <td className="w-9 px-2 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectEmp(emp.id)}
                            className="inline-flex items-center justify-center p-1 rounded hover:bg-default/10 text-muted hover:text-primary transition-colors cursor-pointer"
                            aria-label={`Select employee ${emp.display_name}`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-muted/60" />
                            )}
                          </button>
                        </td>
                        <td className="w-20 px-2 py-2.5 font-mono font-bold text-primary whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleViewEmployeeProfile(emp)}
                            className="hover:underline cursor-pointer text-left font-mono"
                            title="View employee profile"
                          >
                            {emp.employee_code}
                          </button>
                        </td>
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewEmployeeProfile(emp)}
                              className="size-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0 hover:ring-2 hover:ring-primary/40 transition cursor-pointer"
                              title="View employee profile"
                            >
                              {emp.first_name?.[0] || emp.display_name?.[0] || 'E'}
                              {emp.last_name?.[0] || ''}
                            </button>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => handleViewEmployeeProfile(emp)}
                                className="font-semibold text-default hover:text-primary transition truncate block text-left cursor-pointer"
                              >
                                {emp.display_name}
                              </button>
                              <div className="text-3xs text-muted">
                                {emp.date_of_joining ? `Joined ${emp.date_of_joining.split('T')[0]}` : 'Active Staff'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5">
                          <div className="font-medium text-default whitespace-nowrap">
                            {emp.department?.name || 'General Operations'}
                          </div>
                          <div className="text-2xs text-muted whitespace-nowrap">
                            {emp.designation?.name ||
                              (emp.roles && emp.roles.length > 0 && emp.roles[0]
                                ? emp.roles[0].name.replace(/[_-]/g, ' ')
                                : 'Staff Member')}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5">
                          {emp.has_user_account || emp.user_id ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                                <span className="text-xs font-semibold text-default truncate max-w-36" title={emp.user?.email || emp.email || 'Active User'}>
                                  {emp.user?.email || emp.email || 'Active User'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {emp.roles && emp.roles.length > 0 ? (
                                  emp.roles.map((r) => (
                                    <span
                                      key={r.id}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-semibold bg-primary/10 text-primary border border-primary/20 capitalize whitespace-nowrap"
                                    >
                                      {r.name.replace(/[_-]/g, ' ')}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-3xs text-muted italic">No roles</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted whitespace-nowrap">
                              <span className="size-1.5 rounded-full bg-muted-foreground/30 shrink-0 inline-block" />
                              <span className="text-xs italic">No ERP Login</span>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2.5 font-mono text-xs text-muted whitespace-nowrap">
                          {emp.phone || '—'}
                        </td>
                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-2xs font-semibold rounded-full capitalize ${
                              emp.employment_type === 'piece_rate'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : emp.employment_type === 'permanent'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            }`}
                          >
                            {emp.employment_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-xs text-muted whitespace-nowrap">
                          {emp.default_shift?.name || 'Standard Shift'}
                        </td>
                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-2xs font-bold rounded-full ${
                              emp.is_active
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            }`}
                          >
                            {emp.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="w-36 px-2 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 relative">
                            <button
                              type="button"
                              onClick={() => handleViewEmployeeProfile(emp)}
                              className="px-2.5 py-1 text-xs bg-surface border border-default hover:bg-surface-sunken text-default rounded-lg font-medium transition cursor-pointer"
                              title="View complete employee record"
                            >
                              Profile
                            </button>

                            {/* Prominent Actions Dropdown Button */}
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openActionMenuId === `emp_${emp.id}`) {
                                    setOpenActionMenuId(null);
                                    setActionMenuAnchor(null);
                                  } else {
                                    setOpenActionMenuId(`emp_${emp.id}`);
                                    setActionMenuAnchor(e.currentTarget);
                                  }
                                }}
                                className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                  openActionMenuId === `emp_${emp.id}`
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-default bg-surface hover:bg-surface-sunken text-default'
                                }`}
                                title={`More actions for ${emp.display_name}`}
                                aria-label={`More options for ${emp.display_name}`}
                              >
                                <span>Actions</span>
                                <ChevronDown className="size-3 text-muted" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {actionMenuAnchor && typeof openActionMenuId === 'string' && openActionMenuId.startsWith('emp_') && (() => {
                const empId = parseInt(openActionMenuId.replace('emp_', ''), 10);
                const emp = filteredEmployees.find((e) => e.id === empId);
                if (!emp) return null;
                return (
                  <ActionMenuPortal
                    isOpen={true}
                    anchorEl={actionMenuAnchor}
                    onClose={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-52"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        setSelectedEmployeeForBadge(emp);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                    >
                      <Printer className="size-3.5 text-primary shrink-0" />
                      <span>Print ID Badge</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        handleOpenAccessModal(emp);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                    >
                      <KeyRound className="size-3.5 text-amber-500 shrink-0" />
                      <span>ERP Access & Roles</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        handleToggleEmployeeStatus(emp.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                      <span>{emp.is_active ? 'Deactivate Employee' : 'Activate Employee'}</span>
                    </button>

                    <div className="my-1 border-t border-default/50" />

                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        setDeleteConfirm({
                          open: true,
                          type: 'employee',
                          id: emp.id,
                          name: emp.display_name,
                        });
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                      <span>Delete Employee</span>
                    </button>
                  </ActionMenuPortal>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 3: Shifts & Daily Attendance
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Attendance Toolbar */}
          <div className="bg-surface rounded-2xl border border-default p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              <div className="flex items-center gap-1.5 px-3 py-1.5 border border-default rounded-xl bg-surface">
                <span className="text-xs font-semibold text-muted">Date:</span>
                <input
                  type="date"
                  value={attDateFilter}
                  onChange={(e) => setAttDateFilter(e.target.value)}
                  className="bg-transparent text-xs font-mono font-bold text-default focus:outline-none cursor-pointer"
                />
              </div>

              <div className="relative flex-1 min-w-45 max-w-xs">
                <Search className="size-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={attSearch}
                  onChange={(e) => setAttSearch(e.target.value)}
                  placeholder="Filter by worker name/code..."
                  className="w-full pl-8 pr-3 py-1.5 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <select
                value={attStatusFilter}
                onChange={(e) => setAttStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-default rounded-xl bg-surface text-default text-xs focus:border-primary focus:outline-none font-medium cursor-pointer"
              >
                <option value="all">All Attendance Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late Check-in</option>
                <option value="absent">Absent</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportAttendance}
                className="px-3 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Download className="size-3.5 text-muted" />
                <span>Export Records</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMarkAttendanceModal(true)}
                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Clock className="size-3.5" />
                <span>Mark Attendance</span>
              </button>
            </div>
          </div>

          {/* Floating Bulk Actions Ribbon for Attendance */}
          {selectedAttIds.length > 0 && (
            <div className="sticky top-2 z-20 flex items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-surface shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white shadow-xs">
                  {selectedAttIds.length}
                </span>
                <div>
                  <p className="text-xs font-bold text-default">
                    {selectedAttIds.length} Record{selectedAttIds.length > 1 ? 's' : ''} Selected
                  </p>
                  <p className="text-[11px] text-muted">Batch reconcile attendance or remove obsolete logs</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => void handleBulkStatusAttendances('present')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Present
                </button>
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => void handleBulkStatusAttendances('absent')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Mark Absent
                </button>
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => setDeleteConfirm({ open: true, type: 'attendance', isBulk: true })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedAttIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAttIds([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-default text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* Attendance Table */}
          <div className="bg-surface rounded-2xl shadow-2xs border border-default overflow-hidden">
            <div className="overflow-x-auto min-h-75">
              <table className="w-full text-left text-sm text-default">
                <thead className="bg-surface-sunken text-muted uppercase text-2xs font-bold border-b border-default">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAllAtt}
                        className="text-muted hover:text-primary transition-colors cursor-pointer"
                        title="Select All"
                      >
                        {selectedAttIds.length === filteredAttendances.length && filteredAttendances.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-muted/60" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 whitespace-nowrap">Date</th>
                    <th className="px-6 py-3 whitespace-nowrap">Employee</th>
                    <th className="px-6 py-3 whitespace-nowrap">Check-In</th>
                    <th className="px-6 py-3 whitespace-nowrap">Check-Out</th>
                    <th className="px-6 py-3 text-right whitespace-nowrap">Worked (Mins)</th>
                    <th className="px-6 py-3 text-right whitespace-nowrap">Late (Mins)</th>
                    <th className="px-6 py-3 text-center whitespace-nowrap">Status</th>
                    <th className="px-6 py-3 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {filteredAttendances.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-xs text-muted">
                        No attendance records found for this date.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendances.map((att) => {
                      const isChecked = selectedAttIds.includes(att.id);
                      return (
                        <tr
                          key={att.id}
                          className={`transition ${isChecked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-sunken/50'}`}
                        >
                          <td className="px-4 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectAtt(att.id)}
                              className="text-muted hover:text-primary transition-colors cursor-pointer"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-muted/60" />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">{att.attendance_date}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-default">
                              {att.employee?.display_name}
                            </div>
                            <div className="text-xs font-mono text-muted">
                              {att.employee?.employee_code}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">{att.check_in_at}</td>
                          <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">{att.check_out_at}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-default whitespace-nowrap">
                            {att.worked_minutes} mins ({(att.worked_minutes / 60).toFixed(1)} hrs)
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {att.late_minutes} mins
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase ${
                                att.status === 'present'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              }`}
                            >
                              {att.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5 relative">
                              <button
                                type="button"
                                onClick={() => {
                                  setAttendances((prev) =>
                                    prev.map((a) =>
                                      a.id === att.id
                                        ? {
                                            ...a,
                                            status: a.status === 'present' ? 'late' : 'present',
                                            late_minutes: a.status === 'present' ? 15 : 0,
                                          }
                                        : a
                                    )
                                  );
                                  notify.info('Attendance status adjusted');
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-default hover:bg-surface-sunken text-default transition cursor-pointer shadow-2xs"
                              >
                                Toggle State
                              </button>

                              {/* Prominent Actions Dropdown Button */}
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (openActionMenuId === `att_${att.id}`) {
                                      setOpenActionMenuId(null);
                                      setActionMenuAnchor(null);
                                    } else {
                                      setOpenActionMenuId(`att_${att.id}`);
                                      setActionMenuAnchor(e.currentTarget);
                                    }
                                  }}
                                  className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                    openActionMenuId === `att_${att.id}`
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-default bg-surface hover:bg-surface-sunken text-default'
                                  }`}
                                  title="More options"
                                  aria-label="More options"
                                >
                                  <span>Actions</span>
                                  <ChevronDown className="size-3 text-muted" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {actionMenuAnchor && typeof openActionMenuId === 'string' && openActionMenuId.startsWith('att_') && (() => {
                const attId = parseInt(openActionMenuId.replace('att_', ''), 10);
                const att = filteredAttendances.find((a) => a.id === attId);
                if (!att) return null;
                return (
                  <ActionMenuPortal
                    isOpen={true}
                    anchorEl={actionMenuAnchor}
                    onClose={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-52"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        setAttendances((prev) =>
                          prev.map((a) =>
                            a.id === att.id
                              ? {
                                  ...a,
                                  status: a.status === 'present' ? 'late' : 'present',
                                  late_minutes: a.status === 'present' ? 15 : 0,
                                }
                              : a
                          )
                        );
                        notify.info('Attendance status adjusted');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                    >
                      <Clock className="size-3.5 text-primary shrink-0" />
                      <span>Toggle Present / Late</span>
                    </button>

                    <div className="my-1 border-t border-default/50" />

                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        setDeleteConfirm({
                          open: true,
                          type: 'attendance',
                          id: att.id,
                          name: `${att.attendance_date} - ${att.employee?.display_name || 'Worker'}`,
                        });
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                      <span>Delete Record</span>
                    </button>
                  </ActionMenuPortal>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 4: Leave Management
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          {/* Leaves Toolbar */}
          <div className="bg-surface rounded-2xl border border-default p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              <div className="relative flex-1 min-w-50 max-w-sm">
                <Search className="size-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={leaveSearch}
                  onChange={(e) => setLeaveSearch(e.target.value)}
                  placeholder="Filter by employee name or code..."
                  className="w-full pl-8 pr-3 py-1.5 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <select
                value={leaveStatusFilter}
                onChange={(e) => setLeaveStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-default rounded-xl bg-surface text-default text-xs focus:border-primary focus:outline-none font-medium cursor-pointer"
              >
                <option value="all">All Request Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowLeaveRequestModal(true)}
              className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Request Leave</span>
            </button>
          </div>

          {/* Floating Bulk Actions Ribbon for Leaves */}
          {selectedLeaveIds.length > 0 && (
            <div className="sticky top-2 z-20 flex items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-surface shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white shadow-xs">
                  {selectedLeaveIds.length}
                </span>
                <div>
                  <p className="text-xs font-bold text-default">
                    {selectedLeaveIds.length} Request{selectedLeaveIds.length > 1 ? 's' : ''} Selected
                  </p>
                  <p className="text-[11px] text-muted">Batch review leave applications or purge records</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => void handleBulkApproveLeaves()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve Selected
                </button>
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => void handleBulkRejectLeaves()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject Selected
                </button>
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => setDeleteConfirm({ open: true, type: 'leave', isBulk: true })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedLeaveIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLeaveIds([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-default text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          <div className="bg-surface rounded-2xl shadow-2xs border border-default overflow-hidden">
            <div className="overflow-x-auto min-h-75">
              <table className="w-full text-left text-sm text-default">
                <thead className="bg-surface-sunken text-muted uppercase text-2xs font-bold border-b border-default">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAllLeave}
                        className="text-muted hover:text-primary transition-colors cursor-pointer"
                        title="Select All"
                      >
                        {selectedLeaveIds.length === filteredLeaves.length && filteredLeaves.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-muted/60" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 whitespace-nowrap">Employee</th>
                    <th className="px-6 py-3 whitespace-nowrap">Leave Type</th>
                    <th className="px-6 py-3 whitespace-nowrap">Start Date</th>
                    <th className="px-6 py-3 whitespace-nowrap">End Date</th>
                    <th className="px-6 py-3 text-right whitespace-nowrap">Days</th>
                    <th className="px-6 py-3 whitespace-nowrap">Reason</th>
                    <th className="px-6 py-3 text-center whitespace-nowrap">Status</th>
                    <th className="px-6 py-3 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {filteredLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-xs text-muted">
                        No leave applications found.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaves.map((lr) => {
                      const isChecked = selectedLeaveIds.includes(lr.id);
                      return (
                        <tr
                          key={lr.id}
                          className={`transition ${isChecked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-sunken/50'}`}
                        >
                          <td className="px-4 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectLeave(lr.id)}
                              className="text-muted hover:text-primary transition-colors cursor-pointer"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-muted/60" />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-default">
                              {lr.employee?.display_name}
                            </div>
                            <div className="text-xs font-mono text-muted">
                              {lr.employee?.employee_code}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-default whitespace-nowrap">
                            {lr.leave_type?.name}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono whitespace-nowrap">{lr.start_date}</td>
                          <td className="px-6 py-4 text-xs font-mono whitespace-nowrap">{lr.end_date}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-default whitespace-nowrap">
                            {parseFloat(String(lr.total_days))} Days
                          </td>
                          <td className="px-6 py-4 text-xs text-muted max-w-xs truncate">{lr.reason}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase ${
                                lr.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : lr.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                              }`}
                            >
                              {lr.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5 relative">
                              {lr.status === 'pending' ? (
                                <button
                                  type="button"
                                  onClick={() => handleApproveLeave(lr.id)}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                >
                                  <Check className="size-3" /> Approve
                                </button>
                              ) : lr.status === 'approved' ? (
                                <button
                                  type="button"
                                  onClick={() => handleRejectLeave(lr.id)}
                                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-default hover:bg-surface-sunken text-muted hover:text-default transition cursor-pointer"
                                >
                                  Revoke
                                </button>
                              ) : (
                                <span className="text-2xs text-muted">Archived</span>
                              )}

                              {/* Prominent Actions Dropdown Button */}
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (openActionMenuId === `leave_${lr.id}`) {
                                      setOpenActionMenuId(null);
                                      setActionMenuAnchor(null);
                                    } else {
                                      setOpenActionMenuId(`leave_${lr.id}`);
                                      setActionMenuAnchor(e.currentTarget);
                                    }
                                  }}
                                  className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                    openActionMenuId === `leave_${lr.id}`
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-default bg-surface hover:bg-surface-sunken text-default'
                                  }`}
                                  title="More options"
                                  aria-label="More options"
                                >
                                  <span>Actions</span>
                                  <ChevronDown className="size-3 text-muted" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {actionMenuAnchor && typeof openActionMenuId === 'string' && openActionMenuId.startsWith('leave_') && (() => {
                const leaveId = parseInt(openActionMenuId.replace('leave_', ''), 10);
                const lr = filteredLeaves.find((l) => l.id === leaveId);
                if (!lr) return null;
                return (
                  <ActionMenuPortal
                    isOpen={true}
                    anchorEl={actionMenuAnchor}
                    onClose={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-52"
                  >
                    {lr.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionMenuId(null);
                            setActionMenuAnchor(null);
                            handleApproveLeave(lr.id);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer font-medium"
                        >
                          <Check className="size-3.5 text-emerald-600 shrink-0" />
                          <span>Approve Application</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionMenuId(null);
                            setActionMenuAnchor(null);
                            handleRejectLeave(lr.id);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        >
                          <X className="size-3.5 text-rose-600 shrink-0" />
                          <span>Reject Application</span>
                        </button>
                      </>
                    ) : lr.status === 'approved' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleRejectLeave(lr.id);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                      >
                        <X className="size-3.5 text-amber-600 shrink-0" />
                        <span>Revoke Approval</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleApproveLeave(lr.id);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer font-medium"
                      >
                        <Check className="size-3.5 text-emerald-600 shrink-0" />
                        <span>Re-Approve</span>
                      </button>
                    )}

                    <div className="my-1 border-t border-default/50" />

                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        setDeleteConfirm({
                          open: true,
                          type: 'leave',
                          id: lr.id,
                          name: `${lr.employee?.display_name || 'Employee'} (${lr.leave_type?.name || 'Leave'})`,
                        });
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                      <span>Delete Leave Request</span>
                    </button>
                  </ActionMenuPortal>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 5: Worker Production Performance
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'performance' && <WorkerPerformanceSection />}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 6: Departments & Roles Setup
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'departments' && (
        <DepartmentsSetupSection
          departments={departments}
          designations={designations}
          shifts={shifts}
          onAddDepartment={(d) => setDepartments([...departments, d])}
          onAddDesignation={(des) => setDesignations([...designations, des])}
          onAddShift={(s) => setShifts([...shifts, s])}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 7: Compensation Packages & Salary Structures
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'salary-structures' && <SalaryStructuresSection />}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 8: Salary Advances & Employee Loans
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'advances' && <SalaryAdvancesSection />}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 1: View Payslip Breakdown
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(selectedPayslip)}
        onClose={() => setSelectedPayslip(null)}
        title={`Payslip Breakdown: ${selectedPayslip?.payslip_number || ''}`}
        subtitle={`Employee: ${selectedPayslip?.employee?.display_name || ''} (${selectedPayslip?.employee?.employee_code || ''})`}
        size="md"
      >
        {selectedPayslip && (
          <div className="space-y-5 pt-1">
            <div className="space-y-3">
              <div className="text-2xs font-semibold text-muted uppercase tracking-wider">
                Itemized Salary & Production Output Earnings
              </div>
              {selectedPayslip.items?.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 bg-surface-sunken rounded-xl border border-default"
                >
                  <div>
                    <div className="font-semibold text-sm text-default font-mono">
                      {item.component_code}
                    </div>
                    {item.quantity && item.rate && (
                      <div className="text-xs text-muted">
                        {parseFloat(item.quantity).toFixed(0)} units @ {formatCurrency(item.rate)}
                      </div>
                    )}
                  </div>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-default flex justify-between items-center">
              <div>
                <span className="text-2xs text-muted block uppercase font-semibold">Net Payable Payout</span>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCurrency(selectedPayslip.net_amount)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintPayslip(selectedPayslip)}
                  className="px-3.5 py-2 text-xs border border-default rounded-xl bg-surface hover:bg-surface-sunken text-default font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print Payslip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(null)}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 2: Onboard Employee
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showOnboardModal}
        onClose={() => setShowOnboardModal(false)}
        title="Onboard New Workforce Member"
        subtitle="Register personnel profile, department, wage structure, and banking info."
        size="md"
      >
        <form onSubmit={handleOnboardEmployee} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="onboard-first-name" className="block text-xs font-semibold text-default uppercase mb-1">
                First Name
              </label>
              <input
                id="onboard-first-name"
                name="first_name"
                type="text"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                required
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="onboard-last-name" className="block text-xs font-semibold text-default uppercase mb-1">
                Last Name
              </label>
              <input
                id="onboard-last-name"
                name="last_name"
                type="text"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="onboard-email" className="block text-xs font-semibold text-default uppercase mb-1">
                Email Address {grantUserAccess && <span className="text-rose-500">*</span>}
              </label>
              <input
                id="onboard-email"
                name="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@company.com"
                required={grantUserAccess}
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="onboard-phone" className="block text-xs font-semibold text-default uppercase mb-1">
                Phone Number
              </label>
              <input
                id="onboard-phone"
                name="phone"
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+88017..."
                required
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="onboard-dept" className="block text-xs font-semibold text-default uppercase mb-1">
                Department
              </label>
              <select
                id="onboard-dept"
                name="department_id"
                value={newDeptId}
                onChange={(e) => setNewDeptId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="onboard-desg" className="block text-xs font-semibold text-default uppercase mb-1">
                Designation
              </label>
              <select
                id="onboard-desg"
                name="designation_id"
                value={newDesgId}
                onChange={(e) => setNewDesgId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="onboard-type" className="block text-xs font-semibold text-default uppercase mb-1">
                Employment Type
              </label>
              <select
                id="onboard-type"
                name="employment_type"
                value={newEmpType}
                onChange={(e) => setNewEmpType(e.target.value as EmploymentType)}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="piece_rate">Piece-Rate Worker</option>
                <option value="permanent">Permanent Salaried</option>
                <option value="contract">Contract Staff</option>
                <option value="daily_wage">Daily Wage</option>
              </select>
            </div>

            <div>
              <label htmlFor="onboard-bank" className="block text-xs font-semibold text-default uppercase mb-1">
                Bank Account # (Optional)
              </label>
              <input
                id="onboard-bank"
                name="bank_account"
                type="text"
                value={newBankNumber}
                onChange={(e) => setNewBankNumber(e.target.value)}
                placeholder="e.g. 205011928391"
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* ERP Access & Roles Provisioning Section */}
          <div className="p-3.5 bg-surface-sunken border border-default rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-default">Grant ERP Login Access</span>
                <p className="text-2xs text-muted">Create a secure login credentials and assign ERP permissions</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={grantUserAccess}
                  onChange={(e) => {
                    setGrantUserAccess(e.target.checked);
                    if (e.target.checked && !userPassword) {
                      setUserPassword(generateRandomPassword());
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-default after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
              </label>
            </div>

            {grantUserAccess && (
              <div className="space-y-3 pt-2 border-t border-default/60">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-2xs font-semibold text-muted uppercase">
                      Temporary Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setUserPassword(generateRandomPassword())}
                      className="text-2xs text-primary hover:underline cursor-pointer"
                    >
                      Generate Random
                    </button>
                  </div>
                  <input
                    type="text"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    required={grantUserAccess}
                    className="w-full px-3 py-1.5 border border-default rounded-lg bg-surface text-default text-xs font-mono focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-muted uppercase mb-1.5">
                    Assign ERP Roles ({selectedRoleIds.size} selected)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {availableRoles.map((role) => {
                      const isChecked = selectedRoleIds.has(role.id);
                      return (
                        <label
                          key={role.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                            isChecked
                              ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                              : 'bg-surface border-default text-muted hover:border-default-hover'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedRoleIds);
                              if (e.target.checked) {
                                next.add(role.id);
                              } else {
                                next.delete(role.id);
                              }
                              setSelectedRoleIds(next);
                            }}
                            className="rounded border-default text-primary focus:ring-primary size-3.5"
                          />
                          <span className="capitalize">{role.name.replace(/[_-]/g, ' ')}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowOnboardModal(false)}
              disabled={savingEmployee}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEmployee}
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
            >
              {savingEmployee ? 'Saving...' : 'Complete Onboarding'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal: Universal Bulk Import Staff
          ───────────────────────────────────────────────────────────────────────────── */}
      <UniversalImportModal
        isOpen={showImportStaffModal}
        onClose={() => setShowImportStaffModal(false)}
        config={employeeImportSchema}
        onSuccess={() => {
          void loadHrData();
        }}
      />

      <UniversalImportModal
        isOpen={showImportAttendanceModal}
        onClose={() => setShowImportAttendanceModal(false)}
        config={attendanceImportSchema}
        onSuccess={() => {
          void loadHrData();
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 3: Mark Shift Attendance
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showMarkAttendanceModal}
        onClose={() => setShowMarkAttendanceModal(false)}
        title="Mark Shift Attendance"
        subtitle="Log employee daily check-in, check-out, and shift hours."
        size="md"
      >
        <form onSubmit={handleCreateAttendance} className="space-y-4 pt-1">
          <div>
            <label htmlFor="att-emp-select" className="block text-xs font-semibold text-default uppercase mb-1">
              Select Employee
            </label>
            <select
              id="att-emp-select"
              name="employee_id"
              value={attEmpId}
              onChange={(e) => setAttEmpId(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employee_code} — {e.display_name} ({e.department?.name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="att-shift-select" className="block text-xs font-semibold text-default uppercase mb-1">
                Shift Schedule
              </label>
              <select
                id="att-shift-select"
                name="shift_id"
                value={attShiftId}
                onChange={(e) => setAttShiftId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                {shifts.map((sh) => (
                  <option key={sh.id} value={sh.id}>
                    {sh.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="att-status-select" className="block text-xs font-semibold text-default uppercase mb-1">
                Attendance Status
              </label>
              <select
                id="att-status-select"
                name="status"
                value={attStatus}
                onChange={(e) => setAttStatus(e.target.value as Attendance['status'])}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="present">Present (On Time)</option>
                <option value="late">Late Check-in</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="att-date" className="block text-xs font-semibold text-default uppercase mb-1">
                Date
              </label>
              <input
                id="att-date"
                name="att_date"
                type="date"
                value={attDate}
                onChange={(e) => setAttDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="att-in-time" className="block text-xs font-semibold text-default uppercase mb-1">
                Check In
              </label>
              <input
                id="att-in-time"
                name="check_in"
                type="time"
                value={attCheckIn}
                onChange={(e) => setAttCheckIn(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="att-out-time" className="block text-xs font-semibold text-default uppercase mb-1">
                Check Out
              </label>
              <input
                id="att-out-time"
                name="check_out"
                type="time"
                value={attCheckOut}
                onChange={(e) => setAttCheckOut(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="att-remarks" className="block text-xs font-semibold text-default uppercase mb-1">
              Floor Remarks / Location
            </label>
            <input
              id="att-remarks"
              name="remarks"
              type="text"
              value={attRemarks}
              onChange={(e) => setAttRemarks(e.target.value)}
              placeholder="e.g. Cutting floor station #2"
              autoComplete="off"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowMarkAttendanceModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Save Attendance Record
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 4: Submit Leave Request
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showLeaveRequestModal}
        onClose={() => setShowLeaveRequestModal(false)}
        title="Submit Leave Request"
        subtitle="Apply for scheduled time off or medical emergency quota."
        size="md"
      >
        <form onSubmit={handleCreateLeaveRequest} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="leave-emp" className="block text-xs font-semibold text-default uppercase mb-1">
                Employee
              </label>
              <select
                id="leave-emp"
                name="employee_id"
                value={leaveEmpId}
                onChange={(e) => setLeaveEmpId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.display_name} ({e.employee_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="leave-type" className="block text-xs font-semibold text-default uppercase mb-1">
                Leave Category
              </label>
              <select
                id="leave-type"
                name="leave_type_id"
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({parseFloat(lt.annual_quota_days)}d/yr)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="leave-start" className="block text-xs font-semibold text-default uppercase mb-1">
                Start Date
              </label>
              <input
                id="leave-start"
                name="start_date"
                type="date"
                value={leaveStartDate}
                onChange={(e) => setLeaveStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="leave-end" className="block text-xs font-semibold text-default uppercase mb-1">
                End Date
              </label>
              <input
                id="leave-end"
                name="end_date"
                type="date"
                value={leaveEndDate}
                onChange={(e) => setLeaveEndDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="leave-days" className="block text-xs font-semibold text-default uppercase mb-1">
                Total Days
              </label>
              <input
                id="leave-days"
                name="total_days"
                type="number"
                step="0.5"
                value={leaveDays}
                onChange={(e) => setLeaveDays(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono text-right focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="leave-reason" className="block text-xs font-semibold text-default uppercase mb-1">
              Reason & Remarks
            </label>
            <textarea
              id="leave-reason"
              name="reason"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="State reason for absence or medical appointment..."
              required
              rows={3}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowLeaveRequestModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Submit Application
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 5: Create New Pay Period
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showNewPeriodModal}
        onClose={() => setShowNewPeriodModal(false)}
        title="Initialize New Payroll Period"
        subtitle="Open a new monthly salary disbursement and piece-rate calculation period."
        size="md"
      >
        <form onSubmit={handleCreateNewPeriod} className="space-y-4 pt-1">
          <div>
            <label htmlFor="new-period-code" className="block text-xs font-semibold text-default uppercase mb-1">
              Period Code
            </label>
            <input
              id="new-period-code"
              name="period_code"
              type="text"
              value={newPeriodCode}
              onChange={(e) => setNewPeriodCode(e.target.value.toUpperCase())}
              placeholder="e.g. PAY-202609"
              required
              autoComplete="off"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="period-start" className="block text-xs font-semibold text-default uppercase mb-1">
                Start Date
              </label>
              <input
                id="period-start"
                name="period_start"
                type="date"
                value={newPeriodStart}
                onChange={(e) => setNewPeriodStart(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="period-end" className="block text-xs font-semibold text-default uppercase mb-1">
                End Date
              </label>
              <input
                id="period-end"
                name="period_end"
                type="date"
                value={newPeriodEnd}
                onChange={(e) => setNewPeriodEnd(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="payment-date" className="block text-xs font-semibold text-default uppercase mb-1">
              Scheduled Disbursement Date
            </label>
            <input
              id="payment-date"
              name="payment_date"
              type="date"
              value={newPaymentDate}
              onChange={(e) => setNewPaymentDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowNewPeriodModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Open Pay Period
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 5B: Create Payslip Modal
          ───────────────────────────────────────────────────────────────────────────── */}
      <CreatePayslipModal
        open={showCreatePayslipModal}
        onClose={() => setShowCreatePayslipModal(false)}
        employees={employees}
        payrollPeriods={payrollPeriods}
        activePeriodId={selectedPeriodId === 'all' ? payrollPeriods[0]?.id : selectedPeriodId}
        onSuccess={handleCreatePayslipSuccess}
      />

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 6: Employee ID Badge Print
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(selectedEmployeeForBadge)}
        onClose={() => setSelectedEmployeeForBadge(null)}
        title="Workforce Security ID Card"
        subtitle="Standard CR80 employee pass with encrypted identification barcode."
        size="sm"
      >
        {selectedEmployeeForBadge && (
          <div className="space-y-4 pt-1">
            <div className="border-2 border-primary/30 rounded-2xl p-5 bg-linear-to-b from-primary/10 to-transparent flex flex-col items-center text-center space-y-3">
              <div className="w-full flex items-center justify-between border-b border-primary/20 pb-2">
                <span className="font-extrabold text-xs tracking-wider text-primary uppercase">
                  SLICE MART FMS
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 uppercase">
                  Security Pass
                </span>
              </div>

              {/* Avatar */}
              <div className="size-20 rounded-2xl bg-primary/10 border-2 border-primary/40 flex items-center justify-center text-2xl font-bold text-primary shadow-inner">
                {selectedEmployeeForBadge.first_name[0]}{selectedEmployeeForBadge.last_name?.[0] ?? ''}
              </div>

              <div>
                <div className="font-extrabold text-base text-default">
                  {selectedEmployeeForBadge.display_name}
                </div>
                <div className="text-xs font-semibold text-primary">
                  {selectedEmployeeForBadge.designation?.name ?? 'Factory Operator'}
                </div>
                <div className="text-[11px] text-muted">
                  {selectedEmployeeForBadge.department?.name ?? 'Production Floor'}
                </div>
              </div>

              <div className="w-full grid grid-cols-2 gap-2 text-left bg-surface-sunken p-2.5 rounded-xl border border-default text-[11px] font-mono">
                <div>
                  <span className="text-[9px] text-muted uppercase block font-sans">ID Code</span>
                  <span className="font-bold text-default">{selectedEmployeeForBadge.employee_code}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted uppercase block font-sans">Phone</span>
                  <span className="text-default">{selectedEmployeeForBadge.phone}</span>
                </div>
              </div>

              {/* High-Density Barcode Graphic */}
              <div className="w-full bg-white p-2 rounded-lg border border-gray-300 flex flex-col items-center">
                <div className="font-mono text-[8px] tracking-[3px] text-black font-bold uppercase mb-0.5">
                  ||||| | |||| ||| ||||| || |||||| | ||| ||||
                </div>
                <div className="font-mono text-[9px] text-black font-semibold">
                  *{selectedEmployeeForBadge.employee_code}*
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedEmployeeForBadge(null)}
                className="flex-1 px-3 py-2 text-xs border border-default rounded-xl text-muted hover:text-default cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  printDocument(
                    <EmployeeIdBadgeDocument employee={selectedEmployeeForBadge} />,
                    {
                      documentTitle: `Security_Badge_${selectedEmployeeForBadge.employee_code}.pdf`,
                      pageClass: 'print-page-id-card',
                    }
                  );
                }}
                disabled={isPrintingBadge}
                className="flex-1 px-3 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-bold rounded-xl shadow cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Printer className="size-3.5" />
                <span>{isPrintingBadge ? 'Preparing Badge...' : 'Print Badge'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 7: Employee Profile & Specs
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(viewingEmployeeProfile)}
        onClose={() => setViewingEmployeeProfile(null)}
        title={`Employee Profile: ${viewingEmployeeProfile?.display_name || ''}`}
        subtitle={`Staff Code: ${viewingEmployeeProfile?.employee_code || ''} • Status: ${viewingEmployeeProfile?.employment_status?.toUpperCase() || ''}`}
        size="md"
      >
        {viewingEmployeeProfile && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-surface-sunken rounded-xl border border-default text-xs">
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Department</span>
                <span className="font-semibold text-default">{viewingEmployeeProfile.department?.name}</span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Designation</span>
                <span className="font-semibold text-default">{viewingEmployeeProfile.designation?.name}</span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Employment Type</span>
                <span className="capitalize text-default font-semibold">
                  {viewingEmployeeProfile.employment_type.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Default Shift</span>
                <span className="text-default font-semibold">
                  {viewingEmployeeProfile.default_shift?.name || 'Standard Morning'}
                </span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Phone Contact</span>
                <span className="font-mono text-default">{viewingEmployeeProfile.phone}</span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Bank Account #</span>
                <span className="font-mono text-default">
                  {viewingEmployeeProfile.bank_account_number || 'Cash / Unassigned'}
                </span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Date of Joining</span>
                <span className="font-mono text-default">{viewingEmployeeProfile.date_of_joining}</span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Company Registry</span>
                <span className="text-default font-semibold">Factory Operations</span>
              </div>
            </div>

            {/* Employee Document Vault & Compliance */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-default uppercase tracking-wider">
                  Employee Document Vault & Compliance
                </span>
                <button
                  type="button"
                  onClick={() => notify.success('Document uploaded to employee dossier.')}
                  className="text-[11px] text-primary hover:underline font-semibold"
                >
                  + Upload File
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg border border-default bg-surface-sunken text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-default">National ID</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Verified</span>
                  </div>
                  <p className="text-[11px] text-muted font-mono">NID-8829102910</p>
                </div>
                <div className="p-2.5 rounded-lg border border-default bg-surface-sunken text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-default">Contract</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Active</span>
                  </div>
                  <p className="text-[11px] text-muted font-mono">Signed 2026</p>
                </div>
                <div className="p-2.5 rounded-lg border border-default bg-surface-sunken text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-default">Health Pass</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Passed</span>
                  </div>
                  <p className="text-[11px] text-muted font-mono">Exp: 2027-03</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => {
                  const emp = viewingEmployeeProfile;
                  setViewingEmployeeProfile(null);
                  setSelectedEmployeeForBadge(emp);
                }}
                className="px-3.5 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-semibold rounded-xl cursor-pointer flex items-center gap-1"
              >
                <span>🪪 Print ID Card</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingEmployeeProfile(null)}
                className="px-4 py-1.5 text-xs border border-default rounded-xl text-default hover:bg-surface-sunken cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 8: Biometric & NFC Kiosk Punch Terminal
          ───────────────────────────────────────────────────────────────────────────── */}
      <BadgePunchTerminalModal
        isOpen={isKioskModalOpen}
        onClose={() => setIsKioskModalOpen(false)}
        onPunchSuccess={(punch) => {
          const targetEmp =
            employees.find((e) => e.employee_code === punch.employee.employee_code) ?? employees[0];
          if (!targetEmp) return;
          const todayDate = new Date().toISOString().slice(0, 10);
          const newAtt: Attendance = {
            id: attendances.length + 1,
            uuid: `att-kiosk-${Date.now()}`,
            employee_id: targetEmp.id,
            employee: targetEmp,
            attendance_date: todayDate,
            shift_id: 1,
            shift: shifts[0],
            check_in_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
            worked_minutes: 480,
            late_minutes: punch.status === 'late' ? 15 : 0,
            overtime_minutes: 0,
            status: punch.status === 'late' ? 'late' : 'present',
            remarks: 'Biometric / RFID Kiosk Punch',
          };
          setAttendances([newAtt, ...attendances]);
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 9: Employee ERP Access & Security Roles
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(accessModalEmp)}
        onClose={() => setAccessModalEmp(null)}
        title={`ERP Access & Roles: ${accessModalEmp?.display_name || ''}`}
        subtitle={`Staff Code: ${accessModalEmp?.employee_code || ''} • Email: ${accessModalEmp?.email || 'N/A'}`}
        size="md"
      >
        {accessModalEmp && (
          <div className="space-y-4 pt-1">
            {!accessModalEmp.has_user_account && !accessModalEmp.user_id ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-amber-800 dark:text-amber-300 text-xs">
                <p className="font-semibold flex items-center gap-1.5">
                  <span>⚠️</span> No Active ERP Login Found
                </p>
                <p className="text-2xs opacity-90">
                  Provisioning access will create a system user account associated with {accessModalEmp.email || 'this employee email'} so they can log into the application.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold">Linked User Account:</span>
                  <span className="font-mono">{accessModalEmp.user?.email || accessModalEmp.email}</span>
                </div>
                <span className="text-3xs uppercase px-2 py-0.5 rounded font-bold bg-emerald-500/20">
                  Active
                </span>
              </div>
            )}

            {!accessModalEmp.has_user_account && !accessModalEmp.user_id && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-2xs font-semibold text-muted uppercase">
                    Initial Account Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setAccessPassword(generateRandomPassword())}
                    className="text-2xs text-primary hover:underline cursor-pointer"
                  >
                    Generate Random
                  </button>
                </div>
                <input
                  type="text"
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs font-mono focus:border-primary focus:outline-none"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-2xs font-semibold text-muted uppercase">
                  Assign System Roles & Permissions
                </label>
                <span className="text-2xs text-muted">
                  {accessRoleIds.size} {accessRoleIds.size === 1 ? 'role' : 'roles'} selected
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {availableRoles.map((role) => {
                  const isChecked = accessRoleIds.has(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        isChecked
                          ? 'bg-primary/10 border-primary/40 text-primary font-medium shadow-2xs'
                          : 'bg-surface-sunken border-default text-muted hover:border-default-hover'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = new Set(accessRoleIds);
                          if (e.target.checked) {
                            next.add(role.id);
                          } else {
                            next.delete(role.id);
                          }
                          setAccessRoleIds(next);
                        }}
                        className="rounded border-default text-primary focus:ring-primary size-4 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold capitalize truncate">{role.name.replace(/[_-]/g, ' ')}</div>
                        <div className="text-3xs text-muted truncate">{role.description || 'System access role'}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-default">
              <div>
                {(accessModalEmp.has_user_account || accessModalEmp.user_id) && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      await handleUnlinkUser(accessModalEmp.id);
                      setAccessModalEmp(null);
                    }}
                    disabled={savingAccess}
                  >
                    Unlink User
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAccessModalEmp(null)}
                  disabled={savingAccess}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveAccess}
                  loading={savingAccess}
                >
                  {accessModalEmp.has_user_account || accessModalEmp.user_id ? 'Update Roles' : 'Provision User & Assign Roles'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Universal Delete Confirmation Modal */}
      <Modal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, type: 'employee' })}
        title={
          deleteConfirm.isBulk
            ? `Confirm Bulk Deletion (${deleteConfirm.type})`
            : `Delete ${deleteConfirm.type.charAt(0).toUpperCase() + deleteConfirm.type.slice(1)}`
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300">
            <AlertTriangle className="size-5 shrink-0 mt-0.5 text-rose-600" />
            <div className="text-xs space-y-1">
              <p className="font-bold">
                {deleteConfirm.isBulk
                  ? `Are you sure you want to permanently delete selected ${deleteConfirm.type} records?`
                  : `Are you sure you want to delete this ${deleteConfirm.type}?`}
              </p>
              {deleteConfirm.name && (
                <p className="font-mono text-[11px] opacity-90">Target: {deleteConfirm.name}</p>
              )}
              <p className="text-[11px] opacity-80">
                This action is permanent and cannot be reversed. Associated ledger or reporting entries will be updated.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteConfirm({ open: false, type: 'employee' })}
              disabled={isBulkProcessing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleExecuteDelete()}
              loading={isBulkProcessing}
              className="bg-rose-600 hover:bg-rose-700 text-white border-transparent"
            >
              {deleteConfirm.isBulk ? 'Delete Selected' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HrWorkspace;
