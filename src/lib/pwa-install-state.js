export function shouldShowInstallPrompt(state) {
  return !state.installed && !state.handled && !state.dismissedAt;
}

export function createDismissedInstallPromptState() {
  return {
    handled: true,
    dismissedAt: Date.now(),
    installed: false,
  };
}

export function createInstalledInstallPromptState(installed = true) {
  return {
    handled: true,
    installed,
  };
}
