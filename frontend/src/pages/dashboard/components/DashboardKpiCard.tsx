import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils';

export type DashboardKpiTheme =
  | 'emerald'
  | 'blue'
  | 'amber'
  | 'indigo'
  | 'cyan'
  | 'violet'
  | 'rose'
  | 'teal'
  | 'orange'
  | 'purple';

export interface DashboardKpiCardProps {
  label: string;
  value: string | number;
  sub?: string | undefined;
  badge?: {
    text: string;
    variant?: 'positive' | 'warning' | 'negative' | 'neutral' | 'info' | undefined;
  } | undefined;
  icon: React.ReactNode;
  theme?: DashboardKpiTheme | undefined;
  to?: string | undefined;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}

const KPI_THEME_STYLES: Record<
  DashboardKpiTheme,
  {
    bg: string;
    border: string;
    topHairline: string;
    glow: string;
    icon: string;
    textAccent: string;
  }
> = {
  emerald: {
    bg: 'bg-gradient-to-br from-emerald-500/[0.08] via-surface to-emerald-500/[0.02] dark:from-emerald-500/[0.14] dark:via-surface dark:to-emerald-500/[0.03]',
    border: 'border-emerald-500/25 hover:border-emerald-500/50',
    topHairline: 'via-emerald-500',
    glow: 'hover:shadow-[0_10px_26px_-6px_rgba(16,185,129,0.22)]',
    icon: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xs shadow-emerald-500/30 border-emerald-400/30',
    textAccent: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-500/[0.08] via-surface to-blue-500/[0.02] dark:from-blue-500/[0.14] dark:via-surface dark:to-blue-500/[0.03]',
    border: 'border-blue-500/25 hover:border-blue-500/50',
    topHairline: 'via-blue-500',
    glow: 'hover:shadow-[0_10px_26px_-6px_rgba(59,130,246,0.22)]',
    icon: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xs shadow-blue-500/30 border-blue-400/30',
    textAccent: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-500/[0.08] via-surface to-amber-500/[0.02] dark:from-amber-500/[0.14] dark:via-surface dark:to-amber-500/[0.03]',
    border: 'border-amber-500/25 hover:border-amber-500/50',
    topHairline: 'via-amber-500',
    glow: 'hover:shadow-[0_10px_26px_-6px_rgba(245,158,11,0.22)]',
    icon: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs shadow-amber-500/30 border-amber-400/30',
    textAccent: 'group-hover:text-amber-600 dark:group-hover:text-amber-400',
  },
  indigo: {
    bg: 'bg-gradient-to-br from-indigo-500/[0.08] via-surface to-indigo-500/[0.02] dark:from-indigo-500/[0.14] dark:via-surface dark:to-indigo-500/[0.03]',
    border: 'border-indigo-500/25 hover:border-indigo-500/50',
    topHairline: 'via-indigo-500',
    glow: 'hover:shadow-[0_10px_26px_-6px_rgba(99,102,241,0.22)]',
    icon: 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-xs shadow-indigo-500/30 border-indigo-400/30',
    textAccent: 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400',
  },
  cyan: {
    bg: 'bg-gradient-to-br from-cyan-500/[0.08] via-surface to-cyan-500/[0.02] dark:from-cyan-500/[0.14] dark:via-surface dark:to-cyan-500/[0.03]',
    border: 'border-cyan-500/25 hover:border-cyan-500/50',
    topHairline: 'via-cyan-500',
    glow: 'hover:shadow-[0_10px_26px_-6px_rgba(6,182,212,0.22)]',
    icon: 'bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-xs shadow-cyan-500/30 border-cyan-400/30',
    textAccent: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
  },
  violet: {
    bg: 'bg-gradient-to-br from-violet-500/[0.08] via-surface to-violet-500/[0.02] dark:from-violet-500/[0.14] dark:via-surface dark:to-violet-500/[0.03]',
    border: 'border-violet-500/25 hover:border-violet-500/50',
    topHairline: 'via-violet-500',
    glow: 'hover:shadow-[0_10px_26px_-6px_rgba(139,92,246,0.22)]',
    icon: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xs shadow-violet-500/30 border-violet-400/30',
    textAccent: 'group-hover:text-violet-600 dark:group-hover:text-violet-400',
  },
  rose: {
    bg: 'bg-gradient-to-br from-rose-500/[0.08] via-surface to-rose-500/[0.02] dark:from-rose-500/[0.14] dark:via-surface dark:to-rose-500/[0.03]',
    border: 'border-rose-500/25 hover:border-rose-500/50',
    topHairline: 'via-rose-500',
    glow: 'hover:shadow-[0_10px_26px_-6px_rgba(244,63,94,0.22)]',
    icon: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-xs shadow-rose-500/30 border-rose-400/30',
    textAccent: 'group-hover:text-rose-600 dark:group-hover:text-rose-400',
  },
  teal: {
    bg: 'bg-gradient-to-br from-teal-500/[0.08] via-surface to-teal-500/[0.02] dark:from-teal-500/[0.14] dark:via-surface dark:to-teal-500/[0.03]',
    border: 'border-teal-500/25 hover:border-teal-500/50',
    topHairline: 'via-teal-500',
    glow: 'hover:shadow-[0_10px_26px_-6px_rgba(20,184,166,0.22)]',
    icon: 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-xs shadow-teal-500/30 border-teal-400/30',
    textAccent: 'group-hover:text-teal-600 dark:group-hover:text-teal-400',
  },
  orange: {
    bg: 'bg-gradient-to-br from-orange-500/[0.08] via-surface to-orange-500/[0.02] dark:from-orange-500/[0.14] dark:via-surface dark:to-orange-500/[0.03]',
    border: 'border-orange-500/25 hover:border-orange-500/50',
    topHairline: 'via-orange-500',
    glow: 'hover:shadow-[0_10px_26px_-6px_rgba(249,115,22,0.22)]',
    icon: 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-xs shadow-orange-500/30 border-orange-400/30',
    textAccent: 'group-hover:text-orange-600 dark:group-hover:text-orange-400',
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-500/[0.08] via-surface to-purple-500/[0.02] dark:from-purple-500/[0.14] dark:via-surface dark:to-purple-500/[0.03]',
    border: 'border-purple-500/25 hover:border-purple-500/50',
    topHairline: 'via-purple-500',
    glow: 'hover:shadow-[0_10px_26px_-6px_rgba(168,85,247,0.22)]',
    icon: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xs shadow-purple-500/30 border-purple-400/30',
    textAccent: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
  },
};

