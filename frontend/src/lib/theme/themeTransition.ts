/**
 * Utility for circular ripple / view-transition theme toggling.
 * Supports 3-state themes: 'light' | 'dark' | 'system'
 * Starts an expanding circular animation from the exact coordinates of the user's click.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem('ui.theme') || localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return 'system';
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

  // If View Transitions API is not supported or reduced motion is preferred, apply immediately
  if (!doc?.startViewTransition || isReducedMotion) {
    applyTheme();
    return next;
  }

  // Calculate coordinates from the click or element center
  let x = window.innerWidth;
  let y = 0;

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

  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  try {
    const transition = doc.startViewTransition(() => {
      applyTheme();
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      document.documentElement.animate(
        {
          clipPath,
        },
        {
          duration: 500,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
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
  onApplied?: (next: ThemeMode) => void
): ThemeMode {
  // 3-state cycle: light -> dark -> system -> light
  const next: ThemeMode =
    currentTheme === 'light'
      ? 'dark'
      : currentTheme === 'dark'
        ? 'system'
        : 'light';

  return applyThemeMode(next, event, onApplied);
}
