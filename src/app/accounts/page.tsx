'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Plus, UserRound } from 'lucide-react';
import Button from '@/components/ui/Button';
import GlassCard from '@/components/ui/GlassCard';
import { showAppToast } from '@/components/ui/ToastHost';
import { identifyAnalyticsUser, track } from '@/lib/analytics/client';
import { Account, createAccount, getAccounts, setActiveAccount, validateAccountName } from '@/lib/accounts';
import { getItem, KEYS } from '@/lib/storage';
import { UserProfile } from '@/lib/mock-data';

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>(() => getAccounts().sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt)));
  const [name, setName] = useState('');

  const goNext = (accountId: string) => {
    const user = getItem<UserProfile | null>(`fla:${accountId}:${KEYS.USER}`, null);
    router.push(user ? '/dashboard' : '/onboarding');
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateAccountName(name, accounts);
    if (error) {
      showAppToast(error, 'error');
      return;
    }

    try {
      const account = createAccount(name);
      identifyAnalyticsUser(account.id);
      track('sign_up', { channel: 'local_account', account_type: 'local' }, { userId: account.id });
      showAppToast('账户已创建。', 'success');
      goNext(account.id);
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : '创建账户失败。', 'error');
    }
  };

  const handleSelect = (id: string) => {
    const account = setActiveAccount(id);
    if (!account) {
      showAppToast('账户不存在，请重新创建。', 'error');
      setAccounts(getAccounts());
      return;
    }
    identifyAnalyticsUser(account.id);
    goNext(account.id);
  };

  return (
    <div className="min-h-dvh px-5 pt-14 pb-10">
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl gradient-accent flex items-center justify-center mb-4">
          <UserRound size={24} className="text-white" />
        </div>
        <h1 className="text-[24px] font-semibold mb-2">选择账户</h1>
        <p className="text-[14px] text-text-secondary leading-relaxed">
          每个账户的数据会单独保存在这台设备上，体重、饮食、计划和聊天记录不会混在一起。
        </p>
      </div>

      <form onSubmit={handleCreate} className="mb-7">
        <label className="text-[13px] text-text-secondary font-medium block mb-2.5">新账户名</label>
        <div className="glass-card rounded-xl px-4 py-3.5 mb-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：张三"
            className="bg-transparent border-none outline-none text-[16px] w-full text-text-primary"
            maxLength={20}
          />
        </div>
        <Button fullWidth type="submit">
          <Plus size={18} className="mr-2" />
          创建并进入
        </Button>
      </form>

      {accounts.length > 0 && (
        <div>
          <p className="text-[13px] text-text-secondary font-medium mb-3">已有账户</p>
          <div className="flex flex-col gap-3">
            {accounts.map(account => (
              <GlassCard key={account.id} padding="p-4" className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold truncate">{account.name}</p>
                  <p className="text-[11px] text-text-tertiary mt-1">
                    上次使用 {new Date(account.lastActiveAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                <button
                  onClick={() => handleSelect(account.id)}
                  className="w-10 h-10 rounded-full bg-glass border border-white/10 flex items-center justify-center text-accent-blue shrink-0"
                  aria-label={`进入 ${account.name}`}
                >
                  <LogIn size={18} />
                </button>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
