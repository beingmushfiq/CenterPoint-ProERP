import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Shield,
  Plus,
  Search,
  KeyRound,
  UserCheck,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Building,
  Briefcase,
  ChevronRight,
  Filter,
  Edit,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { extractList } from '../../lib/api/apiData';
import { useAuthStore } from '../../lib/auth/authStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { notify } from '../../components/ui/Toast';

export interface UserRole {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  is_system?: boolean;
}

export interface UserEmployee {
  id: number;
  uuid: string;
  employee_code: string;
  first_name?: string;
  last_name?: string;
  display_name: string;
  department?: string | null;
  designation?: string | null;
  employment_status?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface UserData {
  id: number;
  uuid: string;
  name: string;
  email: string;
  phone?: string | null;
  status: 'active' | 'suspended';
  is_active: boolean;
  is_platform_admin?: boolean;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  roles: UserRole[];
  employee?: UserEmployee | null;
  created_at?: string;
}

export interface RoleOption {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_system?: boolean;
  permissions_count?: number;
}

export interface UnlinkedEmployeeOption {
  id: number;
  employee_code: string;
  display_name: string;
  department?: string | null;
  designation?: string | null;
  email?: string | null;
  has_user_account?: boolean;
}

export const UsersManagementWorkspace: React.FC = () => {
  const { hasPermission } = useAuthStore();
  const canManageRoles = hasPermission('core.role.manage') || hasPermission('core.role.update');
  const canCreateUser = hasPermission('core.user.create') || hasPermission('core.role.manage');
  const canUpdateUser = hasPermission('core.user.update') || hasPermission('core.role.manage');

  const [users, setUsers] = useState<UserData[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [unlinkedEmployees, setUnlinkedEmployees] = useState<UnlinkedEmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all'); // all | employee | standalone

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [rolesModalUser, setRolesModalUser] = useState<UserData | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<UserData | null>(null);
  const [toggleStatusUser, setToggleStatusUser] = useState<UserData | null>(null);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editingUserData, setEditingUserData] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Form states
  const [savingRoles, setSavingRoles] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<number>>(new Set());

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoleIds, setNewUserRoleIds] = useState<Set<number>>(new Set());
  const [linkEmployeeId, setLinkEmployeeId] = useState<string>('');
  const [creatingUser, setCreatingUser] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Fetch initial data
  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [usersRes, rolesRes, employeesRes] = await Promise.all([
        api.get<UserData[]>('/users'),
        api.get<RoleOption[]>('/roles'),
        api.get<{ data: Array<UnlinkedEmployeeOption & { user_id?: number | null }> } | Array<UnlinkedEmployeeOption & { user_id?: number | null }>>('/hr/employees').catch(() => ({ data: { data: [] } })),
      ]);

      const loadedUsers = extractList<UserData>(usersRes);
      setUsers(loadedUsers);

      const loadedRoles = extractList<RoleOption>(rolesRes);
      setAvailableRoles(loadedRoles);