export const DashboardKpiCard: React.FC<DashboardKpiCardProps> = ({
  label,
  value,
  sub,
  badge,
  icon,
  theme = 'blue',
  to,
  onClick,
  className,
}) => {
  const styles = KPI_THEME_STYLES[theme] || KPI_THEME_STYLES.blue;
  const isInteractive = Boolean(to || onClick);

  const commonClasses = cn(
    'group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 overflow-hidden min-w-0 shadow-2xs text-left',
    isInteractive && 'cursor-pointer hover:-translate-y-0.5',
    styles.bg,
    styles.border,
    styles.glow,
    className
  );

  const cardContent = (
    <>
      {/* Illuminated top hairline accent */}
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-[2.5px] bg-linear-to-r from-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity',
          styles.topHairline
        )}
      />

      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted truncate">
          {label}
        </span>
        <div
          className={cn(
            'flex size-8 items-center justify-center rounded-xl border shrink-0 transition-transform duration-200 group-hover:scale-110',
            styles.icon
          )}
        >
          {icon}
        </div>
      </div>

      <div className="my-1">
        <div
          className={cn(
            'text-xl sm:text-2xl font-extrabold font-mono text-default tracking-tight truncate transition-colors duration-200',
            styles.textAccent
          )}
        >
          {value}
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 mt-1.5 pt-2 border-t border-default/50 min-w-0">
        <span className="text-[11px] text-muted truncate">{sub}</span>
        {badge && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 border transition-colors',
              badge.variant === 'positive' &&
                'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
              badge.variant === 'warning' &&
                'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
              badge.variant === 'negative' &&
                'bg-red-500/15 text-red-500 border-red-500/30',
              badge.variant === 'info' &&
                'bg-blue-500/15 text-blue-500 border-blue-500/30',
              (!badge.variant || badge.variant === 'neutral') &&
                'bg-surface-sunken text-muted border-default'
            )}
          >
            {badge.text}
          </span>
        )}
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn('block min-w-0', commonClasses)}>
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn('w-full', commonClasses)}>
        {cardContent}
      </button>
    );
  }

  return <div className={commonClasses}>{cardContent}</div>;
};
