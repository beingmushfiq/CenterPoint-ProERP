import React, { useState } from 'react';
import {
  Briefcase,
  Building2,
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  Upload,
  Download,
  ChevronDown,
} from 'lucide-react';
import type { Department, Designation, Shift } from '../../../types/api/hr';
import { Modal } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import { hrApi } from '../services/hrApi';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { departmentImportSchema } from '../schemas/departmentImportSchema';
import { designationImportSchema } from '../schemas/designationImportSchema';
import { shiftImportSchema } from '../schemas/shiftImportSchema';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';

interface Props {
  departments: Department[];
  designations: Designation[];
  shifts: Shift[];
  onAddDepartment?: (dept: Department) => void;
  onAddDesignation?: (des: Designation) => void;
  onAddShift?: (shift: Shift) => void;
  onRefresh?: () => void;
}

export function DepartmentsSetupSection({
  departments: initialDepartments,
  designations: initialDesignations,
  shifts: initialShifts,
  onAddDepartment,
  onAddDesignation,
  onAddShift,
  onRefresh,
}: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'departments' | 'designations' | 'shifts'>('departments');

  const [deptList, setDeptList] = useState<Department[]>(initialDepartments);
  const [desList, setDesList] = useState<Designation[]>(initialDesignations);
  const [shiftList, setShiftList] = useState<Shift[]>(initialShifts);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Bulk Selection States
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<number>>(new Set());
  const [selectedDesIds, setSelectedDesIds] = useState<Set<number>>(new Set());
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<number>>(new Set());

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'departments' | 'designations' | 'shifts';
    id?: number;
    isBulk?: boolean;
    name: string;
  } | null>(null);

  // Action Menu State
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  // Modals state
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptName, setNewDeptName] = useState('');

  const [showAddDesModal, setShowAddDesModal] = useState(false);
  const [newDesCode, setNewDesCode] = useState('');
  const [newDesName, setNewDesName] = useState('');

  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [newShiftCode, setNewShiftCode] = useState('');
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('09:00');
  const [newShiftEnd, setNewShiftEnd] = useState('17:00');
  const [newShiftGrace, setNewShiftGrace] = useState(15);
  const [newShiftBreak, setNewShiftBreak] = useState(60);

  const [isImportOpen, setIsImportOpen] = useState(false);

  // Sync handler
  const handleSyncWithApi = async () => {
    setIsSyncing(true);
    try {
      const [deptsRes, desgsRes, shiftsRes] = await Promise.all([
        hrApi.getDepartments(),
        hrApi.getDesignations(),
        hrApi.getShifts(),
      ]);

      if (deptsRes.data?.data) {
        setDeptList(deptsRes.data.data as Department[]);
      }
      if (desgsRes.data?.data) {
        setDesList(desgsRes.data.data as Designation[]);
      }
      if (shiftsRes.data?.data) {
        setShiftList(shiftsRes.data.data as Shift[]);
      }

      onRefresh?.();
      notify.success('Departments, roles & shifts synchronized with backend API');
    } catch {
      notify.info('Using latest cached organizational hierarchy data');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCsv = () => {
    let headers: string[];
    let rows: (string | number)[][];
    let filename: string;

    if (activeSubTab === 'departments') {
      headers = ['Code', 'Name', 'Cost Center Code', 'Is Active'];
      rows = deptList.map((d) => [
        `"${(d.code || '').replace(/"/g, '""')}"`,
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${(d.cost_center_code || '').replace(/"/g, '""')}"`,
        d.is_active ? 'TRUE' : 'FALSE',
      ]);
      filename = `departments_export_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (activeSubTab === 'designations') {
      headers = ['Code', 'Name', 'Grade', 'Is Active'];
      rows = desList.map((d) => [
        `"${(d.code || '').replace(/"/g, '""')}"`,
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${(d.grade || '').replace(/"/g, '""')}"`,
        d.is_active ? 'TRUE' : 'FALSE',
      ]);
      filename = `designations_export_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      headers = ['Code', 'Name', 'Start Time', 'End Time', 'Break Minutes', 'Grace Minutes', 'Crosses Midnight', 'Is Active'];
      rows = shiftList.map((s) => [
        `"${(s.code || '').replace(/"/g, '""')}"`,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        s.start_time || '09:00:00',
        s.end_time || '17:00:00',
        s.break_minutes ?? 60,
        s.grace_in_minutes ?? 15,
        s.crosses_midnight ? 'TRUE' : 'FALSE',
        s.is_active ? 'TRUE' : 'FALSE',
      ]);
      filename = `shifts_export_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify.success(`Exported ${rows.length} ${activeSubTab} to CSV.`);
  };

  const handleImportSuccess = () => {
    handleSyncWithApi();
  };

  // Bulk Selection Helpers
  const toggleSelectDept = (id: number) => {
    const next = new Set(selectedDeptIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDeptIds(next);
  };

  const toggleAllDepts = () => {
    if (selectedDeptIds.size === deptList.length) {
      setSelectedDeptIds(new Set());
    } else {
      setSelectedDeptIds(new Set(deptList.map((d) => d.id)));
    }
  };

  const toggleSelectDes = (id: number) => {
    const next = new Set(selectedDesIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDesIds(next);
  };

  const toggleAllDes = () => {
    if (selectedDesIds.size === desList.length) {
      setSelectedDesIds(new Set());
    } else {
      setSelectedDesIds(new Set(desList.map((d) => d.id)));
    }
  };

  const toggleSelectShift = (id: number) => {
    const next = new Set(selectedShiftIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedShiftIds(next);
  };

  const toggleAllShifts = () => {
    if (selectedShiftIds.size === shiftList.length) {
      setSelectedShiftIds(new Set());
    } else {
      setSelectedShiftIds(new Set(shiftList.map((s) => s.id)));
    }
  };

  // Handlers for Creations
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    const code = newDeptCode.trim()
      ? newDeptCode.trim().toUpperCase()
      : newDeptName.replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();

    try {
      const res = await hrApi.createDepartment({ code, name: newDeptName.trim(), is_active: true });
      const created = (res.data?.data as Department) || {
        id: deptList.length + 1,
        code,
        name: newDeptName.trim(),
        is_active: true,
      };
      setDeptList([created, ...deptList]);
      onAddDepartment?.(created);
      notify.success(`Department "${created.name}" created successfully`);
    } catch {
      const fallback: Department = {
        id: deptList.length + 1,
        uuid: `dep-auto-${Date.now()}`,
        code,
        name: newDeptName.trim(),
        is_active: true,
      };
      setDeptList([fallback, ...deptList]);
      onAddDepartment?.(fallback);
      notify.success(`Department "${fallback.name}" saved locally`);
    }
    setShowAddDeptModal(false);
    setNewDeptCode('');
    setNewDeptName('');
  };

  const handleCreateDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesName.trim()) return;
    const code = newDesCode.trim()
      ? newDesCode.trim().toUpperCase()
      : newDesName.replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();

    try {
      const res = await hrApi.createDesignation({ code, name: newDesName.trim(), is_active: true });
      const created = (res.data?.data as Designation) || {
        id: desList.length + 1,
        code,
        name: newDesName.trim(),
        is_active: true,
      };
      setDesList([created, ...desList]);
      onAddDesignation?.(created);
      notify.success(`Designation "${created.name}" created successfully`);
    } catch {
      const fallback: Designation = {
        id: desList.length + 1,
        uuid: `des-auto-${Date.now()}`,
        code,
        name: newDesName.trim(),
        is_active: true,
      };
      setDesList([fallback, ...desList]);
      onAddDesignation?.(fallback);
      notify.success(`Designation "${fallback.name}" saved locally`);
    }
    setShowAddDesModal(false);
    setNewDesCode('');
    setNewDesName('');
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftName.trim()) return;
    const code = newShiftCode.trim()
      ? newShiftCode.trim().toUpperCase()
      : newShiftName.replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();

    try {
      const res = await hrApi.createShift({
        code,
        name: newShiftName.trim(),
        start_time: `${newShiftStart}:00`,
        end_time: `${newShiftEnd}:00`,
        break_minutes: newShiftBreak,
        grace_in_minutes: newShiftGrace,
      });
      const created = (res.data?.data as Shift) || {
        id: shiftList.length + 1,
        code,
        name: newShiftName.trim(),
        start_time: `${newShiftStart}:00`,
        end_time: `${newShiftEnd}:00`,
        crosses_midnight: newShiftStart > newShiftEnd,
        break_minutes: newShiftBreak,
        grace_in_minutes: newShiftGrace,
        is_active: true,
      };
      setShiftList([created, ...shiftList]);
      onAddShift?.(created);
      notify.success(`Shift Schedule "${created.name}" created successfully`);
    } catch {
      const fallback: Shift = {
        id: shiftList.length + 1,
        uuid: `sh-auto-${Date.now()}`,
        code,
        name: newShiftName.trim(),
        start_time: `${newShiftStart}:00`,
        end_time: `${newShiftEnd}:00`,
        crosses_midnight: newShiftStart > newShiftEnd,
        break_minutes: newShiftBreak,
        grace_in_minutes: newShiftGrace,
        is_active: true,
      };
      setShiftList([fallback, ...shiftList]);
      onAddShift?.(fallback);
      notify.success(`Shift Schedule "${fallback.name}" saved locally`);
    }
    setShowAddShiftModal(false);
    setNewShiftCode('');
    setNewShiftName('');
  };

  // Toggle status
  const handleToggleDeptStatus = async (id: number) => {
    const target = deptList.find((d) => d.id === id);
    if (!target) return;
    try {
      await hrApi.updateDepartment(id, { is_active: !target.is_active });
    } catch {
      // update optimistic
    }
    setDeptList((prev) =>
      prev.map((d) => (d.id === id ? { ...d, is_active: !d.is_active } : d))
    );
    notify.info('Department status updated');
  };

  const handleToggleDesStatus = async (id: number) => {
    const target = desList.find((d) => d.id === id);
    if (!target) return;
    try {
      await hrApi.updateDesignation(id, { is_active: !target.is_active });
    } catch {
      // update optimistic
    }
    setDesList((prev) =>
      prev.map((d) => (d.id === id ? { ...d, is_active: !d.is_active } : d))
    );
    notify.info('Designation status updated');
  };

  const handleToggleShiftStatus = async (id: number) => {
    const target = shiftList.find((s) => s.id === id);
    if (!target) return;
    try {
      await hrApi.updateShift(id, { is_active: !target.is_active });
    } catch {
      // update optimistic
    }
    setShiftList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: !s.is_active } : s))
    );
    notify.info('Shift schedule status updated');
  };

  // Confirm Delete execution
  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id, isBulk } = deleteConfirm;

    try {
      if (type === 'departments') {
        if (isBulk) {
          const ids = Array.from(selectedDeptIds);
          await hrApi.bulkDeleteDepartments(ids);
          setDeptList((prev) => prev.filter((d) => !selectedDeptIds.has(d.id)));
          setSelectedDeptIds(new Set());
          notify.success(`Deleted ${ids.length} departments`);
        } else if (id) {
          await hrApi.deleteDepartment(id);
          setDeptList((prev) => prev.filter((d) => d.id !== id));
          notify.success(`Department removed`);
        }
      } else if (type === 'designations') {
        if (isBulk) {
          const ids = Array.from(selectedDesIds);
          await hrApi.bulkDeleteDesignations(ids);
          setDesList((prev) => prev.filter((d) => !selectedDesIds.has(d.id)));
          setSelectedDesIds(new Set());
          notify.success(`Deleted ${ids.length} designations`);
        } else if (id) {
          await hrApi.deleteDesignation(id);
          setDesList((prev) => prev.filter((d) => d.id !== id));
          notify.success(`Designation removed`);
        }
      } else if (type === 'shifts') {
        if (isBulk) {
          const ids = Array.from(selectedShiftIds);
          await hrApi.bulkDeleteShifts(ids);
          setShiftList((prev) => prev.filter((s) => !selectedShiftIds.has(s.id)));
          setSelectedShiftIds(new Set());
          notify.success(`Deleted ${ids.length} shift schedules`);
        } else if (id) {
          await hrApi.deleteShift(id);
          setShiftList((prev) => prev.filter((s) => s.id !== id));
          notify.success(`Shift removed`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion failed';
      notify.error(msg);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const activeSelectedCount =
    activeSubTab === 'departments'
      ? selectedDeptIds.size
      : activeSubTab === 'designations'
      ? selectedDesIds.size
      : selectedShiftIds.size;

  return (
    <div className="space-y-6">
      {/* Header & Subtabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-default">Organization Hierarchy & Operational Setup</h2>
          <p className="text-xs text-muted">
            Manage business units, departments, job designations, and factory work shift schedules.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-default">
            <button
              type="button"
              onClick={() => setActiveSubTab('departments')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeSubTab === 'departments'
                  ? 'bg-surface text-default shadow-xs font-semibold'
                  : 'text-muted hover:text-default'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Departments ({deptList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('designations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeSubTab === 'designations'
                  ? 'bg-surface text-default shadow-xs font-semibold'
                  : 'text-muted hover:text-default'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Designations ({desList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('shifts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeSubTab === 'shifts'
                  ? 'bg-surface text-default shadow-xs font-semibold'
                  : 'text-muted hover:text-default'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Shift Schedules ({shiftList.length})</span>
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 bg-surface hover:bg-surface-sunken text-default text-xs font-semibold rounded-xl border border-default flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            title={`Export current ${activeSubTab} to CSV`}
          >
            <Download className="size-3.5 text-muted" />
            <span className="hidden md:inline">Export CSV</span>
          </button>

          {/* Bulk Import Button */}
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="px-3 py-2 bg-surface hover:bg-surface-sunken text-default text-xs font-semibold rounded-xl border border-default flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            title={`Import ${activeSubTab} from Excel (.xlsx) or CSV`}
          >
            <Upload className="size-3.5 text-primary" />
            <span className="hidden md:inline">Import</span>
          </button>

          {/* Sync with API Button */}
          <button
            type="button"
            onClick={handleSyncWithApi}
            disabled={isSyncing}
            className="px-3 py-2 bg-surface hover:bg-surface-sunken text-default text-xs font-semibold rounded-xl border border-default flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            title="Synchronize departments, roles and shifts with backend API"
          >
            <RefreshCw className={`size-3.5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Sync API</span>
          </button>

          {/* Primary Action Button Contextual to SubTab */}
          {activeSubTab === 'departments' && (
            <button
              type="button"
              onClick={() => setShowAddDeptModal(true)}
              className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Department</span>
            </button>
          )}

          {activeSubTab === 'designations' && (
            <button
              type="button"
              onClick={() => setShowAddDesModal(true)}
              className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Designation</span>
            </button>
          )}

          {activeSubTab === 'shifts' && (
            <button
              type="button"
              onClick={() => setShowAddShiftModal(true)}
              className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Ribbon */}
      {activeSelectedCount > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-2xl animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-primary-fg text-xs font-bold font-mono">
              {activeSelectedCount}
            </span>
            <span className="text-xs font-semibold text-default">
              {activeSelectedCount} {activeSubTab} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDeleteConfirm({
                  type: activeSubTab,
                  isBulk: true,
                  name: `${activeSelectedCount} selected ${activeSubTab}`,
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-danger bg-danger/10 hover:bg-danger/20 border border-danger/30 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Bulk Delete</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeSubTab === 'departments') setSelectedDeptIds(new Set());
                if (activeSubTab === 'designations') setSelectedDesIds(new Set());
                if (activeSubTab === 'shifts') setSelectedShiftIds(new Set());
              }}
              className="p-1.5 text-muted hover:text-default rounded-lg transition cursor-pointer"
              title="Clear selection"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Departments Table */}
      {activeSubTab === 'departments' && (
        <div className="overflow-x-auto min-h-75 rounded-2xl border border-default bg-surface shadow-2xs">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={selectedDeptIds.size === deptList.length && deptList.length > 0}
                    onChange={toggleAllDepts}
                    className="size-4 rounded border-default text-primary focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Department Code</th>
                <th className="px-4 py-3.5">Department Name</th>
                <th className="px-4 py-3.5">Operational Scope</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {deptList.map((dep) => {
                const isSelected = selectedDeptIds.has(dep.id);
                return (
                  <tr key={dep.id} className={`hover:bg-surface-sunken/60 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectDept(dep.id)}
                        className="size-4 rounded border-default text-primary focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-primary">{dep.code}</td>
                    <td className="px-4 py-3.5 font-semibold text-default">{dep.name}</td>
                    <td className="px-4 py-3.5 text-muted">Core Enterprise Operations</td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          dep.is_active
                            ? 'bg-success-subtle text-success border-success'
                            : 'bg-danger-subtle text-danger border-danger'
                        }`}
                      >
                        {dep.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleDeptStatus(dep.id)}
                          className="px-2.5 py-1 text-2xs font-semibold rounded-lg border border-default hover:bg-surface-sunken text-muted hover:text-default transition cursor-pointer shadow-2xs"
                        >
                          {dep.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openActionMenuId === `dept_${dep.id}`) {
                              setOpenActionMenuId(null);
                              setActionMenuAnchor(null);
                            } else {
                              setOpenActionMenuId(`dept_${dep.id}`);
                              setActionMenuAnchor(e.currentTarget);
                            }
                          }}
                          className={`px-2.5 py-1 text-2xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                            openActionMenuId === `dept_${dep.id}`
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-default bg-surface hover:bg-surface-sunken text-default'
                          }`}
                          title={`Actions for ${dep.name}`}
                        >
                          <span>Actions</span>
                          <ChevronDown className="size-3 text-muted" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {actionMenuAnchor && openActionMenuId?.startsWith('dept_') && (() => {
            const depId = parseInt(openActionMenuId.replace('dept_', ''), 10);
            const dep = deptList.find((d) => d.id === depId);
            if (!dep) return null;
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
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    handleToggleDeptStatus(dep.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  <Briefcase className="size-3.5 text-primary shrink-0" />
                  <span>{dep.is_active ? 'Deactivate Department' : 'Activate Department'}</span>
                </button>
                <div className="my-1 border-t border-default/50" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    setDeleteConfirm({
                      type: 'departments',
                      id: dep.id,
                      name: dep.name,
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                  <span>Delete Department</span>
                </button>
              </ActionMenuPortal>
            );
          })()}
        </div>
      )}

      {/* Designations Table */}
      {activeSubTab === 'designations' && (
        <div className="overflow-x-auto min-h-75 rounded-2xl border border-default bg-surface shadow-2xs">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={selectedDesIds.size === desList.length && desList.length > 0}
                    onChange={toggleAllDes}
                    className="size-4 rounded border-default text-primary focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Designation Code</th>
                <th className="px-4 py-3.5">Job Title</th>
                <th className="px-4 py-3.5">Grade / Classification</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {desList.map((des) => {
                const isSelected = selectedDesIds.has(des.id);
                return (
                  <tr key={des.id} className={`hover:bg-surface-sunken/60 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectDes(des.id)}
                        className="size-4 rounded border-default text-primary focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-primary">{des.code}</td>
                    <td className="px-4 py-3.5 font-semibold text-default">{des.name}</td>
                    <td className="px-4 py-3.5 text-muted">Standard Operational Band</td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          des.is_active
                            ? 'bg-success-subtle text-success border-success'
                            : 'bg-danger-subtle text-danger border-danger'
                        }`}
                      >
                        {des.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleDesStatus(des.id)}
                          className="px-2.5 py-1 text-2xs font-semibold rounded-lg border border-default hover:bg-surface-sunken text-muted hover:text-default transition cursor-pointer shadow-2xs"
                        >
                          {des.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openActionMenuId === `des_${des.id}`) {
                              setOpenActionMenuId(null);
                              setActionMenuAnchor(null);
                            } else {
                              setOpenActionMenuId(`des_${des.id}`);
                              setActionMenuAnchor(e.currentTarget);
                            }
                          }}
                          className={`px-2.5 py-1 text-2xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                            openActionMenuId === `des_${des.id}`
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-default bg-surface hover:bg-surface-sunken text-default'
                          }`}
                          title={`Actions for ${des.name}`}
                        >
                          <span>Actions</span>
                          <ChevronDown className="size-3 text-muted" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {actionMenuAnchor && openActionMenuId?.startsWith('des_') && (() => {
            const desId = parseInt(openActionMenuId.replace('des_', ''), 10);
            const des = desList.find((d) => d.id === desId);
            if (!des) return null;
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
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    handleToggleDesStatus(des.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  <Briefcase className="size-3.5 text-primary shrink-0" />
                  <span>{des.is_active ? 'Deactivate Title' : 'Activate Title'}</span>
                </button>
                <div className="my-1 border-t border-default/50" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    setDeleteConfirm({
                      type: 'designations',
                      id: des.id,
                      name: des.name,
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                  <span>Delete Designation</span>
                </button>
              </ActionMenuPortal>
            );
          })()}
        </div>
      )}

      {/* Shifts Table */}
      {activeSubTab === 'shifts' && (
        <div className="overflow-x-auto min-h-75 rounded-2xl border border-default bg-surface shadow-2xs">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={selectedShiftIds.size === shiftList.length && shiftList.length > 0}
                    onChange={toggleAllShifts}
                    className="size-4 rounded border-default text-primary focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Shift Code</th>
                <th className="px-4 py-3.5">Shift Title</th>
                <th className="px-4 py-3.5">Working Hours</th>
                <th className="px-4 py-3.5">Break Minutes</th>
                <th className="px-4 py-3.5">Grace Period</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {shiftList.map((sh) => {
                const isSelected = selectedShiftIds.has(sh.id);
                return (
                  <tr key={sh.id} className={`hover:bg-surface-sunken/60 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectShift(sh.id)}
                        className="size-4 rounded border-default text-primary focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-primary">{sh.code}</td>
                    <td className="px-4 py-3.5 font-semibold text-default">{sh.name}</td>
                    <td className="px-4 py-3.5 font-mono text-muted">
                      {sh.start_time.slice(0, 5)} - {sh.end_time.slice(0, 5)}
                      {sh.crosses_midnight && ' (+1d)'}
                    </td>
                    <td className="px-4 py-3.5 text-muted">{sh.break_minutes} mins</td>
                    <td className="px-4 py-3.5 font-mono text-muted">{sh.grace_in_minutes} mins</td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          sh.is_active
                            ? 'bg-success-subtle text-success border-success'
                            : 'bg-danger-subtle text-danger border-danger'
                        }`}
                      >
                        {sh.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleShiftStatus(sh.id)}
                          className="px-2.5 py-1 text-2xs font-semibold rounded-lg border border-default hover:bg-surface-sunken text-muted hover:text-default transition cursor-pointer shadow-2xs"
                        >
                          {sh.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openActionMenuId === `shift_${sh.id}`) {
                              setOpenActionMenuId(null);
                              setActionMenuAnchor(null);
                            } else {
                              setOpenActionMenuId(`shift_${sh.id}`);
                              setActionMenuAnchor(e.currentTarget);
                            }
                          }}
                          className={`px-2.5 py-1 text-2xs rounded-lg border font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                            openActionMenuId === `shift_${sh.id}`
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-default bg-surface hover:bg-surface-sunken text-default'
                          }`}
                          title={`Actions for ${sh.name}`}
                        >
                          <span>Actions</span>
                          <ChevronDown className="size-3 text-muted" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {actionMenuAnchor && openActionMenuId?.startsWith('shift_') && (() => {
            const shId = parseInt(openActionMenuId.replace('shift_', ''), 10);
            const sh = shiftList.find((s) => s.id === shId);
            if (!sh) return null;
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
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    handleToggleShiftStatus(sh.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  <Clock className="size-3.5 text-primary shrink-0" />
                  <span>{sh.is_active ? 'Deactivate Shift' : 'Activate Shift'}</span>
                </button>
                <div className="my-1 border-t border-default/50" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setActionMenuAnchor(null);
                    setDeleteConfirm({
                      type: 'shifts',
                      id: sh.id,
                      name: sh.name,
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                  <span>Delete Shift</span>
                </button>
              </ActionMenuPortal>
            );
          })()}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Deletion"
        subtitle="This action is permanent and cannot be undone."
        size="sm"
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 p-3 bg-danger/10 rounded-xl border border-danger/20">
            <AlertTriangle className="size-5 text-danger shrink-0" />
            <p className="text-xs text-default font-medium">
              Are you sure you want to delete <span className="font-bold text-danger">{deleteConfirm?.name}</span>?
            </p>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-default">
            <button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={executeDelete}
              className="px-4 py-2 text-xs bg-danger hover:bg-danger/90 text-white font-semibold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="size-3.5" />
              <span>Confirm Delete</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Department */}
      <Modal
        open={showAddDeptModal}
        onClose={() => setShowAddDeptModal(false)}
        title="Add Business Department"
        subtitle="Define a new organizational unit or operational department."
        size="md"
      >
        <form onSubmit={handleCreateDepartment} className="space-y-4 pt-1">
          <div>
            <label htmlFor="dept-name-input" className="block text-xs font-semibold text-default uppercase mb-1">
              Department Name
            </label>
            <input
              id="dept-name-input"
              name="dept_name"
              type="text"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="e.g. Quality Assurance & Testing"
              required
              autoComplete="off"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="dept-code-input" className="block text-xs font-semibold text-default uppercase mb-1">
              Department Code (Optional)
            </label>
            <input
              id="dept-code-input"
              name="dept_code"
              type="text"
              value={newDeptCode}
              onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
              placeholder="e.g. QA"
              autoComplete="off"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowAddDeptModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Create Department
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Designation */}
      <Modal
        open={showAddDesModal}
        onClose={() => setShowAddDesModal(false)}
        title="Add Job Designation"
        subtitle="Create a new job title and classification."
        size="md"
      >
        <form onSubmit={handleCreateDesignation} className="space-y-4 pt-1">
          <div>
            <label htmlFor="des-name-input" className="block text-xs font-semibold text-default uppercase mb-1">
              Job Designation Title
            </label>
            <input
              id="des-name-input"
              name="des_name"
              type="text"
              value={newDesName}
              onChange={(e) => setNewDesName(e.target.value)}
              placeholder="e.g. Lead Packaging Technician"
              required
              autoComplete="off"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="des-code-input" className="block text-xs font-semibold text-default uppercase mb-1">
              Designation Code (Optional)
            </label>
            <input
              id="des-code-input"
              name="des_code"
              type="text"
              value={newDesCode}
              onChange={(e) => setNewDesCode(e.target.value.toUpperCase())}
              placeholder="e.g. PKG_TECH"
              autoComplete="off"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowAddDesModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Create Designation
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Shift */}
      <Modal
        open={showAddShiftModal}
        onClose={() => setShowAddShiftModal(false)}
        title="Create Shift Schedule"
        subtitle="Configure standard working hours, grace periods, and breaks."
        size="md"
      >
        <form onSubmit={handleCreateShift} className="space-y-4 pt-1">
          <div>
            <label htmlFor="shift-name-input" className="block text-xs font-semibold text-default uppercase mb-1">
              Shift Title
            </label>
            <input
              id="shift-name-input"
              name="shift_name"
              type="text"
              value={newShiftName}
              onChange={(e) => setNewShiftName(e.target.value)}
              placeholder="e.g. Afternoon Production Shift"
              required
              autoComplete="off"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="shift-code-input" className="block text-xs font-semibold text-default uppercase mb-1">
              Shift Code (Optional)
            </label>
            <input
              id="shift-code-input"
              name="shift_code"
              type="text"
              value={newShiftCode}
              onChange={(e) => setNewShiftCode(e.target.value.toUpperCase())}
              placeholder="e.g. AFTN"
              autoComplete="off"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="shift-start-input" className="block text-xs font-semibold text-default uppercase mb-1">
                Start Time
              </label>
              <input
                id="shift-start-input"
                name="shift_start"
                type="time"
                value={newShiftStart}
                onChange={(e) => setNewShiftStart(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="shift-end-input" className="block text-xs font-semibold text-default uppercase mb-1">
                End Time
              </label>
              <input
                id="shift-end-input"
                name="shift_end"
                type="time"
                value={newShiftEnd}
                onChange={(e) => setNewShiftEnd(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="shift-break-input" className="block text-xs font-semibold text-default uppercase mb-1">
                Break Duration (Minutes)
              </label>
              <input
                id="shift-break-input"
                name="shift_break"
                type="number"
                min="0"
                value={newShiftBreak}
                onChange={(e) => setNewShiftBreak(parseInt(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="shift-grace-input" className="block text-xs font-semibold text-default uppercase mb-1">
                Grace-in Period (Minutes)
              </label>
              <input
                id="shift-grace-input"
                name="shift_grace"
                type="number"
                min="0"
                value={newShiftGrace}
                onChange={(e) => setNewShiftGrace(parseInt(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowAddShiftModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Create Shift Schedule
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        schema={
          activeSubTab === 'departments'
            ? departmentImportSchema
            : activeSubTab === 'designations'
            ? designationImportSchema
            : shiftImportSchema
        }
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
