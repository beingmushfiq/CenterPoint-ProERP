import React, { useState } from 'react';
import { useOnboardingProgress } from './useOnboardingProgress';
import { useAuthStore } from '../../lib/auth/authStore';
import { OnboardingWizardModal } from './OnboardingWizardModal';
import { Button } from '../../components/ui/Button';
import {
  CheckCircle2,
  Circle,
  Building2,
  Warehouse,
  Coins,
  Factory,
  Layers,
  SlidersHorizontal,
  ArrowRight,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Compass,
} from 'lucide-react';

interface MilestoneDetail {
  key: string;
  stepId: number;
  title: string;
  subtitle: string;
  description: string;
  estimatedTime: string;
  icon: React.FC<{ className?: string }>;
}

const MILESTONES: MilestoneDetail[] = [
  {
    key: 'legal_identity',
    stepId: 1,
    title: 'Legal & Tax Identity',
    subtitle: 'TIN, VAT & Registered Office',
    description: 'Provide company registration, tax numbers, and corporate address to issue compliant commercial invoices.',
    estimatedTime: '2 min',
    icon: Building2,
  },
  {
    key: 'financial_defaults',
    stepId: 2,
    title: 'Financial Localization',
    subtitle: 'Operating Currency & Fiscal Year',
    description: 'Set your primary trading currency, operational timezone, and fiscal calendar cycle for accounting.',
    estimatedTime: '1 min',
    icon: Coins,
  },
  {
    key: 'operational_facilities',
    stepId: 3,
    title: 'Facilities & Warehousing',
    subtitle: 'Central Depot & Cash Counter',
    description: 'Create the primary stock warehouse and default POS checkout counter to receive goods and start sales.',
    estimatedTime: '2 min',
    icon: Warehouse,
  },
  {
    key: 'industry_blueprint',
    stepId: 4,
    title: 'Industry & Business Model',
    subtitle: 'Manufacturing Type & Sector',
    description: 'Select your operational pattern (discrete or process manufacturing, wholesale, or multi-channel retail).',
    estimatedTime: '3 min',
    icon: Factory,
  },
  {
    key: 'workflow_stages',
    stepId: 5,
    title: 'Floor Stages & Subsystems',
    subtitle: 'Sequential Gates & Module Setup',
    description: 'Activate operational ERP modules and establish manufacturing workflow stages for batch tracking.',
    estimatedTime: '3 min',
    icon: Layers,
  },
  {
    key: 'standards_branding',
    stepId: 6,
    title: 'Standards, Branding & Launch',
    subtitle: 'Units of Measure & Document Terms',
    description: 'Define product units (KG, PCS, BOX), commercial invoice terms, and workspace branding colors.',
    estimatedTime: '2 min',
    icon: SlidersHorizontal,
  },
];

