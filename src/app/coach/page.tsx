'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, Brain, Check, ChevronRight, Dumbbell, ListChecks, MessageSquare, RefreshCw, ShoppingCart, Sparkles, X } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { showAppToast } from '@/components/ui/ToastHost';
import { track } from '@/lib/analytics/client';
import { getActiveAccount, getScopedKey } from '@/lib/accounts';
import { getItem, KEYS } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { useCoachStore } from '@/stores/useCoachStore';
import type { ActionProposal, CoachInsight } from '@/lib/mock-data';

const insightTone: Record<CoachInsight['severity'], { label: string; className: string }> = {
  info: { label: '洞察', className: 'text-accent-blue bg-blue-500/10 border-blue-400/20' },
  warning: { label: '留意', className: 'text-yellow-200 bg-yellow-500/10 border-yellow-400/20' },
  action: { label: '行动', className: 'text-carb-low bg-green-500/10 border-green-400/20' },
};

const proposalIcon: Record<ActionProposal['type'], typeof Brain> = {
  adjust_calorie_target: ListChecks,
  adjust_carb_cycle: RefreshCw,
  generate_meal_plan: Sparkles,
  generate_training_plan: Dumbbell,
  generate_shopping_list: ShoppingCart,
  update_weight_goal: Brain,
  update_calorie_target: ListChecks,
  reorder_carb_cycle: RefreshCw,
  create_shopping_list: ShoppingCart,
};

export default function CoachPage() {
  const router = useRouter();
  const { feed, isLoading, error, loadFeed, runDaily, runWeekly, acceptProposal, dismissProposal } = useCoachStore();

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
    track('coach_feed_view', { feed_type: 'coach_page' }, { userId: activeAccount.id });
    loadFeed();
  }, [loadFeed, router]);

  const topInsight = feed.insights[0];

  return (
    <div className="px-5 pt-14 pb-28 min-h-dvh">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[12px] text-text-tertiary mb-1">AI 减脂教练</p>
          <h1 className="text-[24px] font-semibold">教练动态</h1>
        </div>
        <button
          onClick={() => {
            track('coach_feed_click', { card_type: 'daily_refresh', card_id: 'run_daily' });
            void runDaily().then(() => showAppToast('教练动态已更新。', 'success'));
          }}
          disabled={isLoading}
          className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-accent-blue disabled:opacity-50"
          aria-label="运行每日教练分析"
        >
          <RefreshCw size={17} className={cn(isLoading && 'animate-spin')} />
        </button>
      </div>

      <GlassCard variant="highlight" className="mb-3 overflow-hidden relative">
        <div className="absolute right-[-56px] top-[-56px] w-36 h-36 rounded-full bg-accent-blue/10" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={16} className="text-accent-blue" />
            <span className="text-[12px] text-accent-blue font-medium">主动教练</span>
          </div>
          <h2 className="text-[20px] font-semibold mb-2">{topInsight?.title || '准备好复盘你的数据了'}</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            {topInsight?.summary || '点击每日复盘，我会把今天的记录整理成一个最值得执行的下一步。'}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => void runDaily().then(() => showAppToast('每日复盘已生成。', 'success'))}
              disabled={isLoading}
              className="rounded-xl py-3 gradient-accent text-white text-[13px] font-medium disabled:opacity-50"
            >
              每日复盘
            </button>
            <button
              onClick={() => void runWeekly().then(() => showAppToast('每周策略已生成。', 'success'))}
              disabled={isLoading}
              className="rounded-xl py-3 border border-white/10 bg-white/[0.05] text-text-secondary text-[13px] font-medium disabled:opacity-50"
            >
              每周策略
            </button>
          </div>
        </div>
      </GlassCard>

      <button
        type="button"
        onClick={() => router.push('/chat')}
        className="w-full mb-5 rounded-2xl border border-accent-blue/25 bg-accent-blue/10 px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-blue/15 border border-accent-blue/25 flex items-center justify-center shrink-0">
            <MessageSquare size={18} className="text-accent-blue" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-text-primary">问 AI 教练</p>
            <p className="text-[12px] text-text-secondary mt-1 leading-snug">进入原来的 AI 聊天页，继续提问饮食、平台期、训练和计划调整。</p>
          </div>
          <ChevronRight size={17} className="text-text-tertiary shrink-0" />
        </div>
      </button>

      {error && (
        <p className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">{error}</p>
      )}

      <SectionTitle title="需要你确认" count={feed.proposals.length} />
      <div className="flex flex-col gap-3 mb-5">
        {feed.proposals.length ? feed.proposals.map(proposal => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            disabled={isLoading}
            onAccept={() => void acceptProposal(proposal.id).then(() => showAppToast('建议已采纳。', 'success'))}
            onDismiss={() => void dismissProposal(proposal.id).then(() => showAppToast('建议已忽略。', 'success'))}
          />
        )) : (
          <EmptyCard text="暂无待确认调整。涉及热量、碳循环、饮食或训练变化时，教练会先征得你的确认。" />
        )}
      </div>

      <SectionTitle title="教练洞察" count={feed.insights.length} />
      <div className="flex flex-col gap-3 mb-5">
        {feed.insights.length ? feed.insights.map(insight => (
          <InsightCard key={insight.id} insight={insight} />
        )) : <EmptyCard text="运行一次每日复盘后，这里会出现第一条主动洞察。" />}
      </div>

      <SectionTitle title="记忆与提醒" count={feed.memories.length + feed.notifications.length} />
      <div className="grid grid-cols-1 gap-3">
        {feed.notifications.slice(0, 3).map(notification => (
          <GlassCard key={notification.id} className="flex items-start gap-3">
            <Bell size={16} className="text-accent-blue mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold">{notification.title}</p>
              <p className="text-[12px] text-text-tertiary mt-1">{notification.body}</p>
            </div>
          </GlassCard>
        ))}
        {feed.memories.slice(0, 3).map(memory => (
          <GlassCard key={memory.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold">{memory.title}</p>
              <p className="text-[11px] text-text-tertiary mt-1">记忆类型：{memoryTypeLabel(memory.type)}</p>
            </div>
            <ChevronRight size={16} className="text-text-tertiary mt-0.5" />
          </GlassCard>
        ))}
        {!feed.notifications.length && !feed.memories.length && <EmptyCard text="你采纳或忽略的建议会沉淀为长期记忆，让后续建议更贴合你。" />}
      </div>
    </div>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-[13px] text-text-secondary font-medium">{title}</p>
      <span className="text-[11px] text-text-tertiary">{count}</span>
    </div>
  );
}

