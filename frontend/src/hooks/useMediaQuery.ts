import { useState, useSyncExternalStore, useCallback } from 'react';

/**
 * Universal media query hook with SSR safety and clean change event handling.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const media = window.matchMedia(query);
      if (media.addEventListener) {
        media.addEventListener('change', callback);
        return () => media.removeEventListener('change', callback);
      } else {
        media.addListener(callback);
        return () => media.removeListener(callback);
      }
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type DeviceClass = 'mobile' | 'tablet' | 'desktop' | 'wide';

export interface DeviceInfo {
  deviceClass: DeviceClass;
  isMobile: boolean;       // < 768px
  isTablet: boolean;       // 768px - 1023px
  isDesktop: boolean;      // 1024px - 1439px
  isWide: boolean;         // >= 1440px
  isTouch: boolean;
  orientation: 'portrait' | 'landscape';
}

/**
 * High-performance hook for capability-driven responsive layout decisions.
 */
export function useDeviceInfo(): DeviceInfo {
  const isMobile = useMediaQuery('(max-width: 767.98px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023.98px)');
  const isDesktop = useMediaQuery('(min-width: 1024px) and (max-width: 1439.98px)');
  const isWide = useMediaQuery('(min-width: 1440px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');

  const [isTouch] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  });

  const deviceClass: DeviceClass = isMobile
    ? 'mobile'
    : isTablet
    ? 'tablet'
    : isDesktop
    ? 'desktop'
    : 'wide';

  return {
    deviceClass,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    isTouch,
    orientation: isLandscape ? 'landscape' : 'portrait',
  };
}