export const OnboardingStartupModal: React.FC = () => {
  const {
    shouldShowStartupModal,
    isLoading,
    completionPercentage,
    milestones,
    skipOnboarding,
  } = useOnboardingProgress();

  const tenant = useAuthStore((s) => s.tenant);

  // Modal open state — replaces navigate('/onboarding') for in-place wizard
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState(1);

  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('onboarding_banner_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('onboarding_banner_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  if (isLoading || !shouldShowStartupModal) {
    return null;
  }

  const completedKeys = milestones?.completed_milestones ?? [];
  const completedCount = completedKeys.length;
  const totalCount = MILESTONES.length;

  // Identify the first milestone in sequence that is not yet completed
  const nextMilestone: MilestoneDetail =
    MILESTONES.find((m) => !completedKeys.includes(m.key)) ?? MILESTONES[0]!;

  const handleOpenStep = (stepId: number) => {
    setWizardInitialStep(stepId);
    setIsWizardOpen(true);
  };

  // ── Collapsed Compact Mode ──────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <>
      <section
        aria-label="Workspace Setup Progress Bar"
        className="rounded-2xl border border-default/80 bg-surface-raised px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Compass className="size-4" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-default">Workspace Setup</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                {completionPercentage}% complete
              </span>
              <span className="text-muted hidden md:inline">
                ({completedCount} of {totalCount} milestones completed)
              </span>
            </div>
            <p className="text-[11px] text-muted truncate">
              Next step: <span className="text-default font-medium">{nextMilestone.title}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenStep(nextMilestone.stepId)}
            className="flex items-center gap-1.5 text-xs h-8 min-h-[32px] px-3 font-semibold shadow-2xs"
          >
            <span>Resume Step {nextMilestone.stepId}</span>
            <ArrowRight className="size-3" />
          </Button>

          <button
            type="button"
            onClick={toggleCollapse}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-default rounded-lg border border-default bg-surface hover:bg-surface-sunken cursor-pointer transition-colors"
            title="Expand Full Setup Checklist"
          >
            <span>View Checklist</span>
            <ChevronDown className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={skipOnboarding}
            className="flex items-center justify-center size-8 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
            title="Dismiss for this session"
            aria-label="Dismiss setup banner"
          >
            <X className="size-4" />
          </button>
        </div>
      </section>

      {/* Onboarding Wizard Modal — collapsed banner launch point */}
      <OnboardingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        initialStep={wizardInitialStep}
      />
    </>
  );
  }

  // ── Expanded Interactive Wizard Hub ──────────────────────────────────────
  return (
    <>
    <section
      aria-label="Workspace Initialization Setup Hub"
      className="rounded-2xl border border-default/90 bg-surface-raised p-4 sm:p-5 lg:p-6 shadow-sm space-y-5 animate-in fade-in duration-200"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-default/70">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-2xs shrink-0 mt-0.5 sm:mt-0">
            <Compass className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-default tracking-tight">
                Enterprise Readiness Setup
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                {completionPercentage}% Configured
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Welcome to {tenant?.name || 'your workspace'}. Configure the 6 operational foundations below to unlock full billing, inventory, and production capabilities.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-default rounded-lg border border-default bg-surface hover:bg-surface-sunken cursor-pointer transition-colors"
            title="Collapse checklist into compact bar"
          >
            <ChevronUp className="size-3.5" />
            <span>Collapse</span>
          </button>
          <button
            type="button"
            onClick={skipOnboarding}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
            title="Dismiss until next session"
          >
            <span>Dismiss</span>
          </button>
        </div>
      </div>

      {/* Recommended Action Spotlight (Next Milestone in Sequence) */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-primary uppercase tracking-wider text-[10px]">
              Recommended Next Action
            </span>
            <span className="text-muted">•</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
              <Clock className="size-3" />
              <span>Takes ~{nextMilestone.estimatedTime}</span>
            </span>
          </div>
          <h3 className="text-sm font-bold text-default">
            Step {nextMilestone.stepId}: {nextMilestone.title}
          </h3>
          <p className="text-xs text-muted leading-relaxed max-w-2xl">
            {nextMilestone.description}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenStep(nextMilestone.stepId)}
            className="flex items-center gap-2 h-9 px-4 text-xs font-semibold shadow-xs min-h-[36px]"
          >
            <span>Start Step {nextMilestone.stepId}</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Segmented Milestone Progress Track */}
      <div className="space-y-2 rounded-xl border border-default bg-surface p-3 sm:p-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-default">Setup Milestones</span>
            <span className="text-muted font-normal">
              ({completedCount} of {totalCount} completed)
            </span>
          </div>
          <span className="font-mono font-bold text-default">{completionPercentage}%</span>
        </div>

        {/* Segmented Track with 6 checkpoints */}
        <div className="grid grid-cols-6 gap-1.5 h-2 w-full">
          {MILESTONES.map((step) => {
            const isDone = completedKeys.includes(step.key);
            const isCurrent = step.key === nextMilestone.key && !isDone;

            return (
              <div
                key={step.key}
                className={`h-full rounded-full transition-colors ${
                  isDone
                    ? 'bg-emerald-500'
                    : isCurrent
                    ? 'bg-primary animate-pulse'
                    : 'bg-default/20'
                }`}
                title={`Step ${step.stepId}: ${step.title} (${isDone ? 'Completed' : isCurrent ? 'Up Next' : 'Pending'})`}
              />
            );
          })}
        </div>
      </div>

      {/* Interactive 6-Milestone Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MILESTONES.map((step) => {
          const isDone = completedKeys.includes(step.key);
          const isCurrent = step.key === nextMilestone.key && !isDone;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              role="button"
              tabIndex={0}
              onClick={() => handleOpenStep(step.stepId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpenStep(step.stepId);
                }
              }}
              className={`group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${
                isDone
                  ? 'border-emerald-500/30 bg-surface hover:border-emerald-500/50 hover:bg-emerald-500/5'
                  : isCurrent
                  ? 'border-primary/50 bg-primary/5 hover:border-primary shadow-xs ring-1 ring-primary/20'
                  : 'border-default bg-surface hover:border-default-strong hover:bg-surface-sunken/40'
              }`}
              title={`Click to open Step ${step.stepId}: ${step.title}`}
              aria-label={`Step ${step.stepId}: ${step.title}. Status: ${isDone ? 'Completed' : isCurrent ? 'Up Next' : 'Pending'}`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`flex size-7 items-center justify-center rounded-lg border shrink-0 transition-colors ${
                        isDone
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : isCurrent
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-default bg-surface-sunken text-muted'
                      }`}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider">
                      Step {step.stepId}
                    </span>
                  </div>

                  {/* Status Badge */}
                  {isDone ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <CheckCircle2 className="size-3 shrink-0" />
                      <span>Done</span>
                    </span>
                  ) : isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                      <Clock className="size-3 shrink-0" />
                      <span>Up Next</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted bg-surface-sunken px-2 py-0.5 rounded-md border border-default/60">
                      <Circle className="size-2.5 shrink-0" />
                      <span>Pending</span>
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-default group-hover:text-primary transition-colors">
                    {step.title}
                  </h4>
                  <p className="text-[11px] text-muted line-clamp-2 mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-default/50 flex items-center justify-between text-[11px]">
                <span className="text-muted text-[10px] flex items-center gap-1">
                  <Clock className="size-2.5" />
                  <span>{step.estimatedTime}</span>
                </span>
                <span className="font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>{isDone ? 'Review' : 'Configure'}</span>
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Navigation Bar */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-default/70">
        <button
          type="button"
          onClick={skipOnboarding}
          className="text-xs font-medium text-muted hover:text-default transition-colors text-left sm:text-center cursor-pointer py-1"
        >
          Skip for now and continue exploring the dashboard
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center justify-center gap-2 min-h-[38px] px-5 text-xs font-semibold shadow-xs"
          >
            <span>Resume Guided Setup</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </section>

      {/* Onboarding Wizard Modal — replaces full-page /onboarding route */}
      <OnboardingWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        initialStep={wizardInitialStep}
      />
    </>
  );
};

