import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAppVersion } from './appVersion';

describe('getAppVersion', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns v2.0 as the active edition fallback version', () => {
    const version = getAppVersion();
    expect(version).toBe('v2.0');
  });
});
