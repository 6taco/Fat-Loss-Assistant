import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { resolveEmailConfig } from '@/lib/auth/email-config';

export async function sendPasswordResetEmail(email: string, token: string) {
  const config = resolveEmailConfig();
  const { from, appUrl } = config;
  const url = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
  const subject = '重置你的轻燃AI密码';
  const html = `<p>我们收到了密码重置请求。</p><p><a href="${url}">重置密码</a></p><p>链接将在1小时后失效。如果不是你发起的请求，请忽略此邮件。</p>`;

  if (config.provider === 'smtp') {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    await transporter.sendMail({ from, to: email, subject, html });
    return;
  }

  const resend = new Resend(config.resendApiKey);
  const { error } = await resend.emails.send({ from, to: email, subject, html });
  if (error) throw new Error(error.message);
}

export async function sendRegistrationCodeEmail(email: string, code: string) {
  const config = resolveEmailConfig();
  const { from } = config;
  const subject = '你的轻燃AI注册验证码';
  const html = `<p>你的轻燃AI注册验证码是：</p><p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${code}</p><p>验证码将在10分钟后失效。如果不是你发起的注册请求，请忽略此邮件。</p>`;

  if (config.provider === 'smtp') {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    await transporter.sendMail({ from, to: email, subject, html });
    return;
  }

  const resend = new Resend(config.resendApiKey);
  const { error } = await resend.emails.send({ from, to: email, subject, html });
  if (error) throw new Error(error.message);
}
