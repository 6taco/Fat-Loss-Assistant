'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, LoaderCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { showAppToast } from '@/components/ui/ToastHost';

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="min-h-dvh" />}><ResetPasswordContent /></Suspense>;
}

function ResetPasswordContent() {
  const router = useRouter();
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return showAppToast('重置链接无效。', 'error');
    if (password.length < 8 || password !== confirmPassword) return showAppToast('请确认两次输入相同，且密码至少 8 个字符。', 'error');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) return showAppToast('重置链接无效或已过期。', 'error');
      showAppToast('密码已更新，请重新登录。', 'success');
      router.replace('/accounts');
    } catch {
      showAppToast('网络请求失败，请稍后重试。', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh px-5 pt-14 pb-10">
      <KeyRound size={28} className="mb-5 text-accent-blue" />
      <h1 className="text-[25px] font-semibold">设置新密码</h1>
      <p className="mt-2 text-[14px] text-text-secondary">重置成功后，所有设备都需要重新登录。</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <PasswordField label="新密码" value={password} onChange={setPassword} />
        <PasswordField label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} />
        <Button fullWidth type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle size={18} className="mr-2 animate-spin" /> : <KeyRound size={18} className="mr-2" />}
          更新密码
        </Button>
      </form>
    </div>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] text-text-secondary">{label}</span>
      <input type="password" value={value} onChange={event => onChange(event.target.value)} autoComplete="new-password" className="glass-card w-full rounded-xl px-4 py-3.5 text-[16px] outline-none" />
    </label>
  );
}
