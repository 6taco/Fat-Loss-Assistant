'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { showAppToast } from '@/components/ui/ToastHost';
import { useChatStore } from '@/stores/useChatStore';
import { usePlanStore } from '@/stores/usePlanStore';
import { useUserStore } from '@/stores/useUserStore';
import { useWeightStore } from '@/stores/useWeightStore';
import { ChatCard, ChatMessage, getTodayPlan } from '@/lib/mock-data';

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
    content: '我先给你一个稳妥建议：保持今天的目标不变，优先完成蛋白质、饮水和训练/步数。更具体的方案可以结合你的今日计划继续调整。',
  },
};

export default function ChatPage() {
  const { messages, isTyping, loadMessages, addMessage, setTyping } = useChatStore();
  const { user, loadUser } = useUserStore();
  const { plans, loadPlans } = usePlanStore();
  const { entries: weightEntries, loadEntries } = useWeightStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    loadUser();
    loadPlans();
    loadEntries();
  }, [loadMessages, loadUser, loadPlans, loadEntries]);

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

  return (
    <div className="flex flex-col h-dvh pt-14 pb-[83px]">
      <div className="px-5 pb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center relative">
          <span className="text-[13px] font-semibold">Z</span>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-carb-low border-2 border-bg-primary" />
        </div>
        <div>
          <p className="text-[16px] font-semibold">Coach Zero</p>
          <p className="text-[11px] text-carb-low">在线 · 减脂教练</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
              <Avatar />
              <div className="glass-card rounded-[4px_16px_16px_16px] px-5 py-3 border-l-2 border-l-accent-blue">
                <div className="flex gap-1 items-center">
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-accent-blue"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="px-5 py-2 flex gap-2 overflow-x-auto">
        {quickTags.map(tag => (
          <button
            key={tag}
            onClick={() => sendMessage(tag)}
            className="glass-card rounded-full px-3.5 py-2 text-[12px] text-text-secondary whitespace-nowrap cursor-pointer border-none bg-transparent hover:bg-glass-hover transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="px-5 pb-2 flex gap-2.5 items-center">
        <div className="flex-1 glass-card rounded-full px-4 py-3 flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="输入你的问题..."
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

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${message.role === 'user' ? 'justify-end' : 'gap-2'}`}
    >
      {message.role === 'ai' && <Avatar />}
      <div
        className={`max-w-[80%] px-4 py-3 ${
          message.role === 'user'
            ? 'gradient-accent rounded-[16px_4px_16px_16px]'
            : 'glass-card rounded-[4px_16px_16px_16px] border-l-2 border-l-accent-blue'
        }`}
      >
        <p className={`text-[14px] leading-relaxed ${message.role === 'ai' ? 'text-text-primary' : 'text-white'}`}>
          {message.content}
        </p>
        {message.cards?.map((card, index) => (
          <ChatCardComponent key={index} card={card} />
        ))}
        <span className={`text-[10px] block mt-2 ${message.role === 'user' ? 'text-white/50 text-right' : 'text-text-tertiary'}`}>
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

function Avatar() {
  return (
    <div className="w-7 h-7 rounded-lg gradient-accent flex items-center justify-center flex-shrink-0 mt-1">
      <span className="text-[10px] font-semibold">Z</span>
    </div>
  );
}

function ChatCardComponent({ card }: { card: ChatCard }) {
  const borderColor = card.type === 'food' ? 'rgba(48,209,88,0.2)' : card.type === 'calorie' ? 'rgba(10,132,255,0.2)' : 'rgba(94,92,230,0.2)';

  return (
    <div className="mt-2.5 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}` }}>
      <p className="text-[11px] text-text-tertiary font-medium mb-2">{card.title}</p>
      <div className="flex flex-col gap-2">
        {card.items.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <span className="text-[13px]">{item.label}</span>
            <span className="text-[11px] text-text-tertiary text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
