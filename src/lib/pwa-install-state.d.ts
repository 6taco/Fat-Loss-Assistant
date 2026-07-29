export interface InstallPromptState {
  handled?: boolean;
  dismissedAt?: number;
  installed?: boolean;
}

export function shouldShowInstallPrompt(state: InstallPromptState): boolean;
export function createDismissedInstallPromptState(): InstallPromptState;
export function createInstalledInstallPromptState(installed?: boolean): InstallPromptState;
