import React from 'react';
import { Button } from './Button';
import { PackageOpen, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export interface SectionEmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon | React.ElementType;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: LucideIcon | React.ElementType;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: LucideIcon | React.ElementType;
  };
  children?: React.ReactNode;
  className?: string;
}

export const SectionEmptyState: React.FC<SectionEmptyStateProps> = ({
  title,
  description,
  icon: Icon = PackageOpen,
  primaryAction,
  secondaryAction,
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-default bg-surface-sunken/40 p-8 text-center sm:p-12 space-y-4',
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-subtle text-primary border border-primary/20 shadow-xs">
        <Icon className="size-7" aria-hidden="true" />
      </div>

      <div className="max-w-md space-y-1.5">
        <h3 className="text-base font-bold text-default">{title}</h3>
        <p className="text-xs text-muted leading-relaxed">{description}</p>
      </div>

      {(primaryAction || secondaryAction || children) && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {primaryAction &&
            (primaryAction.href ? (
              <Link to={primaryAction.href}>
                <Button
                  variant="primary"
                  size="md"
                  disabled={primaryAction.disabled}
                  className="text-xs shadow-md shadow-primary/20"
                >
                  {primaryAction.icon && (
                    <primaryAction.icon className="size-3.5 mr-1.5" aria-hidden="true" />
                  )}
                  {primaryAction.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="text-xs shadow-md shadow-primary/20"
              >
                {primaryAction.icon && (
                  <primaryAction.icon className="size-3.5 mr-1.5" aria-hidden="true" />
                )}
                {primaryAction.label}
              </Button>
            ))}

          {secondaryAction &&
            (secondaryAction.href ? (
              <Link to={secondaryAction.href}>
                <Button variant="secondary" size="md" className="border border-default text-xs">
                  {secondaryAction.icon && (
                    <secondaryAction.icon className="size-3.5 mr-1.5" aria-hidden="true" />
                  )}
                  {secondaryAction.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant="secondary"
                size="md"
                onClick={secondaryAction.onClick}
                className="border border-default text-xs"
              >
                {secondaryAction.icon && (
                  <secondaryAction.icon className="size-3.5 mr-1.5" aria-hidden="true" />
                )}
                {secondaryAction.label}
              </Button>
            ))}

          {children}
        </div>
      )}
    </div>
  );
};
