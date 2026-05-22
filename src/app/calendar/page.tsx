'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import ProgressBar from '@/components/ui/ProgressBar';
import Button from '@/components/ui/Button';
import { usePlanStore } from '@/stores/usePlanStore';
import { carbColors, DayPlan } from '@/lib/mock-data';

export default function CalendarPage() {
  const { plans, loadPlans, toggleComplete } = usePlanStore();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0

  const planMap = new Map<string, DayPlan>();
  plans.forEach(p => planMap.set(p.date, p));

  const selectedPlan = selectedDate ? planMap.get(selectedDate) : null;
  const cc = selectedPlan ? carbColors[selectedPlan.carbType] : null;

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const foods: Record<string, string[]> = {
    high: ['🍚 糙米饭', '🍠 红薯', '🍌 香蕉', '🥣 燕麦'],
    mid: ['🍝 全麦面', '🌽 玉米', '🍞 杂粮面包'],
    low: ['🥦 西兰花', '🥑 牛油果', '🥒 黄瓜', '🥗 沙拉'],
  };

  return (
    <div className="px-5 pt-14 pb-28 min-h-dvh">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-semibold">
          {year}年{month + 1}月
        </h1>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="w-8 h-8 glass-card rounded-full flex items-center justify-center">
            <ChevronLeft size={14} className="text-text-secondary" />
          </button>
          <button onClick={nextMonth} className="w-8 h-8 glass-card rounded-full flex items-center justify-center">
            <ChevronRight size={14} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4">
        {(['high', 'mid', 'low'] as const).map(t => (
          <div key={t} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: carbColors[t].main }} />
            <span className="text-[11px] text-text-tertiary">{carbColors[t].label.slice(0, 2)}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <GlassCard padding="p-4" className="mb-5">
        {/* Week headers */}
        <div className="grid grid-cols-7 text-center mb-3">
          {['一', '二', '三', '四', '五', '六', '日'].map(d => (
            <span key={d} className="text-[11px] text-text-tertiary font-medium">{d}</span>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {/* Empty offset */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="py-2" />
          ))}
          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const plan = planMap.get(dateStr);
            const isSelected = dateStr === selectedDate;
            const todayStr = new Date().toISOString().slice(0, 10);
            const isToday = dateStr === todayStr;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className="flex flex-col items-center gap-1 py-2 bg-transparent border-none cursor-pointer"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-medium transition-all ${
                  isSelected
                    ? 'gradient-accent text-white shadow-[0_0_12px_rgba(10,132,255,0.4)]'
                    : isToday
                      ? 'ring-1 ring-accent-blue text-accent-blue'
                      : plan
                        ? 'text-text-primary'
                        : 'text-text-tertiary'
                }`}>
                  {plan?.completed ? <Check size={12} /> : day}
                </div>
                {plan && (
                  <div
                    className="w-[5px] h-[5px] rounded-full transition-opacity"
                    style={{
                      background: carbColors[plan.carbType].main,
                      opacity: plan ? 1 : 0.3,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Selected day detail */}
      <AnimatePresence mode="wait">
        {selectedPlan && cc && (
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <GlassCard variant="highlight">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[16px] font-semibold">{selectedDate?.replace(/-/g, '/')}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: cc.main }} />
                    <span className="text-[12px] font-medium" style={{ color: cc.main }}>{cc.label}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[22px] font-bold">{selectedPlan.calories.toLocaleString()}</p>
                  <p className="text-[11px] text-text-tertiary">kcal 目标</p>
                </div>
              </div>

              {/* Macro bars */}
              <div className="flex flex-col gap-3 mb-5">
                {[
                  { label: '碳水', current: Math.round(selectedPlan.carb * 0.72), target: selectedPlan.carb, color: cc.main },
                  { label: '蛋白质', current: Math.round(selectedPlan.protein * 0.75), target: selectedPlan.protein, color: '#0A84FF' },
                  { label: '脂肪', current: Math.round(selectedPlan.fat * 0.67), target: selectedPlan.fat, color: '#FFD60A' },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[12px] text-text-secondary">{m.label}</span>
                      <span className="text-[12px] font-medium">{m.current} / {m.target}g</span>
                    </div>
                    <ProgressBar value={(m.current / m.target) * 100} color={m.color} />
                  </div>
                ))}
              </div>

              {/* Recommended foods */}
              <p className="text-[12px] text-text-secondary font-medium mb-2">推荐食物</p>
              <div className="flex gap-2 flex-wrap mb-5">
                {(foods[selectedPlan.carbType] || []).map(f => (
                  <span key={f} className="glass-card rounded-full px-3 py-1.5 text-[12px]">{f}</span>
                ))}
              </div>

              {/* Complete button */}
              <Button
                fullWidth
                variant={selectedPlan.completed ? 'secondary' : 'primary'}
                onClick={() => toggleComplete(selectedPlan.date)}
              >
                {selectedPlan.completed ? '✓ 今日已完成' : '完成打卡'}
              </Button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
