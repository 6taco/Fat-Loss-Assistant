'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarCheck, ChevronUp, HeartPulse, RotateCw, Send, Sparkles, X } from 'lucide-react';
import { track } from '@/lib/analytics/client';
import { showAppToast } from '@/components/ui/ToastHost';
import { useChatStore } from '@/stores/useChatStore';
import { useDailyReportStore } from '@/stores/useDailyReportStore';
import { usePlanStore } from '@/stores/usePlanStore';
import { useUserStore } from '@/stores/useUserStore';
import { useWeightStore } from '@/stores/useWeightStore';
import { COACH_PROFILES, useCoachPreferenceStore } from '@/stores/useCoachPreferenceStore';
import type { CoachProfile } from '@/stores/useCoachPreferenceStore';
import { ChatCard, ChatMessage, DailyReport } from '@/lib/types';
import { getTodayPlan } from '@/lib/domain';
import { getScopedKey } from '@/lib/accounts';
import { getItem, KEYS } from '@/lib/storage';

const quickTags = ['今天吃什么？', '平台期怎么办？', '可以吃欺骗餐吗？', '帮我调整计划', '加餐建议'];

// Onboarding lifestyle answers the user already gave — the coach should know
// about binge risk, sleep habits and plan tolerance when replying.
function getLifestyleContext() {
  const stored = getItem<Record<string, unknown> | null>(getScopedKey(KEYS.LIFESTYLE_PROFILE), null);
  if (!stored) return undefined;
  return {
    sleepRegularity: stored.sleepRegularity,
    averageSleepHours: stored.averageSleepHours,
    oftenStaysUpLate: stored.oftenStaysUpLate,
    dietRegularity: stored.dietRegularity,
    bingeRisk: stored.bingeRisk,
    takeawayFrequency: stored.takeawayFrequency,
    complexPlanTolerance: stored.complexPlanTolerance,
    trainingExperience: stored.trainingExperience,
    fatLossGoal: stored.fatLossGoal,
    targetWeeks: stored.targetWeeks,
  };
}

