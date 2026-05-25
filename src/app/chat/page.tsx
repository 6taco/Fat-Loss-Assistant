'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { CalendarCheck, ChevronUp, HeartPulse, RotateCw, Send, Sparkles, X } from 'lucide-react';
import { showAppToast } from '@/components/ui/ToastHost';
import { useChatStore } from '@/stores/useChatStore';
import { useDailyReportStore } from '@/stores/useDailyReportStore';
import { usePlanStore } from '@/stores/usePlanStore';
import { useUserStore } from '@/stores/useUserStore';
import { useWeightStore } from '@/stores/useWeightStore';
import { ChatCard, ChatMessage, DailyReport, getTodayPlan } from '@/lib/mock-data';

const quickTags = ['今天吃什么？', '平台期怎么办？', '可以吃欺骗餐吗？', '帮我调整计划', '加餐建议'];

const mockAIResponses: Record<string, { content: string; cards?: ChatCard[] }> = {
  '今天吃什么？': {
    content: '今天先按当前碳循环目标安排：主食不过量，蛋白质每餐都要有，蔬菜用来增加饱腹感。',
    cards: [{
      type: 'food',
      title: '今日参考搭配',
      items: [
        { label: '早餐：鸡蛋 + 燕麦', value: '约 320 kcal' },
        { label: '午餐：鸡胸肉 + 米饭 + 蔬菜', value: '约 520 kcal' },
        { label: '晚餐：鱼肉 + 绿叶菜', value: '约 420 kcal' },
        { label: '加餐：无糖酸奶或坚果', value: '约 150 kcal' },
      ],
    }],
  },
  '平台期怎么办？': {
    content: '体重短期停滞不一定是失败。先看 7-14 天平均体重，再决定是否调整热量或活动量。',
    cards: [{
      type: 'suggestion',
      title: '平台期检查清单',
      items: [
        { label: '看平均体重', value: '不要只看单日波动' },
        { label: '检查睡眠', value: '优先保证 7 小时以上' },
        { label: '提高日常活动', value: '先增加步数' },
        { label: '保持蛋白质', value: '每公斤体重约 1.5g' },
      ],
    }],
  },
  default: {
    content: '我听到了，减脂有时候真的会让人很累。今天先别急着把所有事都做好，先完成一个很小的动作：喝点水，吃一份蛋白质，或者出门走 5 分钟。你不是失败，我们先把这一刻稳住。',
  },
};

