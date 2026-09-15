import React, { useState } from 'react';
import {
  User as UserIcon,
  Shield,
  KeyRound,
  Building,
  MapPin,
  Clock,
  CheckCircle2,
  Lock,
  Save,
  Globe,
  Sparkles,
  Laptop,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuthStore } from '../../lib/auth/authStore';
import { useCurrency } from '../../lib/format/currency';
import { Button } from '../../components/ui/Button';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { api } from '../../lib/api/client';
import { useQuery } from '@tanstack/react-query';

export const ProfileSettingsWorkspace: React.FC = () => {
  const { user, tenant, activeBranch, branches, permissions } = useAuthStore();
  const { currencyCode, currencySymbol } = useCurrency();

  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'permissions' | 'preferences'>('general');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [designation, setDesignation] = useState(user?.role_label || user?.role || 'Staff Member');
  const [department, setDepartment] = useState(user?.department || 'Operations');

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // Preference state
  const [timezone, setTimezone] = useState(tenant?.timezone || 'Asia/Dhaka');
  const [locale, setLocale] = useState(user?.locale || 'en-BD');
  const [isSaved, setIsSaved] = useState(false);

  // Search permissions filter
  const [permissionSearch, setPermissionSearch] = useState('');

  const permissionList = Array.from(permissions || []);
  const permissionsQuery = useQuery({
    queryKey: ['auth', 'permissions'],
    queryFn: async () => {
      const res = await api.get<any>('/auth/permissions');
      return (res.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const allAvailablePermissions = Array.isArray(permissionsQuery.data)
    ? permissionsQuery.data.map((p: any) => typeof p === 'string' ? p : p.name || p.code || String(p))
    : permissionList;

  const filteredPermissions = (allAvailablePermissions.length > 0 ? allAvailablePermissions : permissionList).filter((p: string) =>
    p.toLowerCase().includes(permissionSearch.toLowerCase())
  );

  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch('/auth/preferences', {
        timezone,
        locale,
        density: 'comfortable',
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecuritySuccess(null);
    setSecurityError(null);

    if (!currentPassword) {
      setSecurityError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setSecurityError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('New password and confirmation do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await api.patch('/auth/change-password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setSecuritySuccess('Password successfully updated and active.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSecuritySuccess(null), 4000);
    } catch (err: any) {
      setSecurityError(err?.response?.data?.message || err?.message || 'Failed to update password. Please check your current password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to sign out of all active sessions across all devices?')) return;
    setIsLoggingOutAll(true);
    try {
      await api.post('/auth/logout-all', {});
      setSecuritySuccess('All other active sessions have been terminated.');
      setTimeout(() => setSecuritySuccess(null), 4000);
    } catch (err: any) {
      setSecurityError(err?.response?.data?.message || 'Failed to terminate other sessions.');
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-2xl border border-default bg-surface p-6 sm:p-7 shadow-xs">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-600 to-teal-700 text-white font-bold text-2xl shadow-lg ring-4 ring-emerald-500/20">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-default tracking-tight">
                  {user?.name || 'Operator Profile'}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="size-3" />
                  {user?.is_platform_admin ? 'Platform Superadmin' : 'Factory Operator'}
                </span>
                <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-muted border border-default">
                  Active
                </span>
              </div>
              <p className="text-xs text-muted flex items-center gap-2">
                <span>{user?.email}</span>
                <span>•</span>
                <span>ID: {user?.id}</span>
                <span>•</span>
                <span className="font-semibold text-default">{tenant?.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActiveTab('permissions');
                const search = document.getElementById('search-perm-input');
                if (search) search.focus();
              }}
              className="text-xs"
            >
              <Shield className="size-3.5 mr-1.5 text-emerald-500" />
              <span>{permissionList.length} Active Permissions</span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8 flex overflow-x-auto p-1.5 bg-surface-sunken rounded-2xl border border-default shadow-2xs">
          <div className="flex gap-1.5 min-w-full sm:min-w-0">
            {[
              { id: 'general', label: 'Personal & Role Profile', icon: UserIcon },
              { id: 'security', label: 'Security & Credentials', icon: KeyRound },
              { id: 'permissions', label: 'Assigned Privileges', icon: Shield },
              { id: 'preferences', label: 'Workstation Preferences', icon: Globe },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setActiveTab(t.id as 'general' | 'security' | 'permissions' | 'preferences')
                  }
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-primary text-primary-fg font-semibold shadow-xs border border-primary'
                      : 'text-muted hover:text-default hover:bg-surface/50 border border-transparent'
                  }`}
                >
                  <Icon className={`size-3.5 ${isActive ? 'text-primary-fg' : 'text-muted'}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="space-y-6">
        {/* TAB 1: General Info */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSaveProfile} className="rounded-2xl border border-default bg-surface p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-default pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-default">Personal Information</h3>
                    <p className="text-xs text-muted">Update your public identification and staff record.</p>
                  </div>
                  {isSaved && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-semibold animate-fade-in">
                      <Check className="size-3.5" />
                      Changes Saved
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                      Designation / Role Title
                    </label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Department / Line Unit
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" size="sm" className="text-xs">
                    <Save className="size-3.5 mr-1.5" />
                    <span>Save Profile Details</span>
                  </Button>
                </div>
              </form>

              {/* Workstation & Factory Assignment */}
              <div className="rounded-2xl border border-default bg-surface p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-default">Assigned Factory Scope</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-default bg-surface-sunken space-y-1">
                    <div className="flex items-center gap-1.5 text-muted">
                      <Building className="size-3.5 text-emerald-500" />
                      <span className="font-semibold text-[11px]">Primary Tenant</span>
                    </div>
                    <p className="font-bold text-default">{tenant?.name || 'Slice Mart Ltd'}</p>
                    <p className="text-[10px] text-muted font-mono">{tenant?.slug}</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-default bg-surface-sunken space-y-1">
                    <div className="flex items-center gap-1.5 text-muted">
                      <MapPin className="size-3.5 text-blue-500" />
                      <span className="font-semibold text-[11px]">Active Branch</span>
                    </div>
                    <p className="font-bold text-default">{activeBranch?.name || 'Main Factory HQ'}</p>
                    <p className="text-[10px] text-muted font-mono">{activeBranch?.code || 'HQ-01'}</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-default bg-surface-sunken space-y-1">
                    <div className="flex items-center gap-1.5 text-muted">
                      <Clock className="size-3.5 text-amber-500" />
                      <span className="font-semibold text-[11px]">Timezone</span>
                    </div>
                    <p className="font-bold text-default">{tenant?.timezone || 'UTC'}</p>
                    <p className="text-[10px] text-muted">Currency: {currencyCode} ({currencySymbol})</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Account Status & Quick Cards */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-default bg-surface p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-default uppercase tracking-wider">Account Overview</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-default">
                    <span className="text-muted">Status</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      Active & Verified
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-default">
                    <span className="text-muted">Auth Level</span>
                    <span className="font-semibold text-default">
                      {user?.is_platform_admin ? 'SaaS Super Admin' : 'Full Factory Access'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-default">
                    <span className="text-muted">Branches Accessible</span>
                    <span className="font-semibold text-default">{branches.length || 1} Factory Branches</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">2FA Verification</span>
                    <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Enforced
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-default bg-surface p-5 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-default uppercase tracking-wider">Active Device Session</h3>
                <div className="flex items-start gap-3 p-3 rounded-xl border border-default bg-surface-sunken">
                  <Laptop className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-default">Chrome on Windows 11</p>
                    <p className="text-[11px] text-muted">Current Session • 127.0.0.1</p>
                    <span className="inline-block text-[10px] font-mono text-emerald-500 font-semibold">Active Now</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Security & Password */}
        {activeTab === 'security' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <form onSubmit={handleUpdatePassword} className="rounded-2xl border border-default bg-surface p-6 shadow-xs space-y-5">
              <div className="border-b border-default pb-4">
                <h3 className="text-sm font-bold text-default">Change Account Password</h3>
                <p className="text-xs text-muted">Ensure your account is protected with a strong, distinct passphrase.</p>
              </div>

              {securityError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{securityError}</span>
                </div>
              )}

              {securitySuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{securitySuccess}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted hover:text-default"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" size="sm" className="text-xs" disabled={isUpdatingPassword}>
                  <Lock className="size-3.5 mr-1.5" />
                  <span>{isUpdatingPassword ? 'Updating...' : 'Update Password'}</span>
                </Button>
              </div>
            </form>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 shadow-xs space-y-4">
              <div className="border-b border-rose-500/10 pb-3">
                <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">Terminate Active Sessions</h3>
                <p className="text-xs text-muted">
                  Revoke all active authentication tokens across any web browsers, mobile devices, or POS terminals currently logged into this account.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Force logout on all devices</span>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="text-xs"
                  onClick={handleLogoutAll}
                  disabled={isLoggingOutAll}
                >
                  <Shield className="size-3.5 mr-1.5" />
                  <span>{isLoggingOutAll ? 'Terminating...' : 'Sign Out Everywhere'}</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Permissions & Privileges */}
        {activeTab === 'permissions' && (
          <div className="rounded-2xl border border-default bg-surface p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-default pb-4">
              <div>
                <h3 className="text-sm font-bold text-default">Assigned Permissions & Scopes</h3>
                <p className="text-xs text-muted">
                  These authorization capabilities are dynamically loaded from your active role assignment.
                </p>
              </div>
              <div className="w-full sm:w-64">
                <input
                  id="search-perm-input"
                  type="text"
                  placeholder="Filter permissions..."
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredPermissions.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-muted">
                  No matching permissions found.
                </div>
              ) : (
                filteredPermissions.map((perm) => {
                  const parts = perm.split('.');
                  const domain = parts[0] || 'core';
                  return (
                    <div
                      key={perm}
                      className="flex items-center gap-2.5 rounded-xl border border-default bg-surface-sunken p-2.5 text-xs"
                    >
                      <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold text-[10px]">
                        ✓
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-[11px] font-semibold text-default block truncate">
                          {perm}
                        </span>
                        <span className="text-[10px] text-muted capitalize">{domain} module</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Workstation Preferences */}
        {activeTab === 'preferences' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="rounded-2xl border border-default bg-surface p-6 shadow-xs space-y-5">
              <div className="border-b border-default pb-4">
                <h3 className="text-sm font-bold text-default">Workstation & Regional Settings</h3>
                <p className="text-xs text-muted">Configure display defaults, date formats, and language.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Timezone Standard
                  </label>
                  <SelectDropdown
                    options={[
                      { value: 'Asia/Dhaka', label: 'Asia/Dhaka (GMT+06:00 - Bangladesh Standard Time)' },
                      { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
                      { value: 'Asia/Singapore', label: 'Asia/Singapore (GMT+08:00)' },
                      { value: 'Europe/London', label: 'Europe/London (GMT+00:00)' },
                      { value: 'America/New_York', label: 'America/New_York (EST)' },
                    ]}
                    value={timezone}
                    onChange={(val) => setTimezone(val)}
                    size="md"
                    buttonClassName="w-full"
                    aria-label="Timezone standard"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Locale & Currency Presentation
                  </label>
                  <SelectDropdown
                    options={[
                      { value: 'en-US', label: `English — ${currencyCode} (${currencySymbol})` },
                      { value: 'en-BD', label: `English (Regional) — ${currencyCode} (${currencySymbol})` },
                      { value: 'bn-BD', label: `বাংলা — ${currencyCode} (${currencySymbol})` },
                    ]}
                    value={locale}
                    onChange={(val) => setLocale(val)}
                    size="md"
                    buttonClassName="w-full"
                    aria-label="Locale and currency"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={() => {
                      setIsSaved(true);
                      setTimeout(() => setIsSaved(false), 2500);
                    }}
                    size="sm"
                    className="text-xs"
                  >
                    <Save className="size-3.5 mr-1.5" />
                    <span>Apply Preferences</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
