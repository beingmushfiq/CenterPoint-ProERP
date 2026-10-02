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
  Filter,
  Edit,
  Trash2,
  AlertTriangle,
  Clock,
  X,
  RotateCcw,
  Activity,
  ShoppingBag,
  Factory,
  Package,
  CheckSquare,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { extractList } from '../../lib/api/apiData';
import { useAuthStore } from '../../lib/auth/authStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { notify } from '../../components/ui/Toast';
import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';
import { ResponsiveDataTable, type ResponsiveColumn } from '../../components/ui/ResponsiveDataTable';
import { type ActionSheetItem } from '../../components/motion/MotionActionSheet';

export interface UserRole {
  id: number;
  uuid: string;
  name: string;
  designation?: string | null;
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
  designation?: string | null;
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

type NavCategoryKey = 'all' | 'roles' | 'staff' | 'activity';

export const UsersManagementWorkspace: React.FC = () => {
  const { hasPermission, user: currentUser } = useAuthStore();
  const canManageRoles = hasPermission('core.role.manage') || hasPermission('core.role.update');
  const canCreateUser = hasPermission('core.user.create') || hasPermission('core.role.manage');
  const canUpdateUser = hasPermission('core.user.update') || hasPermission('core.role.manage');
  const canDeleteUser =
    hasPermission('core.user.delete') ||
    hasPermission('core.role.manage') ||
    hasPermission('core.user.manage') ||
    !!currentUser?.is_platform_admin;

  const [users, setUsers] = useState<UserData[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [unlinkedEmployees, setUnlinkedEmployees] = useState<UnlinkedEmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Navigation Hub States
  const [activeTab, setActiveTab] = useState<string>('all__all');

  // Search and toolbar filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all'); // all | employee | standalone

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [rolesModalUser, setRolesModalUser] = useState<UserData | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<UserData | null>(null);
  const [toggleStatusUser, setToggleStatusUser] = useState<UserData | null>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<UserData | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editingUserData, setEditingUserData] = useState<UserData | null>(null);
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
        api
          .get<
            | { data: Array<UnlinkedEmployeeOption & { user_id?: number | null }> }
            | Array<UnlinkedEmployeeOption & { user_id?: number | null }>
          >('/hr/employees')
          .catch(() => ({ data: { data: [] } })),
      ]);

      const loadedUsers = extractList<UserData>(usersRes);
      setUsers(loadedUsers);

      const loadedRoles = extractList<RoleOption>(rolesRes);
      setAvailableRoles(loadedRoles);

      const resData = employeesRes.data;
      const empData =
        resData && 'data' in resData && Array.isArray(resData.data)
          ? resData.data
          : Array.isArray(resData)
            ? resData
            : [];
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
      api
        .get<
          | { data: Array<UnlinkedEmployeeOption & { user_id?: number | null }> }
          | Array<UnlinkedEmployeeOption & { user_id?: number | null }>
        >('/hr/employees')
        .catch(() => ({ data: { data: [] } })),
    ])
      .then(([usersRes, rolesRes, employeesRes]) => {
        if (ignore) return;
        const loadedUsers = extractList<UserData>(usersRes);
        setUsers(loadedUsers);

        const loadedRoles = extractList<RoleOption>(rolesRes);
        setAvailableRoles(loadedRoles);

        const resData = employeesRes.data;
        const empData =
          resData && 'data' in resData && Array.isArray(resData.data)
            ? resData.data
            : Array.isArray(resData)
              ? resData
              : [];
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

  // Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'active').length;
    const suspended = users.filter((u) => u.status === 'suspended').length;
    const linkedEmployees = users.filter((u) => !!u.employee).length;
    const platformAdmins = users.filter((u) => !!u.is_platform_admin).length;
    const totalRoles = availableRoles.length;
    return { total, active, suspended, linkedEmployees, platformAdmins, totalRoles };
  }, [users, availableRoles]);

  // 2-Tier Navigation Hub Configurations
  const categoriesConfig: WorkspaceCategoryConfig<NavCategoryKey, string>[] = useMemo(
    () => [
      {
        id: 'all',
        label: 'All Accounts',
        tagline: 'Complete directory of operator credentials, system access, and account status',
        icon: Users,
        theme: WORKSPACE_THEMES.indigo,
        defaultTab: 'all__all',
        tabs: ['all__all', 'all__active', 'all__suspended', 'all__platform_admin'],
        badge: metrics.total > 0 ? String(metrics.total) : undefined,
      },
      {
        id: 'roles',
        label: 'Operational Roles',
        tagline: 'Filter accounts by functional duty assignments and security privilege levels',
        icon: Shield,
        theme: WORKSPACE_THEMES.purple,
        defaultTab: 'roles__all',
        tabs: [
          'roles__all',
          'roles__admin',
          'roles__production',
          'roles__sales',
          'roles__inventory',
          'roles__qc',
        ],
      },
      {
        id: 'staff',
        label: 'Staff Linkage',
        tagline: 'Personnel linkage between HR employee records and SliceMart system credentials',
        icon: Briefcase,
        theme: WORKSPACE_THEMES.emerald,
        defaultTab: 'staff__all',
        tabs: ['staff__all', 'staff__linked', 'staff__standalone'],
      },
      {
        id: 'activity',
        label: 'Security & Logins',
        tagline: 'Audit recent operator sign-ins and identify dormant or unaccessed accounts',
        icon: KeyRound,
        theme: WORKSPACE_THEMES.amber,
        defaultTab: 'activity__all',
        tabs: ['activity__all', 'activity__recent', 'activity__never'],
      },
    ],
    [metrics.total]
  );

  const tabsConfig: WorkspaceTabConfig<NavCategoryKey, string>[] = useMemo(
    () => [
      // All Domain
      { id: 'all__all', label: 'All User Accounts', shortLabel: 'All Accounts', category: 'all', icon: Users, count: metrics.total },
      { id: 'all__active', label: 'Active Credentials', shortLabel: 'Active', category: 'all', icon: UserCheck, count: metrics.active },
      { id: 'all__suspended', label: 'Suspended Accounts', shortLabel: 'Suspended', category: 'all', icon: AlertCircle, count: metrics.suspended },
      { id: 'all__platform_admin', label: 'Platform Admins', shortLabel: 'Admins', category: 'all', icon: Shield, count: metrics.platformAdmins },

      // Roles Domain
      { id: 'roles__all', label: 'All Assigned Roles', shortLabel: 'All Roles', category: 'roles', icon: Shield },
      { id: 'roles__admin', label: 'Administrators & Executives', shortLabel: 'Admins', category: 'roles', icon: Shield },
      { id: 'roles__production', label: 'Production & Manufacturing', shortLabel: 'Production', category: 'roles', icon: Factory },
      { id: 'roles__sales', label: 'Commercial & Sales', shortLabel: 'Sales', category: 'roles', icon: ShoppingBag },
      { id: 'roles__inventory', label: 'Warehouse & Inventory', shortLabel: 'Inventory', category: 'roles', icon: Package },
      { id: 'roles__qc', label: 'Quality Assurance & QC', shortLabel: 'QC & QA', category: 'roles', icon: CheckSquare },

      // Staff Domain
      { id: 'staff__all', label: 'All Personnel Types', shortLabel: 'All Linkages', category: 'staff', icon: Briefcase },
      { id: 'staff__linked', label: 'Linked Staff Employees', shortLabel: 'Linked Staff', category: 'staff', icon: Building, count: metrics.linkedEmployees },
      { id: 'staff__standalone', label: 'Standalone Logins', shortLabel: 'Standalone', category: 'staff', icon: Users, count: metrics.total - metrics.linkedEmployees },

      // Activity Domain
      { id: 'activity__all', label: 'All Authentication States', shortLabel: 'All Activity', category: 'activity', icon: KeyRound },
      { id: 'activity__recent', label: 'Logged In Previously', shortLabel: 'Logged In', category: 'activity', icon: Clock, count: users.filter((u) => !!u.last_login_at).length },
      { id: 'activity__never', label: 'Never Signed In', shortLabel: 'Never Signed In', category: 'activity', icon: AlertTriangle, count: users.filter((u) => !u.last_login_at).length },
    ],
    [metrics, users]
  );

  // Tab Selection
  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Navigation Hub Filter
      if (activeTab === 'all__active' && u.status !== 'active') return false;
      if (activeTab === 'all__suspended' && u.status !== 'suspended') return false;
      if (activeTab === 'all__platform_admin' && !u.is_platform_admin) return false;

      if (activeTab === 'roles__admin') {
        const matches = u.roles.some((r) => r.slug.includes('admin') || r.slug.includes('manager') || u.is_platform_admin);
        if (!matches) return false;
      }
      if (activeTab === 'roles__production') {
        const matches = u.roles.some((r) => r.slug.includes('production') || r.slug.includes('plant'));
        if (!matches) return false;
      }
      if (activeTab === 'roles__sales') {
        const matches = u.roles.some((r) => r.slug.includes('sales') || r.slug.includes('commercial'));
        if (!matches) return false;
      }
      if (activeTab === 'roles__inventory') {
        const matches = u.roles.some((r) => r.slug.includes('store') || r.slug.includes('inventory') || r.slug.includes('warehouse'));
        if (!matches) return false;
      }
      if (activeTab === 'roles__qc') {
        const matches = u.roles.some((r) => r.slug.includes('qc') || r.slug.includes('quality') || r.slug.includes('inspector'));
        if (!matches) return false;
      }

      if (activeTab === 'staff__linked' && !u.employee) return false;
      if (activeTab === 'staff__standalone' && u.employee) return false;

      if (activeTab === 'activity__recent' && !u.last_login_at) return false;
      if (activeTab === 'activity__never' && u.last_login_at) return false;

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesPhone = u.phone?.toLowerCase().includes(q) ?? false;
        const matchesEmpCode = u.employee?.employee_code.toLowerCase().includes(q) ?? false;
        const matchesEmpName = u.employee?.display_name.toLowerCase().includes(q) ?? false;
        const matchesRole = u.roles.some(
          (r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)
        );

        if (!matchesName && !matchesEmail && !matchesPhone && !matchesEmpCode && !matchesEmpName && !matchesRole) {
          return false;
        }
      }

      // 3. Toolbar Dropdown: Role Filter
      if (selectedRoleFilter !== 'all') {
        const hasRole = u.roles.some(
          (r) => r.slug === selectedRoleFilter || r.id.toString() === selectedRoleFilter
        );
        if (!hasRole) return false;
      }

      // 4. Toolbar Dropdown: Status Filter
      if (selectedStatusFilter !== 'all') {
        if (u.status !== selectedStatusFilter) return false;
      }

      // 5. Toolbar Dropdown: Type Filter (Employee linked vs Standalone)
      if (selectedTypeFilter === 'employee' && !u.employee) return false;
      if (selectedTypeFilter === 'standalone' && u.employee) return false;

      return true;
    });
  }, [users, activeTab, searchQuery, selectedRoleFilter, selectedStatusFilter, selectedTypeFilter]);

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
      const res = await api.get<{ data?: UserData } | UserData>(`/users/${user.id}`);
      const payload =
        res.data && typeof res.data === 'object' && 'data' in res.data
          ? res.data.data
          : res.data;
      setEditingUserData((payload as UserData) || user);
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

  const handleDeleteUser = async () => {
    if (!deleteModalUser) return;
    setDeletingUser(true);
    try {
      await api.delete(`/users/${deleteModalUser.id}`);
      notify.success(`User '${deleteModalUser.name}' was deleted successfully.`);
      setDeleteModalUser(null);
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete user account';
      notify.error(msg);
    } finally {
      setDeletingUser(false);
    }
  };

  const getRoleBadgeStyle = (slug: string) => {
    if (slug.includes('admin')) {
      return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25';
    }
    if (slug.includes('production') || slug.includes('plant')) {
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25';
    }
    if (slug.includes('qc') || slug.includes('quality')) {
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25';
    }
    if (slug.includes('store') || slug.includes('inventory') || slug.includes('warehouse')) {
      return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25';
    }
    if (slug.includes('sales') || slug.includes('commercial')) {
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25';
    }
    return 'bg-surface-sunken text-muted border-default';
  };

  // Active Category & Tab derivation
  const activeCategoryKey = (activeTab.split('__')[0] || 'all') as NavCategoryKey;
  const activeCategoryConfig =
    categoriesConfig.find((c) => c.id === activeCategoryKey) || categoriesConfig[0]!;
  const ActiveCategoryIcon = activeCategoryConfig.icon;
  const currentTabConfig = tabsConfig.find((t) => t.id === activeTab);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedRoleFilter !== 'all' ||
    selectedStatusFilter !== 'all' ||
    selectedTypeFilter !== 'all' ||
    activeTab !== 'all__all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedRoleFilter('all');
    setSelectedStatusFilter('all');
    setSelectedTypeFilter('all');
    setActiveTab('all__all');
  };

  const userColumns: ResponsiveColumn<UserData>[] = [
    {
      id: 'user',
      header: (
        <span className="flex items-center gap-1.5">
          <Users className="size-3 text-muted" />
          User Account
        </span>
      ),
      isPrimary: true,
      priority: 'high',
      accessor: (user) => {
        const initials = user.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-linear-to-br from-indigo-500/15 to-purple-500/15 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/25 flex items-center justify-center text-xs shrink-0 shadow-2xs">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-default flex items-center gap-2">
                <span>{user.name}</span>
                {user.is_platform_admin && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Platform Admin
                  </span>
                )}
              </div>
              <div className="text-xs text-muted font-mono truncate">{user.email}</div>
              {user.phone && (
                <div className="text-[11px] text-muted/80 mt-0.5">{user.phone}</div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'employee',
      header: (
        <span className="flex items-center gap-1.5">
          <Briefcase className="size-3 text-muted" />
          Linked Staff Profile
        </span>
      ),
      priority: 'medium',
      accessor: (user) => {
        return user.employee ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-surface-sunken text-default border border-default">
                {user.employee.employee_code}
              </span>
              <span className="font-medium text-default text-xs">
                {user.employee.display_name}
              </span>
            </div>
            <div className="text-[11px] text-muted flex items-center gap-2">
              {user.employee.department && (
                <span className="flex items-center gap-1">
                  <Building className="size-3 text-muted/70" />
                  {user.employee.department}
                </span>
              )}
              {user.employee.designation && (
                <span className="flex items-center gap-1">
                  <Briefcase className="size-3 text-muted/70" />
                  {user.employee.designation}
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted italic bg-surface-sunken px-2 py-0.5 rounded border border-default">
            <Users className="size-3 text-muted/70" />
            Standalone Login
          </span>
        );
      },
    },
    {
      id: 'roles',
      header: (
        <span className="flex items-center gap-1.5">
          <Shield className="size-3 text-muted" />
          Assigned Roles
        </span>
      ),
      priority: 'low',
      accessor: (user) => (
        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
          {user.roles && user.roles.length > 0 ? (
            user.roles.map((r) => (
              <span
                key={r.id}
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getRoleBadgeStyle(
                  r.slug
                )}`}
                title={r.designation ? `Designation: ${r.designation}` : undefined}
              >
                <Shield className="size-3 mr-1 opacity-70" />
                <span>{r.name}</span>
                {r.designation && (
                  <span className="opacity-75 font-normal ml-1">({r.designation})</span>
                )}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
              <AlertCircle className="size-3 mr-1" />
              No Roles Assigned
            </span>
          )}

          {canManageRoles && (
            <button
              type="button"
              onClick={() => handleOpenRolesModal(user)}
              className="text-xs font-semibold text-primary hover:underline ml-1 inline-flex items-center gap-0.5 touch-target"
            >
              Edit Roles
            </button>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: (
        <span className="flex items-center gap-1.5">
          <Activity className="size-3 text-muted" />
          Status
        </span>
      ),
      priority: 'high',
      isStatus: true,
      accessor: (user) => (
        <button
          type="button"
          onClick={() => canUpdateUser && setToggleStatusUser(user)}
          disabled={!canUpdateUser}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all touch-target ${
            user.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 hover:bg-rose-500/20'
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          {user.status === 'active' ? 'Active' : 'Suspended'}
        </button>
      ),
    },
    {
      id: 'last_login',
      header: (
        <span className="flex items-center gap-1.5">
          <Clock className="size-3 text-muted" />
          Last Login
        </span>
      ),
      priority: 'low',
      accessor: (user) => (
        user.last_login_at ? (
          <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
            <Clock className="size-3 text-muted shrink-0" />
            <div>
              <div>{new Date(user.last_login_at).toLocaleDateString()}</div>
              <div className="text-[10px] text-muted/70">
                {new Date(user.last_login_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-muted/60 italic text-xs">Never</span>
        )
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      priority: 'high',
      isAction: true,
      align: 'right',
      accessor: (user) => (
        <div className="flex items-center justify-end gap-1.5">
          {canManageRoles && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenRolesModal(user)}
              className="h-7 text-xs px-2.5 gap-1 shadow-2xs hover:border-primary/40 touch-target"
              title="Assign or modify roles"
            >
              <Shield className="size-3 text-primary" />
              <span>Roles</span>
            </Button>
          )}

          {canUpdateUser && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenEditUser(user)}
              className="h-7 text-xs px-2.5 gap-1 shadow-2xs hover:border-blue-500/40 touch-target"
              title="Edit user profile & details"
            >
              <Edit className="size-3 text-blue-600 dark:text-blue-400" />
              <span>Edit</span>
            </Button>
          )}

          {canUpdateUser && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenPasswordModal(user)}
              className="size-7 p-0 text-muted hover:text-default hover:bg-surface-sunken touch-target"
              title="Reset password"
            >
              <KeyRound className="size-3.5" />
            </Button>
          )}

          {canDeleteUser &&
            String(user.id) !== String(currentUser?.id) &&
            !user.is_platform_admin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteModalUser(user)}
                className="size-7 p-0 text-muted hover:text-rose-600 hover:bg-rose-500/10 touch-target"
                title="Delete user account"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
        </div>
      ),
    },
  ];

  const getMobileActions = (user: UserData): ActionSheetItem[] => {
    const actions: ActionSheetItem[] = [];
    if (canManageRoles) {
      actions.push({
        label: 'Manage Roles',
        icon: Shield,
        onClick: () => handleOpenRolesModal(user),
      });
    }
    if (canUpdateUser) {
      actions.push({
        label: 'Edit User Profile',
        icon: Edit,
        onClick: () => handleOpenEditUser(user),
      });
      actions.push({
        label: 'Reset Password',
        icon: KeyRound,
        onClick: () => handleOpenPasswordModal(user),
      });
      actions.push({
        label: user.status === 'active' ? 'Suspend Account' : 'Activate Account',
        icon: Activity,
        onClick: () => setToggleStatusUser(user),
      });
    }
    if (canDeleteUser && String(user.id) !== String(currentUser?.id) && !user.is_platform_admin) {
      actions.push({
        label: 'Delete Account',
        icon: Trash2,
        variant: 'destructive',
        onClick: () => setDeleteModalUser(user),
      });
    }
    return actions;
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto py-2">
      {/* ── Workspace Header Surface ───────────────────────────────────── */}
      <div className="bg-surface border border-default rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-1.5">
                <Shield className="size-3" />
                Identity & RBAC
              </span>
              <span className="text-[10px] text-muted font-medium bg-surface-sunken px-2 py-0.5 rounded-full border border-default">
                Settings & Access
              </span>
              <span className="text-muted/40 text-xs">/</span>
              <span className="text-[11px] font-medium text-muted flex items-center gap-1">
                <ActiveCategoryIcon className="size-3 text-muted" />
                {activeCategoryConfig.label}
              </span>
              <span className="text-muted/40 text-xs">/</span>
              <span className="text-[11px] font-semibold text-default">
                {currentTabConfig?.shortLabel || currentTabConfig?.label || 'All Accounts'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default flex items-center gap-3">
              <div className="size-10 rounded-xl bg-linear-to-br from-indigo-500/15 via-purple-500/15 to-emerald-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Users className="size-5" />
              </div>
              <span>Staff & User Accounts</span>
            </h1>
            <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
              Provision system login credentials, map workforce personnel to operational roles, and enforce
              enterprise RBAC permissions.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="md"
              onClick={() => loadData(true)}
              disabled={loading || refreshing}
              className="text-xs"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            {canCreateUser && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setNewUserName('');
                  setNewUserEmail('');
                  setNewUserPhone('');
                  setNewUserPassword(generatePassword());
                  setNewUserRoleIds(new Set());
                  setLinkEmployeeId('');
                  setCreateModalOpen(true);
                }}
                className="text-xs"
              >
                <Plus className="size-4 mr-1.5" />
                <span>New User Account</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Summary Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Accounts */}
        <div className="bg-surface rounded-2xl border border-default p-4 space-y-1 shadow-2xs transition-all hover:border-indigo-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              Total User Accounts
            </span>
            <div className="size-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Users className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-default font-mono">{metrics.total}</div>
          <span className="text-[11px] text-muted block">Registered login profiles</span>
        </div>

        {/* Active Credentials */}
        <div className="bg-surface rounded-2xl border border-default p-4 space-y-1 shadow-2xs transition-all hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Active Credentials
            </span>
            <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <UserCheck className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {metrics.active}
          </div>
          <span className="text-[11px] text-muted block">Operational & unlocked</span>
        </div>

        {/* Linked Staff */}
        <div className="bg-surface rounded-2xl border border-default p-4 space-y-1 shadow-2xs transition-all hover:border-cyan-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
              Linked Staff Profiles
            </span>
            <div className="size-7 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <Briefcase className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 font-mono">
            {metrics.linkedEmployees}
          </div>
          <span className="text-[11px] text-muted block">Synced with HR directory</span>
        </div>

        {/* Defined Roles */}
        <div className="bg-surface rounded-2xl border border-default p-4 space-y-1 shadow-2xs transition-all hover:border-purple-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              RBAC Security Roles
            </span>
            <div className="size-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <Shield className="size-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
            {metrics.totalRoles}
          </div>
          <span className="text-[11px] text-muted block">Permission blueprints</span>
        </div>
      </div>

      {/* ── 2-Tier Universal Navigation Hub ─────────────────────────── */}
      <WorkspaceNavigationHub
        categories={categoriesConfig}
        tabs={tabsConfig}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        taglineRightContent={
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Showing</span>
            <strong className="text-default font-mono">{filteredUsers.length}</strong>
            <span>of {metrics.total} accounts</span>
          </div>
        }
      />

      {/* ── Search & Filter Toolbar ────────────────────────────────── */}
      <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by user name, email, employee code, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-8 py-2 text-xs text-default placeholder-muted focus:border-primary focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 rounded-full bg-surface-sunken hover:bg-surface text-muted hover:text-default flex items-center justify-center transition-colors"
                title="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Role Filter */}
            <div className="flex items-center gap-1.5 bg-surface-sunken border border-default rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="size-3 text-muted" />
              <span className="text-muted font-medium">Role:</span>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold focus:outline-none text-default cursor-pointer"
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
            <div className="flex items-center gap-1.5 bg-surface-sunken border border-default rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-muted font-medium">Status:</span>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold focus:outline-none text-default cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {/* Profile Filter */}
            <div className="flex items-center gap-1.5 bg-surface-sunken border border-default rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-muted font-medium">Profile:</span>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold focus:outline-none text-default cursor-pointer"
              >
                <option value="all">All Users</option>
                <option value="employee">Linked Employees</option>
                <option value="standalone">Standalone Users</option>
              </select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs h-8 px-2.5 text-muted hover:text-default"
                title="Reset all filters"
              >
                <RotateCcw className="size-3 mr-1" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Active Filter Chips Ribbon */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 pt-2 border-t border-default/60 flex-wrap text-xs">
            <span className="text-muted text-[11px] font-medium">Active Filters:</span>
            {activeTab !== 'all__all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <ActiveCategoryIcon className="size-3" />
                {currentTabConfig?.label}
              </span>
            )}
            {selectedRoleFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Role: {availableRoles.find((r) => r.slug === selectedRoleFilter)?.name || selectedRoleFilter}
              </span>
            )}
            {selectedStatusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 capitalize">
                Status: {selectedStatusFilter}
              </span>
            )}
            {selectedTypeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                Profile: {selectedTypeFilter === 'employee' ? 'Linked Employees' : 'Standalone'}
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-0.5 text-[11px] text-default border border-default">
                Query: &quot;{searchQuery}&quot;
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline ml-1 font-medium"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Users Directory Table ─────────────────────────────────── */}
      <ResponsiveDataTable<UserData>
        data={filteredUsers}
        columns={userColumns}
        keyExtractor={(user) => user.id}
        loading={loading}
        emptyMessage={
          hasActiveFilters
            ? 'No user accounts match your filter criteria. Try adjusting or resetting filters.'
            : 'No user accounts found. Get started by creating your first system user account or granting access from HR.'
        }
        emptyIcon={Users}
        mobileActions={getMobileActions}
      />

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
            <div className="text-xs text-muted font-medium">
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
          <div className="p-3 bg-surface-sunken rounded-xl border border-default flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-default">{rolesModalUser?.name}</div>
              <div className="text-muted font-mono">{rolesModalUser?.email}</div>
            </div>
            {rolesModalUser?.employee && (
              <div className="text-right">
                <span className="font-mono font-bold text-primary">
                  {rolesModalUser.employee.employee_code}
                </span>
                <div className="text-muted">{rolesModalUser.employee.department}</div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-default uppercase tracking-wider block">
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
                    className={`w-full p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-2xs'
                        : 'border-default bg-surface hover:bg-surface-sunken'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by container onClick
                      className="mt-0.5 rounded border-default text-primary focus:ring-primary h-4 w-4 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-default flex items-center justify-between">
                        <span>{role.name}</span>
                        {role.is_system && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-sunken font-mono text-muted border border-default">
                            System
                          </span>
                        )}
                      </div>
                      {role.designation && (
                        <div className="text-xs font-semibold text-primary mt-0.5">{role.designation}</div>
                      )}
                      <div className="text-xs text-muted font-mono mt-0.5">{role.slug}</div>
                      {role.description && (
                        <p className="text-xs text-muted mt-1 line-clamp-2">{role.description}</p>
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
          <div className="text-xs text-muted">
            Enter a new password or generate a high-entropy credential for the user. Active JWT
            sessions will be invalidated immediately.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-default">
              New Temporary or Permanent Password
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-surface-sunken border border-default rounded-xl font-mono focus:outline-none focus:border-primary text-default"
                placeholder="Enter password..."
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyPassword}
                className="h-9 px-3 gap-1"
              >
                {copiedPassword ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copiedPassword ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNewPassword(generatePassword())}
                className="h-9 px-3"
                title="Generate another password"
              >
                <RefreshCw className="size-3.5" />
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
          <div className="p-3 bg-surface-sunken rounded-xl border border-default space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-default flex items-center gap-1.5">
                <Briefcase className="size-3.5 text-primary" />
                Link to an Existing Staff Employee (Optional)
              </label>
              <span className="text-[11px] text-muted">
                {unlinkedEmployees.length} staff without ERP login
              </span>
            </div>
            <select
              value={linkEmployeeId}
              onChange={(e) => handleEmployeeSelection(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-surface border border-default rounded-xl focus:outline-none focus:border-primary text-default cursor-pointer"
            >
              <option value="">-- Standalone User (Not linked to staff directory) --</option>
              {unlinkedEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code} — {emp.display_name} ({emp.department || 'No Dept'} /{' '}
                  {emp.designation || 'Staff'})
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
              <label className="text-xs font-semibold text-default">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 text-sm bg-surface-sunken border border-default rounded-xl focus:outline-none focus:border-primary text-default"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-default">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@company.com"
                className="w-full px-3 py-2 text-sm bg-surface-sunken border border-default rounded-xl focus:outline-none focus:border-primary text-default"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-default">Phone Number</label>
              <input
                type="text"
                value={newUserPhone}
                onChange={(e) => setNewUserPhone(e.target.value)}
                placeholder="+8801700000000"
                className="w-full px-3 py-2 text-sm bg-surface-sunken border border-default rounded-xl focus:outline-none focus:border-primary text-default"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-default">
                Initial Password <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface-sunken border border-default rounded-xl font-mono focus:outline-none focus:border-primary text-default"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setNewUserPassword(generatePassword())}
                  className="h-9 px-2.5"
                  title="Generate random password"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Initial Role Selection */}
          <div className="space-y-2 pt-2 border-t border-default">
            <label className="text-xs font-semibold text-default uppercase tracking-wider block">
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
                    className={`w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-2xs'
                        : 'border-default bg-surface hover:bg-surface-sunken'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-default text-primary focus:ring-primary size-3.5 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-default">{role.name}</div>
                      <div className="text-[10px] text-muted font-mono">{role.slug}</div>
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
        <div className="py-2 text-sm text-default space-y-2">
          {toggleStatusUser?.status === 'active' ? (
            <p>
              Are you sure you want to suspend <strong>{toggleStatusUser?.name}</strong>? The user will
              be immediately logged out of all active sessions and prevented from signing in until
              reactivated.
            </p>
          ) : (
            <p>
              Are you sure you want to reactivate access for <strong>{toggleStatusUser?.name}</strong>?
              They will be able to log in with their existing credentials and assigned roles.
            </p>
          )}
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: EDIT USER PROFILE & ACCESS                             */}
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
            <span className="text-xs text-muted">Loading account profile...</span>
          </div>
        ) : editingUserData ? (
          <form onSubmit={handleSaveUserEdit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={editingUserData.name || ''}
                onChange={(e) => setEditingUserData({ ...editingUserData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken focus:outline-none focus:border-primary text-default"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-default mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={editingUserData.email || ''}
                  onChange={(e) => setEditingUserData({ ...editingUserData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken focus:outline-none focus:border-primary text-default"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-default mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editingUserData.phone || ''}
                  onChange={(e) => setEditingUserData({ ...editingUserData, phone: e.target.value })}
                  placeholder="+8801..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken focus:outline-none focus:border-primary text-default"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">Account Status</label>
              <select
                value={editingUserData.status || 'active'}
                onChange={(e) =>
                  setEditingUserData({
                    ...editingUserData,
                    status: e.target.value as 'active' | 'suspended',
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface-sunken focus:outline-none focus:border-primary text-default cursor-pointer"
              >
                <option value="active">Active (Full system login enabled)</option>
                <option value="suspended">Suspended (Access blocked)</option>
              </select>
            </div>

            {editingUserData.employee && (
              <div className="p-3 bg-surface-sunken rounded-xl border border-default space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Linked Employee Record
                </span>
                <div className="text-xs font-semibold text-default">
                  {editingUserData.employee.display_name} ({editingUserData.employee.employee_code})
                </div>
                <div className="text-[11px] text-muted">
                  Dept: {editingUserData.employee.department || 'N/A'} • Role:{' '}
                  {editingUserData.employee.designation || 'N/A'}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-default">
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIRM DELETE USER                                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!deleteModalUser}
        onClose={() => !deletingUser && setDeleteModalUser(null)}
        title="Delete User Account"
        subtitle={`Permanently revoke access and remove ${deleteModalUser?.name}`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => setDeleteModalUser(null)}
              disabled={deletingUser}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteUser}
              disabled={deletingUser}
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deletingUser ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  <span>Delete User</span>
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs space-y-2">
            <div className="font-bold flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-4" />
              <span>Confirm Account Deletion</span>
            </div>
            <p>
              Are you sure you want to delete user account <strong>{deleteModalUser?.name}</strong> (
              {deleteModalUser?.email})?
            </p>
            <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
              This action will revoke active JWT sessions, unlink any associated employee profile, and
              disable login credentials. Historic audit logs and created records will preserve data
              integrity.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
