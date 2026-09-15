/**
 * SliceMart HR & Workforce API Service Layer
 * Fully typed client communicating with Laravel backend /api/v1/hr/*
 */

import { api } from '../../../lib/api/client';

export interface EmployeeApiItem {
  id: number;
  uuid?: string;
  employee_code: string;
  first_name: string;
  last_name?: string;
  full_name?: string;
  display_name: string;
  email?: string;
  phone: string;
  employment_type?: string;
  designation?: string;
  department?: string;
  department_id?: number;
  shift?: string;
  status: 'active' | 'on_leave' | 'suspended' | 'resigned' | 'terminated';
  date_of_joining?: string;
  bank_name?: string;
  bank_account_number?: string;
  mobile_wallet_number?: string;
  national_id?: string;
}

export interface DepartmentApiItem {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  employees_count?: number;
}

export interface DesignationApiItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  employees_count?: number;
}

export interface ShiftApiItem {
  id: number;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_in_minutes: number;
  is_active: boolean;
  employees_count?: number;
}

export interface AttendanceApiItem {
  id: number;
  employee_id: number;
  attendance_date: string;
  check_in_at?: string;
  check_out_at?: string;
  working_hours?: number;
  status: 'present' | 'late' | 'absent' | 'half_day' | 'on_leave' | 'holiday';
  employee?: {
    display_name?: string;
    first_name?: string;
    employee_code?: string;
    department?: { name: string };
    designation?: { name: string };
  };
  shift?: {
    name: string;
    start_time: string;
    end_time: string;
  };
}

export interface AttendanceSummaryApi {
  date: string;
  total_workforce: number;
  present: number;
  late: number;
  absent: number;
  on_leave: number;
  present_rate_percent: number;
}

export interface BadgePunchResult {
  success: boolean;
  type: 'clock_in' | 'clock_out';
  status?: string;
  message: string;
  employee: {
    id: number;
    name: string;
    employee_code: string;
    department?: string;
    designation?: string;
  };
}

export interface LeaveRequestApiItem {
  id: number;
  request_number: string;
  employee_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  total_days: string | number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  employee?: {
    display_name?: string;
    employee_code?: string;
    department?: { name: string };
  };
  leaveType?: {
    name: string;
    code: string;
  };
}

export interface LeaveBalanceApiItem {
  id: number;
  employee_id: number;
  leave_type_id: number;
  year: number;
  opening_days: number | string;
  accrued_days: number | string;
  used_days: number | string;
  balance_days: number | string;
  leave_type?: {
    name: string;
    code: string;
  };
}

export interface SalaryStructureApiItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  currency_code?: string;
  currency?: string;
  employees_count?: number;
  is_active: boolean;
  components?: Array<{
    id?: number;
    salary_structure_id?: number;
    component_id?: number;
    salary_component_id?: number;
    calculation_type?: 'fixed' | 'percentage';
    calculation?: 'fixed' | 'percentage';
    amount_or_percentage?: string | number;
    value?: number;
    name?: string;
    type?: 'earning' | 'deduction';
    sort_order?: number;
    component?: {
      code: string;
      name: string;
      component_type: 'earning' | 'deduction';
      is_taxable: boolean;
    };
  }>;
}

export interface SalaryComponentApiItem {
  id: number;
  code: string;
  name: string;
  component_type: 'earning' | 'deduction';
  is_taxable: boolean;
  affects_gross: boolean;
}

export interface PayrollPeriodApiItem {
  id: number;
  period_code: string;
  pay_frequency: string;
  period_start: string;
  period_end: string;
  payment_date: string;
  status: 'open' | 'processing' | 'approved' | 'paid' | 'locked';
  total_gross: string | number;
  total_deductions: string | number;
  total_net: string | number;
  employee_count: number;
}

export interface PayslipApiItem {
  id: number;
  payslip_number: string;
  payroll_period_id: number;
  employee_id: number;
  gross_salary: string | number;
  total_deductions: string | number;
  net_salary: string | number;
  status: 'draft' | 'approved' | 'paid';
  employee?: {
    display_name?: string;
    employee_code?: string;
    department?: { name: string };
    designation?: { name: string };
  };
  items?: Array<{
    id: number;
    component_id: number;
    amount: string | number;
    component?: {
      name: string;
      component_type: 'earning' | 'deduction';
    };
  }>;
}

