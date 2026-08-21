import { Resend } from 'resend';

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.APP_URL;
  if (!apiKey || !from || !appUrl) throw new Error('RESEND_API_KEY, RESEND_FROM_EMAIL and APP_URL are required');
  return { resend: new Resend(apiKey), from, appUrl: appUrl.replace(/\/$/, '') };
}

export async function sendVerificationEmail(email: string, token: string) {
  const { resend, from, appUrl } = getEmailConfig();
  const url = `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: '验证你的轻燃AI邮箱',
    html: `<p>欢迎使用轻燃AI。</p><p><a href="${url}">验证邮箱</a></p><p>链接将在24小时后失效。</p>`,
  });
  if (error) throw new Error(error.message);
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const { resend, from, appUrl } = getEmailConfig();
  const url = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: '重置你的轻燃AI密码',
    html: `<p>我们收到了密码重置请求。</p><p><a href="${url}">重置密码</a></p><p>链接将在1小时后失效。如果不是你发起的请求，请忽略此邮件。</p>`,
  });
  if (error) throw new Error(error.message);
}
