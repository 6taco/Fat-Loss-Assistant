'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check, Dumbbell, Scale, UserRound } from 'lucide-react';
import Button from '@/components/ui/Button';
import GlassCard from '@/components/ui/GlassCard';
import { showAppToast } from '@/components/ui/ToastHost';
import { getAnonymousUserId } from '@/lib/anonymous-id';
import { usePlanStore } from '@/stores/usePlanStore';
import { useUserStore } from '@/stores/useUserStore';
import { useWeightStore } from '@/stores/useWeightStore';
import {
  defaultTrainingSchedule,
  generateCarbCyclePlan,
  muscleGroupLabels,
  somatotypeLabels,
  type MuscleGroup,
  type Somatotype,
  type TrainingDay,
  type UserProfile,
} from '@/lib/mock-data';

const TOTAL_STEPS = 4;
const today = () => new Date().toISOString().slice(0, 10);

const somatotypeOptions: { value: Somatotype; visual: string; desc: string; macros: string }[] = [
  {
    value: 'endomorph',
    visual: '圆润 / 易储脂',
    desc: '骨架偏宽、增重较快，减脂时更需要控制碳水总量。',
    macros: '碳水 2g/kg，蛋白 1.5g/kg，脂肪 0.8g/kg',
  },
  {
    value: 'mesomorph',
    visual: '均衡 / 易增肌',
    desc: '肩腰比例较好，训练反馈明显，适合标准 232 碳循环。',
    macros: '碳水 2.5g/kg，蛋白 1.5g/kg，脂肪 1g/kg',
  },
  {
    value: 'ectomorph',
    visual: '瘦长 / 代谢快',
    desc: '四肢较长、体脂偏低或不易增重，计划会保留更高碳水。',
    macros: '碳水 3g/kg，蛋白 1.5g/kg，脂肪 1.1g/kg',
  },
];

const bodyFatOptions = [
  { value: 12, label: '清晰线条', desc: '腹肌或肌肉线条明显' },
  { value: 18, label: '标准偏瘦', desc: '腰腹脂肪较少' },
  { value: 24, label: '普通体型', desc: '腰腹有一定脂肪' },
  { value: 30, label: '偏高体脂', desc: '腹部脂肪明显' },
  { value: 36, label: '高体脂', desc: '全身脂肪较多' },
];

const frequencyOptions = [2, 3, 4, 5, 6];
const intensityOptions = [
  { value: 'low', label: '轻度', desc: '训练后疲劳较轻' },
  { value: 'medium', label: '中等', desc: '明显出汗，有恢复需求' },
  { value: 'high', label: '高强度', desc: '大重量或高容量训练' },
] as const;
const muscleOptions: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'rest'];
const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface FormState {
  gender: 'male' | 'female';
  age: number;
  height: number;
  weight: number;
  weightMeasuredDate: string;
  bodyFat: number;
  somatotype: Somatotype;
  trainingFrequency: number;
  trainingIntensity: 'low' | 'medium' | 'high';
  trainingSchedule: TrainingDay[];
}

