'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BrainCircuit,
  Footprints,
  Gauge,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  Utensils,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { showAppToast } from '@/components/ui/ToastHost';
import { getActiveAccount, getScopedKey } from '@/lib/accounts';
import { getJson, sendJson } from '@/lib/client-api';
import { syncLocalDataToServer } from '@/lib/client-sync';
import type { UserProfile } from '@/lib/mock-data';
import { getItem, KEYS } from '@/lib/storage';
import { cn } from '@/lib/utils';
import type {
  DigitalTwinBundle,
  DigitalTwinForecastPoint,
  DigitalTwinScenarioDto,
  ScenarioInput,
} from '@/lib/digital-twin/types';

const scenarioButtons: Array<{
  type: ScenarioInput['type'];
  label: string;
  icon: typeof Sparkles;
  payload: ScenarioInput;
}> = [
  { type: 'maintain_current', label: '保持当前饮食', icon: Scale, payload: { type: 'maintain_current', horizonDays: 30 } },
  { type: 'add_steps', label: '每天多 5000 步', icon: Footprints, payload: { type: 'add_steps', horizonDays: 30, dailyStepsAdded: 5000 } },
  { type: 'reduce_calories', label: '每天少 100 kcal', icon: Utensils, payload: { type: 'reduce_calories', horizonDays: 30, dailyCalorieDelta: -100 } },
  { type: 'improve_adherence', label: '每周多打卡 2 天', icon: Target, payload: { type: 'improve_adherence', horizonDays: 30, adherenceBoost: 0.15 } },
];

