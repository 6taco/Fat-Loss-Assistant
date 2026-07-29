import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDismissedInstallPromptState,
  createInstalledInstallPromptState,
  shouldShowInstallPrompt,
} from './pwa-install-state.js';

test('never shows the automatic install prompt after the user closes it', () => {
  const state = createDismissedInstallPromptState();

  assert.equal(shouldShowInstallPrompt(state), false);
});

test('never shows the automatic install prompt after the install button is used', () => {
  const state = createInstalledInstallPromptState(false);

  assert.equal(shouldShowInstallPrompt(state), false);
  assert.equal(state.installed, false);
});

test('keeps previous dismissals permanently dismissed', () => {
  assert.equal(shouldShowInstallPrompt({ dismissedAt: 1 }), false);
});

test('shows the automatic install prompt for a new visitor', () => {
  assert.equal(shouldShowInstallPrompt({}), true);
});
