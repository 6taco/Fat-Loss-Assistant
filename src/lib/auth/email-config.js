export function resolveEmailConfig(env = process.env) {
  const appUrl = env.APP_URL;
  const from = env.EMAIL_FROM || env.RESEND_FROM_EMAIL;
  const provider = (env.EMAIL_PROVIDER || (env.SMTP_HOST ? 'smtp' : 'resend')).toLowerCase();

  if (!appUrl || !from) {
    throw new Error('APP_URL and EMAIL_FROM are required');
  }

  if (provider === 'smtp') {
    const host = env.SMTP_HOST;
    const user = env.SMTP_USER;
    const pass = env.SMTP_PASS;
    if (!host || !user || !pass) {
      throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS are required for SMTP email');
    }
    return {
      provider: 'smtp',
      from,
      appUrl: appUrl.replace(/\/$/, ''),
      smtp: {
        host,
        port: parsePort(env.SMTP_PORT),
        secure: (env.SMTP_SECURE || 'true').toLowerCase() === 'true',
        user,
        pass,
      },
    };
  }

  if (provider === 'resend') {
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is required for Resend email');
    return {
      provider: 'resend',
      from,
      appUrl: appUrl.replace(/\/$/, ''),
      resendApiKey: env.RESEND_API_KEY,
    };
  }

  throw new Error('EMAIL_PROVIDER must be smtp or resend');
}

function parsePort(value) {
  const port = Number(value || 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port');
  }
  return port;
}
