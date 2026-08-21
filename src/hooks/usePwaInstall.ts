'use client';

import { useEffect, useState, useCallback } from 'react';
import { BeforeInstallPromptEvent, isStandalonePwa } from '@/lib/pwa';
import {
  createDismissedInstallPromptState,
  createInstalledInstallPromptState,
  shouldShowInstallPrompt,
  type InstallPromptState,
} from '@/lib/pwa-install-state';

const STORAGE_KEY = 'pwa_install_prompt';

// Capture the event as early as possible — before any React component mounts.
// This runs once when the module is first imported (client-side only).
let cachedPromptEvent: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    cachedPromptEvent = e as BeforeInstallPromptEvent;
  }, { once: true });
}

function getStoredState(): InstallPromptState {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function setStoredState(state: InstallPromptState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => isStandalonePwa() || Boolean(getStoredState().installed));

  useEffect(() => {
    if (isStandalonePwa() || getStoredState().installed) return;
    if (!shouldShowInstallPrompt(getStoredState())) return;

    const tryShow = (event: BeforeInstallPromptEvent) => {
      setPromptEvent(event);
      setTimeout(() => {
        if (shouldShowInstallPrompt(getStoredState())) {
          setIsVisible(true);
        }
      }, 2500);
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
      setStoredState(createInstalledInstallPromptState());
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return false;
    setIsVisible(false);
    setStoredState(createInstalledInstallPromptState(false));

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    cachedPromptEvent = null;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setStoredState(createInstalledInstallPromptState());
      return true;
    }
    return false;
  }, [promptEvent]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setStoredState(createDismissedInstallPromptState());
  }, []);

  const triggerAfterAction = useCallback(() => {
    if (promptEvent && shouldShowInstallPrompt(getStoredState()) && !isInstalled) {
      setTimeout(() => {
        if (shouldShowInstallPrompt(getStoredState())) {
          setIsVisible(true);
        }
      }, 800);
    }
  }, [promptEvent, isInstalled]);

  return { isVisible, isInstalled, promptEvent, install, dismiss, triggerAfterAction };
}
