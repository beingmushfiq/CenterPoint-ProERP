import React, { useState, useMemo, useEffect } from 'react';
import {
  Shield,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Users,
  Lock,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Eye,
  PlusCircle,
  Pencil,
  AlertCircle,
  CheckSquare,
  Square,
  Layers,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { extractList } from '../../lib/api/apiData';
import { useAuthStore } from '../../lib/auth/authStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { notify } from '../../components/ui/Toast';

export interface PermissionItem {
  id: number;
  name: string;
  module: string;
  resource: string;
  action: string;
  description?: string;
}

export interface ResourceGroup {
  resource: string;
  permissions: PermissionItem[];
}

export interface ModuleGroup {
  module: string;
  resources: ResourceGroup[];
}

export interface RoleData {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  description?: string | null;
  is_system: boolean;
  users_count?: number;
  permissions_count?: number;
  permissions?: PermissionItem[];
  created_at?: string;
}

export const RolesManagementWorkspace: React.FC = () => {
  const { hasPermission } = useAuthStore();
  const canCreateRole = hasPermission('core.role.create') || hasPermission('core.role.manage');
  const canEditRole = hasPermission('core.role.update') || hasPermission('core.role.manage');
  const canDeleteRole = hasPermission('core.role.delete') || hasPermission('core.role.manage');

  const [roles, setRoles] = useState<RoleData[]>([]);
  const [modulesList, setModulesList] = useState<ModuleGroup[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [roleSearch, setRoleSearch] = useState('');
  const [permMatrixSearch, setPermMatrixSearch] = useState('');
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  // Active Role Modal Editor
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleSlug, setRoleSlug] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermIds, setSelectedPermIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  // Delete Confirmation Modal
  const [roleToDelete, setRoleToDelete] = useState<RoleData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Role Members Modal
  const [membersRole, setMembersRole] = useState<RoleData | null>(null);
  const [roleMembers, setRoleMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<string>('');
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

  // Load Roles & Permission Catalog
  useEffect(() => {
    let ignore = false;

    Promise.all([
      api.get<RoleData[]>('/roles'),
      api.get<{ raw: PermissionItem[]; grouped: ModuleGroup[] }>('/permissions'),
    ])
      .then(([rolesRes, permsRes]) => {
        if (!ignore) {
          const rolesData = extractList<RoleData>(rolesRes);
          setRoles(rolesData);

          const permsPayload = (permsRes.data && typeof permsRes.data === 'object' && 'data' in permsRes.data)
            ? (permsRes.data as { data: { raw: PermissionItem[]; grouped: ModuleGroup[] } }).data
            : permsRes.data;
          const rawList = permsPayload?.raw ?? [];
          const groupedList = permsPayload?.grouped ?? [];

          setAllPermissions(rawList);
          setModulesList(groupedList);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to load roles and permission catalog';
          notify.error(msg);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const refreshData = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  // Open Create Role Modal
  const handleOpenCreate = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleSlug('');
    setRoleDescription('');
    setSelectedPermIds(new Set());
    setIsModalOpen(true);
  };

  // Open Edit Role Modal
  const handleOpenEdit = async (role: RoleData) => {
    try {
      const res = await api.get<any>(`/roles/${role.id}`);
      const payload = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as any).data
        : res.data;
      const target = payload || role;
      setEditingRole(target);
      setRoleName(target.name);
      setRoleSlug(target.slug);
      setRoleDescription(target.description || '');
      const ids = new Set<number>((target.permissions || []).map((p: any) => Number(p.id)));
      setSelectedPermIds(ids);
      setIsModalOpen(true);
    } catch {
      setEditingRole(role);
      setRoleName(role.name);
      setRoleSlug(role.slug);
      setRoleDescription(role.description || '');
      const ids = new Set<number>((role.permissions || []).map((p) => Number(p.id)));
      setSelectedPermIds(ids);
      setIsModalOpen(true);
    }
  };

  // Clone Role
  const handleCloneRole = (role: RoleData) => {
    setEditingRole(null);
    setRoleName(`${role.name} (Copy)`);
    setRoleSlug(`${role.slug}_copy`);
    setRoleDescription(`Cloned from ${role.name}. ${role.description || ''}`);
    const ids = new Set((role.permissions || []).map((p) => p.id));
    setSelectedPermIds(ids);
    setIsModalOpen(true);
  };

  // Toggle single permission ID
  const togglePermission = (id: number) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle All permissions in a Resource row
  const toggleResourceAll = (resourcePerms: PermissionItem[]) => {
    const allChecked = resourcePerms.every((p) => selectedPermIds.has(p.id));
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      resourcePerms.forEach((p) => {
        if (allChecked) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      });
      return next;
    });
  };

  // Toggle All permissions in an entire Module
  const toggleModuleAll = (moduleGroup: ModuleGroup) => {
    const allModulePerms: PermissionItem[] = [];
    moduleGroup.resources.forEach((r) => {
      r.permissions.forEach((p) => allModulePerms.push(p));
    });

    const allChecked = allModulePerms.every((p) => selectedPermIds.has(p.id));
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      allModulePerms.forEach((p) => {
        if (allChecked) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      });
      return next;
    });
  };

  // Preset: Select All (Full Admin)
  const handleSelectAll = () => {
    const allIds = new Set(allPermissions.map((p) => p.id));
    setSelectedPermIds(allIds);
  };

  // Preset: Clear All
  const handleClearAll = () => {
    setSelectedPermIds(new Set());
  };

  // Preset: Read-Only (View Only)
  const handlePresetReadOnly = () => {
    const viewIds = new Set(
      allPermissions
        .filter((p) => p.action === 'view' || p.name?.endsWith('.view'))
        .map((p) => p.id)
    );
    setSelectedPermIds(viewIds);
  };

  // Preset: Standard Operator (View + Create + Update on operational records)
  const handlePresetOperator = () => {
    const opIds = new Set(
      allPermissions
        .filter(
          (p) =>
            (['view', 'create', 'update'].includes(p.action) ||
             p.name?.endsWith('.view') ||
             p.name?.endsWith('.create') ||
             p.name?.endsWith('.update')) &&
            !p.module?.includes('platform') &&
            !p.name?.startsWith('platform.')
        )
        .map((p) => p.id)
    );
    setSelectedPermIds(opIds);
  };

  // Save Role
  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      notify.error('Role name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: roleName.trim(),
        slug: roleSlug.trim() || undefined,
        description: roleDescription.trim() || undefined,
        permission_ids: Array.from(selectedPermIds),
      };

      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, payload);
        notify.success(`Role "${roleName}" updated successfully.`);
      } else {
        await api.post('/roles', payload);
        notify.success(`Custom Role "${roleName}" created successfully.`);
      }

      setIsModalOpen(false);
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save role configuration.';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Delete Role
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/roles/${roleToDelete.id}`);
      notify.success(`Role "${roleToDelete.name}" deleted successfully.`);
      setRoleToDelete(null);
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete role.';
      notify.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Role Members Management
  const handleOpenMembersModal = async (role: RoleData) => {
    setMembersRole(role);
    setLoadingMembers(true);
    setSelectedUserToAdd('');
    try {
      const [membersRes, usersRes] = await Promise.all([
        api.get<any>(`/roles/${role.id}/users`),
        allUsersList.length === 0 ? api.get<any>('/users') : Promise.resolve({ data: allUsersList }),
      ]);
      const members = membersRes.data?.data || (Array.isArray(membersRes.data) ? membersRes.data : []);
      setRoleMembers(members);

      const users = usersRes.data?.data || (Array.isArray(usersRes.data) ? usersRes.data : []);
      setAllUsersList(users);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load role members';
      notify.error(msg);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAssignUserToRole = async () => {
    if (!membersRole || !selectedUserToAdd) return;
    setAddingMember(true);
    try {
      await api.post(`/roles/${membersRole.id}/users`, {
        user_id: parseInt(selectedUserToAdd, 10),
      });
      notify.success('User assigned to role successfully.');
      setSelectedUserToAdd('');
      const membersRes = await api.get<any>(`/roles/${membersRole.id}/users`);
      const members = membersRes.data?.data || (Array.isArray(membersRes.data) ? membersRes.data : []);
      setRoleMembers(members);
      setRoles((prev) =>
        prev.map((r) => (r.id === membersRole.id ? { ...r, users_count: (r.users_count ?? 0) + 1 } : r))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign user to role';
      notify.error(msg);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveUserFromRole = async (userId: number) => {
    if (!membersRole) return;
    setRemovingMemberId(userId);
    try {
      await api.delete(`/roles/${membersRole.id}/users/${userId}`);
      notify.success('User removed from role.');
      setRoleMembers((prev) => prev.filter((m) => m.id !== userId));
      setRoles((prev) =>
        prev.map((r) =>
          r.id === membersRole.id ? { ...r, users_count: Math.max(0, (r.users_count ?? 1) - 1) } : r
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove user from role';
      notify.error(msg);
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Filtered Roles List
  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return roles;
    const q = roleSearch.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [roles, roleSearch]);

  // Filtered Modules for Permission Matrix Search
  const filteredModules = useMemo(() => {
    if (!permMatrixSearch.trim()) return modulesList;
    const q = permMatrixSearch.toLowerCase();

    return modulesList
      .map((mod) => {
        const matchingResources = mod.resources.filter(
          (r) =>
            r.resource.toLowerCase().includes(q) ||
            mod.module.toLowerCase().includes(q) ||
            r.permissions.some((p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)))
        );
        return {
          ...mod,
          resources: matchingResources,
        };
      })
      .filter((mod) => mod.resources.length > 0);
  }, [modulesList, permMatrixSearch]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-default bg-surface p-6 sm:p-7 shadow-xs">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-600 to-teal-700 text-white font-bold shadow-lg ring-4 ring-emerald-500/20">
              <Shield className="size-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-default tracking-tight">
                  Custom RBAC & Permission Matrix
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="size-3" />
                  Granular CRUD Control
                </span>
              </div>
              <p className="text-xs text-muted max-w-2xl leading-relaxed">
                Configure custom security roles with precise toggles for <strong>View</strong>, <strong>Add (Create)</strong>,{' '}
                <strong>Edit (Update)</strong>, and <strong>Delete</strong> across all factory & commercial modules.
              </p>
            </div>
          </div>

          {canCreateRole && (
            <div className="flex items-center gap-2.5">
              <Button variant="primary" size="md" onClick={handleOpenCreate} className="text-xs shadow-md shadow-emerald-600/20">
                <Plus className="size-3.5 mr-1.5" />
                <span>Create Custom Role</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Role Directory Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Search roles by title, code or scope..."
            value={roleSearch}
            onChange={(e) => setRoleSearch(e.target.value)}
            className="w-full rounded-xl border border-default bg-surface pl-10 pr-4 py-2 text-xs text-default placeholder-muted focus:border-primary focus:outline-none shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="font-semibold text-default">{roles.length}</span>
          <span>Configured Roles</span>
          <span>•</span>
          <span className="font-semibold text-default">{allPermissions.length}</span>
          <span>Canonical Permissions</span>
        </div>
      </div>

      {/* Roles Cards Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoles.map((role) => {
            const permCount = role.permissions_count ?? role.permissions?.length ?? 0;
            const pct = Math.round((permCount / Math.max(1, allPermissions.length)) * 100);

            return (
              <div
                key={role.id}
                className="rounded-2xl border border-default bg-surface p-5 space-y-4 shadow-xs hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-default">{role.name}</h3>
                        {role.is_system ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold text-muted border border-default">
                            <Lock className="size-2.5" />
                            System Standard
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Custom Role
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-muted block mt-0.5">{role.slug}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canCreateRole && (
                        <button
                          type="button"
                          onClick={() => handleCloneRole(role)}
                          title="Clone Role Matrix"
                          className="rounded-lg p-1.5 text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      )}
                      {canEditRole && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(role)}
                          title="Configure Role Permissions"
                          className="rounded-lg p-1.5 text-primary hover:bg-primary-subtle transition-colors cursor-pointer"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                      )}
                      {!role.is_system && canDeleteRole && (
                        <button
                          type="button"
                          onClick={() => setRoleToDelete(role)}
                          title="Delete Role"
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-relaxed line-clamp-2">
                    {role.description || 'Custom factory operational role with tailored module and action scopes.'}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-default">
                  {/* Permissions Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted font-medium">Access Scope</span>
                      <span className="font-mono font-bold text-default">
                        {permCount} / {allPermissions.length} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenMembersModal(role)}
                      className="flex items-center gap-1.5 text-primary hover:underline text-[11px] font-medium cursor-pointer transition-colors"
                      title="View & manage assigned users"
                    >
                      <Users className="size-3.5" />
                      <span>{role.users_count ?? 0} Users Assigned</span>
                    </button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEdit(role)}
                      className="text-[11px] h-7 px-2.5"
                    >
                      <span>Matrix Setup →</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role Configuration & Permission Matrix Modal */}
      {isModalOpen && (
        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Custom Role'}
          size="xl"
        >
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
            {/* Basic Information */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 bg-surface-sunken p-4 rounded-xl border border-default">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                  Role Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assistant QC Inspector"
                  value={roleName}
                  onChange={(e) => {
                    setRoleName(e.target.value);
                    if (!editingRole) {
                      setRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
                    }
                  }}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-1.5 text-xs text-default placeholder-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                  Role Key / Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. assistant_qc"
                  value={roleSlug}
                  disabled={editingRole?.is_system}
                  onChange={(e) => setRoleSlug(e.target.value)}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-1.5 text-xs font-mono text-default placeholder-muted focus:border-primary focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Scope & responsibilities..."
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-1.5 text-xs text-default placeholder-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Matrix Control Toolbar & Presets */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-default">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider mr-1">
                  Quick Presets:
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="rounded-lg border border-default bg-surface-sunken px-2.5 py-1 text-[11px] font-semibold text-default hover:border-primary transition-colors cursor-pointer"
                >
                  Full Admin (All)
                </button>
                <button
                  type="button"
                  onClick={handlePresetReadOnly}
                  className="rounded-lg border border-default bg-surface-sunken px-2.5 py-1 text-[11px] font-semibold text-default hover:border-primary transition-colors cursor-pointer"
                >
                  Read-Only (View)
                </button>
                <button
                  type="button"
                  onClick={handlePresetOperator}
                  className="rounded-lg border border-default bg-surface-sunken px-2.5 py-1 text-[11px] font-semibold text-default hover:border-primary transition-colors cursor-pointer"
                >
                  Operator CRUD
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-lg border border-default bg-surface-sunken px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:border-rose-500 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder="Filter matrix..."
                    value={permMatrixSearch}
                    onChange={(e) => setPermMatrixSearch(e.target.value)}
                    className="w-full rounded-lg border border-default bg-surface-sunken pl-8 pr-3 py-1 text-xs text-default placeholder-muted focus:border-primary focus:outline-none"
                  />
                </div>

                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  {selectedPermIds.size} / {allPermissions.length} Enabled
                </span>
              </div>
            </div>

            {/* Granular CRUD Matrix Table */}
            <div className="space-y-4">
              {filteredModules.map((mod) => {
                const isCollapsed = !!collapsedModules[mod.module];
                const allModulePerms: PermissionItem[] = [];
                mod.resources.forEach((r) => r.permissions.forEach((p) => allModulePerms.push(p)));
                const allChecked = allModulePerms.length > 0 && allModulePerms.every((p) => selectedPermIds.has(p.id));
                const someChecked = allModulePerms.some((p) => selectedPermIds.has(p.id));

                return (
                  <div
                    key={mod.module}
                    className="rounded-xl border border-default bg-surface overflow-hidden shadow-2xs"
                  >
                    {/* Module Header */}
                    <div className="flex items-center justify-between bg-surface-sunken px-4 py-2.5 border-b border-default">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedModules((prev) => ({
                              ...prev,
                              [mod.module]: !prev[mod.module],
                            }))
                          }
                          className="text-muted hover:text-default transition-colors cursor-pointer"
                        >
                          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                        <Layers className="size-4 text-emerald-500" />
                        <h4 className="text-xs font-bold text-default uppercase tracking-wider">
                          {mod.module.replace(/_/g, ' ')} Module
                        </h4>
                        <span className="text-[10px] text-muted font-mono">
                          ({mod.resources.length} resources)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleModuleAll(mod)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                      >
                        {allChecked ? <CheckSquare className="size-3.5" /> : someChecked ? <Square className="size-3.5 text-emerald-500" /> : <Square className="size-3.5" />}
                        <span>Toggle All {mod.module}</span>
                      </button>
                    </div>

                    {/* Resources Table */}
                    {!isCollapsed && (
                      <div className="divide-y divide-default">
                        {mod.resources.map((res) => {
                          const viewPerm = res.permissions.find((p) => p.action === 'view');
                          const createPerm = res.permissions.find((p) => p.action === 'create');
                          const updatePerm = res.permissions.find((p) => p.action === 'update');
                          const deletePerm = res.permissions.find((p) => p.action === 'delete');
                          const otherPerms = res.permissions.filter(
                            (p) => !['view', 'create', 'update', 'delete'].includes(p.action)
                          );

                          const rowChecked = res.permissions.every((p) => selectedPermIds.has(p.id));

                          return (
                            <div
                              key={res.resource}
                              className="px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-surface-sunken/40 transition-colors"
                            >
                              {/* Resource Title */}
                              <div className="min-w-48">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleResourceAll(res.permissions)}
                                    className="text-muted hover:text-primary transition-colors cursor-pointer"
                                    title="Toggle entire resource"
                                  >
                                    {rowChecked ? (
                                      <CheckSquare className="size-3.5 text-primary" />
                                    ) : (
                                      <Square className="size-3.5" />
                                    )}
                                  </button>
                                  <span className="text-xs font-bold text-default capitalize">
                                    {res.resource.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-muted block pl-5.5">
                                  {mod.module}.{res.resource}
                                </span>
                              </div>

                              {/* CRUD Action Checkboxes Matrix */}
                              <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                                {/* VIEW */}
                                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    disabled={!viewPerm}
                                    checked={viewPerm ? selectedPermIds.has(viewPerm.id) : false}
                                    onChange={() => viewPerm && togglePermission(viewPerm.id)}
                                    className="rounded border-default text-emerald-600 focus:ring-emerald-500 disabled:opacity-30"
                                  />
                                  <span className={viewPerm ? 'text-default' : 'text-muted/40'}>
                                    <Eye className="inline size-3 mr-0.5 text-blue-500" />
                                    View
                                  </span>
                                </label>

                                {/* CREATE (ADD) */}
                                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    disabled={!createPerm}
                                    checked={createPerm ? selectedPermIds.has(createPerm.id) : false}
                                    onChange={() => createPerm && togglePermission(createPerm.id)}
                                    className="rounded border-default text-emerald-600 focus:ring-emerald-500 disabled:opacity-30"
                                  />
                                  <span className={createPerm ? 'text-default' : 'text-muted/40'}>
                                    <PlusCircle className="inline size-3 mr-0.5 text-emerald-500" />
                                    Add
                                  </span>
                                </label>

                                {/* UPDATE (EDIT) */}
                                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    disabled={!updatePerm}
                                    checked={updatePerm ? selectedPermIds.has(updatePerm.id) : false}
                                    onChange={() => updatePerm && togglePermission(updatePerm.id)}
                                    className="rounded border-default text-emerald-600 focus:ring-emerald-500 disabled:opacity-30"
                                  />
                                  <span className={updatePerm ? 'text-default' : 'text-muted/40'}>
                                    <Pencil className="inline size-3 mr-0.5 text-amber-500" />
                                    Edit
                                  </span>
                                </label>

                                {/* DELETE */}
                                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    disabled={!deletePerm}
                                    checked={deletePerm ? selectedPermIds.has(deletePerm.id) : false}
                                    onChange={() => deletePerm && togglePermission(deletePerm.id)}
                                    className="rounded border-default text-emerald-600 focus:ring-emerald-500 disabled:opacity-30"
                                  />
                                  <span className={deletePerm ? 'text-default' : 'text-muted/40'}>
                                    <Trash2 className="inline size-3 mr-0.5 text-rose-500" />
                                    Delete
                                  </span>
                                </label>

                                {/* Other Special Actions (Approve, Void, Lock, Manage, Export) */}
                                {otherPerms.length > 0 && (
                                  <div className="flex items-center gap-2 border-l border-default pl-3">
                                    {otherPerms.map((op) => {
                                      const isChecked = selectedPermIds.has(op.id);
                                      return (
                                        <button
                                          key={op.id}
                                          type="button"
                                          onClick={() => togglePermission(op.id)}
                                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all cursor-pointer ${
                                            isChecked
                                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                              : 'bg-surface-sunken text-muted border border-default hover:text-default'
                                          }`}
                                          title={op.description || op.name}
                                        >
                                          {op.action}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-default sticky bottom-0 bg-surface">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveRole}
                disabled={saving || !roleName.trim() || (editingRole ? !canEditRole : !canCreateRole)}
                className="shadow-md shadow-emerald-600/20"
              >
                {saving ? 'Saving Permissions Matrix...' : 'Save Role Permissions'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {roleToDelete && (
        <Modal
          open={!!roleToDelete}
          onClose={() => setRoleToDelete(null)}
          title="Confirm Delete Role"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              <AlertCircle className="size-5 shrink-0" />
              <p className="text-xs">
                Are you sure you want to delete custom role <strong>{roleToDelete.name}</strong>?
              </p>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              This will revoke all mapped permissions for this role. Users must have at least one other active role to access system modules.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <Button variant="ghost" onClick={() => setRoleToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteRole}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Role Members Management Modal */}
      {membersRole && (
        <Modal
          open={!!membersRole}
          onClose={() => setMembersRole(null)}
          title={`Role Members: ${membersRole.name}`}
          subtitle={`Manage staff and user accounts holding the ${membersRole.name} security role`}
          size="lg"
          footer={
            <div className="flex justify-between items-center w-full">
              <span className="text-xs text-muted font-medium">
                {roleMembers.length} {roleMembers.length === 1 ? 'member' : 'members'} assigned
              </span>
              <Button variant="secondary" size="sm" onClick={() => setMembersRole(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-2">
            {/* Quick Assign Box */}
            <div className="p-3.5 rounded-xl border border-default bg-surface-sunken space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-default">
                <UserPlus className="size-3.5 text-primary" />
                <span>Assign Staff Member or User to this Role</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedUserToAdd}
                  onChange={(e) => setSelectedUserToAdd(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-surface border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-default cursor-pointer"
                >
                  <option value="">-- Select user to assign --</option>
                  {allUsersList
                    .filter((u) => !roleMembers.some((m) => m.id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) {u.employee ? `— ${u.employee.employee_code}` : ''}
                      </option>
                    ))}
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAssignUserToRole}
                  disabled={!selectedUserToAdd || addingMember}
                  className="h-8 text-xs gap-1"
                >
                  <UserPlus className="size-3.5" />
                  {addingMember ? 'Assigning...' : 'Assign User'}
                </Button>
              </div>
            </div>

            {/* Members List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-default uppercase tracking-wider">
                Currently Assigned Accounts
              </div>
              {loadingMembers ? (
                <div className="p-8 text-center text-xs text-muted">
                  Loading role members...
                </div>
              ) : roleMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted border border-dashed border-default rounded-xl">
                  No staff or users are currently assigned to this role. Use the selector above to assign members.
                </div>
              ) : (
                <div className="border border-default rounded-xl overflow-hidden divide-y divide-default max-h-80 overflow-y-auto">
                  {roleMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-3 bg-surface hover:bg-surface-sunken transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-default flex items-center gap-2">
                            <span>{member.name}</span>
                            <span
                              className={`inline-block size-1.5 rounded-full ${
                                member.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                          </div>
                          <div className="text-[11px] text-muted font-mono truncate">{member.email}</div>
                          {member.employee && (
                            <div className="text-[10px] text-muted flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono font-semibold text-default bg-surface-sunken px-1 rounded border border-default">
                                {member.employee.employee_code}
                              </span>
                              {member.employee.department && (
                                <span>• {member.employee.department}</span>
                              )}
                              {member.employee.designation && (
                                <span>• {member.employee.designation}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUserFromRole(member.id)}
                        disabled={removingMemberId === member.id}
                        className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 text-xs gap-1"
                        title="Remove user from this role"
                      >
                        <UserMinus className="size-3.5" />
                        <span>Remove</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
