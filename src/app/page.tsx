'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getActiveAccount } from '@/lib/accounts';
import { UserProfile } from '@/lib/mock-data';
import { getItem, KEYS } from '@/lib/storage';

export default function LandingPage() {
  const router = useRouter();

  const start = () => {
    const account = getActiveAccount();
    if (!account) {
      router.push('/accounts');
      return;
    }

    const user = getItem<UserProfile | null>(`fla:${account.id}:${KEYS.USER}`, null);
    router.push(user ? '/dashboard' : '/onboarding');
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-dvh px-8 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(10,132,255,0.08), transparent 70%)', top: '15%', left: '-20%' }}
          animate={{ y: [-20, 20, -20], x: [0, 15, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[200px] h-[200px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(94,92,230,0.06), transparent 70%)', bottom: '25%', right: '-15%' }}
          animate={{ y: [15, -15, 15], x: [0, -10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[150px] h-[150px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(48,209,88,0.05), transparent 70%)', top: '55%', left: '60%' }}
          animate={{ y: [10, -20, 10] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-accent-blue/30"
            style={{ left: `${15 + i * 15}%`, top: '80%' }}
            animate={{ y: [0, -400], opacity: [0, 0.6, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.8, ease: 'linear' }}
          />
        ))}
      </div>

      <motion.div
        className="relative z-10 flex flex-col items-center text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="w-[88px] h-[88px] rounded-[22px] gradient-accent flex items-center justify-center mb-8 animate-pulse-glow"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <Zap size={44} strokeWidth={1.8} className="text-white" />
        </motion.div>

        <motion.h1
          className="text-[28px] font-bold tracking-[-0.3px] mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          减脂助手
        </motion.h1>
        <motion.p
          className="text-[16px] text-text-secondary mb-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          AI 碳循环计划与体重追踪
        </motion.p>
        <motion.p
          className="text-[15px] text-text-tertiary mb-14"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          让减脂更有计划，不再靠硬撑
        </motion.p>

        <motion.div
          className="flex gap-6 mb-14"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {[
            { icon: 'AI', label: '策略生成', bg: 'rgba(255,69,58,0.12)', border: 'rgba(255,69,58,0.2)' },
            { icon: 'C', label: '碳循环', bg: 'rgba(10,132,255,0.12)', border: 'rgba(10,132,255,0.2)' },
            { icon: 'Z', label: 'Coach Zero', bg: 'rgba(48,209,88,0.12)', border: 'rgba(48,209,88,0.2)' },
          ].map((f) => (
            <div key={f.label} className="text-center">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2 text-[13px] font-semibold"
                style={{ background: f.bg, border: `1px solid ${f.border}` }}
              >
                {f.icon}
              </div>
              <span className="text-[11px] text-text-tertiary">{f.label}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button fullWidth onClick={start}>
            开始我的计划
          </Button>
          <p className="text-[13px] text-text-tertiary mt-4">
            已有本地数据？
            <button
              className="text-accent-blue bg-transparent border-none cursor-pointer ml-1"
              onClick={start}
            >
              直接进入
            </button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