export default function ChatPage() {
  const router = useRouter();
  const { messages, isTyping, loadMessages, addMessage, setTyping } = useChatStore();
  const { user, loadUser } = useUserStore();
  const { plans, loadPlans } = usePlanStore();
  const { entries: weightEntries, loadEntries } = useWeightStore();
  const { latestReport, isLoading: isReportLoading, error: reportError, loadReports, ensureLatestReport, generateReport } = useDailyReportStore();
  const { gender: coachGender, loadPreference } = useCoachPreferenceStore();
  const coach = COACH_PROFILES[coachGender];
  const [input, setInput] = useState('');
  const [openPanel, setOpenPanel] = useState<'coach' | 'report' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPreference();
    loadMessages();
    loadUser();
    loadPlans();
    loadEntries();
    loadReports();
  }, [loadPreference, loadMessages, loadUser, loadPlans, loadEntries, loadReports]);

  useEffect(() => {
    if (!user?.id) return;
    ensureLatestReport();
  }, [user?.id, ensureLatestReport]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const currentMessages = messages;
    const sentAt = new Date();
    const userMsg: ChatMessage = {
      id: `msg-${sentAt.getTime()}`,
      role: 'user',
      content: text.trim(),
      timestamp: sentAt.toISOString(),
    };
      addMessage(userMsg);
    track('ai_chat_send', {
      message_length: text.trim().length,
      quick_tag: text.trim(),
    });
    setInput('');

    const todayPlan = getTodayPlan(plans);
    setTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: currentMessages,
          context: {
            user,
            coach: { gender: coach.gender, name: coach.name },
            todayPlan,
            recentWeights: weightEntries.slice(-5),
            completed: todayPlan?.completed,
            lifestyle: getLifestyleContext(),
          },
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        setTyping(false);
        showAppToast('请先登录后再使用 AI 聊天。', 'error');
        return;
      }
      if (!response.ok) throw data;

      setTyping(false);
      track('ai_chat_reply', {
        provider: data?.source || 'local',
        rag_used: Boolean(data?.message?.cards?.length),
        confidence: data?.message?.cards?.length ? 'high' : 'medium',
      });
      addMessage(data.message as ChatMessage);
    } catch (error) {
      // Server-provided fallback text stays; the old canned "local fallback"
      // replies pretended to answer the question and misled users.
      const fallback = error && typeof error === 'object' && 'fallback' in error
        ? (error as { fallback: ChatMessage }).fallback
        : null;
      const respondedAt = new Date();
      const aiMsg: ChatMessage = fallback || {
        id: `msg-${respondedAt.getTime()}`,
        role: 'ai',
        content: 'AI 服务暂时没有连上，上面这条不是 AI 的回复。你的消息没有丢失，稍后再试一次，或先去「教练」页看看今日建议。',
        timestamp: respondedAt.toISOString(),
      };

      setTyping(false);
      showAppToast('AI 服务暂时不可用，请稍后重试。', 'error');
      addMessage(aiMsg);
    }
  };

  const handleGenerateReport = async () => {
    const report = await generateReport(undefined, Boolean(latestReport));
    const latestError = useDailyReportStore.getState().error;
    showAppToast(report ? '日报已更新。' : latestError || '日报暂时生成失败，稍后再试。', report ? 'success' : 'error');
  };

  return (
    <div className="flex flex-col h-dvh pt-[88px] pb-[83px] relative overflow-hidden bg-transparent">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-carb-low/15 blur-3xl" />
        <div className="absolute top-40 -left-28 w-72 h-72 rounded-full bg-carb-mid/15 blur-3xl" />
      </div>

      <button
        type="button"
        onClick={() => router.push('/coach')}
        className="absolute left-5 top-5 z-40 w-11 h-11 rounded-full border border-border-glass bg-white/85 backdrop-blur-xl flex items-center justify-center text-text-secondary shadow-[0_10px_26px_rgba(104,83,55,0.14)] active:scale-95 transition-transform"
        aria-label="返回教练页"
      >
        <ArrowLeft size={19} />
      </button>

      <TopFloatingPanels
        openPanel={openPanel}
        onToggle={(panel) => setOpenPanel(current => current === panel ? null : panel)}
        onClose={() => setOpenPanel(null)}
        report={latestReport}
        isReportLoading={isReportLoading}
        reportError={reportError}
        onGenerateReport={handleGenerateReport}
        coach={coach}
      />

      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-5 pt-3 pb-4">
        <div className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} coach={coach} />
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5 items-start">
              <Avatar coach={coach} />
              <div className="rounded-[6px_18px_18px_18px] bg-white/82 border border-border-glass px-4 py-3 shadow-[0_8px_24px_rgba(104,83,55,0.10)]">
                <p className="text-[11px] text-text-tertiary mb-2">{coach.displayName} 正在认真听你说</p>
                <TypingDots />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="relative z-10 px-5 py-2 flex gap-2 overflow-x-auto">
        {quickTags.map(tag => (
          <button
            key={tag}
            onClick={() => sendMessage(tag)}
            className="rounded-full px-3.5 py-2 text-[12px] text-text-secondary whitespace-nowrap cursor-pointer border border-border-glass-strong bg-white/75 hover:bg-white transition-colors shadow-[0_4px_12px_rgba(104,83,55,0.06)]"
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="relative z-10 px-5 pb-2 flex gap-2.5 items-center">
        <div className="flex-1 rounded-[18px] px-4 py-3 flex items-center bg-white/90 border border-border-glass shadow-[0_8px_24px_rgba(104,83,55,0.12)]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="说说今天哪里最难..."
            className="w-full bg-transparent border-none outline-none text-[14px] text-text-primary placeholder:text-text-tertiary"
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          className="w-11 h-11 rounded-full gradient-accent flex items-center justify-center cursor-pointer border-none shadow-[0_6px_16px_rgba(103,181,107,0.28)] flex-shrink-0 active:scale-95 transition-transform disabled:opacity-50"
          disabled={isTyping}
          aria-label="发送"
        >
          <Send size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}

function TopFloatingPanels({
  openPanel,
  onToggle,
  onClose,
  report,
  isReportLoading,
  reportError,
  onGenerateReport,
  coach,
}: {
  openPanel: 'coach' | 'report' | null;
  onToggle: (panel: 'coach' | 'report') => void;
  onClose: () => void;
  report: DailyReport | null;
  isReportLoading: boolean;
  reportError: string;
  onGenerateReport: () => void;
  coach: CoachProfile;
}) {
  return (
    <div className="absolute top-4 left-[74px] right-5 z-30 pointer-events-none">
      <div className="flex items-center justify-between gap-2.5">
        <motion.button
          type="button"
          onClick={() => onToggle('coach')}
          whileTap={{ scale: 0.94 }}
          className={`pointer-events-auto relative min-w-0 flex-1 rounded-[20px] border px-2.5 py-2 backdrop-blur-xl flex items-center gap-2.5 text-left transition-colors ${
            openPanel === 'coach'
              ? 'border-carb-low/45 bg-white shadow-[0_12px_30px_rgba(103,181,107,0.18)]'
              : 'border-border-glass bg-white/88 shadow-[0_10px_26px_rgba(104,83,55,0.12)]'
          }`}
          aria-label={openPanel === 'coach' ? `收起 ${coach.displayName}` : `展开 ${coach.displayName}`}
        >
          <Avatar coach={coach} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-text-primary">{coach.displayName}</span>
            <span className="mt-0.5 block truncate text-[10px] text-text-tertiary">在线 · {coach.description}</span>
          </span>
          <motion.span
            animate={{ rotate: openPanel === 'coach' ? 180 : 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="w-6 h-6 rounded-full bg-carb-low/12 text-carb-low flex items-center justify-center border border-carb-low/20"
          >
            <ChevronUp size={12} />
          </motion.span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => onToggle('report')}
          whileTap={{ scale: 0.94 }}
          className={`pointer-events-auto relative w-12 h-12 shrink-0 rounded-[17px] border backdrop-blur-xl flex items-center justify-center transition-colors ${
            openPanel === 'report'
              ? 'border-carb-low/45 bg-white shadow-[0_12px_30px_rgba(103,181,107,0.18)]'
              : 'border-border-glass bg-white/88 shadow-[0_10px_26px_rgba(104,83,55,0.12)]'
          }`}
          aria-label={openPanel === 'report' ? '收起 AI 减脂日报' : '展开 AI 减脂日报'}
        >
          <CalendarCheck size={20} className="text-carb-low" />
          <span className="absolute -bottom-1 -right-1 min-w-6 h-6 rounded-full bg-white border border-carb-low/50 px-1 flex items-center justify-center text-[10px] font-semibold text-text-primary">
            {isReportLoading && !report ? '--' : report?.score ?? 'AI'}
          </span>
          <motion.span
            animate={{ rotate: openPanel === 'report' ? 180 : 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-carb-low text-white flex items-center justify-center border border-white/70"
          >
            <ChevronUp size={12} />
          </motion.span>
        </motion.button>
      </div>

      <AnimatePresence>
        {openPanel && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-[-1] bg-black/10 pointer-events-auto"
              onClick={onClose}
              aria-label="关闭顶部面板"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              initial={{ opacity: 0, y: -26, scale: 0.96 }}
              animate={{ opacity: 1, y: 14, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.8 }}
              className="pointer-events-auto relative mt-1 max-h-[72dvh] overflow-y-auto rounded-[24px] border border-border-glass bg-white/90 p-3.5 shadow-[0_24px_70px_rgba(104,83,55,0.18),0_0_32px_rgba(103,181,107,0.12)] backdrop-blur-2xl"
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="absolute right-6 top-6 z-10 w-8 h-8 rounded-full bg-white/75 border border-border-glass flex items-center justify-center text-text-secondary active:scale-95 transition-transform"
              >
                <X size={15} />
              </button>
              {openPanel === 'coach' ? (
                <CoachHeader coach={coach} />
              ) : (
                <DailyReportPanel
                  report={report}
                  isLoading={isReportLoading}
                  error={reportError}
                  onGenerate={onGenerateReport}
                  coach={coach}
                />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function CoachHeader({ coach }: { coach: CoachProfile }) {
  return (
    <div className="glass-card-highlight p-4 flex items-center gap-3 pr-11">
      <Avatar size="lg" coach={coach} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[17px] font-semibold">{coach.displayName}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-carb-low/10 border border-carb-low/20 px-2 py-0.5 text-[10px] text-carb-low">
            <span className="w-1.5 h-1.5 rounded-full bg-carb-low" />
            在线
          </span>
        </div>
        <p className="text-[12px] text-text-secondary">温柔减脂教练</p>
        <p className="text-[11px] text-text-tertiary mt-1.5 leading-relaxed">难受的时候也可以来找我，我们先把这一刻稳住。</p>
      </div>
      <div className="w-9 h-9 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center shrink-0">
        <HeartPulse size={16} className="text-accent-blue" />
      </div>
    </div>
  );
}

function DailyReportPanel({
  report,
  isLoading,
  error,
  onGenerate,
  coach,
}: {
  report: DailyReport | null;
  isLoading: boolean;
  error: string;
  onGenerate: () => void;
  coach: CoachProfile;
}) {
  const dateLabel = report ? formatReportDate(report.date) : '收盘复盘';
  const score = report?.score ?? 0;

  return (
    <div className="rounded-2xl border border-border-glass-strong bg-white/82 px-4 py-3.5 shadow-[0_12px_34px_rgba(104,83,55,0.12)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-carb-low/12 border border-carb-low/25 flex items-center justify-center">
            <CalendarCheck size={15} className="text-carb-low" />
          </div>
          <div>
            <p className="text-[14px] font-semibold">AI 减脂日报</p>
            <p className="text-[11px] text-text-tertiary">{dateLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onGenerate}
            disabled={isLoading}
            className="h-8 px-2.5 rounded-full border border-border-glass bg-white/70 text-[11px] text-text-secondary flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition-transform"
          >
            <RotateCw size={12} className={isLoading ? 'animate-spin' : ''} />
            {report ? '重新生成' : '生成'}
          </button>
          <ScoreRing score={score} isLoading={isLoading && !report} />
        </div>
      </div>

      {isLoading && !report ? (
        <p className="text-[13px] text-text-secondary leading-relaxed">{coach.displayName} 正在整理你的日报...</p>
      ) : error && !report ? (
        <p className="text-[13px] text-text-secondary leading-relaxed">{error}</p>
      ) : report ? (
        <>
          <p className="text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap break-words">{report.summary}</p>
          <div className="grid gap-2 mt-3">
            {report.suggestions.map((suggestion, index) => (
              <div key={index} className="rounded-xl border border-border-glass bg-bg-tertiary/75 px-3 py-2">
                <p className="text-[12px] text-text-secondary leading-snug">{suggestion}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[13px] text-text-secondary leading-relaxed">记录饮食、体重或打卡后，就可以生成最近一天的温柔复盘。</p>
      )}
    </div>
  );
}

function ScoreRing({ score, isLoading }: { score: number; isLoading: boolean }) {
  const clamped = Math.max(0, Math.min(100, score));
  const background = `conic-gradient(#68B96C ${clamped * 3.6}deg, rgba(103,181,107,0.14) 0deg)`;

  return (
    <div className="w-14 h-14 rounded-full p-[3px] shrink-0" style={{ background }}>
      <div className="w-full h-full rounded-full bg-white/95 flex flex-col items-center justify-center">
        <span className="text-[15px] font-semibold leading-none">{isLoading ? '--' : clamped}</span>
        <span className="text-[9px] text-text-tertiary mt-0.5">分</span>
      </div>
    </div>
  );
}

function formatReportDate(date: string) {
  const [, month, day] = date.split('-');
  return `${Number(month)}月${Number(day)}日 收盘复盘`;
}

function MessageBubble({ message, coach }: { message: ChatMessage; coach: CoachProfile }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? 'justify-end' : 'gap-2.5 items-start'}`}
    >
      {!isUser && <Avatar coach={coach} />}
      <div
        className={`max-w-[82%] px-4 py-3 shadow-[0_8px_24px_rgba(104,83,55,0.10)] ${
          isUser
            ? 'bg-gradient-to-br from-[#86C979] via-[#5EAB68] to-[#4F9460] rounded-[18px_6px_18px_18px] text-white'
            : 'bg-white/82 border border-border-glass rounded-[6px_18px_18px_18px]'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={12} className="text-carb-low" />
            <span className="text-[11px] text-text-tertiary font-medium">{coach.displayName}</span>
          </div>
        )}
        <p className={`text-[14px] leading-relaxed whitespace-pre-wrap break-words ${isUser ? 'text-white' : 'text-text-primary'}`}>
          {message.content}
        </p>
        {message.cards?.map((card, index) => (
          <ChatCardComponent key={index} card={card} />
        ))}
        <span className={`text-[10px] block mt-2 ${isUser ? 'text-white/55 text-right' : 'text-text-tertiary'}`}>
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

function Avatar({ size = 'sm', coach }: { size?: 'sm' | 'lg'; coach: CoachProfile }) {
  const dimensions = size === 'lg' ? 'w-14 h-14 rounded-full' : 'w-9 h-9 rounded-full';
  const imageSize = size === 'lg' ? 56 : 32;

  return (
    <div className={`${dimensions} relative overflow-hidden flex-shrink-0 bg-white border-2 border-white shadow-[0_6px_18px_rgba(79,148,96,0.22)]`}>
      <Image
        src={coach.avatar}
        alt={coach.displayName}
        width={imageSize}
        height={imageSize}
        className="w-full h-full object-cover"
        priority={size === 'lg'}
      />
      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-carb-low border-2 border-white" />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center h-4">
      {[0, 0.2, 0.4].map((delay, i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-accent-blue"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, delay }}
        />
      ))}
    </div>
  );
}

function ChatCardComponent({ card }: { card: ChatCard }) {
  const accent = card.type === 'food' ? '#30D158' : card.type === 'calorie' ? '#0A84FF' : '#5E5CE6';
  const bg = card.type === 'food' ? 'rgba(48,209,88,0.08)' : card.type === 'calorie' ? 'rgba(10,132,255,0.08)' : 'rgba(94,92,230,0.08)';

  return (
    <div className="mt-3 rounded-xl p-3 border" style={{ background: bg, borderColor: `${accent}33` }}>
      <p className="text-[11px] font-semibold mb-2" style={{ color: accent }}>{card.title}</p>
      <div className="flex flex-col gap-2">
        {card.items.map((item, index) => (
          <div key={index} className="flex items-start justify-between gap-3 rounded-lg bg-black/10 px-2.5 py-2">
            <span className="text-[13px] leading-snug">{item.label}</span>
            <span className="text-[11px] text-text-tertiary text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