export default function OnboardingPage() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const { setPlans } = usePlanStore();
  const { loadEntries, addEntry } = useWeightStore();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    gender: 'male',
    age: 25,
    height: 175,
    weight: 72,
    weightMeasuredDate: today(),
    bodyFat: 24,
    somatotype: 'mesomorph',
    trainingFrequency: 5,
    trainingIntensity: 'high',
    trainingSchedule: defaultTrainingSchedule,
  });

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const previewPlans = useMemo(
    () => generateCarbCyclePlan(today(), form.weight, form.somatotype, form.trainingSchedule).slice(0, 7),
    [form.weight, form.somatotype, form.trainingSchedule],
  );

  const update = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const updateTrainingDay = (dayIndex: number, muscleGroup: MuscleGroup) => {
    setForm(prev => ({
      ...prev,
      trainingSchedule: prev.trainingSchedule.map(day =>
        day.dayIndex === dayIndex
          ? { ...day, muscleGroup, label: muscleGroupLabels[muscleGroup] }
          : day,
      ),
    }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (form.age < 14 || form.age > 80) return '年龄需要在 14-80 岁之间。';
      if (form.height < 120 || form.height > 230) return '身高需要在 120-230 cm 之间。';
      if (form.weight < 30 || form.weight > 250) return '体重需要在 30-250 kg 之间。';
      if (!form.weightMeasuredDate) return '请选择最近一次测量体重的日期。';
      if (new Date(form.weightMeasuredDate) > new Date()) return '测量日期不能晚于今天。';
    }
    if (step === 2 && (form.bodyFat < 5 || form.bodyFat > 60)) return '体脂率需要在 5%-60% 之间。';
    if (step === 3) {
      const restDays = form.trainingSchedule.filter(day => day.muscleGroup === 'rest').length;
      if (restDays < 1) return '建议至少安排 1 天休息日，低碳日会优先放在休息日。';
    }
    return '';
  };

  const next = () => {
    const error = validateStep();
    if (error) {
      showAppToast(error, 'error');
      return;
    }

    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }

    const user: UserProfile = {
      id: getAnonymousUserId(),
      name: 'Alex',
      gender: form.gender,
      age: form.age,
      height: form.height,
      weight: form.weight,
      bodyFat: form.bodyFat,
      trainingFrequency: form.trainingFrequency,
      trainingIntensity: form.trainingIntensity,
      startDate: today(),
      initialWeightDate: form.weightMeasuredDate,
      goalWeight: Math.round(form.weight * 0.9),
      somatotype: form.somatotype,
      trainingSchedule: form.trainingSchedule,
    };

    setUser(user);
    setPlans(generateCarbCyclePlan(user.startDate, user.weight, user.somatotype, user.trainingSchedule));
    addEntry({ date: form.weightMeasuredDate, weight: form.weight });
    showAppToast('碳循环计划已生成。', 'success');
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

      <div className="h-[3px] rounded-full overflow-hidden mb-8" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full rounded-full gradient-accent"
          animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="flex-1 overflow-y-auto"
        >
          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <UserRound size={20} className="text-accent-blue" />
                <h2 className="text-[22px] font-semibold">基础信息</h2>
              </div>
              <p className="text-[14px] text-text-secondary mb-8">用于计算每周宏观营养素总量和初始体重趋势。</p>

              <label className="text-[13px] text-text-secondary font-medium block mb-2.5">性别</label>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {(['male', 'female'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => update('gender', g)}
                    className={`p-4 text-center rounded-xl border-2 cursor-pointer bg-glass transition-all ${
                      form.gender === g ? 'border-accent-blue shadow-[0_0_12px_rgba(10,132,255,0.2)]' : 'border-border-glass'
                    }`}
                  >
                    <span className="text-[14px] font-medium">{g === 'male' ? '男' : '女'}</span>
                  </button>
                ))}
              </div>

              {[
                { label: '年龄', key: 'age' as const, unit: '岁', min: 14, max: 80 },
                { label: '身高', key: 'height' as const, unit: 'cm', min: 120, max: 230 },
                { label: '体重', key: 'weight' as const, unit: 'kg', min: 30, max: 250 },
              ].map(field => (
                <div key={field.key} className="mb-5">
                  <label className="text-[13px] text-text-secondary font-medium block mb-2.5">{field.label}</label>
                  <div className="glass-card rounded-xl px-4 py-3.5 flex items-center justify-between">
                    <input
                      type="number"
                      value={form[field.key]}
                      onChange={(event) => update(field.key, Number(event.target.value))}
                      className="bg-transparent border-none outline-none text-[16px] w-full text-text-primary"
                      min={field.min}
                      max={field.max}
                    />
                    <span className="text-[14px] text-text-tertiary ml-2">{field.unit}</span>
                  </div>
                </div>
              ))}

              <div className="mb-5">
                <label className="text-[13px] text-text-secondary font-medium block mb-2.5">最近一次测量体重时间</label>
                <div className="glass-card rounded-xl px-4 py-3.5">
                  <input
                    type="date"
                    value={form.weightMeasuredDate}
                    max={today()}
                    onChange={(event) => update('weightMeasuredDate', event.target.value)}
                    className="bg-transparent border-none outline-none text-[16px] w-full text-text-primary [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Scale size={20} className="text-accent-blue" />
                <h2 className="text-[22px] font-semibold">体脂与胚型</h2>
              </div>
              <p className="text-[14px] text-text-secondary mb-6">先估算体脂，再选择最接近自己的胚型。</p>

              <label className="text-[13px] text-text-secondary font-medium block mb-3">体脂率参考</label>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {bodyFatOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update('bodyFat', opt.value)}
                    className={`p-4 rounded-xl border-2 cursor-pointer bg-glass transition-all text-left ${
                      form.bodyFat === opt.value ? 'border-accent-blue shadow-[0_0_12px_rgba(10,132,255,0.2)]' : 'border-border-glass'
                    }`}
                  >
                    <p className="text-[15px] font-semibold">{opt.value}% · {opt.label}</p>
                    <p className="text-[12px] text-text-tertiary mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <label className="text-[13px] text-text-secondary font-medium block mb-3">精确调整</label>
              <input
                type="range"
                min={5}
                max={45}
                value={form.bodyFat}
                onChange={(event) => update('bodyFat', Number(event.target.value))}
                className="w-full accent-accent-blue mb-1"
              />
              <div className="flex justify-between mb-7">
                <span className="text-[11px] text-text-tertiary">5%</span>
                <span className="text-[13px] text-accent-blue font-semibold">{form.bodyFat}%</span>
                <span className="text-[11px] text-text-tertiary">45%</span>
              </div>

              <label className="text-[13px] text-text-secondary font-medium block mb-3">胚型判断辅助</label>
              <div className="flex flex-col gap-3">
                {somatotypeOptions.map(opt => {
                  const selected = form.somatotype === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => update('somatotype', opt.value)}
                      className={`p-4 rounded-xl border-2 cursor-pointer bg-glass transition-all text-left ${
                        selected ? 'border-accent-blue shadow-[0_0_12px_rgba(10,132,255,0.2)]' : 'border-border-glass'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`w-16 h-20 rounded-xl border flex flex-col items-center justify-center text-center shrink-0 ${
                            selected ? 'border-accent-blue text-accent-blue' : 'border-border-glass text-text-tertiary'
                          }`}
                        >
                          <span className="text-[12px] font-semibold">{somatotypeLabels[opt.value]}</span>
                          <span className="text-[10px] leading-tight mt-1">{opt.visual}</span>
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold">{somatotypeLabels[opt.value]}</p>
                          <p className="text-[12px] text-text-secondary leading-relaxed mt-1">{opt.desc}</p>
                          <p className="text-[11px] text-text-tertiary mt-2">{opt.macros}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell size={20} className="text-accent-blue" />
                <h2 className="text-[22px] font-semibold">训练计划</h2>
              </div>
              <p className="text-[14px] text-text-secondary mb-6">练背和练腿优先高碳，休息日优先低碳。</p>

              <label className="text-[13px] text-text-secondary font-medium block mb-3">每周训练频率</label>
              <div className="flex gap-2 mb-6">
                {frequencyOptions.map(f => (
                  <button
                    key={f}
                    onClick={() => update('trainingFrequency', f)}
                    className={`flex-1 h-12 rounded-xl font-semibold border-2 cursor-pointer transition-all ${
                      form.trainingFrequency === f ? 'gradient-accent text-white border-transparent' : 'bg-glass border-border-glass text-text-secondary'
                    }`}
                  >
                    {f}次
                  </button>
                ))}
              </div>

              <label className="text-[13px] text-text-secondary font-medium block mb-3">训练强度</label>
              <div className="flex flex-col gap-3 mb-7">
                {intensityOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update('trainingIntensity', opt.value)}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer bg-glass transition-all ${
                      form.trainingIntensity === opt.value ? 'border-accent-blue shadow-[0_0_12px_rgba(10,132,255,0.2)]' : 'border-border-glass'
                    }`}
                  >
                    <span className="text-[15px] font-medium">{opt.label}</span>
                    <span className="text-[12px] text-text-tertiary">{opt.desc}</span>
                  </button>
                ))}
              </div>

              <label className="text-[13px] text-text-secondary font-medium block mb-3">7 天训练安排</label>
              <div className="flex flex-col gap-3">
                {form.trainingSchedule.map(day => (
                  <GlassCard key={day.dayIndex} padding="p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[13px] font-semibold">{weekDayNames[day.dayIndex]}</span>
                      <span className="text-[12px] text-accent-blue">{muscleGroupLabels[day.muscleGroup]}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {muscleOptions.map(group => (
                        <button
                          key={group}
                          onClick={() => updateTrainingDay(day.dayIndex, group)}
                          className={`h-9 rounded-lg border text-[11px] transition-all ${
                            day.muscleGroup === group ? 'gradient-accent text-white border-transparent' : 'bg-glass border-border-glass text-text-secondary'
                          }`}
                        >
                          {muscleGroupLabels[group]}
                        </button>
                      ))}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Check size={20} className="text-accent-blue" />
                <h2 className="text-[22px] font-semibold">计划预览</h2>
              </div>
              <p className="text-[14px] text-text-secondary mb-6">
                232 模式：2 天高碳、3 天中碳、2 天低碳，蛋白质每天一致。
              </p>

              <GlassCard variant="highlight" className="mb-4">
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <p className="text-text-tertiary mb-1">胚型</p>
                    <p className="font-semibold">{somatotypeLabels[form.somatotype]}</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary mb-1">当前体重</p>
                    <p className="font-semibold">{form.weight} kg</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary mb-1">训练频率</p>
                    <p className="font-semibold">每周 {form.trainingFrequency} 次</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary mb-1">初始体重日期</p>
                    <p className="font-semibold">{form.weightMeasuredDate}</p>
                  </div>
                </div>
              </GlassCard>

              <div className="flex flex-col gap-2.5">
                {previewPlans.map((plan, index) => (
                  <GlassCard key={plan.date} padding="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[14px] font-semibold">{weekDayNames[index]} · {plan.trainingLabel}</p>
                        <p className="text-[11px] text-text-tertiary">{plan.carbType === 'high' ? '高碳日' : plan.carbType === 'mid' ? '中碳日' : '低碳日'}</p>
                      </div>
                      <p className="text-[13px] font-semibold">{plan.calories} kcal</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[12px] text-text-secondary">
                      <span>碳水 {plan.carb}g</span>
                      <span>蛋白 {plan.protein}g</span>
                      <span>脂肪 {plan.fat}g</span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex-shrink-0">
        <Button fullWidth onClick={next}>
          {step === TOTAL_STEPS ? '生成我的碳循环计划' : '下一步'}
        </Button>
      </div>
    </div>
  );
}
