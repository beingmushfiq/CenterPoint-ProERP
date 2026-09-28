import React from 'react';
import {
  StatusBadge as BaseStatusBadge,
  Badge,
  resolveStatus,
  STATUS_REGISTRY,
  type BadgeTone,
} from './Badge';

export interface StatusBadgeProps {
  status: string;
  label?: string;
  tone?: BadgeTone;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  tone,
  className,
}) => {
  if (tone) {
    const desc = resolveStatus(status);
    const displayLabel = label ?? status.replace(/_/g, ' ');
    return (
      <Badge
        tone={tone}
        icon={desc.icon}
        {...(desc.spin !== undefined ? { spin: desc.spin } : {})}
        {...(className !== undefined ? { className } : {})}
        data-status={status}
      >
        {displayLabel}
      </Badge>
    );
  }

  const baseProps: { status: string; label?: string; className?: string } = { status };
  if (label !== undefined) baseProps.label = label;
  if (className !== undefined) baseProps.className = className;

  return <BaseStatusBadge {...baseProps} />;
};

export { resolveStatus, STATUS_REGISTRY, type BadgeTone };
export default StatusBadge;
