'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import { usePlanStore } from '@/stores/usePlanStore';
import { carbColors } from '@/lib/mock-data';

const dayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function PlanPage() {
  const { plans, loadPlans } = usePlanStore();

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const weekPlans = plans.slice(0, 7);
  const highDays = weekPlans.filter(plan => plan.carbType === 'high').length;
  const midDays = weekPlans.filter(plan => plan.carbType === 'mid').length;
  const lowDays = weekPlans.filter(plan => plan.carbType === 'low').length;

  return (
    <div className="px-5 pt-14 pb-28 min-h-dvh">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold">碳循环方案</h1>
          <p className="text-[13px] text-text-tertiary mt-1">232 模式 · 28 天周期</p>
        </div>
        <div className="glass-card rounded-full px-3 py-1.5 text-[11px] text-text-secondary">第 1 周</div>
      </div>

      <GlassCard variant="highlight" className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] text-text-secondary font-medium">本周碳循环节奏</p>
          <p className="text-[11px] text-text-tertiary">{highDays} 高 / {midDays} 中 / {lowDays} 低</p>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weekPlans.map((plan, index) => {
            const color = carbColors[plan.carbType];
            return (
              <motion.div
                key={plan.date}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.05, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 text-[11px] font-semibold"
                  style={{ background: color.bg, border: `2px solid ${color.main}`, color: color.main }}
                >
                  {color.emoji}
                </div>
                <span className="text-[10px] text-text-tertiary">{dayLabels[index]}</span>
              </motion.div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="mb-5" padding="p-4">
        <p className="text-[12px] text-text-secondary leading-relaxed">
          分配规则：高碳日合计占每周碳水 50%、脂肪 15%；中碳日占碳水 35%、脂肪 35%；低碳日占碳水 15%、脂肪 50%。蛋白质每天保持一致。
        </p>
      </GlassCard>

      <p className="text-[13px] text-text-secondary font-medium mb-3">每日详情</p>
      <div className="flex flex-col gap-2.5">
        {weekPlans.map((plan, index) => {
          const color = carbColors[plan.carbType];
          return (
            <GlassCard key={plan.date} padding="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color.main, boxShadow: `0 0 8px ${color.main}` }} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{dayLabels[index]} · {color.label}</p>
                    <p className="text-[12px] text-text-tertiary mt-0.5">
                      {plan.trainingLabel || (plan.carbType === 'low' ? '休息' : '训练')}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[14px] font-semibold" style={{ color: color.main }}>
                    {plan.calories.toLocaleString()}
                  </span>
                  <p className="text-[10px] text-text-tertiary">kcal</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-border-glass">
                <div>
                  <p className="text-[10px] text-text-tertiary mb-0.5">碳水</p>
                  <p className="text-[13px] font-semibold" style={{ color: color.main }}>{plan.carb}g</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-tertiary mb-0.5">蛋白质</p>
                  <p className="text-[13px] font-semibold">{plan.protein}g</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-tertiary mb-0.5">脂肪</p>
                  <p className="text-[13px] font-semibold">{plan.fat}g</p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
