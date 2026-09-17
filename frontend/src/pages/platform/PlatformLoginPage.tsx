import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatformAuthStore } from '../../lib/auth/platformAuthStore';
import { ShieldCheck, Lock, Mail, AlertCircle, Layers, ArrowRight } from 'lucide-react';

export const PlatformLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, status, error } = usePlatformAuthStore();

  const [email, setEmail] = useState('admin@devcenterpoint.com');
  const [password, setPassword] = useState('PlatformAdmin123!');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
      navigate('/platform', { replace: true });
    } catch {
      // Handled in store
    }
  };

  return (
    <div className="min-h-screen bg-base text-default flex flex-col justify-center items-center px-3 sm:px-4 py-8 overflow-x-hidden selection:bg-amber-500 selection:text-slate-950">
      <div className="w-full max-w-md">
        {/* Brand Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-linear-to-tr from-amber-600 to-amber-400 text-slate-950 shadow-xl shadow-amber-500/20 mb-4">
            <Layers className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold text-default tracking-tight">
            DevCenterPoint Platform Engine
          </h1>
          <p className="text-xs font-mono text-amber-500 uppercase tracking-widest mt-1 font-bold">
            Master SaaS Control Plane
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-default rounded-2xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-amber-600 via-amber-400 to-amber-600" />

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-mono mb-6">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Restricted: Super Administrator Access Only</span>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Authentication Refused</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="platform-email" className="block text-xs font-semibold text-default uppercase tracking-wider mb-2 font-mono">
                Super Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="platform-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-sunken border border-default rounded-xl pl-10 pr-4 py-2.5 text-sm text-default placeholder-muted focus:outline-hidden focus:border-amber-500 font-mono transition-colors"
                  placeholder="admin@devcenterpoint.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="platform-password" className="block text-xs font-semibold text-default uppercase tracking-wider mb-2 font-mono">
                Master Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="platform-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-sunken border border-default rounded-xl pl-10 pr-4 py-2.5 text-sm text-default placeholder-muted focus:outline-hidden focus:border-amber-500 font-mono transition-colors"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'authenticating'}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {status === 'authenticating' ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Authenticate to Control Plane</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="mt-4 pt-4 border-t border-default/40 flex items-center justify-between text-xs text-muted font-mono">
              <span>Super Admin Credentials:</span>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@devcenterpoint.com');
                  setPassword('PlatformAdmin123!');
                }}
                className="text-amber-500 hover:text-amber-400 font-semibold cursor-pointer underline underline-offset-2"
              >
                Auto-fill
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
export default PlatformLoginPage;
