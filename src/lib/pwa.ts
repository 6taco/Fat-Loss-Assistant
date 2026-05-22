'use client';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean(navigator.standalone));
}

export async function getPwaStatus() {
  if (typeof window === 'undefined') {
    return { standalone: false, serviceWorker: false, manifest: false };
  }

  const serviceWorker = 'serviceWorker' in navigator
    ? Boolean(await navigator.serviceWorker.getRegistration('/'))
    : false;

  const manifest = Boolean(document.querySelector('link[rel="manifest"]'));

  return {
    standalone: isStandalonePwa(),
    serviceWorker,
    manifest,
  };
}
