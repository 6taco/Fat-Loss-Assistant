'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, ChevronLeft, Dumbbell, Moon, Scale, Target, Utensils } from 'lucide-react';
import Button from '@/components/ui/Button';
import GlassCard from '@/components/ui/GlassCard';
import { showAppToast } from '@/components/ui/ToastHost';
import { getActiveAccount } from '@/lib/accounts';
import { identifyAnalyticsUser, track } from '@/lib/analytics/client';
import {
  buildTrainingCycleByFrequency,
  generateCarbCyclePlan,
  muscleGroupLabels,
  normalizeTrainingCycle,
  type MuscleGroup,
  type TrainingDay,
  type UserProfile,
} from '@/lib/mock-data';
import { generateStrategyDayPlans, recommendFatLossStrategy } from '@/lib/strategy-engine/engine';
import { usePlanStore } from '@/stores/usePlanStore';
import { useStrategyStore } from '@/stores/useStrategyStore';
import { useUserStore } from '@/stores/useUserStore';
import { useWeightStore } from '@/stores/useWeightStore';
import type { FatLossStrategyType, StrategyRecommendation } from '@/lib/strategy-engine/types';

const TOTAL_STEPS = 6;
const today = () => new Date().toISOString().slice(0, 10);
const muscleOptions: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'rest'];

interface FormState {
  gender: 'male' | 'female';
  age: string;
  height: string;
  weight: string;
  bodyFat: string;
  weightMeasuredDate: string;
  goalWeight: string;
  targetWeeks: string;
  fatLossGoal: 'health' | 'appearance' | 'performance' | 'event';
  sleepRegularity: 'regular' | 'mixed' | 'irregular';
  averageSleepHours: string;
  workStudyRhythm: 'student' | 'office' | 'shift' | 'flexible' | 'high_pressure';
  oftenStaysUpLate: boolean;
  dietRegularity: 'regular' | 'mixed' | 'irregular';
  bingeRisk: 'low' | 'medium' | 'high';
  takeawayFrequency: 'low' | 'medium' | 'high';
  complexPlanTolerance: 'low' | 'medium' | 'high';
  trainingFrequency: number;
  trainingIntensity: 'low' | 'medium' | 'high';
  hasFitnessHabit: boolean;
  hasStrengthTraining: boolean;
  trainingExperience: 'none' | 'beginner' | 'intermediate' | 'advanced';
  trainingSchedule: TrainingDay[];
}

const initialForm: FormState = {
  gender: 'male',
  age: '25',
  height: '175',
  weight: '72',
  bodyFat: '24',
  weightMeasuredDate: today(),
  goalWeight: '65',
  targetWeeks: '12',
  fatLossGoal: 'appearance',
  sleepRegularity: 'mixed',
  averageSleepHours: '7',
  workStudyRhythm: 'flexible',
  oftenStaysUpLate: false,
  dietRegularity: 'mixed',
  bingeRisk: 'low',
  takeawayFrequency: 'medium',
  complexPlanTolerance: 'medium',
  trainingFrequency: 3,
  trainingIntensity: 'medium',
  hasFitnessHabit: true,
  hasStrengthTraining: true,
  trainingExperience: 'beginner',
  trainingSchedule: buildTrainingCycleByFrequency(3),
};

