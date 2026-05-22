'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, TrendingDown } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import RingChart from '@/components/ui/RingChart';
import { useMealStore } from '@/stores/useMealStore';
import { usePlanStore } from '@/stores/usePlanStore';
import { useUserStore } from '@/stores/useUserStore';
import { useWeightStore } from '@/stores/useWeightStore';
import { DayPlan, MealLog, UserProfile, WeightEntry, mockUser, sumMealMacros } from '@/lib/mock-data';

type RangeKey = '7' | '30' | '90' | 'all';
type MacroDay = Pick<DayPlan, 'date' | 'calories' | 'carb' | 'protein' | 'fat'>;

const timeRanges: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '7', label: '7天', days: 7 },
  { key: '30', label: '30天', days: 30 },
  { key: '90', label: '90天', days: 90 },
  { key: 'all', label: '全部', days: null },
];

const chartHeight = 150;
const plotTop = 14;
const plotBottom = 106;

export default function TrendsPage() {
  const [range, setRange] = useState<RangeKey>('7');
  const { user, loadUser } = useUserStore();
  const { entries: weightEntries, loadEntries } = useWeightStore();
  const { plans, loadPlans } = usePlanStore();
  const { meals, loadMeals } = useMealStore();
  const u = user || mockUser;

  useEffect(() => {
    loadUser();
    loadEntries();
    loadPlans();
    loadMeals();
  }, [loadUser, loadEntries, loadPlans, loadMeals]);

  const selectedRange = timeRanges.find(item => item.key === range) || timeRanges[0];
  const chartData = useMemo(() => {
    const source = mergeInitialWeight(u, weightEntries);
    return filterWeightsByRange(source, selectedRange.days);
  }, [selectedRange.days, u, weightEntries]);
  const actualMacroDays = useMemo(() => getDailyMealMacros(meals), [meals]);
  const macroData = useMemo(() => {
    if (actualMacroDays.length > 0) {
      return selectedRange.days ? actualMacroDays.slice(-selectedRange.days) : actualMacroDays;
    }
    const limit = selectedRange.days ?? plans.length;
    return plans.slice(0, Math.min(limit, plans.length));
  }, [actualMacroDays, plans, selectedRange.days]);
  const hasActualMacroData = actualMacroDays.length > 0;

  const latestWeight = chartData[chartData.length - 1];
  const firstWeight = chartData[0];
  const totalChange = latestWeight && firstWeight ? (latestWeight.weight - firstWeight.weight).toFixed(1) : '0';
  const trendSummary = getTrendSummary(selectedRange.label, Number(totalChange), chartData.length);
  const chartWidth = Math.max(350, chartData.length * 68);
  const weightValues = chartData.map(entry => entry.weight);
  const minWeight = weightValues.length ? Math.min(...weightValues) : u.weight - 1;
  const maxWeight = weightValues.length ? Math.max(...weightValues) : u.weight + 1;
  const points = chartData.map((entry, index) => ({
    ...entry,
    x: getX(index, chartData.length, chartWidth),
    y: mapWeight(entry.weight, minWeight, maxWeight),
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  const areaPath = points.length ? `${linePath} L${points[points.length - 1].x},${plotBottom} L${points[0].x},${plotBottom} Z` : '';
  const maxMacroTotal = Math.max(1, ...macroData.map(day => day.carb + day.protein + day.fat));
  const averageMacros = getAverageMacros(macroData);
  const completedRate = plans.length ? Math.round((plans.filter(plan => plan.completed).length / plans.length) * 100) : 0;
  const streak = getCurrentStreak(plans);

  return (
    <div className="px-5 pt-14 pb-28 min-h-dvh">
      <h1 className="text-[22px] font-semibold mb-5">数据趋势</h1>

      <div className="flex gap-2 mb-5">
        {timeRanges.map(item => (
          <button
            key={item.key}
            onClick={() => setRange(item.key)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium border-none cursor-pointer transition-all ${
              range === item.key ? 'gradient-accent text-white shadow-[0_2px_10px_rgba(10,132,255,0.3)]' : 'bg-glass text-text-secondary hover:bg-glass-hover'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <GlassCard className="mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingDown size={14} className="text-carb-low" />
            <span className="text-[13px] font-medium">体重变化</span>
          </div>
          <div className="text-right">
            <span className="text-[20px] font-bold">{latestWeight?.weight ?? u.weight}</span>
            <span className="text-[13px] text-text-tertiary ml-1">kg</span>
          </div>
        </div>

        <div className="rounded-xl px-3 py-2 mb-3" style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.12)' }}>
          <p className="text-[12px] text-accent-blue font-medium">{trendSummary}</p>
        </div>

        {points.length > 0 && (
          <div className="overflow-x-auto pb-1">
            <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="block">
              {[plotTop, 44, 74, plotBottom].map(y => (
                <line key={y} x1="0" y1={y} x2={chartWidth} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              ))}
              <defs>
                <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path d={areaPath} fill="url(#weightGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
              <motion.path d={linePath} fill="none" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeOut' }} />
              {points.map((point, index) => (
                <g key={`${point.date}-${point.weight}`}>
                  <line x1={point.x} y1={point.y + 8} x2={point.x} y2={plotBottom + 4} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <motion.circle
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill={index === points.length - 1 ? '#0A84FF' : '#FFFFFF'}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15 + index * 0.04 }}
                    style={{ filter: 'drop-shadow(0 0 6px rgba(10,132,255,0.5))' }}
                  />
                  <text x={point.x} y={124} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="10">{formatDate(point.date)}</text>
                  <text x={point.x} y={140} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10">{point.weight}kg</text>
                </g>
              ))}
            </svg>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-[12px] text-text-tertiary">{firstWeight?.date} 至 {latestWeight?.date}</span>
          <span className={`text-[13px] font-semibold ${Number(totalChange) <= 0 ? 'text-carb-low' : 'text-carb-high'}`}>
            {Number(totalChange) <= 0 ? '下降' : '上升'} {Math.abs(Number(totalChange))} kg
          </span>
        </div>
      </GlassCard>

      <GlassCard className="mb-3">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-medium">{hasActualMacroData ? '宏观营养素实际摄入' : '宏观营养素目标参考'}</p>
          <span className="text-[11px] text-text-tertiary">{macroData.length} 天</span>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <MacroStat label="平均热量" value={`${averageMacros.calories}`} unit="kcal" color="text-accent-blue" />
          <MacroStat label="碳水" value={`${averageMacros.carb}`} unit="g" color="text-accent-blue" />
          <MacroStat label="蛋白" value={`${averageMacros.protein}`} unit="g" color="text-carb-low" />
          <MacroStat label="脂肪" value={`${averageMacros.fat}`} unit="g" color="text-carb-mid" />
        </div>

        {macroData.length > 0 ? (
          <div className="overflow-x-auto pb-1">
            <div className="flex items-end gap-2 h-36" style={{ minWidth: Math.max(350, macroData.length * 48) }}>
              {macroData.map((day, index) => {
                const total = Math.max(1, day.carb + day.protein + day.fat);
                const barHeight = Math.max(28, (total / maxMacroTotal) * 104);
                return (
                  <div key={day.date} className="flex-1 min-w-10 flex flex-col items-center">
                    <div className="text-[10px] text-text-tertiary mb-1">{day.calories}</div>
                    <div className="w-full flex flex-col justify-end gap-[1px]" style={{ height: barHeight }}>
                      <motion.div className="w-full rounded-t-sm" style={{ background: '#0A84FF', height: `${(day.carb / total) * 100}%` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: index * 0.03, duration: 0.35 }} />
                      <motion.div className="w-full" style={{ background: '#30D158', height: `${(day.protein / total) * 100}%` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: index * 0.03 + 0.08, duration: 0.35 }} />
                      <motion.div className="w-full rounded-b-sm" style={{ background: '#FFD60A', height: `${(day.fat / total) * 100}%` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: index * 0.03 + 0.16, duration: 0.35 }} />
                    </div>
                    <span className="text-[10px] text-text-tertiary mt-1">{formatDate(day.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-text-tertiary py-8 text-center">暂无饮食记录。保存餐食后这里会显示实际摄入趋势。</p>
        )}

        <div className="grid grid-cols-3 gap-2 mt-4">
          <MacroLegend color="bg-accent-blue" label="碳水" />
          <MacroLegend color="bg-carb-low" label="蛋白" />
          <MacroLegend color="bg-carb-mid" label="脂肪" />
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard padding="p-4" className="flex flex-col items-center">
          <Target size={14} className="text-accent-blue mb-2" />
          <p className="text-[11px] text-text-tertiary mb-2">执行率</p>
          <RingChart size={80} centerValue={`${completedRate}%`} centerLabel="" rings={[{ value: completedRate, color: '#0A84FF', label: '', current: '', target: '' }]} />
        </GlassCard>
        <GlassCard padding="p-4" className="flex flex-col items-center justify-center">
          <Flame size={14} className="text-carb-high mb-2" />
          <p className="text-[11px] text-text-tertiary mb-1">连续打卡</p>
          <motion.p className="text-[36px] font-bold gradient-accent-text" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}>
            {streak}
          </motion.p>
          <p className="text-[12px] text-text-tertiary">天</p>
        </GlassCard>
      </div>
    </div>
  );
}

function MacroStat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-lg bg-glass px-2 py-2 text-center">
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      <p className={`text-[15px] font-semibold ${color}`}>{value}</p>
      <p className="text-[9px] text-text-tertiary">{unit}</p>
    </div>
  );
}

function MacroLegend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1 rounded-lg bg-glass px-2 py-2">
      <div className={`w-2 h-2 rounded-sm ${color}`} />
      <span className="text-[10px] text-text-tertiary">{label}</span>
    </div>
  );
}

function getDailyMealMacros(meals: MealLog[]): MacroDay[] {
  const byDate = new Map<string, MealLog[]>();
  meals.forEach(meal => {
    const list = byDate.get(meal.date) || [];
    list.push(meal);
    byDate.set(meal.date, list);
  });

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayMeals]) => {
      const summary = sumMealMacros(dayMeals);
      return {
        date,
        calories: Math.round(summary.calories),
        carb: Math.round(summary.carb),
        protein: Math.round(summary.protein),
        fat: Math.round(summary.fat),
      };
    });
}

function getTrendSummary(label: string, change: number, count: number): string {
  if (count <= 1) return '当前只有 1 条体重记录。继续记录后，这里会显示阶段趋势。';
  if (Math.abs(change) < 0.1) return `${label}内体重基本稳定，继续观察平均趋势。`;
  return `${label}内体重${change < 0 ? '下降' : '上升'} ${Math.abs(change).toFixed(1)} kg。`;
}

function filterWeightsByRange(entries: WeightEntry[], days: number | null): WeightEntry[] {
  if (!days || entries.length <= 1) return entries;
  const latestTime = parseDate(entries[entries.length - 1].date);
  const startTime = latestTime - (days - 1) * 86400000;
  const filtered = entries.filter(entry => parseDate(entry.date) >= startTime);
  return filtered.length > 0 ? filtered : entries.slice(-1);
}

function mergeInitialWeight(user: UserProfile, entries: WeightEntry[]): WeightEntry[] {
  const initialEntry = {
    date: user.initialWeightDate || user.startDate,
    weight: user.weight,
  };
  const byDate = new Map<string, WeightEntry>();
  entries.forEach(entry => byDate.set(entry.date, entry));
  byDate.set(initialEntry.date, initialEntry);
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function getAverageMacros(days: MacroDay[]) {
  if (!days.length) return { calories: 0, carb: 0, protein: 0, fat: 0 };
  const totals = days.reduce(
    (sum, day) => ({
      calories: sum.calories + day.calories,
      carb: sum.carb + day.carb,
      protein: sum.protein + day.protein,
      fat: sum.fat + day.fat,
    }),
    { calories: 0, carb: 0, protein: 0, fat: 0 },
  );
  return {
    calories: Math.round(totals.calories / days.length),
    carb: Math.round(totals.carb / days.length),
    protein: Math.round(totals.protein / days.length),
    fat: Math.round(totals.fat / days.length),
  };
}

function getCurrentStreak(plans: DayPlan[]): number {
  let streak = 0;
  for (const plan of plans) {
    if (!plan.completed) break;
    streak += 1;
  }
  return streak;
}

function getX(index: number, count: number, width: number): number {
  if (count <= 1) return width / 2;
  const padding = 18;
  return padding + index * ((width - padding * 2) / (count - 1));
}

function mapWeight(w: number, min: number, max: number): number {
  const range = Math.max(0.1, max - min);
  const plotHeight = plotBottom - plotTop;
  return plotBottom - ((w - min) / range) * plotHeight;
}

function parseDate(date: string): number {
  return new Date(`${date}T00:00:00`).getTime();
}

function formatDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${month}/${day}`;
}