export interface PayrollAdvanceApiItem {
  id: number;
  advance_number: string;
  employee_id: number;
  amount: string | number;
  issued_on: string;
  installment_amount: string | number;
  recovered_amount: string | number;
  status: 'active' | 'recovered' | 'written_off';
  notes?: string;
  employee?: {
    display_name?: string;
    employee_code?: string;
    department?: { name: string };
  };
}

export type ApiPayrollAdvance = PayrollAdvanceApiItem & {
  employee_name?: string;
  employee_code?: string;
  department?: string;
  request_date?: string;
  created_at?: string;
  reason?: string;
};

export type ApiSalaryStructure = SalaryStructureApiItem;

export interface EmployeeDocumentApiItem {
  id: number;
  employee_id: number;
  document_type: 'nid' | 'contract' | 'certificate' | 'photo' | 'health_pass' | 'other';
  issued_on?: string;
  expires_on?: string;
  notes?: string;
  created_at?: string;
}

export const hrApi = {
  // Employees
  async getEmployees(params?: { search?: string; department_id?: number; employment_type?: string; employment_status?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.department_id) query.set('department_id', String(params.department_id));
    if (params?.employment_type) query.set('employment_type', params.employment_type);
    if (params?.employment_status) query.set('employment_status', params.employment_status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ data: EmployeeApiItem[] }>(`/hr/employees${qs}`);
  },

  async createEmployee(payload: Record<string, unknown>) {
    return api.post<{ data: EmployeeApiItem; message: string }>('/hr/employees', payload);
  },

  async createWorkforceEmployee(payload: Record<string, unknown>) {
    return api.post<{ data: EmployeeApiItem; message: string }>('/workforce/employees', payload);
  },

  async getEmployeeById(id: number) {
    return api.get<{ data: EmployeeApiItem }>(`/hr/employees/${id}`);
  },

  async getWorkforceEmployeeById(id: number) {
    return api.get<{ data: EmployeeApiItem }>(`/workforce/employees/${id}`);
  },

  async linkUser(id: number, user_id: number) {
    return api.post<{ success: boolean; message: string }>(`/hr/employees/${id}/link-user`, { user_id });
  },

  async unlinkUser(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/employees/${id}/unlink-user`);
  },

  async updateEmployee(id: number, payload: Record<string, unknown>) {
    return api.put<{ data: EmployeeApiItem; message: string }>(`/hr/employees/${id}`, payload);
  },

  async toggleEmployeeStatus(id: number) {
    return api.post<{ data: EmployeeApiItem; message: string }>(`/hr/employees/${id}/toggle-status`);
  },

  async getEmployeeDocuments(id: number) {
    return api.get<{ data: EmployeeDocumentApiItem[] }>(`/hr/employees/${id}/documents`);
  },

  async addEmployeeDocument(id: number, payload: { document_type: string; notes?: string; expires_on?: string }) {
    return api.post<{ data: EmployeeDocumentApiItem; message: string }>(`/hr/employees/${id}/documents`, payload);
  },

  // Departments, Designations & Shifts
  async getDepartments(activeOnly = false) {
    return api.get<{ data: DepartmentApiItem[] }>(`/hr/departments${activeOnly ? '?active_only=1' : ''}`);
  },

  async createDepartment(payload: { code: string; name: string; is_active?: boolean }) {
    return api.post<{ data: DepartmentApiItem; message: string }>('/hr/departments', payload);
  },

  async updateDepartment(id: number, payload: Partial<DepartmentApiItem>) {
    return api.put<{ data: DepartmentApiItem; message: string }>(`/hr/departments/${id}`, payload);
  },

  async getDesignations(activeOnly = false) {
    return api.get<{ data: DesignationApiItem[] }>(`/hr/designations${activeOnly ? '?active_only=1' : ''}`);
  },

  async createDesignation(payload: { code: string; name: string; description?: string; is_active?: boolean }) {
    return api.post<{ data: DesignationApiItem; message: string }>('/hr/designations', payload);
  },

  async updateDesignation(id: number, payload: Partial<DesignationApiItem>) {
    return api.put<{ data: DesignationApiItem; message: string }>(`/hr/designations/${id}`, payload);
  },

  async getShifts(activeOnly = false) {
    return api.get<{ data: ShiftApiItem[] }>(`/hr/shifts${activeOnly ? '?active_only=1' : ''}`);
  },

  async getWorkforceShifts() {
    return api.get<{ data: ShiftApiItem[] }>('/workforce/shifts');
  },

  async createShift(payload: { code: string; name: string; start_time: string; end_time: string; break_minutes?: number; grace_in_minutes?: number }) {
    return api.post<{ data: ShiftApiItem; message: string }>('/hr/shifts', payload);
  },

  async updateShift(id: number, payload: Partial<ShiftApiItem>) {
    return api.put<{ data: ShiftApiItem; message: string }>(`/hr/shifts/${id}`, payload);
  },

  // Attendance & Badge Kiosk
  async getAttendance(params?: { date?: string; employee_id?: number; status?: string }) {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.employee_id) query.set('employee_id', String(params.employee_id));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ data: AttendanceApiItem[] }>(`/hr/attendance${qs}`);
  },

  async getAttendances(params?: { date?: string; employee_id?: number; status?: string }) {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.employee_id) query.set('employee_id', String(params.employee_id));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ data: AttendanceApiItem[] }>(`/hr/attendance${qs}`).catch(() => 
      api.get<{ data: AttendanceApiItem[] }>(`/hr/attendances${qs}`)
    );
  },

  async recordAttendance(payload: { employee_id: number; attendance_date: string; status?: string; shift_id?: number; check_in_at?: string; check_out_at?: string; remarks?: string }) {
    return api.post<{ data: AttendanceApiItem; message: string }>('/hr/attendance', payload).catch(() =>
      api.post<{ data: AttendanceApiItem; message: string }>('/hr/attendances', payload)
    );
  },

  async getAttendanceSummary(date?: string) {
    return api.get<AttendanceSummaryApi>(`/hr/attendances/summary${date ? `?date=${date}` : ''}`);
  },

  async punchBadge(badge_id: string, timestamp?: string) {
    return api.post<BadgePunchResult>('/hr/attendances/punch-badge', { badge_id, timestamp });
  },

  // Leaves & Balances
  async getLeaveRequests(params?: { status?: string; employee_id?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.employee_id) query.set('employee_id', String(params.employee_id));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ data: LeaveRequestApiItem[] }>(`/hr/leave-requests${qs}`).catch(() =>
      api.get<{ data: LeaveRequestApiItem[] }>(`/hr/leaves${qs}`)
    );
  },

  async getLeaves(params?: { status?: string; employee_id?: number }) {
    return this.getLeaveRequests(params);
  },

  async getLeaveTypes() {
    return api.get<{ data: Array<{ id: number; code: string; name: string; days_allowed: number }> }>('/hr/leave-requests/types').catch(() =>
      api.get<{ data: Array<{ id: number; code: string; name: string; days_allowed: number }> }>('/hr/leaves/types')
    );
  },

  async getLeaveBalances(params?: { employee_id?: number; year?: number }) {
    const query = new URLSearchParams();
    if (params?.employee_id) query.set('employee_id', String(params.employee_id));
    if (params?.year) query.set('year', String(params.year));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ data: LeaveBalanceApiItem[] }>(`/hr/leaves/balances${qs}`);
  },

  async submitLeaveRequest(payload: { employee_id: number; leave_type_id: number; start_date: string; end_date: string; total_days: number; reason?: string }) {
    return api.post<{ data: LeaveRequestApiItem; message: string }>('/hr/leave-requests', payload).catch(() =>
      api.post<{ data: LeaveRequestApiItem; message: string }>('/hr/leaves', payload)
    );
  },

  async approveLeave(id: number) {
    return api.post<{ data: LeaveRequestApiItem; message: string }>(`/hr/leaves/${id}/approve`);
  },

  async rejectLeave(id: number, rejection_reason?: string) {
    return api.post<{ data: LeaveRequestApiItem; message: string }>(`/hr/leaves/${id}/reject`, { rejection_reason });
  },

  // Salary Structures & Compensation
  async getSalaryStructures() {
    return api.get<{ data: SalaryStructureApiItem[] }>('/hr/salary-structures');
  },

  async getSalaryComponents() {
    return api.get<{ data: SalaryComponentApiItem[] }>('/hr/salary-structures/components');
  },

  async createSalaryStructure(payload: {
    code: string;
    name: string;
    description?: string;
    currency?: string;
    is_active?: boolean;
    components?: Array<{
      salary_component_id?: number;
      calculation_type?: 'fixed' | 'percentage';
      calculation?: 'fixed' | 'percentage';
      value?: number;
      name?: string;
      type?: 'earning' | 'deduction';
      [key: string]: unknown;
    }>;
  }) {
    return api.post<SalaryStructureApiItem>('/hr/salary-structures', payload);
  },

  // Payroll Periods, Payslips & Advances
  async getPayrollPeriods() {
    return api.get<{ data: PayrollPeriodApiItem[] }>('/hr/payroll/periods');
  },

  async createPayrollPeriod(payload: { period_code: string; pay_frequency: string; period_start: string; period_end: string; payment_date: string }) {
    return api.post<{ data: PayrollPeriodApiItem; message: string }>('/hr/payroll/periods', payload);
  },

  async processPayrollPeriod(id: number) {
    return api.post<{ data: PayrollPeriodApiItem; message: string }>(`/hr/payroll/periods/${id}/process`);
  },

  async disbursePayrollPeriod(id: number, payload?: { bank_reference?: string; payment_method?: string }) {
    return api.post<{ data: PayrollPeriodApiItem; message: string }>(`/hr/payroll/periods/${id}/disburse`, payload);
  },

  async getBankAdvice(id: number) {
    return api.get<{ period_code: string; total_net: number; advice_records: Array<Record<string, unknown>> }>(`/hr/payroll/periods/${id}/bank-advice`);
  },

  async getPayslips(params?: { payroll_period_id?: number; employee_id?: number }) {
    const query = new URLSearchParams();
    if (params?.payroll_period_id) query.set('payroll_period_id', String(params.payroll_period_id));
    if (params?.employee_id) query.set('employee_id', String(params.employee_id));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ data: PayslipApiItem[] }>(`/hr/payroll/payslips${qs}`);
  },

  async getPayslipById(id: number) {
    return api.get<{ data: PayslipApiItem }>(`/hr/payroll/payslips/${id}`);
  },

  async createPayslip(payload: {
    payroll_period_id: number;
    employee_id: number;
    gross_amount: number;
    total_deductions?: number | undefined;
    payment_method?: string | undefined;
    produced_quantity?: number | undefined;
    remarks?: string | undefined;
    items?: Array<{
      salary_component_id?: number | undefined;
      component_code?: string | undefined;
      component_name?: string | undefined;
      component_type: 'earning' | 'deduction';
      quantity?: number | undefined;
      rate?: number | undefined;
      amount: number;
    }> | undefined;
  }) {
    return api.post<{ data: PayslipApiItem; message: string }>('/hr/payroll/payslips', payload);
  },

  // Employee Deletion & Bulk
  async deleteEmployee(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/employees/${id}`);
  },

  async bulkDeleteEmployees(ids: number[]) {
    return api.post<{ success: boolean; message: string }>('/hr/employees/bulk-delete', { ids });
  },

  async bulkStatusEmployees(ids: number[], status: string) {
    return api.post<{ success: boolean; message: string }>('/hr/employees/bulk-status', { ids, status });
  },

  // Department Deletion & Bulk
  async deleteDepartment(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/departments/${id}`);
  },

  async bulkDeleteDepartments(ids: number[]) {
    return api.post<{ success: boolean; message: string }>('/hr/departments/bulk-delete', { ids });
  },

  // Designation Deletion & Bulk
  async deleteDesignation(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/designations/${id}`);
  },

  async bulkDeleteDesignations(ids: number[]) {
    return api.post<{ success: boolean; message: string }>('/hr/designations/bulk-delete', { ids });
  },

  // Shift Deletion & Bulk
  async deleteShift(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/shifts/${id}`);
  },

  async bulkDeleteShifts(ids: number[]) {
    return api.post<{ success: boolean; message: string }>('/hr/shifts/bulk-delete', { ids });
  },

  // Attendance Deletion & Bulk
  async deleteAttendance(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/attendances/${id}`);
  },

  async bulkDeleteAttendances(ids: number[]) {
    return api.post<{ success: boolean; message: string }>('/hr/attendances/bulk-delete', { ids });
  },

  async bulkStatusAttendances(ids: number[], status: string) {
    return api.post<{ success: boolean; message: string }>('/hr/attendances/bulk-status', { ids, status });
  },

  // Leave Deletion & Bulk
  async deleteLeave(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/leaves/${id}`);
  },

  async bulkApproveLeaves(ids: number[]) {
    return api.post<{ success: boolean; message: string }>('/hr/leaves/bulk-approve', { ids });
  },

  async bulkRejectLeaves(ids: number[], rejection_reason?: string) {
    return api.post<{ success: boolean; message: string }>('/hr/leaves/bulk-reject', { ids, rejection_reason });
  },

  async bulkDeleteLeaves(ids: number[]) {
    return api.post<{ success: boolean; message: string }>('/hr/leaves/bulk-delete', { ids });
  },

  // Salary Structures Deletion & Bulk
  async deleteSalaryStructure(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/salary-structures/${id}`);
  },

  async bulkDeleteSalaryStructures(ids: number[]) {
    return api.post<{ success: boolean; message: string }>('/hr/salary-structures/bulk-delete', { ids });
  },

  async toggleSalaryStructureStatus(id: number) {
    return api.post<{ success: boolean; message: string; data: unknown }>(`/hr/salary-structures/${id}/toggle-status`);
  },

  // Payroll Deletion & Bulk
  async deletePayrollPeriod(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/payroll/periods/${id}`);
  },

  async deletePayslip(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/payroll/payslips/${id}`);
  },

  async bulkStatusPayslips(ids: number[], payment_status: string) {
    return api.post<{ success: boolean; message: string }>('/hr/payroll/payslips/bulk-status', { ids, payment_status });
  },

  async bulkDeletePayslips(ids: number[]) {
    return api.post<{ success: boolean; message: string }>('/hr/payroll/payslips/bulk-delete', { ids });
  },

  // Advances API
  async getPayrollAdvances(params?: { status?: string; employee_id?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.employee_id) query.set('employee_id', String(params.employee_id));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ data: PayrollAdvanceApiItem[] }>(`/hr/payroll/advances${qs}`);
  },

  async requestPayrollAdvance(payload: {
    employee_id: number;
    amount: number;
    reason?: string;
    repayment_terms?: string;
    installment_amount?: number;
    issued_on?: string;
    notes?: string;
  }) {
    return api.post<PayrollAdvanceApiItem>('/hr/payroll/advances', payload);
  },

  async deletePayrollAdvance(id: number) {
    return api.delete<{ success: boolean; message: string }>(`/hr/payroll/advances/${id}`);
  },

  async bulkStatusPayrollAdvances(ids: number[], status: string) {
    return api.post<{ success: boolean; message: string }>('/hr/payroll/advances/bulk-status', { ids, status });
  },

  async bulkDeletePayrollAdvances(ids: number[]) {
    return api.post<{ success: boolean; message: string }>('/hr/payroll/advances/bulk-delete', { ids });
  },

  // Worker Production Entries
  async getWorkerProductionEntries(params?: { date?: string }) {
    const query = new URLSearchParams();
    if (params?.date) query.set('work_date', params.date);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ data: Array<Record<string, unknown>> }>(`/production/worker-entries${qs}`);
  },

  async verifyWorkerProductionEntry(uuid: string | number) {
    return api.post<{ message: string }>(`/production/worker-entries/${uuid}/verify`);
  },

  async deleteWorkerProductionEntry(uuid: string | number) {
    return api.delete<{ message: string }>(`/production/worker-entries/${uuid}`);
  },

  async bulkVerifyWorkerProductionEntries(ids: Array<string | number>) {
    return api.post<{ success: boolean; message: string }>('/production/worker-entries/bulk-verify', { ids });
  },

  async bulkDeleteWorkerProductionEntries(ids: Array<string | number>) {
    return api.post<{ success: boolean; message: string }>('/production/worker-entries/bulk-delete', { ids });
  },
};

