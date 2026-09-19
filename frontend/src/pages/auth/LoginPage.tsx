import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock, Mail, Moon, Package, Sun, X } from 'lucide-react';
import { useAuthStore } from '../../lib/auth/authStore';
import { isApiError } from '../../lib/api/errors';
import { api } from '../../lib/api/client';
import { toggleThemeWithTransition } from '../../lib/theme/themeTransition';
import { useTenantBranding } from '../../lib/theme/useTenantBranding';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';

const loginSchema = z.object({
  email: z.string().min(1, 'Please enter your email, name, or designation'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoRef = useRef<HTMLImageElement>(null);

  // Dynamic branding from Settings
  const { companyName, logoUrl } = useTenantBranding();
  const logoLoadFailed = Boolean(logoUrl && failedLogoUrl === logoUrl);

  useEffect(() => {
    const el = logoRef.current;
    if (!el || !logoUrl) return;
    const handleError = () => {
      setFailedLogoUrl(logoUrl);
    };
    el.addEventListener('error', handleError);
    return () => {
      el.removeEventListener('error', handleError);
    };
  }, [logoUrl]);

  // Theme support: default to light mode unless explicitly set to dark
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ui.theme') || localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [theme]);

  // Handle circular ripple theme transition starting from the button click
  const handleToggleTheme = (e: React.MouseEvent) => {
    toggleThemeWithTransition(theme, e, (next) => {
      setTheme(next);
    });
  };

  const login = useAuthStore((state) => state.login);
  const selectTenant = useAuthStore((state) => state.selectTenant);
  const navigate = useNavigate();
  const location = useLocation();

  interface LocationState {
    from?: {
      pathname?: string;
    };
  }

  const state = location.state as LocationState | null;
  const from = state?.from?.pathname ?? '/dashboard';

  // Forgot / Reset Password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotStatus, setForgotStatus] = useState<{ error?: string; success?: string }>({});
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  // Tenant selection modal state
  const [availableTenants, setAvailableTenants] = useState<{ id: number; name: string; slug?: string }[]>([]);
  const [pendingEmail, setPendingEmail] = useState('');
  const [showTenantModal, setShowTenantModal] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsForgotLoading(true);
    setForgotStatus({});
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotStatus({ success: 'Reset token dispatched. Check your email inbox.' });
      setForgotStep('reset');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setForgotStatus({ error: errorObj?.response?.data?.message || errorObj?.message || 'Failed to dispatch reset email.' });
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !resetPasswordVal) return;
    setIsForgotLoading(true);
    setForgotStatus({});
    try {
      await api.post('/auth/reset-password', {
        email: forgotEmail,
        token: resetToken,
        password: resetPasswordVal,
      });
      setForgotStatus({ success: 'Password successfully updated! You can now log in.' });
      setTimeout(() => {
        setShowForgotModal(false);
        setValue('email', forgotEmail);
        setValue('password', resetPasswordVal);
      }, 1500);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setForgotStatus({ error: errorObj?.response?.data?.message || errorObj?.message || 'Failed to reset password.' });
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleSelectTenant = async (tenantId: number) => {
    setIsLoading(true);
    setServerError(null);
    try {
      await selectTenant({ email: pendingEmail, tenant_id: tenantId });
      setShowTenantModal(false);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setServerError(errorObj?.response?.data?.message || errorObj?.message || 'Tenant selection failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    setIsLoading(true);
    try {
      const res = await api.post<{
        data?: {
          requires_tenant_selection?: boolean;
          tenants?: { id: number; name: string; slug?: string }[];
        };
        requires_tenant_selection?: boolean;
        tenants?: { id: number; name: string; slug?: string }[];
      }>('/auth/login', {
        email: values.email,
        password: values.password,
      });
      const resPayload = res.data;
      const data = (resPayload && typeof resPayload === 'object' && 'data' in resPayload && resPayload.data)
        ? resPayload.data
        : resPayload;
      if (data?.requires_tenant_selection && Array.isArray(data?.tenants)) {
        setPendingEmail(values.email);
        setAvailableTenants(data.tenants);
        setShowTenantModal(true);
        setIsLoading(false);
        return;
      }
      await login({
        email: values.email,
        password: values.password,
      });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (isApiError(err)) {
        if (err.code === 'UNAUTHENTICATED') {
          setServerError('Invalid email, name, designation, or password. Please check your credentials.');
        } else if (err.code === 'ACCOUNT_INACTIVE') {
          setServerError('Your user account has been deactivated. Contact your administrator.');
        } else if (err.code === 'TENANT_INACTIVE') {
          setServerError('Your organization account is suspended.');
        } else {
          setServerError(err.message ?? 'Authentication failed. Please try again.');
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('Unable to sign in. Please verify your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = companyName || 'Enterprise Operations Platform';

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center bg-base px-3 sm:px-6 lg:px-8 py-8 sm:py-12 text-default transition-colors duration-200 overflow-x-hidden">
      {/* Top-Right Theme & Language Controls */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
        <LanguageSwitcher />
        <button
          type="button"
          onClick={handleToggleTheme}
          className="flex items-center gap-2 rounded-xl border border-default bg-surface/90 px-3 py-2 text-xs font-medium text-muted shadow-xs backdrop-blur-md transition-all hover:bg-surface-sunken hover:text-default cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-400 animate-spin-once" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>
      </div>

      {/* Background glow effects */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-blue-500/10 dark:bg-blue-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/3 h-80 w-80 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-[140px]" />

      <div className="w-full max-w-sm sm:max-w-md space-y-6 rounded-2xl border border-default bg-surface p-6 sm:p-8 shadow-xl backdrop-blur-md animate-in fade-in-50 duration-300">
        {/* Brand Header */}
        <div className="text-center">
          {logoUrl && !logoLoadFailed ? (
            <div className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-surface-sunken border border-default shadow-xs">
              <img
                ref={logoRef}
                src={logoUrl}
                alt={displayName}
                className="h-full w-full object-contain p-1.5"
                crossOrigin="anonymous"
              />
            </div>
          ) : (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 via-indigo-600 to-indigo-700 shadow-lg shadow-blue-500/25">
              <Package className="h-6 w-6 text-white font-bold" />
            </div>
          )}

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-default sm:text-3xl">
            {displayName}
          </h1>
          <p className="mt-1 text-xs text-muted">Business Operations Platform</p>
        </div>

        {/* Server error alert banner */}
        {serverError && (
          <div className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger-subtle p-3.5 text-xs text-danger animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
            <p className="leading-snug">{serverError}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email field */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-semibold text-default">
              Email, Name, or Designation
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="email"
                type="text"
                autoComplete="username"
                placeholder="admin@dcp.com, Hasan, or Production Manager"
                {...register('email')}
                className={`block w-full rounded-xl border bg-surface-sunken py-2.5 pr-3.5 pl-10 text-xs text-default placeholder:text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.email
                    ? 'border-danger focus:border-danger'
                    : 'border-default focus:border-primary'
                }`}
              />
            </div>
            {errors.email && <p className="text-[11px] text-danger">{errors.email.message}</p>}
            <p className="text-[10px] text-muted">
              Log in with your email address, display name, or role/designation.
            </p>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-semibold text-default">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotStatus({});
                }}
                className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative rounded-xl shadow-2xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
                className={`block w-full rounded-xl border bg-surface-sunken py-2.5 pr-10 pl-10 text-xs text-default placeholder:text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.password
                    ? 'border-danger focus:border-danger'
                    : 'border-default focus:border-primary'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted hover:text-default cursor-pointer transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-danger">{errors.password.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 py-3 px-4 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in to Workspace</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="border-t border-default pt-4 text-center space-y-1">
          <p className="text-[11px] text-muted">
            {displayName} &bull; Business Operations Platform
          </p>
          <p className="text-[10px] text-muted/75">
            Powered by{' '}
            <a
              href="https://devcenterpoint.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium transition-colors"
            >
              DevCenterPoint
            </a>
          </p>
        </div>
      </div>

      {/* Modal: Forgot / Reset Password */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-sm font-bold text-default">
                {forgotStep === 'request' ? 'Password Recovery' : 'Set New Password'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface-sunken hover:text-default"
              >
                <X className="size-4" />
              </button>
            </div>

            {forgotStatus.error && (
              <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-subtle p-3 text-xs text-danger">
                <AlertCircle className="size-4 shrink-0 text-danger" />
                <span>{forgotStatus.error}</span>
              </div>
            )}
            {forgotStatus.success && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="size-4 shrink-0 text-emerald-500" />
                <span>{forgotStatus.success}</span>
              </div>
            )}

            {forgotStep === 'request' ? (
              <form onSubmit={handleSendResetLink} className="space-y-4">
                <p className="text-xs text-muted">
                  Enter your verified account email address. We will dispatch an authorization token to reset your password.
                </p>
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="user@domain.com"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep('reset')}
                    className="text-xs text-primary hover:underline"
                  >
                    Already have a token?
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isForgotLoading ? 'Dispatching...' : 'Send Reset Code'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="user@domain.com"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Reset Token / Code
                  </label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste reset token from email"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    New Passphrase
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep('request')}
                    className="text-xs text-muted hover:text-default"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isForgotLoading ? 'Updating...' : 'Update & Log In'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Multi-Tenant Selection */}
      {showTenantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-4">
            <div className="border-b border-default pb-3">
              <h3 className="text-sm font-bold text-default">Select Organization Account</h3>
              <p className="text-xs text-muted mt-0.5">
                Your credentials have access to multiple production workspaces. Please choose which tenant to access:
              </p>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableTenants.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTenant(t.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-default bg-surface-sunken hover:border-primary/50 hover:bg-primary-subtle text-left transition-colors cursor-pointer group"
                >
                  <div>
                    <p className="text-xs font-bold text-default group-hover:text-primary">{t.name}</p>
                    {t.slug && <p className="text-[10px] text-muted font-mono">{t.slug}</p>}
                  </div>
                  <span className="text-xs text-primary font-semibold">Select &rarr;</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
