'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Brain, CheckCircle2, MessageSquare, Scale, Settings, TrendingDown, Utensils } from 'lucide-react';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import GlassCard from '@/components/ui/GlassCard';
import RingChart from '@/components/ui/RingChart';
import { showAppToast } from '@/components/ui/ToastHost';
import { clearLocalAppData, downloadLocalAppData } from '@/lib/app-data';
import { clearActiveAccount, getActiveAccount, getScopedKey } from '@/lib/accounts';
import { getItem, KEYS } from '@/lib/storage';
import { useMealStore } from '@/stores/useMealStore';
import { usePlanStore } from '@/stores/usePlanStore';
import { useUserStore } from '@/stores/useUserStore';
import { useWeightStore } from '@/stores/useWeightStore';
import { CarbType, WeightEntry, carbColors, getFatBurnIndex, getTodayPlan, mockUser } from '@/lib/mock-data';

const todayIso = new Date().toISOString().slice(0, 10);

const carbLabel: Record<CarbType, string> = {
  high: '高碳日',
  mid: '中碳日',
  low: '低碳日',
};

const carbTip: Record<CarbType, string> = {
  high: '今天适合安排背部或腿部训练。主食优先选择米饭、土豆、燕麦等稳定碳水来源。',
  mid: '今天重点是稳定执行。保证蛋白质摄入，训练和日常步数都不要掉线。',
  low: '今天更需要控制饥饿感。优先保证蛋白质、蔬菜、饮水和电解质。',
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loadUser } = useUserStore();
  const { plans, loadPlans, toggleComplete } = usePlanStore();
  const { entries: weightEntries, loadEntries, addEntry } = useWeightStore();
  const { loadMeals, getDailySummary } = useMealStore();
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [weightValue, setWeightValue] = useState('');

  useEffect(() => {
    const activeAccount = getActiveAccount();
    if (!activeAccount) {
      router.replace('/accounts');
      return;
    }
    if (!getItem(getScopedKey(KEYS.USER), null)) {
      router.replace('/onboarding');
      return;
    }
    loadUser();
    loadPlans();
    loadEntries();
    loadMeals();
  }, [loadUser, loadPlans, loadEntries, loadMeals, router]);

  const u = user || mockUser;
  const todayPlan = getTodayPlan(plans);
  const color = todayPlan ? carbColors[todayPlan.carbType] : carbColors.low;
  const burnIndex = todayPlan ? getFatBurnIndex(todayPlan.carbType, todayPlan.completed) : 0;
  const mealSummary = getDailySummary(todayIso);
  const weights = useMemo(() => mergeInitialWeight(u, weightEntries), [u, weightEntries]);
  const latestWeight = weights[weights.length - 1];
  const prevWeight = weights.length >= 3 ? weights[weights.length - 3] : weights[0];
  const weightDiff = latestWeight && prevWeight ? (latestWeight.weight - prevWeight.weight).toFixed(1) : '0';
  const chartEntries = weights.slice(-7);
  const chartWeights = chartEntries.map(entry => entry.weight);
  const minChartWeight = chartWeights.length ? Math.min(...chartWeights) : u.weight - 1;
  const maxChartWeight = chartWeights.length ? Math.max(...chartWeights) : u.weight + 1;
  const chartRange = Math.max(0.1, maxChartWeight - minChartWeight);
  const dayCount = Math.max(1, Math.floor((new Date(todayIso).getTime() - new Date(u.startDate).getTime()) / 86400000) + 1);

  const saveWeight = () => {
    const weight = Number.parseFloat(weightValue);
    if (Number.isNaN(weight) || weight < 30 || weight > 250) {
      showAppToast('请输入 30-250 kg 之间的体重。', 'error');
      return;
    }

    addEntry({ date: todayIso, weight });
    setShowWeightInput(false);
    setWeightValue('');
    showAppToast('体重已保存。', 'success');
  };

  return (
    <div className="px-5 pt-14 pb-28 min-h-dvh relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{ background: `radial-gradient(circle, ${color.main}08, transparent 70%)`, top: '-10%', right: '-30%' }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.48, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.2px]">Hi, {u.name}</h1>
          <p className="text-[13px] text-text-tertiary mt-1">今天是你执行计划的第 {dayCount} 天</p>
        </div>
        <button
          className="w-9 h-9 glass-card rounded-full flex items-center justify-center"
          onClick={() => setShowSettings(true)}
          aria-label="设置"
        >
          <Settings size={16} className="text-text-secondary" />
        </button>
      </div>

      {todayPlan && (
        <GlassCard variant="highlight" className="mb-3 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: color.main, boxShadow: `0 0 8px ${color.main}` }} />
              <span className="text-[13px] font-medium" style={{ color: color.main }}>{carbLabel[todayPlan.carbType]}</span>
            </div>
            <span className="text-[11px] text-text-tertiary">{todayPlan.trainingLabel || '今日计划'}</span>
          </div>

          <div className="flex items-center gap-6 mb-4">
            <div className="flex-shrink-0">
              <motion.div
                className="text-[56px] font-bold leading-none gradient-accent-text"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {burnIndex}
              </motion.div>
              <p className="text-[11px] text-text-tertiary mt-1">燃脂指数 / 100</p>
            </div>
            <div className="flex-1 flex justify-center">
              <RingChart
                size={120}
                centerValue={todayPlan.calories.toLocaleString()}
                centerLabel="kcal"
                rings={[
                  { value: 40, color: '#0A84FF', label: '碳水', current: `${Math.round(mealSummary.carb)}`, target: `${todayPlan.carb}g` },
                  { value: 62, color: '#30D158', label: '蛋白', current: `${Math.round(mealSummary.protein)}`, target: `${todayPlan.protein}g` },
                  { value: 51, color: '#FFD60A', label: '脂肪', current: `${Math.round(mealSummary.fat)}`, target: `${todayPlan.fat}g` },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.12)' }}>
            <Brain size={14} className="text-accent-blue flex-shrink-0" />
            <p className="text-[12px] text-accent-blue font-medium">{carbTip[todayPlan.carbType]}</p>
          </div>
        </GlassCard>
      )}

      {todayPlan && (
        <GlassCard className="mb-3 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Utensils size={14} className="text-accent-blue" />
              <span className="text-[13px] font-medium">今日摄入</span>
            </div>
            <button onClick={() => router.push('/meals')} className="text-[12px] text-accent-blue bg-transparent border-none cursor-pointer">
              记饮食
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <IntakeStat label="碳水" current={mealSummary.carb} target={todayPlan.carb} color="#0A84FF" />
            <IntakeStat label="蛋白" current={mealSummary.protein} target={todayPlan.protein} color="#30D158" />
            <IntakeStat label="脂肪" current={mealSummary.fat} target={todayPlan.fat} color="#FFD60A" />
          </div>
        </GlassCard>
      )}

      <GlassCard className="mb-3 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingDown size={14} className="text-carb-low" />
            <span className="text-[13px] font-medium">体重趋势</span>
          </div>
          <span className="text-[11px] text-text-tertiary">近 7 天</span>
        </div>
        <div className="flex items-end justify-between gap-1 h-12 mb-2">
          {chartEntries.map((entry, index) => {
            const height = ((entry.weight - minChartWeight) / chartRange) * 100;
            return (
              <motion.div
                key={`${entry.date}-${index}`}
                className="flex-1 rounded-sm"
                style={{ background: index === chartEntries.length - 1 ? '#0A84FF' : 'rgba(255,255,255,0.08)' }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(10, height)}%` }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[20px] font-bold">{latestWeight?.weight ?? u.weight} kg</span>
          <span className={`text-[12px] font-medium ${Number(weightDiff) <= 0 ? 'text-carb-low' : 'text-carb-high'}`}>
            {Number(weightDiff) <= 0 ? '下降' : '上升'} {Math.abs(Number(weightDiff))} kg
          </span>
        </div>
      </GlassCard>

      <div className="grid grid-cols-3 gap-3 relative z-10">
        <ActionCard icon={Scale} label="记体重" color="#0A84FF" onClick={() => setShowWeightInput(true)} />
        <ActionCard icon={MessageSquare} label="问 AI" color="#5E5CE6" onClick={() => router.push('/chat')} />
        <ActionCard
          icon={CheckCircle2}
          label={todayPlan?.completed ? '已完成' : '今日完成'}
          color="#30D158"
          onClick={() => {
            if (!todayPlan) return;
            toggleComplete(todayPlan.date);
            showAppToast(todayPlan.completed ? '已取消今日完成。' : '今日完成状态已更新。', 'success');
          }}
        />
      </div>

      {showWeightInput && (
        <ModalBackdrop onClose={() => setShowWeightInput(false)}>
          <p className="text-[16px] font-semibold mb-4">记录今日体重</p>
          <div className="flex items-center gap-2 mb-5">
            <input
              type="number"
              step="0.1"
              value={weightValue}
              onChange={(event) => setWeightValue(event.target.value)}
              placeholder={String(latestWeight?.weight || u.weight)}
              className="flex-1 bg-transparent border border-white/10 rounded-xl px-4 py-3 text-[18px] font-bold text-text-primary outline-none focus:border-accent-blue transition-colors"
              autoFocus
            />
            <span className="text-[14px] text-text-tertiary">kg</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowWeightInput(false)} className="flex-1 py-3 rounded-xl border border-white/10 bg-transparent text-text-secondary text-[14px] cursor-pointer">
              取消
            </button>
            <button onClick={saveWeight} className="flex-1 py-3 rounded-xl gradient-accent text-white text-[14px] font-medium cursor-pointer border-none">
              保存
            </button>
          </div>
        </ModalBackdrop>
      )}

      {showSettings && (
        <ModalBackdrop onClose={() => setShowSettings(false)} maxWidth="max-w-[340px]">
          <p className="text-[16px] font-semibold mb-2">应用与数据</p>
          <p className="text-[12px] text-text-tertiary leading-relaxed mb-5">
            数据会先保存在本机，数据库可用时自动同步。Android Chrome 可将减脂助手安装到手机主屏幕。
          </p>
          <div className="flex flex-col gap-3">
            <InstallPrompt />
            <button
              onClick={() => {
                downloadLocalAppData();
                showAppToast('本地数据已导出。', 'success');
              }}
              className="py-3 rounded-xl gradient-accent text-white text-[14px] font-medium cursor-pointer border-none"
            >
              导出 JSON
            </button>
            <button onClick={() => router.push('/onboarding')} className="py-3 rounded-xl border border-white/10 bg-transparent text-text-secondary text-[14px] cursor-pointer">
              重新填写信息
            </button>
            <button
              onClick={() => {
                setShowSettings(false);
                router.push('/accounts');
              }}
              className="py-3 rounded-xl border border-white/10 bg-transparent text-text-secondary text-[14px] cursor-pointer"
            >
              切换账户
            </button>
            <button
              onClick={() => {
                clearActiveAccount();
                showAppToast('已退出当前账户。', 'success');
                router.push('/accounts');
              }}
              className="py-3 rounded-xl border border-white/10 bg-transparent text-text-secondary text-[14px] cursor-pointer"
            >
              退出当前账户
            </button>
            <button
              onClick={() => {
                clearLocalAppData();
                showAppToast('本地数据已清除。', 'success');
                router.push('/onboarding');
              }}
              className="py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-[14px] cursor-pointer"
            >
              清除本地数据
            </button>
            <button onClick={() => setShowSettings(false)} className="py-3 rounded-xl border border-white/10 bg-transparent text-text-tertiary text-[14px] cursor-pointer">
              关闭
            </button>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}

function ActionCard({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: typeof Scale;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <GlassCard padding="p-3" className="flex flex-col items-center gap-2 cursor-pointer" whileTap={{ scale: 0.95 }} onClick={onClick}>
      <Icon size={20} style={{ color }} />
      <span className="text-[12px] text-text-secondary">{label}</span>
    </GlassCard>
  );
}

function ModalBackdrop({
  children,
  onClose,
  maxWidth = 'max-w-[320px]',
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-8"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
        className={`glass-card-elevated p-6 rounded-2xl w-full ${maxWidth}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function mergeInitialWeight(user: typeof mockUser, entries: WeightEntry[]): WeightEntry[] {
  const initialEntry = {
    date: user.initialWeightDate || user.startDate,
    weight: user.weight,
  };
  const byDate = new Map<string, WeightEntry>();
  entries.forEach(entry => byDate.set(entry.date, entry));
  byDate.set(initialEntry.date, initialEntry);
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function IntakeStat({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const diff = Math.round(target - current);
  return (
    <div className="rounded-xl bg-glass px-3 py-3">
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      <p className="text-[16px] font-bold" style={{ color }}>{Math.round(current)}g</p>
      <p className="text-[10px] text-text-tertiary mt-1">{diff >= 0 ? `剩 ${diff}g` : `超 ${Math.abs(diff)}g`}</p>
    </div>
  );
}
