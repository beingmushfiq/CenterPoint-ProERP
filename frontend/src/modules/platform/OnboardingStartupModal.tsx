import React from 'react';
import { useOnboardingProgress } from './useOnboardingProgress';
import { useAuthStore } from '../../lib/auth/authStore';
import { Button } from '../../components/ui/Button';
import {
  CheckCircle2,
  Circle,
  Building2,
  Warehouse,
  Coins,
  ArrowRight,
  Layers,
  Sparkles,
} from 'lucide-react';

const MILESTONE_LABELS: Record<string, { label: string; icon: React.FC<{ className?: string }> }> = {
  legal_identity: { label: 'Company & Tax Identity', icon: Building2 },
  financial_defaults: { label: 'Currency & Accounting Localization', icon: Coins },
  operational_facilities: { label: 'Primary Warehouse & POS Register', icon: Warehouse },
  industry_blueprint: { label: 'Industry Profile & Model', icon: Layers },
  workflow_stages: { label: 'Floor Stages & Subsystems', icon: Layers },
  standards_branding: { label: 'Units of Measure & Invoicing', icon: Sparkles },
};

export const OnboardingStartupModal: React.FC = () => {
  const {
    shouldShowStartupModal,
    isLoading,
    completionPercentage,
    milestones,
    skipOnboarding,
    resumeOnboarding,
  } = useOnboardingProgress();

  const tenant = useAuthStore((s) => s.tenant);

  if (isLoading || !shouldShowStartupModal) {
    return null;
  }

  const allMilestoneKeys = [
    'legal_identity',
    'financial_defaults',
    'operational_facilities',
    'industry_blueprint',
    'workflow_stages',
    'standards_branding',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-500/20">
              <Layers className="size-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Workspace Initialization
              </div>
              <h2 className="text-lg font-bold text-default">
                Welcome to {tenant?.name || 'Your ERP'}
              </h2>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Your enterprise workspace requires baseline operational parameters (legal identity, warehouse, currency, and floor stages) to process invoices, receipts, and production orders.
        </p>

        {/* 0-100% Progress Bar */}
        <div className="space-y-2 rounded-xl border border-default bg-surface-sunken p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-default">Profile Completion</span>
            <span className="font-mono font-bold text-primary">{completionPercentage}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-raised border border-default/40">
            <div
              className="h-full bg-linear-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.max(5, completionPercentage)}%` }}
            />
          </div>
          <div className="text-[11px] text-muted">
            {completionPercentage >= 100
              ? 'All core prerequisites configured.'
              : `${100 - completionPercentage}% remaining to unlock full production capabilities.`}
          </div>
        </div>

        {/* Milestones Checklist */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Setup Milestones
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {allMilestoneKeys.map((key) => {
              const meta = MILESTONE_LABELS[key] || { label: key, icon: Layers };
              const Icon = meta.icon;
              const isDone = Boolean(milestones?.completed_milestones?.includes(key));

              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-[11px] transition-colors ${
                    isDone
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                      : 'border-default bg-surface text-muted'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="size-3.5 text-muted shrink-0" />
                  )}
                  <Icon className="size-3.5 opacity-70 shrink-0" />
                  <span className="truncate">{meta.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-default">
          <Button
            variant="ghost"
            onClick={skipOnboarding}
            className="text-xs text-muted hover:text-default"
          >
            Skip for Now & Explore
          </Button>

          <Button
            variant="primary"
            onClick={resumeOnboarding}
            className="flex items-center justify-center gap-1.5 min-h-10"
          >
            <span>Configure Workspace Now</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
