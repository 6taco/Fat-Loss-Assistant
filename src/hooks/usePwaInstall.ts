'use client';

import { useEffect, useState, useCallback } from 'react';
import { BeforeInstallPromptEvent, isStandalonePwa } from '@/lib/pwa';

const STORAGE_KEY = 'pwa_install_prompt';
const DISMISS_DAYS = 3;

// Capture the event as early as possible — before any React component mounts.
// This runs once when the module is first imported (client-side only).
let cachedPromptEvent: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    cachedPromptEvent = e as BeforeInstallPromptEvent;
  }, { once: true });
}

interface StoredState {
  dismissedAt?: number;
  installed?: boolean;
}

function getStoredState(): StoredState {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function setStoredState(state: StoredState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function shouldShowPrompt(): boolean {
  const state = getStoredState();
  if (state.installed) return false;
  if (state.dismissedAt) {
    const daysSince = (Date.now() - state.dismissedAt) / (1000 * 60 * 60 * 24);
    if (daysSince < DISMISS_DAYS) return false;
  }
  return true;
}

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (isStandalonePwa()) {
      setIsInstalled(true);
      return;
    }
    if (getStoredState().installed) {
      setIsInstalled(true);
      return;
    }
    if (!shouldShowPrompt()) return;

    const tryShow = (event: BeforeInstallPromptEvent) => {
      setPromptEvent(event);
      setTimeout(() => setIsVisible(true), 2500);
    };

    // Use cached event if already fired before this component mounted
    if (cachedPromptEvent) {
      tryShow(cachedPromptEvent);
      return;
    }

    // Otherwise wait for it
    const handler = (e: Event) => {
      e.preventDefault();
      cachedPromptEvent = e as BeforeInstallPromptEvent;
      tryShow(cachedPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setPromptEvent(null);
      setStoredState({ installed: true });
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsVisible(false);
      setPromptEvent(null);
      cachedPromptEvent = null;
      setStoredState({ installed: true });
      return true;
    }
    return false;
  }, [promptEvent]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setStoredState({ dismissedAt: Date.now() });
  }, []);

  const triggerAfterAction = useCallback(() => {
    if (promptEvent && shouldShowPrompt() && !isInstalled) {
      setTimeout(() => setIsVisible(true), 800);
    }
  }, [promptEvent, isInstalled]);

  return { isVisible, isInstalled, promptEvent, install, dismiss, triggerAfterAction };
}