export default function DigitalTwinPage() {
  const [twin, setTwin] = useState<DigitalTwinBundle | null>(null);
  const [activeScenario, setActiveScenario] = useState<DigitalTwinScenarioDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  useEffect(() => {
    if (!userId) return;

    setIsLoading(true);
    void syncLocalDataToServer()
      .then(() => getJson<{ twin: DigitalTwinBundle | null }>(`/api/digital-twin?userId=${encodeURIComponent(userId)}`))
      .then(async data => {
        if (data?.twin) {
          setTwin(data.twin);
          setActiveScenario(data.twin.scenarios[0] || null);
          return;
        }

        const generated = await sendJson<DigitalTwinBundle>('/api/digital-twin/generate', 'POST', {
          userId,
          horizonDays: 30,
          force: true,
        });
        if (generated) {
          setTwin(generated);
          setActiveScenario(generated.scenarios[0] || null);
        }
      })
      .finally(() => setIsLoading(false));
  }, [userId]);

  const profile = twin?.profile;
  const prediction = twin?.prediction;
  const summary = profile?.modelSummary;
  const forecast = activeScenario?.result?.forecast || prediction?.forecast || [];
  const latestScenario = activeScenario?.result;
  const persona = profile?.persona || {};
  const behavior = profile?.behaviorProfile || {};
  const nutrition = profile?.nutritionProfile || {};

  const simulate = async (payload: ScenarioInput) => {
    if (!userId) return;
    setIsLoading(true);
    await syncLocalDataToServer();

    const result = await sendJson<{ scenario: DigitalTwinScenarioDto; explanation: string }>(
      '/api/digital-twin/simulate',
      'POST',
      { userId, scenario: payload },
    );

    if (result?.scenario) {
      setActiveScenario(result.scenario);
      setTwin(current => current
        ? {
          ...current,
          scenarios: [result.scenario, ...current.scenarios.filter(item => item.id !== result.scenario.id)],
        }
        : current);
      showAppToast('情景模拟已更新。', 'success');
    } else {
      showAppToast('情景模拟暂时失败，请稍后再试。', 'error');
    }

    setIsLoading(false);
  };

  const regenerate = async () => {
    if (!userId) return;
    setIsLoading(true);
    await syncLocalDataToServer();

    const generated = await sendJson<DigitalTwinBundle>('/api/digital-twin/generate', 'POST', {
      userId,
      horizonDays: 30,
      force: true,
    });

    if (generated) {
      setTwin(generated);
      setActiveScenario(generated.scenarios[0] || null);
      showAppToast('数字分身已重新生成。', 'success');
    } else {
      showAppToast('数字分身生成失败。', 'error');
    }

    setIsLoading(false);
  };

  return (
    <div className="px-5 pt-14 pb-28 min-h-dvh">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[12px] text-text-tertiary mb-1">Personal AI Health Coach</p>
          <h1 className="text-[24px] font-semibold">数字减脂分身</h1>
        </div>
        <button
          onClick={regenerate}
          disabled={isLoading || !userId}
          className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-accent-blue disabled:opacity-50"
          aria-label="重新生成数字分身"
        >
          <RefreshCw size={17} className={cn(isLoading && 'animate-spin')} />
        </button>
      </div>

      <GlassCard variant="highlight" className="mb-3 overflow-hidden relative">
        <div className="absolute right-[-56px] top-[-56px] w-36 h-36 rounded-full bg-accent-blue/10" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit size={16} className="text-accent-blue" />
            <span className="text-[12px] text-accent-blue font-medium">
              {String(persona.fatLossType || '个性化趋势模型')}
            </span>
          </div>
          <h2 className="text-[20px] font-semibold mb-2">{getTrendLabel(summary?.plateauRisk)}</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            {summary?.explanation || '生成数字分身后，我会基于你的体重、饮食、打卡和聊天记录，估算未来趋势。'}
          </p>
          <div className="grid grid-cols-4 gap-2 mt-4">
            <Metric label="当前" value={formatKg(summary?.currentWeight)} />
            <Metric label="30天" value={formatKg(prediction?.predictedWeight)} />
            <Metric label="概率" value={prediction ? `${prediction.goalProbability}%` : '--'} />
            <Metric label="风险" value={riskLabel(summary?.plateauRisk)} />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent-blue" />
            <span className="text-[13px] font-medium">未来 30 天预测</span>
          </div>
          <span className="text-[11px] text-text-tertiary">置信度：{confidenceLabel(profile?.confidence)}</span>
        </div>
        {forecast.length ? (
          <ForecastChart forecast={forecast} goalWeight={Number(persona.goalWeight || 0)} />
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-[12px] text-text-tertiary">
            点击右上角重新生成数字分身。
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-text-tertiary">
          预测是基于历史趋势和执行稳定性的估算，不是医学诊断，也不承诺精确结果。
        </p>
      </GlassCard>

      <GlassCard className="mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Gauge size={14} className="text-carb-low" />
          <span className="text-[13px] font-medium">情景模拟器</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {scenarioButtons.map(button => {
            const Icon = button.icon;
            return (
              <button
                key={button.type}
                onClick={() => void simulate(button.payload)}
                disabled={isLoading}
                className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-3 text-left active:scale-[0.99] transition-transform disabled:opacity-50"
              >
                <Icon size={15} className="text-accent-blue mb-2" />
                <p className="text-[12px] font-medium">{button.label}</p>
              </button>
            );
          })}
        </div>
        {latestScenario && (
          <div className="mt-3 rounded-xl border border-accent-blue/20 bg-accent-blue/10 px-3 py-3">
            <p className="text-[12px] font-semibold text-accent-blue mb-1">{activeScenario?.title}</p>
            <p className="text-[12px] text-text-secondary leading-relaxed">{latestScenario.explanation}</p>
          </div>
        )}
      </GlassCard>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <ProfileCard title="行为习惯" items={[
          ['记录稳定度', percent(behavior.loggingConsistency)],
          ['30天饮食记录', percent(behavior.mealLoggingRate30d)],
          ['最长打卡', `${Number(behavior.longestCheckinStreak || 0)} 天`],
        ]} />
        <ProfileCard title="饮食画像" items={[
          ['7天热量', `${Number(nutrition.avgCalories7d || 0)} kcal`],
          ['7天蛋白', `${Number(nutrition.avgProtein7d || 0)} g`],
          ['蛋白达标', percent(nutrition.proteinHitRate)],
        ]} />
      </div>

      <GlassCard>
        <p className="text-[13px] font-medium mb-3">平台期风险解释</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Metric label="7天斜率" value={formatSlope(summary?.slope7d)} />
          <Metric label="14天斜率" value={formatSlope(summary?.slope14d)} />
          <Metric label="波动" value={`${Number(summary?.residualStd || 0).toFixed(2)}`} />
        </div>
        <p className="text-[12px] text-text-secondary leading-relaxed">
          {summary?.plateauRisk === 'high'
            ? '最近趋势接近停滞，建议先看平均体重和记录完整度，再考虑小幅调整。'
            : summary?.plateauRisk === 'medium'
              ? '当前进入观察期，先稳定蛋白、睡眠和活动量。'
              : '暂未看到明显平台期信号，继续保持当前节奏。'}
        </p>
      </GlassCard>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] px-2 py-2 text-center">
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      <p className="text-[13px] font-semibold">{value}</p>
    </div>
  );
}

function ProfileCard({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <GlassCard padding="p-4">
      <p className="text-[13px] font-medium mb-3">{title}</p>
      <div className="space-y-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-tertiary">{label}</span>
            <span className="text-[12px] font-medium">{value}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function ForecastChart({ forecast, goalWeight }: { forecast: DigitalTwinForecastPoint[]; goalWeight: number }) {
  const chartWidth = Math.max(350, forecast.length * 18);
  const values = forecast.flatMap(point => [
    point.lowerBound,
    point.predictedWeight,
    point.upperBound,
    point.scenarioWeight ?? point.predictedWeight,
    goalWeight || point.predictedWeight,
  ]);
  const min = Math.min(...values) - 0.3;
  const max = Math.max(...values) + 0.3;
  const points = forecast.map((point, index) => ({
    ...point,
    x: getX(index, forecast.length, chartWidth),
    y: mapWeight(point.predictedWeight, min, max),
    lowerY: mapWeight(point.lowerBound, min, max),
    upperY: mapWeight(point.upperBound, min, max),
  }));
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  const bandPath = points.length
    ? `${points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.upperY}`).join(' ')} ${[...points].reverse().map(point => `L${point.x},${point.lowerY}`).join(' ')} Z`
    : '';
  const goalY = goalWeight ? mapWeight(goalWeight, min, max) : null;

  return (
    <div className="overflow-x-auto pb-1">
      <svg width={chartWidth} height={154} viewBox={`0 0 ${chartWidth} 154`} className="block">
        {[14, 44, 74, 106].map(y => (
          <line key={y} x1="0" y1={y} x2={chartWidth} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        {goalY !== null && (
          <>
            <line x1="0" y1={goalY} x2={chartWidth} y2={goalY} stroke="rgba(48,209,88,0.5)" strokeDasharray="4 5" strokeWidth="1" />
            <text x="4" y={Math.max(10, goalY - 5)} fill="rgba(48,209,88,0.8)" fontSize="10">
              目标 {goalWeight}kg
            </text>
          </>
        )}
        <path d={bandPath} fill="rgba(10,132,255,0.10)" />
        <motion.path
          d={path}
          fill="none"
          stroke="#0A84FF"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8 }}
        />
        {points.filter((_, index) => index % 6 === 5 || index === points.length - 1).map(point => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="3" fill="#0A84FF" />
            <text x={point.x} y={132} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10">
              {formatDate(point.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function getUserId() {
  const account = getActiveAccount();
  if (!account) return null;
  return getItem<UserProfile | null>(getScopedKey(KEYS.USER), null)?.id || account.id;
}

function getTrendLabel(risk?: string) {
  if (risk === 'high') return '你当前可能进入平台观察期';
  if (risk === 'medium') return '你当前减脂趋势正在放缓';
  if (risk === 'low') return '你当前减脂趋势相对稳定';
  return '正在建立你的数字分身';
}

function riskLabel(risk?: string) {
  if (risk === 'high') return '高';
  if (risk === 'medium') return '中';
  if (risk === 'low') return '低';
  return '未知';
}

function confidenceLabel(confidence?: string) {
  if (confidence === 'high') return '高';
  if (confidence === 'medium') return '中';
  return '低';
}

function formatKg(value?: number) {
  return typeof value === 'number' ? `${value.toFixed(1)}kg` : '--';
}

function formatSlope(value?: number) {
  return typeof value === 'number' ? value.toFixed(3) : '--';
}

function percent(value: unknown) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '--';
}

function getX(index: number, count: number, width: number): number {
  if (count <= 1) return width / 2;
  const padding = 18;
  return padding + index * ((width - padding * 2) / (count - 1));
}

function mapWeight(weight: number, min: number, max: number): number {
  const range = Math.max(0.1, max - min);
  return 106 - ((weight - min) / range) * (106 - 14);
}

function formatDate(date: string) {
  const [, month, day] = date.split('-');
  return `${month}/${day}`;
}
