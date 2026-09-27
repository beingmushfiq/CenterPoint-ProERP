import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StorefrontThemeToggle } from './StorefrontThemeToggle';

// Mock theme transition to avoid document.startViewTransition crashes in jsdom
vi.mock('../../lib/theme/themeTransition', () => ({
  toggleThemeWithTransition: (currentTheme: string, _e: unknown, onApply: (next: 'light' | 'dark') => void) => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('ui.theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    onApply(nextTheme);
  },
}));

describe('StorefrontThemeToggle', () => {
  const storage: Record<string, string> = {};
  beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach((k) => delete storage[k]);
    }),
    length: 0,
    key: vi.fn(),
  });
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
});

  it('defaults to Light Mode when no localStorage is present', () => {
    render(<StorefrontThemeToggle />);
    const button = screen.getByRole('button', { name: /switch to dark mode/i });
    expect(button).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles from Light Mode to Dark Mode on click', () => {
    render(<StorefrontThemeToggle />);
    const button = screen.getByRole('button', { name: /switch to dark mode/i });
    fireEvent.click(button);

    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('respects stored dark mode preference if previously selected', () => {
    localStorage.setItem('ui.theme', 'dark');
    render(<StorefrontThemeToggle />);

    const button = screen.getByRole('button', { name: /switch to light mode/i });
    expect(button).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
