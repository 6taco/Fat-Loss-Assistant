'use client';

import { useEffect, useState, useCallback } from 'react';
import { BeforeInstallPromptEvent, isStandalonePwa } from '@/lib/pwa';

const STORAGE_KEY = 'pwa_install_prompt';
const DISMISS_DAYS = 3;

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
  } catch {
    // ignore
  }
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

    const stored = getStoredState();
    if (stored.installed) {
      setIsInstalled(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);

      if (shouldShowPrompt()) {
        // Delay: show after 2.5s so user lands on the page first
        setTimeout(() => setIsVisible(true), 2500);
      }
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setPromptEvent(null);
      setStoredState({ installed: true });
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
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
      setStoredState({ installed: true });
      return true;
    }
    return false;
  }, [promptEvent]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setStoredState({ dismissedAt: Date.now() });
  }, []);

  // Called externally after user completes a record — re-check eligibility
  const triggerAfterAction = useCallback(() => {
    if (promptEvent && shouldShowPrompt() && !isInstalled) {
      setTimeout(() => setIsVisible(true), 800);
    }
  }, [promptEvent, isInstalled]);

  return { isVisible, isInstalled, promptEvent, install, dismiss, triggerAfterAction };
}