function ProposalCard({
  proposal,
  disabled,
  onAccept,
  onDismiss,
}: {
  proposal: ActionProposal;
  disabled: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const Icon = proposalIcon[proposal.type];
  const safety = proposal.safety && typeof proposal.safety === 'object' ? proposal.safety as { risk?: string } : {};

  return (
    <GlassCard className="relative overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center shrink-0">
          <Icon size={17} className="text-accent-blue" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-semibold">{proposal.title}</p>
            <span className="shrink-0 text-[10px] rounded-full px-2 py-1 border border-white/10 text-text-tertiary">
              {riskLabel(safety.risk)}风险
            </span>
          </div>
          <p className="text-[12px] text-text-secondary leading-relaxed mt-2">{proposal.summary}</p>
          <p className="text-[11px] text-text-tertiary mt-2">不会自动修改计划，确认后才会生效。</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          onClick={onDismiss}
          disabled={disabled}
          className="rounded-xl py-2.5 border border-white/10 bg-white/[0.04] text-text-secondary text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <X size={14} /> 忽略
        </button>
        <button
          onClick={onAccept}
          disabled={disabled}
          className="rounded-xl py-2.5 gradient-accent text-white text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Check size={14} /> 采纳
        </button>
      </div>
    </GlassCard>
  );
}

function InsightCard({ insight }: { insight: CoachInsight }) {
  const tone = insightTone[insight.severity];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard>
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-[14px] font-semibold">{insight.title}</p>
          <span className={cn('text-[10px] rounded-full px-2 py-1 border shrink-0', tone.className)}>{tone.label}</span>
        </div>
        <p className="text-[12px] text-text-secondary leading-relaxed">{insight.summary}</p>
        <p className="text-[11px] text-text-tertiary mt-3">{formatDate(insight.date)}</p>
      </GlassCard>
    </motion.div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-4 text-[12px] text-text-tertiary leading-relaxed">
      {text}
    </div>
  );
}

function formatDate(date: string) {
  const [, month, day] = date.split('-');
  return `${month}/${day}`;
}

function riskLabel(risk?: string) {
  if (risk === 'medium') return '中';
  return '低';
}

function memoryTypeLabel(type: string) {
  if (type === 'effective_strategy') return '有效策略';
  if (type === 'risk_pattern') return '风险模式';
  if (type === 'milestone') return '里程碑';
  if (type === 'rejected_advice') return '已拒绝建议';
  return '偏好';
}
