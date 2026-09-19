import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnboardingProgress } from './useOnboardingProgress';
import { Button } from '../../components/ui/Button';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Compass,
} from 'lucide-react';
import { useTutorialStore } from '../tutorial/tutorialStore';

const MILESTONE_TITLES: Record<string, string> = {
  legal_identity: 'Legal & Tax',
  financial_defaults: 'Currency & Accounting',
  operational_facilities: 'Warehouse & Facility',
  industry_blueprint: 'Industry Blueprint',
  workflow_stages: 'Workflow & Stages',
  standards_branding: 'Units & Branding',
};

export const OnboardingProgressCard: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  const {
    shouldShowProgressCard,
    completionPercentage,
    milestones,
    resumeOnboarding,
  } = useOnboardingProgress();

  const openTutorial = useTutorialStore((s) => s.openTutorial);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!shouldShowProgressCard) {
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
    <div className="rounded-2xl border border-indigo-500/30 bg-linear-to-r from-indigo-500/5 via-primary/5 to-emerald-500/5 p-4 shadow-sm transition-all duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-default">
                {t('onboarding.title')}
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold font-mono text-primary">
                {t('onboarding.percentComplete', { percent: completionPercentage })}
              </span>
            </div>
            <p className="text-[11px] text-muted">
              {t('onboarding.description')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openTutorial(1)}
            className="flex items-center gap-1.5 min-h-9 text-xs"
            title="Open Interactive System Guide & Tour"
          >
            <Compass className="size-3.5 text-primary" />
            <span>{t('onboarding.interactiveGuide')}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-muted"
            title="Toggle setup details"
          >
            <span>{isExpanded ? t('onboarding.hideDetails') : t('onboarding.viewChecklist')}</span>
            {isExpanded ? <ChevronUp className="size-3.5 ml-1" /> : <ChevronDown className="size-3.5 ml-1" />}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={resumeOnboarding}
            className="flex items-center gap-1.5 min-h-9"
          >
            <span>{t('onboarding.resumeSetup')}</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress Rail */}
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised border border-default/40">
          <div
            className="h-full bg-linear-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${Math.max(5, completionPercentage)}%` }}
          />
        </div>
      </div>

      {/* Expanded Checklist */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-default/40 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {allMilestoneKeys.map((key) => {
            const label = t(`onboarding.milestones.${key}`, MILESTONE_TITLES[key] || key);
            const isDone = Boolean(milestones?.completed_milestones?.includes(key));

            return (
              <div
                key={key}
                className={`flex items-center gap-2 rounded-lg border p-2 text-xs transition-colors ${
                  isDone
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-default bg-surface text-muted'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="size-3.5 text-muted shrink-0" />
                )}
                <span className="truncate text-[11px] font-medium">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