export default function ChatPage() {
  const { messages, isTyping, loadMessages, addMessage, setTyping } = useChatStore();
  const { user, loadUser } = useUserStore();
  const { plans, loadPlans } = usePlanStore();
  const { entries: weightEntries, loadEntries } = useWeightStore();
  const { latestReport, isLoading: isReportLoading, error: reportError, loadReports, ensureLatestReport, generateReport } = useDailyReportStore();
  const [input, setInput] = useState('');
  const [openPanel, setOpenPanel] = useState<'coach' | 'report' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    loadUser();
    loadPlans();
    loadEntries();
    loadReports();
  }, [loadMessages, loadUser, loadPlans, loadEntries, loadReports]);

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
            todayPlan,
            recentWeights: weightEntries.slice(-5),
            completed: todayPlan?.completed,
          },
        }),
      });
      const data = await response.json();

      if (!response.ok) throw data;

      setTyping(false);
      addMessage(data.message as ChatMessage);
    } catch (error) {
      const fallback = error && typeof error === 'object' && 'fallback' in error
        ? (error as { fallback: ChatMessage }).fallback
        : null;
      const respondedAt = new Date();
      const resp = mockAIResponses[text.trim()] || mockAIResponses.default;
      const aiMsg: ChatMessage = fallback || {
        id: `msg-${respondedAt.getTime()}`,
        role: 'ai',
        content: resp.content,
        timestamp: respondedAt.toISOString(),
        cards: resp.cards,
      };

      setTyping(false);
      showAppToast('AI 服务暂时不可用，已使用本地降级建议。', 'error');
      addMessage(aiMsg);
    }
  };

  const handleGenerateReport = async () => {
    const report = await generateReport(undefined, Boolean(latestReport));
    const latestError = useDailyReportStore.getState().error;
    showAppToast(report ? '日报已更新。' : latestError || '日报暂时生成失败，稍后再试。', report ? 'success' : 'error');
  };

  return (
    <div className="flex flex-col h-dvh pt-[88px] pb-[83px] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent-blue/10 blur-3xl" />
        <div className="absolute top-40 -left-28 w-72 h-72 rounded-full bg-carb-low/10 blur-3xl" />
      </div>

      <TopFloatingPanels
        openPanel={openPanel}
        onToggle={(panel) => setOpenPanel(current => current === panel ? null : panel)}
        onClose={() => setOpenPanel(null)}
        report={latestReport}
        isReportLoading={isReportLoading}
        reportError={reportError}
        onGenerateReport={handleGenerateReport}
      />

      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5 items-start">
              <Avatar />
              <div className="rounded-[6px_18px_18px_18px] bg-white/[0.055] border border-white/10 px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
                <p className="text-[11px] text-text-tertiary mb-2">Coach Zero 正在认真听你说</p>
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
            className="rounded-full px-3.5 py-2 text-[12px] text-text-secondary whitespace-nowrap cursor-pointer border border-white/10 bg-white/[0.045] hover:bg-white/[0.08] transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="relative z-10 px-5 pb-2 flex gap-2.5 items-center">
        <div className="flex-1 rounded-full px-4 py-3 flex items-center bg-white/[0.06] border border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
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
          className="w-11 h-11 rounded-full gradient-accent flex items-center justify-center cursor-pointer border-none shadow-[0_4px_16px_rgba(10,132,255,0.3)] flex-shrink-0 active:scale-95 transition-transform disabled:opacity-50"
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
}: {
  openPanel: 'coach' | 'report' | null;
  onToggle: (panel: 'coach' | 'report') => void;
  onClose: () => void;
  report: DailyReport | null;
  isReportLoading: boolean;
  reportError: string;
  onGenerateReport: () => void;
}) {
  return (
    <div className="absolute top-5 left-0 right-0 z-30 px-5 pointer-events-none">
      <div className="flex justify-center gap-3">
        <motion.button
          type="button"
          onClick={() => onToggle('coach')}
          whileTap={{ scale: 0.94 }}
          className={`pointer-events-auto relative w-14 h-14 rounded-full border backdrop-blur-2xl flex items-center justify-center transition-colors ${
            openPanel === 'coach'
              ? 'border-accent-blue/60 bg-accent-blue/10 shadow-[0_12px_40px_rgba(0,0,0,0.38),0_0_28px_rgba(10,132,255,0.30)]'
              : 'border-white/15 bg-bg-secondary/85 shadow-[0_12px_40px_rgba(0,0,0,0.38),0_0_24px_rgba(10,132,255,0.18)]'
          }`}
          aria-label={openPanel === 'coach' ? '收起 Coach Zero' : '展开 Coach Zero'}
        >
          <Avatar />
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-carb-low border-2 border-bg-primary" />
          <motion.span
            animate={{ rotate: openPanel === 'coach' ? 180 : 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-blue text-white flex items-center justify-center border border-white/20"
          >
            <ChevronUp size={12} />
          </motion.span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => onToggle('report')}
          whileTap={{ scale: 0.94 }}
          className={`pointer-events-auto relative w-14 h-14 rounded-full border backdrop-blur-2xl flex items-center justify-center transition-colors ${
            openPanel === 'report'
              ? 'border-accent-blue/60 bg-accent-blue/10 shadow-[0_12px_40px_rgba(0,0,0,0.38),0_0_28px_rgba(10,132,255,0.30)]'
              : 'border-white/15 bg-bg-secondary/85 shadow-[0_12px_40px_rgba(0,0,0,0.38),0_0_24px_rgba(10,132,255,0.18)]'
          }`}
          aria-label={openPanel === 'report' ? '收起 AI 减脂日报' : '展开 AI 减脂日报'}
        >
          <CalendarCheck size={20} className="text-accent-blue" />
          <span className="absolute -bottom-1 -right-1 min-w-6 h-6 rounded-full bg-bg-primary border border-accent-blue/50 px-1 flex items-center justify-center text-[10px] font-semibold text-white">
            {isReportLoading && !report ? '--' : report?.score ?? 'AI'}
          </span>
          <motion.span
            animate={{ rotate: openPanel === 'report' ? 180 : 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-blue text-white flex items-center justify-center border border-white/20"
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
              className="pointer-events-auto relative mt-1 max-h-[72dvh] overflow-y-auto rounded-[24px] border border-white/12 bg-bg-secondary/90 p-3.5 shadow-[0_24px_70px_rgba(0,0,0,0.55),0_0_32px_rgba(10,132,255,0.12)] backdrop-blur-2xl"
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="absolute right-6 top-6 z-10 w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-text-secondary active:scale-95 transition-transform"
              >
                <X size={15} />
              </button>
              {openPanel === 'coach' ? (
                <CoachHeader />
              ) : (
                <DailyReportPanel
                  report={report}
                  isLoading={isReportLoading}
                  error={reportError}
                  onGenerate={onGenerateReport}
                />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function CoachHeader() {
  return (
    <div className="glass-card-highlight p-4 flex items-center gap-3 pr-11">
      <Avatar size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[17px] font-semibold">Coach Zero</p>
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
}: {
  report: DailyReport | null;
  isLoading: boolean;
  error: string;
  onGenerate: () => void;
}) {
  const dateLabel = report ? formatReportDate(report.date) : '收盘复盘';
  const score = report?.score ?? 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
            <CalendarCheck size={15} className="text-accent-blue" />
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
            className="h-8 px-2.5 rounded-full border border-white/10 bg-white/[0.045] text-[11px] text-text-secondary flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition-transform"
          >
            <RotateCw size={12} className={isLoading ? 'animate-spin' : ''} />
            {report ? '重新生成' : '生成'}
          </button>
          <ScoreRing score={score} isLoading={isLoading && !report} />
        </div>
      </div>

      {isLoading && !report ? (
        <p className="text-[13px] text-text-secondary leading-relaxed">Coach Zero 正在整理你的日报...</p>
      ) : error && !report ? (
        <p className="text-[13px] text-text-secondary leading-relaxed">{error}</p>
      ) : report ? (
        <>
          <p className="text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap break-words">{report.summary}</p>
          <div className="grid gap-2 mt-3">
            {report.suggestions.map((suggestion, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
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
  const background = `conic-gradient(#0A84FF ${clamped * 3.6}deg, rgba(255,255,255,0.10) 0deg)`;

  return (
    <div className="w-14 h-14 rounded-full p-[3px] shrink-0" style={{ background }}>
      <div className="w-full h-full rounded-full bg-bg-primary/95 flex flex-col items-center justify-center">
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? 'justify-end' : 'gap-2.5 items-start'}`}
    >
      {!isUser && <Avatar />}
      <div
        className={`max-w-[82%] px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.24)] ${
          isUser
            ? 'bg-gradient-to-br from-accent-blue to-accent-purple rounded-[18px_6px_18px_18px] text-white'
            : 'bg-white/[0.055] border border-white/10 rounded-[6px_18px_18px_18px]'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={12} className="text-accent-blue" />
            <span className="text-[11px] text-text-tertiary">Coach Zero</span>
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

function Avatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const dimensions = size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-8 h-8 rounded-xl';
  const imageSize = size === 'lg' ? 56 : 32;

  return (
    <div className={`${dimensions} relative overflow-hidden flex-shrink-0 bg-white/10 border border-white/15 shadow-[0_0_24px_rgba(10,132,255,0.18)]`}>
      <Image
        src="/images/coach-zero-avatar.png"
        alt="Coach Zero"
        width={imageSize}
        height={imageSize}
        className="w-full h-full object-cover"
        priority={size === 'lg'}
      />
      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-carb-low border-2 border-bg-primary" />
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
