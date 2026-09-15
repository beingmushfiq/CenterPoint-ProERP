import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Boxes, ClipboardCheck, Eye, EyeOff, Factory, Lock, Mail, Moon, Package, ShieldCheck, ShoppingCart, Sun } from 'lucide-react';
import { useAuthStore } from '../../lib/auth/authStore';
import { isApiError } from '../../lib/api/errors';
import { toggleThemeWithTransition } from '../../lib/theme/themeTransition';
import { useTenantBranding } from '../../lib/theme/useTenantBranding';

const QUICK_ROLES = [
  { label: 'Admin', role: 'Full Access', email: 'admin@demoerp.com', icon: ShieldCheck },
  { label: 'Production', role: 'Factory Floor', email: 'production@demoerp.com', icon: Factory },
  { label: 'QC Inspector', role: 'Quality QA', email: 'qc@demoerp.com', icon: ClipboardCheck },
  { label: 'Storekeeper', role: 'Inventory', email: 'store@demoerp.com', icon: Boxes },
  { label: 'Sales Officer', role: 'Commercial / POS', email: 'sales@demoerp.com', icon: ShoppingCart },
] as const;

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
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
  const navigate = useNavigate();
  const location = useLocation();

  interface LocationState {
    from?: {
      pathname?: string;
    };
  }

  const state = location.state as LocationState | null;
  const from = state?.from?.pathname ?? '/dashboard';

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

  const handleQuickRole = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Password123!', { shouldValidate: true });
    setServerError(null);
  };

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    setIsLoading(true);
    try {
      await login({
        email: values.email,
        password: values.password,
      });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (isApiError(err)) {
        if (err.code === 'UNAUTHENTICATED') {
          setServerError('Invalid email or password. Please check your credentials.');
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
      {/* Top-Right Theme Toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          type="button"
          onClick={handleToggleTheme}
          className="flex items-center gap-2 rounded-xl border border-default bg-surface/90 px-3 py-2 text-xs font-medium text-muted shadow-xs backdrop-blur-md transition-all hover:bg-surface-sunken hover:text-default cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-slate-600" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Background glow effects */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-blue-500/10 dark:bg-blue-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/3 h-80 w-80 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-[140px]" />

      <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-default bg-surface/95 p-5 sm:p-8 shadow-xl dark:shadow-2xl backdrop-blur-xl transition-colors">
        {/* Brand Header */}
        <div className="text-center">
          {logoUrl && !logoLoadFailed ? (
            <div className="mx-auto flex h-14 w-auto max-w-55 items-center justify-center">
              <img
                ref={logoRef}
                src={logoUrl}
                alt={displayName}
                className="max-h-14 max-w-full object-contain drop-shadow-xs"
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
              Email Address
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                {...register('email')}
                className={`block w-full rounded-xl border bg-surface-sunken py-2.5 pr-3.5 pl-10 text-xs text-default placeholder:text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.email
                    ? 'border-danger focus:border-danger'
                    : 'border-default focus:border-primary'
                }`}
              />
            </div>
            {errors.email && <p className="text-[11px] text-danger">{errors.email.message}</p>}
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-semibold text-default">
                Password
              </label>
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

        {/* Quick Role Sign-in */}
        <div className="space-y-2.5 pt-4 border-t border-default">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Quick Role Login
            </span>
            <span className="text-[10px] text-muted">Click to auto-fill</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_ROLES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.email}
                  type="button"
                  onClick={() => handleQuickRole(item.email)}
                  className="group flex flex-1 min-w-24 sm:min-w-26.25 max-w-full flex-col items-start rounded-xl border border-default bg-surface-sunken/60 p-2 text-left transition-all hover:border-primary/40 hover:bg-primary-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <Icon className="h-3.5 w-3.5 text-muted group-hover:text-primary transition-colors shrink-0" />
                    <span className="text-xs font-semibold text-default group-hover:text-primary transition-colors truncate">
                      {item.label}
                    </span>
                  </div>
                  <span className="mt-0.5 text-[10px] text-muted group-hover:text-default/80 transition-colors truncate w-full">
                    {item.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-default pt-4 text-center">
          <p className="text-[11px] text-muted">
            {displayName} &bull; Business Operations Platform
          </p>
        </div>
      </div>
    </div>
  );
}
