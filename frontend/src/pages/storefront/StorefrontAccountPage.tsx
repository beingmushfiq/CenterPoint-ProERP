import React, { useEffect, useState, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User as UserIcon,
  ShoppingBag,
  LogOut,
  Phone,
  Mail,
  Lock,
  ArrowRight,
  Package,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { useStorefrontCustomerStore } from '../../lib/storefront/storefrontCustomerStore';
import type { StorefrontConfig } from '../../types/api/storefront';
import { useCurrency } from '../../hooks/useCurrency';
import { getStorefrontUrl } from '../../lib/storefront/storefrontUrl';

interface OutletContextType {
  config: StorefrontConfig;
  subdomain: string;
}

interface CustomerOrder {
  id: number;
  uuid: string;
  order_number: string;
  order_date: string;
  status: string;
  payment_status: string;
  total_amount: string;
  currency: string;
  shipping_address?: string;
  items?: Array<{
    id: number;
    product?: {
      name: string;
    };
    quantity: number;
    unit_price: string;
    line_total: string;
  }>;
}

export const StorefrontAccountPage: React.FC = () => {
  const { t } = useTranslation(['storefront', 'common']);
  const { subdomain } = useOutletContext<OutletContextType>();
  const { formatCurrency } = useCurrency();
  const { token, customer, setAuth, logout } = useStorefrontCustomerStore();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
  });

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      void api.get('/storefront/customer/profile', {
        headers: {
          'X-Storefront-Subdomain': subdomain,
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
      const response = await api.get<{ data: CustomerOrder[] }>('/storefront/customer/orders', {
        headers: {
          'X-Storefront-Subdomain': subdomain,
          Authorization: `Bearer ${token}`,
        },
      });
      const rawOrders = response.data as unknown;
      const orderList = Array.isArray(rawOrders)
        ? (rawOrders as CustomerOrder[])
        : (((rawOrders as Record<string, unknown>)?.data as CustomerOrder[]) ?? []);
      setOrders(orderList);
    } catch {
      // If unauthenticated or token expired, log out
      logout();
    } finally {
      setLoadingOrders(false);
    }
  }, [token, subdomain, logout]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) {
        void loadOrders();
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, loadOrders]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAuthLoading(true);
    try {
      const response = await api.post<{
        data: {
          token: string;
          customer: { uuid: string; name: string; email: string | null; phone: string };
        };
      }>(
        '/storefront/customer/login',
        {
          phone: formData.phone,
          password: formData.password,
        },
        {
          headers: {
            'X-Storefront-Subdomain': subdomain,
          },
        }
      );

      const authPayload = response.data as unknown;
      const authData =
        (authPayload as { token?: string })?.token !== undefined
          ? (authPayload as {
              token: string;
              customer: { uuid: string; name: string; email: string | null; phone: string };
            })
          : (((authPayload as Record<string, unknown>)?.data as {
              token: string;
              customer: { uuid: string; name: string; email: string | null; phone: string };
            }) ?? null);
      if (authData) {
        setAuth(authData.token, authData.customer);
        setSuccessMessage(t('storefront.welcomeBackMsg'));
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t('storefront.invalidCredentials'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAuthLoading(true);
    try {
      const response = await api.post<{
        data: {
          token: string;
          customer: { uuid: string; name: string; email: string | null; phone: string };
        };
      }>(
        '/storefront/customer/register',
        {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          password: formData.password,
        },
        {
          headers: {
            'X-Storefront-Subdomain': subdomain,
          },
        }
      );

      const authPayload = response.data as unknown;
      const authData =
        (authPayload as { token?: string })?.token !== undefined
          ? (authPayload as {
              token: string;
              customer: { uuid: string; name: string; email: string | null; phone: string };
            })
          : (((authPayload as Record<string, unknown>)?.data as {
              token: string;
              customer: { uuid: string; name: string; email: string | null; phone: string };
            }) ?? null);
      if (authData) {
        setAuth(authData.token, authData.customer);
        setSuccessMessage(t('storefront.accountCreatedMsg'));
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t('storefront.registrationFailed'));
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Authenticated Account Dashboard ──────────────────────────────────
  if (token && customer) {
    return (
      <div className="max-w-5xl mx-auto py-6 space-y-8">
        {/* Account Header Card */}
        <div className="rounded-3xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xl">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{customer.name}</h1>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {t('storefront.verifiedShopper')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
                  {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
                    {customer.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 transition-all shadow-xs cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>{t('storefront.signOut')}</span>
          </button>
        </div>

        {/* Order History Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">{t('storefront.orderHistoryTitle')}</h2>
            </div>
            <Link
              to={getStorefrontUrl(subdomain, '/track')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              {t('storefront.trackByRef')}
            </Link>
          </div>

          {loadingOrders ? (
            <div className="flex h-48 items-center justify-center rounded-3xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/30">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/20 p-12 text-center space-y-4 shadow-xs">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-400">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('storefront.noOrdersTitle')}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                {t('storefront.noOrdersDesc')}
              </p>
              <Link
                to={getStorefrontUrl(subdomain)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                <span>{t('storefront.browseProducts')}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-5 space-y-4 hover:border-slate-300 dark:hover:border-zinc-700/80 transition-all shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800/60 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                          {order.order_number}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            order.status === 'delivered'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : order.status === 'in_transit' || order.status === 'dispatched'
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                        <Calendar className="h-3 w-3" />
                        <span>{t('storefront.placedOnDate', { date: new Date(order.order_date).toLocaleDateString() })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 dark:text-zinc-500 block">{t('storefront.totalAmount')}</span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </div>
                      <Link
                        to={getStorefrontUrl(subdomain, `/track?order=${encodeURIComponent(order.order_number)}`)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white hover:border-emerald-500 transition-all shadow-2xs"
                      >
                        <span>{t('storefront.trackAction')}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Items summary */}
                  {order.items && order.items.length > 0 && (
                    <div className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center py-0.5">
                          <span>
                            {item.quantity}x {item.product?.name || 'Item'}
                          </span>
                          <span className="font-mono text-slate-900 dark:text-zinc-300">
                            {formatCurrency(item.line_total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Unauthenticated Sign In / Sign Up Form ───────────────────────────
  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <UserIcon className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t('storefront.customerPortal')}</h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          {t('storefront.customerPortalDesc')}
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900/60 p-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('login');
            setErrorMessage(null);
          }}
          className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'login'
              ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-zinc-950 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('storefront.signInTab')}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('register');
            setErrorMessage(null);
          }}
          className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'register'
              ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-zinc-950 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('storefront.createAccountTab')}
        </button>
      </div>

      {/* Error & Success Alerts */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form Container */}
      <div className="rounded-3xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-6 sm:p-8 shadow-xs">
        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{t('storefront.mobilePhoneLabel')}</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                <input
                  type="tel"
                  required
                  placeholder="+8801700000000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{t('storefront.passwordFieldLabel')}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              {authLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
              ) : (
                <>
                  <span>{t('storefront.signInToAccount')}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{t('storefront.fullName')}</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{t('storefront.mobilePhoneLabel')}</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                <input
                  type="tel"
                  required
                  placeholder="+8801700000000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{t('storefront.emailOptional')}</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{t('storefront.createPasswordLabel')}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder={t('storefront.passwordMinLength')}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              {authLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
              ) : (
                <>
                  <span>{t('storefront.createMyAccount')}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
