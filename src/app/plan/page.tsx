'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Dumbbell, Flame, Gauge, ShoppingBasket, Sparkles, Utensils } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { showAppToast } from '@/components/ui/ToastHost';
import { carbColors, getPlanWeek } from '@/lib/domain';
import { getScopedKey } from '@/lib/accounts';
import { getItem, setItem, KEYS } from '@/lib/storage';
import { usePlanStore } from '@/stores/usePlanStore';
import { useStrategyStore } from '@/stores/useStrategyStore';

interface GeneratedMeal {
  mealType: string;
  label: string;
  calories: number;
  carb: number;
  protein: number;
  fat: number;
  foods: string[];
}

interface MealPlanResult {
  id: string;
  date: string;
  meals: GeneratedMeal[];
}

interface TrainingDayResult {
  date: string;
  muscleGroup: string;
  label: string;
  intensity: string;
  blocks: string[];
}

interface TrainingPlanResult {
  id: string;
  startDate: string;
  endDate: string;
  days: TrainingDayResult[];
}

interface ShoppingItemResult {
  name: string;
  category: string;
  count: number;
  amountText: string;
}

interface ShoppingListResult {
  id: string;
  startDate: string;
  endDate: string;
  items: ShoppingItemResult[];
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function PlanPage() {
  const { plans, loadPlans } = usePlanStore();
  const { currentStrategy, recommendation, executionRate, loadCurrent, activate } = useStrategyStore();
  const [mealPlans, setMealPlans] = useState<MealPlanResult[]>([]);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlanResult | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingListResult | null>(null);
  const [generating, setGenerating] = useState<'meals' | 'training' | 'shopping' | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadPlans();
    loadCurrent();
    // Deferred like AuthProvider's refresh: synchronous setState in an
    // effect cascades renders.
    const timer = window.setTimeout(() => {
      setMealPlans(getItem<MealPlanResult[]>(getScopedKey(KEYS.MEAL_PLAN_TOOL), []));
      setTrainingPlan(getItem<TrainingPlanResult | null>(getScopedKey(KEYS.TRAINING_PLAN_TOOL), null));
      setShoppingList(getItem<ShoppingListResult | null>(getScopedKey(KEYS.SHOPPING_LIST_TOOL), null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPlans, loadCurrent]);

  const strategyType = currentStrategy?.strategyType || recommendation?.strategyType || plans[0]?.strategyType || 'carb_cycling';
  const todayStr = todayIso();
  const upcomingPlan = plans.find(plan => plan.date >= todayStr);
  const todayCovered = plans.some(plan => plan.date === todayStr);
  // The generation APIs need day plans covering the start date; with stale or
  // gappy plan data, anchor on the nearest upcoming plan instead of today.
  const toolStartDate = upcomingPlan?.date || todayStr;

  const regeneratePlans = async () => {
    setRegenerating(true);
    try {
      const result = await activate(strategyType);
      if (!result) throw new Error('策略激活失败');
      // Bypass the plan store's fetch dedupe so the fresh plans show up.
      usePlanStore.setState({ lastFetchedAt: 0 });
      await loadPlans();
      showAppToast('已从今天重新生成每日计划。', 'success');
    } catch {
      showAppToast('重新生成失败，请稍后再试。', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const generate = async (kind: 'meals' | 'training' | 'shopping') => {
    setGenerating(kind);
    try {
      const endpoint = kind === 'meals' ? '/api/meal-plans/generate' : kind === 'training' ? '/api/training-plans/generate' : '/api/shopping-lists/generate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: toolStartDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '生成失败');

      if (kind === 'meals' && Array.isArray(data.mealPlans)) {
        setMealPlans(data.mealPlans);
        setItem(getScopedKey(KEYS.MEAL_PLAN_TOOL), data.mealPlans);
        showAppToast('餐单已生成。', 'success');
      } else if (kind === 'training' && data.trainingPlan) {
        setTrainingPlan(data.trainingPlan);
        setItem(getScopedKey(KEYS.TRAINING_PLAN_TOOL), data.trainingPlan);
        showAppToast('训练安排已生成。', 'success');
      } else if (kind === 'shopping' && data.shoppingList) {
        setShoppingList(data.shoppingList);
        setItem(getScopedKey(KEYS.SHOPPING_LIST_TOOL), data.shoppingList);
        showAppToast('采购清单已生成。', 'success');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      const hint = message.includes('没有可用于生成')
        ? '所选日期范围内没有每日计划，可先点「从今天重新生成计划」后再试。'
        : message;
      showAppToast(hint, 'error');
    } finally {
      setGenerating(null);
    }
  };
  const { plans: weekPlans, weekNumber, startIndex } = getPlanWeek(plans);
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
                  <span className="text-[10px] text-text-tertiary">D{startIndex + index + 1}</span>
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

      <p className="text-[13px] text-text-secondary font-medium mb-3">第 {weekNumber} 周 · 每日目标</p>
      <div className="flex flex-col gap-2.5 mb-8">
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
                    <p className="text-[15px] font-semibold">第 {weekNumber} 周 · 第 {index + 1} 天 · {dayLabel(strategyType, plan.carbType)}</p>
                    <p className="text-[12px] text-text-tertiary mt-0.5">{plan.trainingLabel || '今日计划'} · {plan.date}</p>
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

      {!todayCovered && (
        <GlassCard className="mb-4" padding="p-4">
          <p className="text-[13px] font-semibold mb-1">每日计划未覆盖今天</p>
          <p className="text-[12px] text-text-secondary leading-relaxed mb-3">
            {upcomingPlan
              ? `最近的未来计划是 ${upcomingPlan.date}，中间存在日期缺口，上方每日目标因此不连续。AI 计划工具将从 ${upcomingPlan.date} 开始生成。`
              : '现有计划都已过期，AI 计划工具暂时无法生成餐单、训练安排或采购清单。'}
          </p>
          <button
            onClick={() => void regeneratePlans()}
            disabled={regenerating}
            className="w-full py-2.5 rounded-xl gradient-accent text-white text-[13px] font-medium cursor-pointer border-none disabled:opacity-60"
          >
            {regenerating ? '正在重新生成…' : '从今天重新生成计划'}
          </button>
        </GlassCard>
      )}

      <p className="text-[13px] text-text-secondary font-medium mb-3">AI 计划工具</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <ToolButton
          icon={Utensils}
          label="生成餐单"
          hint="未来 3 天"
          loading={generating === 'meals'}
          onClick={() => void generate('meals')}
        />
        <ToolButton
          icon={Dumbbell}
          label="训练安排"
          hint="未来 7 天"
          loading={generating === 'training'}
          onClick={() => void generate('training')}
        />
        <ToolButton
          icon={ShoppingBasket}
          label="采购清单"
          hint="未来 3 天"
          loading={generating === 'shopping'}
          onClick={() => void generate('shopping')}
        />
      </div>

      {mealPlans.length > 0 && (
        <GlassCard className="mb-4" padding="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold">餐单 · {mealPlans[0]?.date} 起 {mealPlans.length} 天</p>
            <span className="text-[10px] text-text-tertiary">AI 规则生成 · 可重新生成</span>
          </div>
          <div className="flex flex-col gap-3">
            {mealPlans.map(plan => (
              <div key={plan.id} className="rounded-xl bg-white/[0.045] border border-white/10 p-3">
                <p className="text-[12px] font-semibold mb-2">{plan.date}</p>
                <div className="flex flex-col gap-1.5">
                  {plan.meals?.map(meal => (
                    <div key={meal.mealType} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium">{meal.label}</p>
                        <p className="text-[11px] text-text-tertiary leading-snug">{meal.foods?.join(' · ')}</p>
                      </div>
                      <span className="text-[11px] text-text-secondary shrink-0">{meal.calories} kcal</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {trainingPlan && (
        <GlassCard className="mb-4" padding="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold">训练安排 · {trainingPlan.startDate} ~ {trainingPlan.endDate}</p>
            <span className="text-[10px] text-text-tertiary">AI 规则生成 · 可重新生成</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {trainingPlan.days?.map(day => (
              <div key={day.date} className="flex items-start gap-3 rounded-xl bg-white/[0.045] border border-white/10 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium">
                    {day.date} · {day.label}
                    <span className="text-text-tertiary font-normal"> · {day.intensity}</span>
                  </p>
                  <p className="text-[11px] text-text-tertiary leading-snug mt-0.5">{day.blocks?.join(' → ')}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {shoppingList && (
        <GlassCard className="mb-4" padding="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold">采购清单 · {shoppingList.startDate} ~ {shoppingList.endDate}</p>
            <span className="text-[10px] text-text-tertiary">按餐单汇总</span>
          </div>
          {(['蛋白质', '碳水', '脂肪'] as const).map(category => {
            const items = shoppingList.items?.filter(item => item.category === category) || [];
            if (!items.length) return null;
            return (
              <div key={category} className="mb-3 last:mb-0">
                <p className="text-[11px] text-text-tertiary font-medium mb-1.5">{category}</p>
                <div className="flex gap-2 flex-wrap">
                  {items.map(item => (
                    <span key={item.name} className="glass-card rounded-full px-3 py-1.5 text-[12px]">
                      {item.name}<span className="text-text-tertiary"> · {item.amountText}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </GlassCard>
      )}
    </div>
  );
}

function ToolButton({ icon: Icon, label, hint, loading, onClick }: {
  icon: typeof Flame;
  label: string;
  hint: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="rounded-xl border border-border-glass bg-white/[0.045] px-3 py-3.5 flex flex-col items-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-[0.98] transition-transform overflow-hidden"
    >
      <Icon size={18} className={loading ? 'animate-pulse text-accent-blue' : 'text-accent-blue'} />
      <span className="text-[12px] font-medium whitespace-nowrap">{loading ? '生成中…' : label}</span>
      <span className="text-[10px] text-text-tertiary whitespace-nowrap">{hint}</span>
    </button>
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
