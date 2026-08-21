'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CloudUpload, LoaderCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { showAppToast } from '@/components/ui/ToastHost';
import { readLocalAppDataForAccount } from '@/lib/app-data';
import { useRouter } from 'next/navigation';
import { getAccounts, getActiveAccountId } from '@/lib/accounts';

const DATASETS = [
  ['user', '个人资料', 'user'],
  ['weights', '体重记录', 'weightEntries'],
  ['meals', '饮食记录', 'mealLogs'],
  ['plans', '日计划', 'plans'],
  ['chat', '聊天记录', 'chatMessages'],
  ['dailyReports', '日报', 'dailyReports'],
  ['weeklyReports', '周报', 'weeklyReports'],
  ['lifestyle', '生活方式', 'lifestyleProfile'],
] as const;

export default function ImportLocalPage() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const accounts = useMemo(() => getAccounts(), []);
  const cloudAccountId = useMemo(() => getActiveAccountId(), []);
  const importSources = useMemo(() => accounts.filter(account => account.id !== cloudAccountId), [accounts, cloudAccountId]);
  const [sourceAccountId, setSourceAccountId] = useState(importSources[0]?.id || cloudAccountId || '');
  const local = useMemo(() => readLocalAppDataForAccount(sourceAccountId || null), [sourceAccountId]);

  const start = async () => {
    setRunning(true);
    try {
      const selected = DATASETS.filter(([, , key]) => {
        const value = local[key];
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
      });
      if (!selected.length) {
        showAppToast('当前没有可导入的本地数据。', 'error');
        return;
      }

      const datasets = selected.map(([dataset]) => dataset);
      const startResponse = await postJson<{ importId: string }>('/api/account/import-local/start', {
        sourceAccountId: local.account?.id,
        datasets,
      });

      for (const [dataset, , key] of selected) {
        const value = local[key];
        const items = Array.isArray(value) ? value : value ? [value] : [];
        for (let index = 0; index < items.length; index += 100) {
          await postJson('/api/account/import-local/chunk', {
            importId: startResponse.importId,
            dataset,
            chunkIndex: Math.floor(index / 100),
            items: items.slice(index, index + 100).map((item, offset) => ({
              sourceId: typeof item === 'object' && item && 'id' in item && typeof item.id === 'string'
                ? item.id
                : `${dataset}-${index + offset}`,
              ...(typeof item === 'object' && item ? item : { value: item }),
            })),
          });
        }
      }

      await postJson('/api/account/import-local/complete', { importId: startResponse.importId });
      setDone(true);
      showAppToast('本地数据导入完成。', 'success');
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : '本地数据导入失败。', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="min-h-dvh px-5 pt-14 pb-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-xl gradient-accent text-white">
          {done ? <CheckCircle2 size={23} /> : <CloudUpload size={23} />}
        </div>
        <h1 className="text-[25px] font-semibold">导入本地数据</h1>
        <p className="mt-2 text-[14px] leading-6 text-text-secondary">把当前浏览器中的资料复制到你的云端账号。认证信息和本地账户 ID 不会被导入。</p>

        {importSources.length ? <label className="mt-6 block">
          <span className="mb-2 block text-[13px] font-medium text-text-secondary">选择本地数据来源</span>
          <select value={sourceAccountId} onChange={event => setSourceAccountId(event.target.value)} className="glass-card h-12 w-full rounded-xl border border-border-glass bg-transparent px-3 text-[14px] outline-none">
            {importSources.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label> : null}

        <div className="mt-7 space-y-2">
          {DATASETS.map(([dataset, label, key]) => {
            const value = local[key];
            const count = Array.isArray(value) ? value.length : value ? 1 : 0;
            return <div key={dataset} className="glass-card flex items-center justify-between rounded-xl px-4 py-3">
              <span className="text-[14px]">{label}</span>
              <span className="text-[13px] text-text-tertiary">{count} 条</span>
            </div>;
          })}
        </div>

        <Button fullWidth className="mt-7" disabled={running || done} onClick={start}>
          {running ? <LoaderCircle size={18} className="mr-2 animate-spin" /> : <CloudUpload size={18} className="mr-2" />}
          {done ? '已完成导入' : '开始导入'}
        </Button>
        {done ? <Button fullWidth variant="secondary" className="mt-3" onClick={() => router.replace('/dashboard')}>返回应用</Button> : null}
      </div>
    </main>
  );
}

async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || 'IMPORT_FAILED');
  return data as T;
}
