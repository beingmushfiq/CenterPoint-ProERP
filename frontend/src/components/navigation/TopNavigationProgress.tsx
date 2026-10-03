import React from 'react';
import { useLocation } from 'react-router-dom';

interface TopNavigationProgressProps {
  isSuspended?: boolean;
}

/**
 * TopNavigationProgress:
 * Ultra-slim 2.5px GPU-accelerated progress bar pinned to the top of the viewport.
 * Uses compositor-driven CSS animation keyed by route changes to eliminate
 * cascading setState renders while maintaining an instant, crisp visual response.
 */
export const TopNavigationProgress: React.FC<TopNavigationProgressProps> = ({ isSuspended = false }) => {
  const location = useLocation();
  const locationKey = location.pathname + location.search;

  return (
    <div
      role="progressbar"
      aria-label="Loading page content"
      className="pointer-events-none fixed top-0 left-0 right-0 z-50 h-[2.5px] w-full overflow-hidden bg-transparent"
    >
      <div
        key={locationKey}
        className={
          isSuspended
            ? 'h-full w-full bg-linear-to-r from-primary via-indigo-500 to-primary shadow-[0_0_8px_rgba(var(--primary-rgb,59,130,246),0.6)] animate-pulse'
            : 'h-full bg-linear-to-r from-primary via-indigo-500 to-primary shadow-[0_0_8px_rgba(var(--primary-rgb,59,130,246),0.6)] animate-nav-sweep'
        }
      />
    </div>
  );
};