      const resData = employeesRes.data;
      const empData = (resData && 'data' in resData && Array.isArray(resData.data))
        ? resData.data
        : (Array.isArray(resData) ? resData : []);
      const unlinked = empData.filter((e) => !e.has_user_account && !e.user_id);
      setUnlinkedEmployees(unlinked);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load user management data';
      notify.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    Promise.all([
      api.get<UserData[]>('/users'),
      api.get<RoleOption[]>('/roles'),
      api.get<{ data: Array<UnlinkedEmployeeOption & { user_id?: number | null }> } | Array<UnlinkedEmployeeOption & { user_id?: number | null }>>('/hr/employees').catch(() => ({ data: { data: [] } })),
    ])
      .then(([usersRes, rolesRes, employeesRes]) => {
        if (ignore) return;
        const loadedUsers = extractList<UserData>(usersRes);
        setUsers(loadedUsers);

        const loadedRoles = extractList<RoleOption>(rolesRes);
        setAvailableRoles(loadedRoles);

        const resData = employeesRes.data;
        const empData = (resData && 'data' in resData && Array.isArray(resData.data))
          ? resData.data
          : (Array.isArray(resData) ? resData : []);
        const unlinked = empData.filter((e) => !e.has_user_account && !e.user_id);
        setUnlinkedEmployees(unlinked);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load user management data';
        notify.error(msg);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesPhone = u.phone?.toLowerCase().includes(q) ?? false;
        const matchesEmpCode = u.employee?.employee_code.toLowerCase().includes(q) ?? false;
        const matchesEmpName = u.employee?.display_name.toLowerCase().includes(q) ?? false;
        const matchesRole = u.roles.some((r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));

        if (!matchesName && !matchesEmail && !matchesPhone && !matchesEmpCode && !matchesEmpName && !matchesRole) {
          return false;
        }
      }

      // Role Filter
      if (selectedRoleFilter !== 'all') {
        const hasRole = u.roles.some((r) => r.slug === selectedRoleFilter || r.id.toString() === selectedRoleFilter);
        if (!hasRole) return false;
      }

      // Status Filter
      if (selectedStatusFilter !== 'all') {
        if (u.status !== selectedStatusFilter) return false;
      }

      // Type Filter (Employee linked vs Standalone)
      if (selectedTypeFilter === 'employee' && !u.employee) return false;
      if (selectedTypeFilter === 'standalone' && u.employee) return false;

      return true;
    });
  }, [users, searchQuery, selectedRoleFilter, selectedStatusFilter, selectedTypeFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'active').length;
    const linkedEmployees = users.filter((u) => !!u.employee).length;
    const totalRoles = availableRoles.length;
    return { total, active, linkedEmployees, totalRoles };
  }, [users, availableRoles]);

  // Open Edit Roles Modal
  const handleOpenRolesModal = (user: UserData) => {
    setRolesModalUser(user);
    setSelectedRoleIds(new Set(user.roles.map((r) => r.id)));
  };

  // Save Assigned Roles
  const handleSaveRoles = async () => {
    if (!rolesModalUser) return;
    setSavingRoles(true);
    try {
      const res = await api.post<{ message?: string }>(`/users/${rolesModalUser.id}/assign-roles`, {
        role_ids: Array.from(selectedRoleIds),
      });
      notify.success(res.data?.message || 'Roles updated successfully');
      setRolesModalUser(null);
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update roles';
      notify.error(msg);
    } finally {
      setSavingRoles(false);
    }
  };

  // Open Reset Password Modal
  const handleOpenPasswordModal = (user: UserData) => {
    setPasswordModalUser(user);
    setNewPassword(generatePassword());
    setCopiedPassword(false);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(newPassword);
    setCopiedPassword(true);
    notify.success('Password copied to clipboard');
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Save Reset Password
  const handleSavePassword = async () => {
    if (!passwordModalUser || !newPassword) return;
    setSavingPassword(true);
    try {
      const res = await api.post<{ message?: string }>(`/users/${passwordModalUser.id}/reset-password`, {
        password: newPassword,
      });
      notify.success(res.data?.message || 'Password reset successfully');
      setPasswordModalUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password';
      notify.error(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  // Toggle User Status
  const handleToggleStatus = async (user: UserData) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await api.patch<{ message?: string }>(`/users/${user.id}/status`, {
        status: nextStatus,
      });
      notify.success(res.data?.message || `User ${nextStatus === 'active' ? 'activated' : 'suspended'}`);
      setToggleStatusUser(null);
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle status';
      notify.error(msg);
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      notify.error('Name, email, and password are required');
      return;
    }

    setCreatingUser(true);
    try {
      const payload: Record<string, unknown> = {
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        phone: newUserPhone.trim() || null,
        role_ids: Array.from(newUserRoleIds),
        employee_id: linkEmployeeId ? parseInt(linkEmployeeId, 10) : null,
      };

      const res = await api.post<{ message?: string }>('/users', payload);
      notify.success(res.data?.message || 'User created successfully');
      setCreateModalOpen(false);
      // Reset form
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPhone('');
      setNewUserPassword('');
      setNewUserRoleIds(new Set());
      setLinkEmployeeId('');
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      notify.error(msg);
    } finally {
      setCreatingUser(false);
    }
  };

  // When an employee is selected in Create User modal, auto-populate email and name
  const handleEmployeeSelection = (empIdStr: string) => {
    setLinkEmployeeId(empIdStr);
    if (!empIdStr) return;
    const emp = unlinkedEmployees.find((e) => e.id.toString() === empIdStr);
    if (emp) {
      if (!newUserName) setNewUserName(emp.display_name);
      if (!newUserEmail && emp.email) setNewUserEmail(emp.email);
    }
  };

  const handleOpenEditUser = async (user: UserData) => {
    setEditUserModalOpen(true);
    setEditLoading(true);
    try {
      const res = await api.get<any>(`/users/${user.id}`);
      const payload = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as any).data
        : res.data;
      setEditingUserData(payload || user);
    } catch {
      setEditingUserData(user);
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserData) return;
    setEditSubmitting(true);
    try {
      await api.put(`/users/${editingUserData.id}`, {
        name: editingUserData.name,
        email: editingUserData.email,
        phone: editingUserData.phone || null,
        status: editingUserData.status,
        employee_id: editingUserData.employee?.id || null,
      });
      notify.success(`User '${editingUserData.name}' updated successfully.`);
      setEditUserModalOpen(false);
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user';
      notify.error(msg);
    } finally {
      setEditSubmitting(false);
    }
  };

  const getRoleBadgeStyle = (slug: string) => {
    if (slug.includes('admin')) {
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
    }
    if (slug.includes('production')) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    }
    if (slug.includes('qc')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (slug.includes('store') || slug.includes('inventory')) {
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    }
    if (slug.includes('sales')) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Settings & Access</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-primary font-bold">Identity & RBAC</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5 mt-1">
            <Users className="w-7 h-7 text-primary" />
            Staff & User Accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Provision system user credentials, map staff to operational roles, and enforce RBAC permissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {canCreateUser && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewUserName('');
                setNewUserEmail('');
                setNewUserPhone('');
                setNewUserPassword(generatePassword());
                setNewUserRoleIds(new Set());
                setLinkEmployeeId('');
                setCreateModalOpen(true);
              }}
              className="h-9 gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New User Account
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats Summary Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">{metrics.total}</div>
            <div className="text-xs text-muted-foreground font-medium">Total User Accounts</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">{metrics.active}</div>
            <div className="text-xs text-muted-foreground font-medium">Active Credentials</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">{metrics.linkedEmployees}</div>
            <div className="text-xs text-muted-foreground font-medium">Linked Employees</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">{metrics.totalRoles}</div>
            <div className="text-xs text-muted-foreground font-medium">Defined Roles</div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by user name, email, employee code, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Role Filter */}
            <div className="flex items-center gap-1.5 bg-background border border-input rounded-lg px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">Role:</span>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold focus:outline-none text-foreground cursor-pointer"
              >
                <option value="all">All Roles</option>
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-background border border-input rounded-lg px-2.5 py-1 text-xs">
              <span className="text-muted-foreground font-medium">Status:</span>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold focus:outline-none text-foreground cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5 bg-background border border-input rounded-lg px-2.5 py-1 text-xs">
              <span className="text-muted-foreground font-medium">Profile:</span>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold focus:outline-none text-foreground cursor-pointer"
              >
                <option value="all">All Users</option>
                <option value="employee">Linked Employees</option>
                <option value="standalone">Standalone Users</option>
              </select>
            </div>

            {(searchQuery || selectedRoleFilter !== 'all' || selectedStatusFilter !== 'all' || selectedTypeFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedRoleFilter('all');
                  setSelectedStatusFilter('all');
                  setSelectedTypeFilter('all');
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Users Directory Table ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading user directory and permissions...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-muted-foreground/60" />
            <div className="text-base font-semibold text-foreground">No user accounts found</div>
            <p className="text-xs text-muted-foreground max-w-sm">
              {searchQuery || selectedRoleFilter !== 'all'
                ? 'Try adjusting your search criteria or resetting filters.'
                : 'Get started by creating your first system user account or granting access from HR.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">User Account</th>
                  <th className="py-3 px-4">Linked Staff Profile</th>
                  <th className="py-3 px-4">Assigned Roles</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredUsers.map((user) => {
                  const isSuspended = user.status === 'suspended';
                  const initials = user.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-muted/20 transition-colors ${
                        isSuspended ? 'opacity-70 bg-muted/10' : ''
                      }`}
                    >
                      {/* User Account Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              <span>{user.name}</span>
                              {user.is_platform_admin && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Platform Admin
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono truncate">{user.email}</div>
                            {user.phone && (
                              <div className="text-[11px] text-muted-foreground/80 mt-0.5">{user.phone}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Linked Staff Profile */}
                      <td className="py-3.5 px-4">
                        {user.employee ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">
                                {user.employee.employee_code}
                              </span>
                              <span className="font-medium text-foreground text-xs">
                                {user.employee.display_name}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                              {user.employee.department && (
                                <span className="flex items-center gap-1">
                                  <Building className="w-3 h-3 text-muted-foreground/70" />
                                  {user.employee.department}
                                </span>
                              )}
                              {user.employee.designation && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="w-3 h-3 text-muted-foreground/70" />
                                  {user.employee.designation}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/70 italic flex items-center gap-1">
                            Standalone Account
                          </span>
                        )}
                      </td>

                      {/* Assigned Roles */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {user.roles && user.roles.length > 0 ? (
                            user.roles.map((r) => (
                              <span
                                key={r.id}
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getRoleBadgeStyle(
                                  r.slug
                                )}`}
                              >
                                <Shield className="w-3 h-3 mr-1 opacity-70" />
                                {r.name}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              No Roles Assigned
                            </span>
                          )}

                          {canManageRoles && (
                            <button
                              type="button"
                              onClick={() => handleOpenRolesModal(user)}
                              className="text-xs font-semibold text-primary hover:underline ml-1 inline-flex items-center gap-0.5"
                            >
                              Edit Roles
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => canUpdateUser && setToggleStatusUser(user)}
                          disabled={!canUpdateUser}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                            user.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {user.status === 'active' ? 'Active' : 'Suspended'}
                        </button>
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-xs text-muted-foreground font-mono">
                        {user.last_login_at ? (
                          <div>
                            <div>{new Date(user.last_login_at).toLocaleDateString()}</div>
                            <div className="text-[10px] text-muted-foreground/70">
                              {new Date(user.last_login_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Never</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManageRoles && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenRolesModal(user)}
                              className="h-8 text-xs px-2.5 gap-1"
                              title="Assign or modify roles"
                            >
                              <Shield className="w-3.5 h-3.5 text-primary" />
                              <span>Roles</span>
                            </Button>
                          )}

                          {canUpdateUser && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenEditUser(user)}
                              className="h-8 text-xs px-2.5 gap-1"
                              title="Edit user profile & details"
                            >
                              <Edit className="w-3.5 h-3.5 text-blue-600" />
                              <span>Edit</span>
                            </Button>
                          )}

                          {canUpdateUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPasswordModal(user)}
                              className="h-8 w-8 p-0"
                              title="Reset password"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: ASSIGN / EDIT ROLES                                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!rolesModalUser}
        onClose={() => setRolesModalUser(null)}
        title="Assign & Manage Roles"
        subtitle={`Configure RBAC permissions and security roles for ${rolesModalUser?.name}`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground font-medium">
              {selectedRoleIds.size} {selectedRoleIds.size === 1 ? 'role' : 'roles'} selected
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setRolesModalUser(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveRoles} disabled={savingRoles}>
                {savingRoles ? 'Saving Roles...' : 'Save Role Assignment'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {/* User Info Header in Modal */}
          <div className="p-3 bg-muted/30 rounded-lg border border-border flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-foreground">{rolesModalUser?.name}</div>
              <div className="text-muted-foreground font-mono">{rolesModalUser?.email}</div>
            </div>
            {rolesModalUser?.employee && (
              <div className="text-right">
                <span className="font-mono font-bold text-primary">{rolesModalUser.employee.employee_code}</span>
                <div className="text-muted-foreground">{rolesModalUser.employee.department}</div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
              Available System & Custom Roles
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {availableRoles.map((role) => {
                const isSelected = selectedRoleIds.has(role.id);
                return (
                  <button
                    type="button"
                    key={role.id}
                    onClick={() => {
                      const next = new Set(selectedRoleIds);
                      if (next.has(role.id)) {
                        next.delete(role.id);
                      } else {
                        next.add(role.id);
                      }
                      setSelectedRoleIds(next);
                    }}
                    className={`w-full p-3.5 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by container onClick
                      className="mt-0.5 rounded border-input text-primary focus:ring-primary h-4 w-4 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-foreground flex items-center justify-between">
                        <span>{role.name}</span>
                        {role.is_system && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted font-mono text-muted-foreground">
                            System
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{role.slug}</div>
                      {role.description && (
                        <p className="text-xs text-muted-foreground/90 mt-1 line-clamp-2">{role.description}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: RESET PASSWORD                                         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!passwordModalUser}
        onClose={() => setPasswordModalUser(null)}
        title="Reset User Password"
        subtitle={`Set new login credentials for ${passwordModalUser?.name}`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="sm" onClick={() => setPasswordModalUser(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSavePassword}
              disabled={savingPassword || !newPassword}
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div className="text-xs text-muted-foreground">
            Enter a new password or generate a high-entropy credential for the user. Active JWT sessions will be invalidated immediately.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">New Temporary or Permanent Password</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Enter password..."
              />
              <Button variant="secondary" size="sm" onClick={handleCopyPassword} className="h-9 px-3 gap-1">
                {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPassword ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNewPassword(generatePassword())}
                className="h-9 px-3"
                title="Generate another password"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREATE USER ACCOUNT                                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Provision New User Account"
        subtitle="Create login credentials and grant role-based authorizations"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateUser} disabled={creatingUser}>
              {creatingUser ? 'Creating User...' : 'Create Account'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateUser} className="space-y-4 py-2">
          {/* Link to Employee Optional Section */}
          <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-primary" />
                Link to an Existing Staff Employee (Optional)
              </label>
              <span className="text-[11px] text-muted-foreground">
                {unlinkedEmployees.length} staff without ERP login
              </span>
            </div>
            <select
              value={linkEmployeeId}
              onChange={(e) => handleEmployeeSelection(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground"
            >
              <option value="">-- Standalone User (Not linked to staff directory) --</option>
              {unlinkedEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code} — {emp.display_name} ({emp.department || 'No Dept'} / {emp.designation || 'Staff'})
                </option>
              ))}
            </select>
            {linkEmployeeId && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ User credentials will be automatically linked to this employee profile.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@company.com"
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Phone Number</label>
              <input
                type="text"
                value={newUserPhone}
                onChange={(e) => setNewUserPhone(e.target.value)}
                placeholder="+8801700000000"
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Initial Password <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setNewUserPassword(generatePassword())}
                  className="h-9 px-2.5"
                  title="Generate random password"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Initial Role Selection */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
              Assign Initial Roles
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
              {availableRoles.map((role) => {
                const isSelected = newUserRoleIds.has(role.id);
                return (
                  <button
                    type="button"
                    key={role.id}
                    onClick={() => {
                      const next = new Set(newUserRoleIds);
                      if (next.has(role.id)) next.delete(role.id);
                      else next.add(role.id);
                      setNewUserRoleIds(next);
                    }}
                    className={`w-full p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-foreground">{role.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{role.slug}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIRM TOGGLE STATUS                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!toggleStatusUser}
        onClose={() => setToggleStatusUser(null)}
        title={toggleStatusUser?.status === 'active' ? 'Suspend User Access' : 'Activate User Account'}
        subtitle={`Confirmation for ${toggleStatusUser?.name}`}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="sm" onClick={() => setToggleStatusUser(null)}>
              Cancel
            </Button>
            <Button
              variant={toggleStatusUser?.status === 'active' ? 'danger' : 'primary'}
              size="sm"
              onClick={() => toggleStatusUser && handleToggleStatus(toggleStatusUser)}
            >
              {toggleStatusUser?.status === 'active' ? 'Suspend Account' : 'Activate Account'}
            </Button>
          </div>
        }
      >
        <div className="py-2 text-sm text-foreground space-y-2">
          {toggleStatusUser?.status === 'active' ? (
            <p>
              Are you sure you want to suspend <strong>{toggleStatusUser?.name}</strong>? The user will be immediately logged out of all active sessions and prevented from signing in until reactivated.
            </p>
          ) : (
            <p>
              Are you sure you want to reactivate access for <strong>{toggleStatusUser?.name}</strong>? They will be able to log in with their existing credentials and assigned roles.
            </p>
          )}
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: EDIT USER PROFILE & ACCESS                               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        open={editUserModalOpen}
        onClose={() => setEditUserModalOpen(false)}
        title="Edit User Account & Access"
        subtitle={editingUserData ? `Updating account for ${editingUserData.name}` : 'User Profile'}
        size="md"
      >
        {editLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="size-6 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Loading account profile...</span>
          </div>
        ) : editingUserData ? (
          <form onSubmit={handleSaveUserEdit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={editingUserData.name || ''}
                onChange={(e) => setEditingUserData({ ...editingUserData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={editingUserData.email || ''}
                  onChange={(e) => setEditingUserData({ ...editingUserData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editingUserData.phone || ''}
                  onChange={(e) => setEditingUserData({ ...editingUserData, phone: e.target.value })}
                  placeholder="+8801..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Account Status</label>
              <select
                value={editingUserData.status || 'active'}
                onChange={(e) => setEditingUserData({ ...editingUserData, status: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="active">Active (Full system login enabled)</option>
                <option value="suspended">Suspended (Access blocked)</option>
              </select>
            </div>

            {editingUserData.employee && (
              <div className="p-3 bg-muted/30 rounded-xl border border-border/70 space-y-1">
                <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Linked Employee Record</span>
                <div className="text-xs font-semibold text-foreground">
                  {editingUserData.employee.display_name} ({editingUserData.employee.employee_code})
                </div>
                <div className="text-2xs text-muted-foreground">
                  Dept: {editingUserData.employee.department?.name || 'N/A'} • Role: {editingUserData.employee.designation?.name || 'N/A'}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditUserModalOpen(false)}
                disabled={editSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={editSubmitting}
                className="gap-1.5"
              >
                {editSubmitting ? (
                  <>
                    <RefreshCw className="size-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="size-3" />
                    Save Account Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};
