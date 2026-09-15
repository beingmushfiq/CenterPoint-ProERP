import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePlatformAuthStore } from '../../lib/auth/platformAuthStore';
import { Button } from '../ui/Button';
import { RotateCcw, LogIn, AlertCircle } from 'lucide-react';

export const PlatformProtectedRoute: React.FC = () => {
  const { status, user, bootstrap } = usePlatformAuthStore();
  const location = useLocation();
  const [showEscalation, setShowEscalation] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      void bootstrap();
    }
  }, [status, bootstrap]);

  // Safety escalation timer for platform admin session
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
      <div className="min-h-screen bg-base flex flex-col items-center justify-center text-default p-6 text-center">
        {!isStuck ? (
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
            <p className="text-xs font-mono tracking-widest text-muted uppercase">
              Verifying Platform Credentials...
            </p>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl bg-surface border border-default p-6 shadow-2xl max-w-sm">
            <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
              <AlertCircle className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-default font-sans">
                Platform Verification Timeout
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Could not verify platform super-admin credentials. Please retry or sign in again.
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
                Retry
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  usePlatformAuthStore.getState().logout().then(() => {
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
    );
  }

  if (status === 'unauthenticated' || !user || !user.is_platform_user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
