/**
 * Utility for circular ripple / view-transition theme toggling.
 * Supports 3-state themes: 'light' | 'dark' | 'system'
 * Starts an expanding circular animation from the exact coordinates of the user's click.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem('ui.theme') || localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return 'light';
}

export function resolveEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return mode;
}

export function applyThemeMode(
  target: ThemeMode,
  event?: React.MouseEvent | MouseEvent,
  onApplied?: (next: ThemeMode) => void
): ThemeMode {
  const next: ThemeMode = target;
  const effective = resolveEffectiveTheme(next);

  const applyTheme = () => {
    try {
      localStorage.setItem('ui.theme', next);
      localStorage.setItem('theme', next);
    } catch {
      // Ignore localStorage write failures (e.g. storage quota exceeded or private mode)
    }

    document.documentElement.setAttribute('data-theme', effective);
    if (effective === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    onApplied?.(next);
  };

  const isReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const doc = typeof document !== 'undefined' ? (document as unknown as {
    startViewTransition?: (callback: () => void) => {
      ready: Promise<void>;
    };
  }) : null;

  // If View Transitions API is not supported or reduced motion is preferred, apply with smooth CSS transition
  if (!doc?.startViewTransition || isReducedMotion) {
    if (typeof document !== 'undefined' && !isReducedMotion) {
      document.documentElement.classList.add('theme-transitioning');
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 400);
    }
    applyTheme();
    return next;
  }

  // Calculate coordinates from the click or element center (fallback to header top-right)
  let x = typeof window !== 'undefined' ? window.innerWidth - 60 : 0;
  let y = 30;

  if (event) {
    if (typeof event.clientX === 'number' && typeof event.clientY === 'number' && (event.clientX !== 0 || event.clientY !== 0)) {
      x = event.clientX;
      y = event.clientY;
    } else if (event.currentTarget instanceof HTMLElement) {
      const rect = event.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
  }

  const endRadius = typeof window !== 'undefined'
    ? Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )
    : 1000;

  try {
    const transition = doc.startViewTransition(() => {
      applyTheme();
    });

    transition.ready.then(() => {
      const isDark = effective === 'dark';
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      // 1. Expand the incoming new theme with a silky-smooth organic deceleration curve
      document.documentElement.animate(
        {
          clipPath,
        },
        {
          duration: 540,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );

      // 2. Animate the outgoing old theme with a subtle parallax depth & luminance shift
      document.documentElement.animate(
        {
          filter: isDark
            ? ['none', 'brightness(0.92) saturate(0.95)']
            : ['none', 'brightness(1.08) saturate(1.05)'],
          transform: isDark
            ? ['scale(1)', 'scale(0.995)']
            : ['scale(1)', 'scale(1.005)'],
        },
        {
          duration: 540,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-old(root)',
        }
      );

      // 3. Spawn a luminous celestial shockwave halo that rides precisely on the expanding wave crest
      try {
        if (typeof document !== 'undefined' && document.body) {
          const halo = document.createElement('div');
          halo.className = 'theme-transition-halo';
          halo.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            width: 0px;
            height: 0px;
            border-radius: 9999px;
            pointer-events: none;
            z-index: 2147483647;
            transform: translate(-50%, -50%);
            border: 2px solid ${isDark ? 'rgba(129, 140, 248, 0.75)' : 'rgba(251, 191, 36, 0.8)'};
            box-shadow: ${
              isDark
                ? '0 0 50px 14px rgba(99, 102, 241, 0.45), inset 0 0 35px 8px rgba(129, 140, 248, 0.3)'
                : '0 0 50px 14px rgba(245, 158, 11, 0.42), inset 0 0 35px 8px rgba(251, 191, 36, 0.25)'
            };
          `;
          document.body.appendChild(halo);

          const haloAnim = halo.animate(
            [
              { width: '0px', height: '0px', opacity: 0.95 },
              { width: `${endRadius * 1.4}px`, height: `${endRadius * 1.4}px`, opacity: 0.8, offset: 0.7 },
              { width: `${endRadius * 2.1}px`, height: `${endRadius * 2.1}px`, opacity: 0 },
            ],
            {
              duration: 560,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }
          );

          haloAnim.onfinish = () => halo.remove();
          haloAnim.oncancel = () => halo.remove();
        }
      } catch {
        // Fallback safely if DOM manipulation is constrained
      }
    }).catch(() => {
      applyTheme();
    });
  } catch {
    applyTheme();
  }

  return next;
}

export function toggleThemeWithTransition(
  currentTheme: ThemeMode,
  event?: React.MouseEvent | MouseEvent,
  onApplied?: (next: ThemeMode) => void,
  cycleSystem = false
): ThemeMode {
  // If cycleSystem is true: light -> dark -> system -> light
  // Otherwise direct elegant toggle: light <-> dark
  const next: ThemeMode = cycleSystem
    ? currentTheme === 'light'
      ? 'dark'
      : currentTheme === 'dark'
        ? 'system'
        : 'light'
    : currentTheme === 'dark'
      ? 'light'
      : 'dark';

  return applyThemeMode(next, event, onApplied);
}

