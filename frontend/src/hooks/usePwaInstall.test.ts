import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePwaInstall } from './usePwaInstall';

interface MockBeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

describe('usePwaInstall hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default non-standalone state', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.isInstallable).toBe(false);
  });

  it('captures beforeinstallprompt and enables installable state', () => {
    const { result } = renderHook(() => usePwaInstall());

    const promptMock = vi.fn().mockResolvedValue(undefined);
    const mockEvent = new Event('beforeinstallprompt') as unknown as MockBeforeInstallPromptEvent;
    mockEvent.prompt = promptMock;
    mockEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    expect(result.current.isInstallable).toBe(true);
  });

  it('triggers promptInstall and transitions state upon acceptance', async () => {
    const { result } = renderHook(() => usePwaInstall());

    const promptMock = vi.fn().mockResolvedValue(undefined);
    const mockEvent = new Event('beforeinstallprompt') as unknown as MockBeforeInstallPromptEvent;
    mockEvent.prompt = promptMock;
    mockEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    let success = false;
    await act(async () => {
      success = await result.current.promptInstall();
    });

    expect(promptMock).toHaveBeenCalled();
    expect(success).toBe(true);
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('handles appinstalled event', () => {
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });
});
