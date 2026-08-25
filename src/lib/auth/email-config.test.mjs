import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveEmailConfig } from './email-config.js';

test('resolves QQ SMTP configuration', () => {
  const config = resolveEmailConfig({
    APP_URL: 'https://example.com/',
    EMAIL_PROVIDER: 'smtp',
    EMAIL_FROM: 'Light Burn AI <123456@qq.com>',
    SMTP_HOST: 'smtp.qq.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: '123456@qq.com',
    SMTP_PASS: 'authorization-code',
  });

  assert.equal(config.provider, 'smtp');
  assert.equal(config.appUrl, 'https://example.com');
  assert.equal(config.smtp.host, 'smtp.qq.com');
  assert.equal(config.smtp.port, 465);
  assert.equal(config.smtp.secure, true);
});

test('requires an SMTP authorization code', () => {
  assert.throws(() => resolveEmailConfig({
    APP_URL: 'https://example.com',
    EMAIL_PROVIDER: 'smtp',
    EMAIL_FROM: '123456@qq.com',
    SMTP_HOST: 'smtp.qq.com',
    SMTP_USER: '123456@qq.com',
  }), /SMTP_PASS/);
});

test('rejects an invalid SMTP port', () => {
  assert.throws(() => resolveEmailConfig({
    APP_URL: 'https://example.com',
    EMAIL_PROVIDER: 'smtp',
    EMAIL_FROM: '123456@qq.com',
    SMTP_HOST: 'smtp.qq.com',
    SMTP_PORT: 'invalid',
    SMTP_USER: '123456@qq.com',
    SMTP_PASS: 'authorization-code',
  }), /SMTP_PORT/);
});
