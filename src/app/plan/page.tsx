'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Flame, Gauge, Sparkles } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { carbColors } from '@/lib/mock-data';
import { usePlanStore } from '@/stores/usePlanStore';
import { useStrategyStore } from '@/stores/useStrategyStore';

export default function PlanPage() {
  const { plans, loadPlans } = usePlanStore();
  const { currentStrategy, recommendation, executionRate, loadCurrent } = useStrategyStore();

  useEffect(() => {
    loadPlans();
    loadCurrent();
  }, [loadPlans, loadCurrent]);

  const strategyType = currentStrategy?.strategyType || recommendation?.strategyType || plans[0]?.strategyType || 'carb_cycling';
  const weekPlans = plans.slice(0, 7);
  const highDays = weekPlans.filter(plan => plan.carbType === 'high').length;
  const midDays = weekPlans.filter(plan => plan.carbType === 'mid').length;
  const lowDays = weekPlans.filter(plan => plan.carbType === 'low').length;

  return (
    <div className="px-5 pt-14 pb-28 min-h-dvh">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold">策略计划</h1>
          <p className="text-[13px] text-text-tertiary mt-1">{strategyLabel(strategyType)} · AI 动态推荐</p>
        </div>
        <div className="glass-card rounded-full px-3 py-1.5 text-[11px] text-text-secondary">{executionRate}% 执行</div>
      </div>

      <GlassCard variant="highlight" className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-accent-blue" />
          <p className="text-[14px] font-semibold">{strategyLabel(strategyType)}</p>
        </div>
        <p className="text-[12px] text-text-secondary leading-relaxed mb-4">
          {currentStrategy?.recommendationReasons?.[0] || recommendation?.reasons?.[0] || '系统会根据你的画像、行为记录和体重趋势，自动推荐并调整减脂策略。'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Metric icon={Flame} label="目标热量" value={`${currentStrategy?.targetCalories || weekPlans[0]?.calories || '--'} kcal`} />
          <Metric icon={Gauge} label="蛋白目标" value={`${currentStrategy?.proteinGrams || weekPlans[0]?.protein || '--'} g`} />
          <Metric icon={Clock} label="预计速度" value={`${(currentStrategy?.expectedLossKgPerWeek || recommendation?.expectedWeightLossKgPerWeek || 0).toFixed(1)} kg/周`} />
        </div>
      </GlassCard>

      {strategyType === 'carb_cycling' ? (
        <GlassCard variant="highlight" className="mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] text-text-secondary font-medium">本周碳循环节奏</p>
            <p className="text-[11px] text-text-tertiary">{highDays} 高 / {midDays} 中 / {lowDays} 低</p>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {weekPlans.map((plan, index) => {
              const color = carbColors[plan.carbType];
              return (
                <motion.div key={plan.date} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 text-[11px] font-semibold" style={{ background: color.bg, border: `2px solid ${color.main}`, color: color.main }}>
                    {color.emoji}
                  </div>
                  <span className="text-[10px] text-text-tertiary">D{index + 1}</span>
                </motion.div>
              );
            })}
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="mb-5" padding="p-4">
          <p className="text-[13px] text-text-secondary leading-relaxed">
            {strategyType === 'if_16_8'
              ? `进食窗口：${currentStrategy?.fastingWindow?.start || '12:00'}-${currentStrategy?.fastingWindow?.end || '20:00'}。今天优先完成窗口、蛋白和总热量底线。`
              : '今天优先完成热量目标和蛋白目标。训练不是前提，稳定记录和持续缺口才是核心。'}
          </p>
        </GlassCard>
      )}

      <p className="text-[13px] text-text-secondary font-medium mb-3">每日目标</p>
      <div className="flex flex-col gap-2.5">
        {weekPlans.map((plan, index) => {
          const color = carbColors[plan.carbType];
          const isCarbCycle = strategyType === 'carb_cycling';
          const accentColor = isCarbCycle ? color.main : '#0A84FF';
          return (
            <GlassCard key={plan.date} padding="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: accentColor, boxShadow: isCarbCycle ? `0 0 8px ${color.main}` : 'none' }} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">第 {index + 1} 天 · {dayLabel(strategyType, plan.carbType)}</p>
                    <p className="text-[12px] text-text-tertiary mt-0.5">{plan.trainingLabel || plan.date}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[14px] font-semibold" style={{ color: accentColor }}>{plan.calories.toLocaleString()}</span>
                  <p className="text-[10px] text-text-tertiary">kcal</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-border-glass">
                <Macro label="碳水" value={`${plan.carb}g`} color={isCarbCycle ? color.main : undefined} />
                <Macro label="蛋白" value={`${plan.protein}g`} />
                <Macro label="脂肪" value={`${plan.fat}g`} />
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.045] border border-white/10 px-3 py-3">
      <Icon size={14} className="text-accent-blue mb-2" />
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      <p className="text-[13px] font-semibold">{value}</p>
    </div>
  );
}

function Macro({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-text-tertiary mb-0.5">{label}</p>
      <p className="text-[13px] font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}

function strategyLabel(strategyType?: string) {
  if (strategyType === 'calorie_deficit') return '热量缺口';
  if (strategyType === 'if_16_8') return '16+8 轻断食';
  return '碳循环';
}

function dayLabel(strategyType: string | undefined, carbType: string) {
  if (strategyType === 'if_16_8') return '进食窗口';
  if (strategyType === 'calorie_deficit') return '热量目标';
  if (carbType === 'high') return '高碳日';
  if (carbType === 'mid') return '中碳日';
  return '低碳日';
}