export default function OnboardingPage() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const { setPlans } = usePlanStore();
  const { addEntry } = useWeightStore();
  const { saveLifestyle, recommend, activate, isLoading } = useStrategyStore();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [recommendation, setRecommendation] = useState<StrategyRecommendation | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<FatLossStrategyType | null>(null);

  useEffect(() => {
    const account = getActiveAccount();
    if (!account) {
      router.replace('/accounts');
      return;
    }
    identifyAnalyticsUser(account.id);
    track('onboarding_start', { step_count: TOTAL_STEPS }, { userId: account.id });
  }, [router]);

  const numeric = useMemo(() => ({
    age: Number.parseInt(form.age, 10),
    height: Number.parseFloat(form.height),
    weight: Number.parseFloat(form.weight),
    bodyFat: Number.parseFloat(form.bodyFat),
    goalWeight: Number.parseFloat(form.goalWeight),
    targetWeeks: Number.parseInt(form.targetWeeks, 10),
    sleepHours: Number.parseFloat(form.averageSleepHours),
  }), [form]);

  const bmi = Number.isFinite(numeric.weight) && Number.isFinite(numeric.height)
    ? numeric.weight / ((numeric.height / 100) ** 2)
    : 0;

  const lifestyleProfile = useMemo(() => ({
    sleepRegularity: form.sleepRegularity,
    averageSleepHours: numeric.sleepHours || 7,
    workStudyRhythm: form.workStudyRhythm,
    oftenStaysUpLate: form.oftenStaysUpLate,
    isStudent: form.workStudyRhythm === 'student',
    dietRegularity: form.dietRegularity,
    bingeRisk: form.bingeRisk,
    takeawayFrequency: form.takeawayFrequency,
    complexPlanTolerance: form.complexPlanTolerance,
    hasFitnessHabit: form.hasFitnessHabit,
    hasStrengthTraining: form.hasStrengthTraining,
    trainingExperience: form.trainingExperience,
    fatLossGoal: form.fatLossGoal,
    targetWeeks: numeric.targetWeeks || 12,
  }), [form, numeric.sleepHours, numeric.targetWeeks]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateTrainingFrequency = (frequency: number) => {
    setForm(prev => ({
      ...prev,
      trainingFrequency: frequency,
      hasFitnessHabit: frequency > 0,
      hasStrengthTraining: frequency >= 3 ? prev.hasStrengthTraining : false,
      trainingSchedule: buildTrainingCycleByFrequency(Math.max(1, frequency)),
    }));
  };

  const updateTrainingDay = (dayIndex: number, muscleGroup: MuscleGroup) => {
    setForm(prev => ({
      ...prev,
      trainingSchedule: prev.trainingSchedule.map(day =>
        day.dayIndex === dayIndex ? { ...day, muscleGroup, label: muscleGroupLabels[muscleGroup] } : day,
      ),
    }));
  };

  const next = async () => {
    const error = validateStep(step, numeric, form);
    if (error) {
      showAppToast(error, 'error');
      return;
    }

    if (step < 5) {
      setStep(step + 1);
      return;
    }

    const account = getActiveAccount();
    if (!account) {
      router.push('/accounts');
      return;
    }

    const user = buildUser(account.id, account.name, form, numeric);

    if (step === 5) {
      identifyAnalyticsUser(user.id);
      await setUser(user);
      await saveLifestyle(lifestyleProfile);
      const result = await recommend(lifestyleProfile);
      const fallbackRecommendation = recommendFatLossStrategy({
        user,
        lifestyle: lifestyleProfile,
        date: today(),
      });
      const finalRecommendation = result || fallbackRecommendation;
      setRecommendation(finalRecommendation);
      setSelectedStrategy(finalRecommendation.strategyType);
      setStep(6);
      return;
    }

    await finishOnboarding(user);
  };

  const finishOnboarding = async (user: UserProfile) => {
    const chosenStrategy = selectedStrategy || recommendation?.strategyType;
    const activated = await activate(chosenStrategy);
    const plans = Array.isArray(activated?.plans)
      ? activated.plans as ReturnType<typeof generateCarbCyclePlan>
      : buildSelectedStrategyPlans(user, recommendation, chosenStrategy);

    setPlans(plans, chosenStrategy);
    if (Number.isFinite(numeric.weight)) {
      addEntry({ date: form.weightMeasuredDate, weight: numeric.weight });
    }
    track('onboarding_complete', {
      step_count: TOTAL_STEPS,
      bmi: Number(bmi.toFixed(1)),
      training_frequency: form.trainingFrequency,
      binge_risk: form.bingeRisk,
      sleep_regular: form.sleepRegularity,
      recommended_strategy: recommendation?.strategyType,
      selected_strategy: chosenStrategy,
      strategy_overridden: Boolean(recommendation?.strategyType && chosenStrategy && recommendation.strategyType !== chosenStrategy),
    }, { userId: user.id });
    showAppToast('AI 已生成你的减脂策略。', 'success');
    router.push('/dashboard');
  };

  const back = () => {
    if (step > 1) setStep(step - 1);
    else router.push('/');
  };

  return (
    <div className="min-h-dvh px-5 pt-14 pb-10 flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <button onClick={back} className="bg-transparent border-none cursor-pointer" aria-label="返回">
          <ChevronLeft size={24} className="text-text-secondary" />
        </button>
        <span className="text-[13px] text-text-tertiary">{step} / {TOTAL_STEPS}</span>
      </div>

      <div className="h-[3px] rounded-full overflow-hidden mb-8 bg-white/[0.08]">
        <motion.div className="h-full rounded-full gradient-accent" animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="flex-1 overflow-y-auto">
          {step === 1 && (
            <StepShell icon={Scale} title="身体基础数据" desc="用于计算 BMI、BMR、TDEE 和安全减重速度。">
              <OptionGrid label="性别" value={form.gender} columns={2} options={[['male', '男'], ['female', '女']]} onChange={(value) => update('gender', value as FormState['gender'])} />
              <NumberInput label="年龄" value={form.age} unit="岁" onChange={(value) => update('age', value)} />
              <NumberInput label="身高" value={form.height} unit="cm" onChange={(value) => update('height', value)} />
              <NumberInput label="当前体重" value={form.weight} unit="kg" onChange={(value) => update('weight', value)} />
              <NumberInput label="体脂率" value={form.bodyFat} unit="%" onChange={(value) => update('bodyFat', value)} />
              <div className="rounded-xl bg-white/[0.045] border border-white/10 px-4 py-3 text-[13px] text-text-secondary">
                当前 BMI 估算：<span className="text-text-primary font-semibold">{bmi ? bmi.toFixed(1) : '--'}</span>
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell icon={Target} title="目标与周期" desc="目标越激进，系统越需要评估暴食、睡眠和执行风险。">
              <NumberInput label="目标体重" value={form.goalWeight} unit="kg" onChange={(value) => update('goalWeight', value)} />
              <NumberInput label="目标周期" value={form.targetWeeks} unit="周" onChange={(value) => update('targetWeeks', value)} />
              <OptionGrid label="减脂目标" value={form.fatLossGoal} options={[['health', '健康'], ['appearance', '体型'], ['performance', '训练表现'], ['event', '短期节点']]} onChange={(value) => update('fatLossGoal', value as FormState['fatLossGoal'])} />
            </StepShell>
          )}

          {step === 3 && (
            <StepShell icon={Moon} title="作息与生活节奏" desc="作息越不稳定，AI 越倾向选择低计算负担的策略。">
              <OptionGrid label="作息规律" value={form.sleepRegularity} options={[['regular', '规律'], ['mixed', '一般'], ['irregular', '不规律']]} onChange={(value) => update('sleepRegularity', value as FormState['sleepRegularity'])} />
              <NumberInput label="平均睡眠" value={form.averageSleepHours} unit="小时" onChange={(value) => update('averageSleepHours', value)} />
              <OptionGrid label="工作/学习节奏" value={form.workStudyRhythm} options={[['student', '学生'], ['office', '上班'], ['shift', '倒班'], ['flexible', '弹性'], ['high_pressure', '高压']]} onChange={(value) => update('workStudyRhythm', value as FormState['workStudyRhythm'])} />
              <ToggleCard label="经常熬夜" active={form.oftenStaysUpLate} onClick={() => update('oftenStaysUpLate', !form.oftenStaysUpLate)} />
            </StepShell>
          )}

          {step === 4 && (
            <StepShell icon={Utensils} title="饮食行为" desc="暴食、外卖和饮食规律会影响策略限制强度。">
              <OptionGrid label="饮食规律" value={form.dietRegularity} options={[['regular', '规律'], ['mixed', '一般'], ['irregular', '不规律']]} onChange={(value) => update('dietRegularity', value as FormState['dietRegularity'])} />
              <OptionGrid label="暴食风险" value={form.bingeRisk} options={[['low', '低'], ['medium', '中'], ['high', '高']]} onChange={(value) => update('bingeRisk', value as FormState['bingeRisk'])} />
              <OptionGrid label="外卖频率" value={form.takeawayFrequency} options={[['low', '少'], ['medium', '一般'], ['high', '经常']]} onChange={(value) => update('takeawayFrequency', value as FormState['takeawayFrequency'])} />
              <OptionGrid label="复杂计划耐受度" value={form.complexPlanTolerance} options={[['low', '低'], ['medium', '中'], ['high', '高']]} onChange={(value) => update('complexPlanTolerance', value as FormState['complexPlanTolerance'])} />
            </StepShell>
          )}

          {step === 5 && (
            <StepShell icon={Dumbbell} title="训练能力" desc="只有稳定力量训练用户才会优先推荐碳循环。">
              <OptionGrid label="每周训练频率" value={String(form.trainingFrequency)} options={[['0', '不练'], ['1', '1 次'], ['2', '2 次'], ['3', '3 次'], ['4', '4 次'], ['5', '5+ 次']]} onChange={(value) => updateTrainingFrequency(Number(value))} />
              <OptionGrid label="训练强度" value={form.trainingIntensity} options={[['low', '轻'], ['medium', '中'], ['high', '高']]} onChange={(value) => update('trainingIntensity', value as FormState['trainingIntensity'])} />
              <OptionGrid label="训练经验" value={form.trainingExperience} options={[['none', '无'], ['beginner', '新手'], ['intermediate', '进阶'], ['advanced', '熟练']]} onChange={(value) => update('trainingExperience', value as FormState['trainingExperience'])} />
              <div className="grid grid-cols-2 gap-3 mb-5">
                <ToggleCard label="有健身习惯" active={form.hasFitnessHabit} onClick={() => update('hasFitnessHabit', !form.hasFitnessHabit)} />
                <ToggleCard label="做力量训练" active={form.hasStrengthTraining} onClick={() => update('hasStrengthTraining', !form.hasStrengthTraining)} />
              </div>
              {form.hasStrengthTraining && (
                <div className="flex flex-col gap-3">
                  {form.trainingSchedule.slice(0, 7).map(day => (
                    <GlassCard key={day.dayIndex} padding="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-semibold">训练日 {day.dayIndex + 1}</span>
                        <span className="text-[12px] text-accent-blue">{muscleGroupLabels[day.muscleGroup]}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {muscleOptions.map(group => (
                          <button key={group} onClick={() => updateTrainingDay(day.dayIndex, group)} className={`h-9 rounded-lg border text-[11px] ${day.muscleGroup === group ? 'gradient-accent text-white border-transparent' : 'bg-glass border-border-glass text-text-secondary'}`}>
                            {muscleGroupLabels[group]}
                          </button>
                        ))}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </StepShell>
          )}

          {step === 6 && (
            <StepShell icon={Brain} title="AI 推荐结果" desc="系统会给你一个主策略，避免自己在多个方案里纠结。">
              {recommendation ? (
                <StrategyResult recommendation={recommendation} selectedStrategy={selectedStrategy || recommendation.strategyType} onSelect={setSelectedStrategy} />
              ) : (
                <GlassCard variant="highlight">
                  <p className="text-[14px] text-text-secondary">正在根据画像生成推荐...</p>
                </GlassCard>
              )}
            </StepShell>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6">
        <Button fullWidth onClick={next} disabled={isLoading}>
          {step === 5 ? '让 AI 判断适合我的策略' : step === 6 ? '确认并生成计划' : '下一步'}
        </Button>
      </div>
    </div>
  );
}

function StepShell({ icon: Icon, title, desc, children }: { icon: typeof Scale; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={20} className="text-accent-blue" />
        <h2 className="text-[22px] font-semibold">{title}</h2>
      </div>
      <p className="text-[14px] text-text-secondary mb-6">{desc}</p>
      {children}
    </div>
  );
}

function NumberInput({ label, value, unit, onChange }: { label: string; value: string; unit: string; onChange: (value: string) => void }) {
  return (
    <div className="mb-5">
      <label className="text-[13px] text-text-secondary font-medium block mb-2.5">{label}</label>
      <div className="glass-card rounded-xl px-4 py-3.5 flex items-center justify-between">
        <input type="number" value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent border-none outline-none text-[16px] w-full text-text-primary" />
        <span className="text-[14px] text-text-tertiary ml-2">{unit}</span>
      </div>
    </div>
  );
}

function OptionGrid({ label, value, options, columns = 3, onChange }: { label: string; value: string; options: [string, string][]; columns?: 2 | 3; onChange: (value: string) => void }) {
  return (
    <div className="mb-5">
      <label className="text-[13px] text-text-secondary font-medium block mb-2.5">{label}</label>
      <div className={columns === 2 ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-3 gap-2'}>
        {options.map(([optionValue, optionLabel]) => (
          <button key={optionValue} onClick={() => onChange(optionValue)} className={`min-h-11 rounded-xl border px-2 text-[12px] ${value === optionValue ? 'gradient-accent text-white border-transparent' : 'bg-glass border-border-glass text-text-secondary'}`}>
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleCard({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full p-4 rounded-xl border-2 text-left ${active ? 'border-accent-blue bg-white/[0.06]' : 'border-border-glass bg-glass'}`}>
      <p className="text-[14px] font-semibold">{label}</p>
      <p className="text-[11px] text-text-tertiary mt-1">{active ? '是' : '否'}</p>
    </button>
  );
}

function StrategyResult({
  recommendation,
  selectedStrategy,
  onSelect,
}: {
  recommendation: StrategyRecommendation;
  selectedStrategy: FatLossStrategyType;
  onSelect: (strategy: FatLossStrategyType) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <GlassCard variant="highlight">
        <p className="text-[12px] text-text-tertiary mb-1">最适合你的策略</p>
        <p className="text-[28px] font-bold">{strategyLabel(recommendation.strategyType)}</p>
        <p className="text-[13px] text-text-secondary mt-2">{recommendation.stageGoal}</p>
      </GlassCard>
      <div>
        <p className="text-[13px] font-semibold mb-3">你也可以改选其它策略</p>
        <div className="flex flex-col gap-2">
          {strategyOptions.map(option => (
            <button
              key={option.type}
              onClick={() => onSelect(option.type)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                selectedStrategy === option.type ? 'border-accent-blue bg-white/[0.07]' : 'border-white/10 bg-white/[0.035]'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-[15px] font-semibold">{option.label}</p>
                {recommendation.strategyType === option.type && <span className="text-[10px] text-accent-blue">AI 推荐</span>}
              </div>
              <p className="text-[12px] text-text-secondary leading-relaxed">{option.desc}</p>
              <p className="text-[11px] text-text-tertiary mt-2">匹配分：{getStrategyScore(recommendation, option.type)}</p>
            </button>
          ))}
        </div>
      </div>
      <GlassCard>
        <p className="text-[13px] font-semibold mb-3">推荐原因</p>
        <div className="flex flex-col gap-2">
          {recommendation.reasons.map(reason => (
            <p key={reason} className="rounded-xl bg-white/[0.045] border border-white/10 px-3 py-2 text-[12px] text-text-secondary leading-relaxed">{reason}</p>
          ))}
        </div>
      </GlassCard>
      <div className="grid grid-cols-3 gap-2">
        <Score label="热量缺口" value={recommendation.scores.calorieDeficit} />
        <Score label="16+8" value={recommendation.scores.intermittentFasting} />
        <Score label="碳循环" value={recommendation.scores.carbCycling} />
      </div>
      {!!recommendation.safetyFlags.length && (
        <GlassCard>
          <p className="text-[13px] font-semibold mb-2">安全提醒</p>
          <p className="text-[12px] text-text-secondary leading-relaxed">{recommendation.safetyFlags.join(' ')}</p>
        </GlassCard>
      )}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/[0.045] border border-white/10 px-3 py-3">
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      <p className="text-[18px] font-bold text-accent-blue">{value}</p>
    </div>
  );
}

const strategyOptions: { type: FatLossStrategyType; label: string; desc: string }[] = [
  { type: 'calorie_deficit', label: '热量缺口', desc: '最稳的基础策略，适合新手、不健身或想先建立热量与蛋白目标的人。' },
  { type: 'if_16_8', label: '16+8 轻断食', desc: '适合作息不稳定、外卖多、不想复杂计算热量的人，重点是进食窗口。' },
  { type: 'carb_cycling', label: '碳循环', desc: '适合稳定力量训练用户，把高碳日匹配训练日，计划复杂度更高。' },
];

function getStrategyScore(recommendation: StrategyRecommendation, strategyType: FatLossStrategyType) {
  if (strategyType === 'calorie_deficit') return recommendation.scores.calorieDeficit;
  if (strategyType === 'if_16_8') return recommendation.scores.intermittentFasting;
  return recommendation.scores.carbCycling;
}

function buildSelectedStrategyPlans(
  user: UserProfile,
  recommendation: StrategyRecommendation | null,
  strategyType?: FatLossStrategyType,
) {
  if (!recommendation || !strategyType) {
    return generateCarbCyclePlan(user.startDate, user.weight, user.somatotype, user.trainingSchedule);
  }
  return generateStrategyDayPlans({
    strategyType,
    intensity: recommendation.intensity,
    startDate: user.startDate,
    user,
    targets: recommendation.targets,
    trainingSchedule: user.trainingSchedule,
  });
}

type NumericForm = {
  age: number;
  height: number;
  weight: number;
  bodyFat: number;
  goalWeight: number;
  targetWeeks: number;
  sleepHours: number;
};

function buildUser(accountId: string, name: string, form: FormState, numeric: NumericForm): UserProfile {
  return {
    id: accountId,
    name,
    gender: form.gender,
    age: numeric.age,
    height: numeric.height,
    weight: numeric.weight,
    bodyFat: numeric.bodyFat,
    trainingFrequency: form.trainingFrequency,
    trainingIntensity: form.trainingIntensity,
    startDate: today(),
    initialWeightDate: form.weightMeasuredDate,
    goalWeight: numeric.goalWeight || Math.round(numeric.weight * 0.9),
    somatotype: 'mesomorph',
    trainingSchedule: normalizeTrainingCycle(form.trainingSchedule),
  };
}

function validateStep(step: number, numeric: NumericForm, form: FormState) {
  if (step === 1) {
    if (!Number.isFinite(numeric.age) || numeric.age < 14 || numeric.age > 80) return '年龄需要在 14-80 岁之间。';
    if (!Number.isFinite(numeric.height) || numeric.height < 120 || numeric.height > 230) return '身高需要在 120-230 cm 之间。';
    if (!Number.isFinite(numeric.weight) || numeric.weight < 30 || numeric.weight > 250) return '体重需要在 30-250 kg 之间。';
    if (!Number.isFinite(numeric.bodyFat) || numeric.bodyFat < 5 || numeric.bodyFat > 60) return '体脂率需要在 5%-60% 之间。';
  }
  if (step === 2) {
    if (!Number.isFinite(numeric.goalWeight) || numeric.goalWeight < 30 || numeric.goalWeight > 250) return '目标体重需要在 30-250 kg 之间。';
    if (!Number.isFinite(numeric.targetWeeks) || numeric.targetWeeks < 2 || numeric.targetWeeks > 104) return '目标周期需要在 2-104 周之间。';
  }
  if (step === 3 && (!Number.isFinite(numeric.sleepHours) || numeric.sleepHours < 3 || numeric.sleepHours > 12)) return '平均睡眠需要在 3-12 小时之间。';
  if (step === 5 && form.hasStrengthTraining) {
    const cycle = normalizeTrainingCycle(form.trainingSchedule);
    if (!cycle.some(day => day.muscleGroup !== 'rest')) return '力量训练计划里至少需要 1 天训练。';
  }
  return '';
}

function strategyLabel(strategyType: string) {
  if (strategyType === 'calorie_deficit') return '热量缺口';
  if (strategyType === 'if_16_8') return '16+8 轻断食';
  return '碳循环';
}
