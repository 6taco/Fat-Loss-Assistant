export type EmailConfig =
  | {
      provider: 'smtp';
      from: string;
      appUrl: string;
      smtp: { host: string; port: number; secure: boolean; user: string; pass: string };
    }
  | {
      provider: 'resend';
      from: string;
      appUrl: string;
      resendApiKey: string;
    };

export function resolveEmailConfig(env?: NodeJS.ProcessEnv): EmailConfig;
