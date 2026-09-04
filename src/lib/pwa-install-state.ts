export interface InstallPromptState {
  handled?: boolean;
  dismissedAt?: number;
  installed?: boolean;
}

export function shouldShowInstallPrompt(state: InstallPromptState): boolean {
  return !state.installed && !state.handled && !state.dismissedAt;
}

export function createDismissedInstallPromptState(): InstallPromptState {
  return {
    handled: true,
    dismissedAt: Date.now(),
    installed: false,
  };
}

export function createInstalledInstallPromptState(installed = true): InstallPromptState {
  return {
    handled: true,
    installed,
  };
}
