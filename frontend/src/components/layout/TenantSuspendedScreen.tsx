import { AlertOctagon, LogOut, Mail, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../lib/auth/authStore';
import { Button } from '../ui/Button';

export function TenantSuspendedScreen() {
  const tenant = useAuthStore((s) => s.tenant);
  const logout = useAuthStore((s) => s.logout);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.href = '/login';
    }
  };

  const handleRefresh = async () => {
    try {
      await bootstrap();
    } catch {
      // Handled in authStore
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-slate-950 p-4 sm:p-6 lg:p-8 font-sans antialiased text-slate-100">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900/90 border border-rose-500/30 p-8 shadow-2xl backdrop-blur-xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Visual Badge Icon */}
        <div className="mx-auto size-20 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-inner">
          <AlertOctagon className="size-10 stroke-[1.75]" />
        </div>

        {/* Header Details */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold tracking-wider uppercase">
            <ShieldAlert className="size-3.5" />
            <span>Workspace Suspended</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {tenant?.name ?? 'Organization'} Locked
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            The subscription cycle and grace period for this business workspace have lapsed. Full administrative and operational access is temporarily withheld.
          </p>
        </div>

        {/* Diagnostic Metadata Container */}
        <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 text-xs font-mono text-left space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span>Workspace:</span>
            <span className="font-semibold text-slate-200">{tenant?.slug ?? 'Unknown'}.devcenterpoint.com</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Status:</span>
            <span className="text-rose-400 font-bold uppercase">Suspended (Lapsed)</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Security Policy:</span>
            <span className="text-slate-300">Read & Write Enforced Lock</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="secondary"
            className="w-full sm:w-auto font-mono text-xs border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
            onClick={handleRefresh}
            leftIcon={<RefreshCw className="size-4" />}
          >
            Check Status
          </Button>

          <Button
            variant="danger"
            className="w-full sm:w-auto font-mono text-xs bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-600/20"
            onClick={handleLogout}
            leftIcon={<LogOut className="size-4" />}
          >
            Sign Out
          </Button>
        </div>

        {/* Footer Support Info */}
        <p className="text-xs text-slate-500 pt-2 flex items-center justify-center gap-1.5">
          <Mail className="size-3.5" />
          <span>If you have already renewed, click Check Status or contact platform billing.</span>
        </p>
      </div>
    </div>
  );
}
