'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, LoaderCircle, LogIn, Mail, UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { showAppToast } from '@/components/ui/ToastHost';
import { useAuth } from '@/components/auth/AuthProvider';

type Mode = 'login' | 'register' | 'forgot';

export default function AccountsPage() {
  return <Suspense fallback={<div className="min-h-dvh" />}><AccountsContent /></Suspense>;
}

function AccountsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [registrationCodeSent, setRegistrationCodeSent] = useState(false);
  const [registrationCooldown, setRegistrationCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (registrationCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setRegistrationCooldown(value => Math.max(0, value - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [registrationCooldown]);

  useEffect(() => {
    if (auth.status === 'authenticated') router.replace(auth.user.hasProfile ? '/dashboard' : '/onboarding');
  }, [auth, router]);

  useEffect(() => {
    if (searchParams.get('verified') === '1') showAppToast('邮箱验证成功，请登录。', 'success');
    if (searchParams.get('verified') === '0') showAppToast('验证链接无效或已过期。', 'error');
    if (searchParams.get('reason') === 'session_expired') showAppToast('登录状态已过期，请重新登录。', 'error');
  }, [searchParams]);

  const resetRegistrationVerification = () => {
    setRegistrationCode('');
    setRegistrationCodeSent(false);
    setRegistrationCooldown(0);
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    resetRegistrationVerification();
  };

  const validateRegistration = () => {
    if (!email.trim()) {
      showAppToast('请输入邮箱。', 'error');
      return false;
    }
    if (password.length < 8) {
      showAppToast('密码至少需要 8 个字符。', 'error');
      return false;
    }
    if (password !== confirmPassword) {
      showAppToast('两次输入的密码不一致。', 'error');
      return false;
    }
    return true;
  };

  const sendRegistrationCode = async () => {
    if (!validateRegistration()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register/send-code', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) {
        showAppToast(errorMessage(data.error), 'error');
        return;
      }
      setRegistrationCodeSent(true);
      setRegistrationCooldown(60);
      showAppToast(data.message || '验证码已发送，请检查邮箱。', 'success');
    } catch {
      showAppToast('网络请求失败，请稍后重试。', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return showAppToast('请输入邮箱。', 'error');
    if (mode !== 'forgot' && password.length < 8) return showAppToast('密码至少需要 8 个字符。', 'error');
    if (mode === 'register' && password !== confirmPassword) return showAppToast('两次输入的密码不一致。', 'error');
    if (mode === 'register' && !registrationCodeSent) {
      await sendRegistrationCode();
      return;
    }
    if (mode === 'register' && !/^\d{6}$/.test(registrationCode)) {
      showAppToast('请输入 6 位邮箱验证码。', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : mode === 'register' ? '/api/auth/register' : '/api/auth/forgot-password';
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'forgot'
            ? { email }
            : mode === 'register'
              ? { email, code: registrationCode }
              : { email, password },
        ),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) {
        showAppToast(errorMessage(data.error), 'error');
        return;
      }

      if (mode === 'login') {
        const next = await auth.refresh();
        if (next.status === 'authenticated') router.replace(next.user.hasProfile ? '/dashboard' : '/onboarding');
        return;
      }
      if (mode === 'register') {
        showAppToast('注册成功，请使用邮箱和密码登录。', 'success');
        switchMode('login');
        setPassword('');
        setConfirmPassword('');
        return;
      }
      showAppToast(data.message || '如果邮箱已注册，重置邮件将会发送。', 'success');
      switchMode('login');
    } catch {
      showAppToast('网络请求失败，请稍后重试。', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const Icon = mode === 'login' ? LogIn : mode === 'register' ? UserPlus : KeyRound;
  return (
    <div className="min-h-dvh px-5 pt-14 pb-10">
      <header className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-accent text-white">
          <Icon size={23} />
        </div>
        <h1 className="text-[25px] font-semibold">{mode === 'login' ? '登录轻燃AI' : mode === 'register' ? '创建云端账号' : '找回密码'}</h1>
        <p className="mt-2 text-[14px] leading-6 text-text-secondary">
          {mode === 'login' ? '登录后可在手机和电脑同步你的体重、饮食、计划和报告。' : mode === 'register' ? '使用邮箱和密码创建云端账号。' : '输入注册邮箱，我们会发送一封密码重置邮件。'}
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <Field icon={Mail} label="邮箱" type="email" value={email} onChange={value => { setEmail(value); if (registrationCodeSent) resetRegistrationVerification(); }} autoComplete="email" />
        {mode !== 'forgot' ? <Field icon={KeyRound} label="密码" type="password" value={password} onChange={value => { setPassword(value); if (mode === 'register' && registrationCodeSent) resetRegistrationVerification(); }} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /> : null}
        {mode === 'register' ? <Field icon={KeyRound} label="确认密码" type="password" value={confirmPassword} onChange={value => { setConfirmPassword(value); if (registrationCodeSent) resetRegistrationVerification(); }} autoComplete="new-password" /> : null}
        {mode === 'register' ? (
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-text-secondary">邮箱验证码</span>
            <span className="glass-card flex items-center gap-3 rounded-xl px-4 py-2.5">
              <Mail size={18} className="shrink-0 text-text-tertiary" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={registrationCode}
                onChange={event => setRegistrationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                placeholder="输入 6 位验证码"
                className="min-w-0 flex-1 border-none bg-transparent text-[16px] outline-none"
              />
              <button
                type="button"
                disabled={isSubmitting || registrationCooldown > 0}
                onClick={() => void sendRegistrationCode()}
                className="shrink-0 whitespace-nowrap text-[13px] font-medium text-accent-blue disabled:cursor-not-allowed disabled:opacity-50"
              >
                {registrationCooldown > 0 ? `${registrationCooldown}s 后重发` : registrationCodeSent ? '重新发送' : '发送验证码'}
              </button>
            </span>
          </label>
        ) : null}
        <Button fullWidth type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle size={18} className="mr-2 animate-spin" /> : <Icon size={18} className="mr-2" />}
          {mode === 'login' ? '登录' : mode === 'register' ? (registrationCodeSent ? '验证并注册' : '发送验证码') : '发送重置邮件'}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-3 text-[13px]">
        {mode !== 'login' ? <button className="bg-transparent text-accent-blue" onClick={() => switchMode('login')}>返回登录</button> : null}
        {mode === 'login' ? <button className="bg-transparent text-accent-blue" onClick={() => switchMode('register')}>注册账号</button> : null}
        {mode === 'login' ? <button className="bg-transparent text-text-secondary" onClick={() => setMode('forgot')}>忘记密码</button> : null}
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, type, value, onChange, autoComplete }: { icon: typeof Mail; label: string; type: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-text-secondary">{label}</span>
      <span className="glass-card flex items-center gap-3 rounded-xl px-4 py-3.5">
        <Icon size={18} className="shrink-0 text-text-tertiary" />
        <input type={type} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} className="w-full border-none bg-transparent text-[16px] outline-none" />
      </span>
    </label>
  );
}

function errorMessage(code?: string) {
  if (code === 'INVALID_CREDENTIALS') return '邮箱或密码不正确。';
  if (code === 'INVALID_EMAIL') return '请输入有效邮箱。';
  if (code === 'INVALID_PASSWORD') return '密码需要 8-128 个字符，且不能与邮箱相同。';
  if (code === 'INVALID_REGISTRATION_CODE') return '验证码不正确，请重新输入。';
  if (code === 'REGISTRATION_CODE_EXPIRED') return '验证码已过期，请重新发送。';
  if (code === 'REGISTRATION_CODE_ATTEMPTS_EXCEEDED') return '验证码错误次数过多，请重新发送验证码。';
  if (code === 'EMAIL_ALREADY_REGISTERED') return '该邮箱已经注册，请直接登录或使用找回密码。';
  if (code === 'AUTH_RATE_LIMITED') return '尝试次数过多，请稍后再试。';
  if (code === 'AUTH_DATABASE_NOT_CONFIGURED') return '账号服务尚未配置数据库。请先配置 Aiven 的 DATABASE_URL。';
  if (code === 'AUTH_DATABASE_MIGRATION_REQUIRED') return '账号数据表尚未创建。请先执行 Prisma 认证迁移。';
  if (code === 'AUTH_DATABASE_UNAVAILABLE' || code === 'AUTH_SERVICE_UNAVAILABLE') return '账号数据库暂时不可用，请检查 Aiven 连接后重试。';
  return '请求失败，请稍后重试。';
}
