import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth/authStore';
import { getAccessToken } from '../../lib/api/client';
import { Button } from '../ui/Button';
import { RotateCcw, LogIn, AlertCircle } from 'lucide-react';

export function ProtectedRoute() {
  const { status, bootstrap } = useAuthStore();
  const location = useLocation();
  const [showEscalation, setShowEscalation] = useState(false);

  useEffect(() => {
    if (status === 'idle' || (status === 'authenticated' && !getAccessToken())) {
      void bootstrap();
    }
  }, [status, bootstrap]);

  // Safety net: if auth bootstrap takes > 5 seconds, present honest recovery options instead of infinite spinning
  useEffect(() => {
    if (status !== 'idle' && status !== 'authenticating') return;
    const timer = setTimeout(() => {
      setShowEscalation(true);
    }, 5000);
    return () => {
      clearTimeout(timer);
    };
  }, [status]);

  const isStuck = showEscalation && (status === 'idle' || status === 'authenticating');

  if (status === 'idle' || status === 'authenticating') {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 text-slate-300 p-6 text-center animate-in fade-in duration-200">
        <div className="relative flex flex-col items-center max-w-sm">
          {!isStuck ? (
            <>
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-emerald-500/20 border-t-emerald-500 mb-4" />
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase font-mono">
                Initializing workspace...
              </p>
            </>
          ) : (
            <div className="space-y-4 rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
              <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
                <AlertCircle className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white font-sans">
                  Session verification is taking longer than usual
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  We are having trouble connecting to your organization's session. You can retry or sign in again.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowEscalation(false);
                    void bootstrap();
                  }}
                  leftIcon={<RotateCcw className="size-3.5" />}
                >
                  Retry Connection
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    useAuthStore.getState().logout().then(() => {
                      window.location.href = '/login';
                    });
                  }}
                  leftIcon={<LogIn className="size-3.5" />}
                >
                  Go to Login
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
