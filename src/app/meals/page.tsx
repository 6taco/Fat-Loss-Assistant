'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Camera, Pencil, Plus, RotateCcw, Trash2, Utensils, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import GlassCard from '@/components/ui/GlassCard';
import ProgressBar from '@/components/ui/ProgressBar';
import { showAppToast } from '@/components/ui/ToastHost';
import { calculateMealCalories, FoodItem, MealLog, mealTypeLabels, MealType, sumMealMacros } from '@/lib/mock-data';
import { useMealStore } from '@/stores/useMealStore';
import { usePlanStore } from '@/stores/usePlanStore';

const todayIso = new Date().toISOString().slice(0, 10);
const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const maxPhotoSize = 5 * 1024 * 1024;

interface EstimateResponse {
  estimate?: {
    description?: string;
    items: FoodItem[];
    carb: number;
    protein: number;
    fat: number;
    calories: number;
  };
  error?: string;
}

export default function MealsPage() {
  const { meals, loadMeals, addMeal, deleteMeal } = useMealStore();
  const { plans, loadPlans } = usePlanStore();
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<FoodItem[]>([]);
  const [carb, setCarb] = useState(0);
  const [protein, setProtein] = useState(0);
  const [fat, setFat] = useState(0);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isRecognizingPhoto, setIsRecognizingPhoto] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadMeals();
    loadPlans();
  }, [loadMeals, loadPlans]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  const todayMeals = useMemo(() => meals.filter(meal => meal.date === todayIso), [meals]);
  const summary = useMemo(() => sumMealMacros(todayMeals), [todayMeals]);
  const todayPlan = plans.find(plan => plan.date === todayIso);
  const calories = calculateMealCalories({ carb, protein, fat });
  const canSave = description.trim().length > 0 && (carb > 0 || protein > 0 || fat > 0);
  const isWorking = isEstimating || isRecognizingPhoto;

  const estimate = async () => {
    const text = description.trim();
    if (!text) {
      showAppToast('请先输入这一餐吃了什么。', 'error');
      return;
    }

    setIsEstimating(true);
    try {
      const response = await fetch('/api/nutrition-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text, mealType }),
      });
      const data = (await response.json()) as EstimateResponse;
      if (!response.ok || !data.estimate) throw new Error(data.error || 'AI 估算失败');

      setItems(data.estimate.items);
      setCarb(data.estimate.carb);
      setProtein(data.estimate.protein);
      setFat(data.estimate.fat);
      setEditMode(true);
      showAppToast('AI 已生成估算，请确认后保存。', 'success');
    } catch {
      setItems([]);
      setCarb(0);
      setProtein(0);
      setFat(0);
      setEditMode(true);
      showAppToast('AI 暂时无法估算，请手动填写三大营养。', 'error');
    } finally {
      setIsEstimating(false);
    }
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showAppToast('请选择餐食照片。', 'error');
      return;
    }
    if (file.size > maxPhotoSize) {
      showAppToast('照片不能超过 5MB，请重新拍摄。', 'error');
      return;
    }

    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setSelectedPhoto(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setSelectedPhoto(null);
    setPhotoPreviewUrl(null);
  };

  const recognizePhoto = async () => {
    if (!selectedPhoto) {
      showAppToast('请先拍摄或选择餐食照片。', 'error');
      return;
    }

    setIsRecognizingPhoto(true);
    try {
      const imageDataUrl = await fileToDataUrl(selectedPhoto);
      const response = await fetch('/api/nutrition-estimate/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl, mealType }),
      });
      const data = (await response.json()) as EstimateResponse;
      if (!response.ok || !data.estimate) throw new Error(data.error || '照片估算失败');

      if (data.estimate.description) setDescription(data.estimate.description);
      setItems(data.estimate.items);
      setCarb(data.estimate.carb);
      setProtein(data.estimate.protein);
      setFat(data.estimate.fat);
      setEditMode(true);
      showAppToast('照片已生成估算，请确认后保存。', 'success');
    } catch {
      setEditMode(true);
      showAppToast('照片暂时无法估算，请重试或手动填写。', 'error');
    } finally {
      setIsRecognizingPhoto(false);
    }
  };

  const saveMeal = () => {
    if (!canSave) {
      showAppToast('请填写食物描述和至少一项营养素。', 'error');
      return;
    }

    const meal: MealLog = {
      id: `meal-${Date.now()}`,
      date: todayIso,
      mealType,
      description: description.trim(),
      items,
      carb,
      protein,
      fat,
      calories,
      source: items.length ? 'ai' : 'manual',
      createdAt: new Date().toISOString(),
    };

    addMeal(meal);
    setDescription('');
    setItems([]);
    setCarb(0);
    setProtein(0);
    setFat(0);
    setEditMode(false);
    clearPhoto();
    showAppToast('饮食记录已保存。', 'success');
  };

  return (
    <div className="px-5 pt-14 pb-32 min-h-dvh">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold">饮食记录</h1>
          <p className="text-[13px] text-text-tertiary mt-1">记录每餐摄入，对比今日目标</p>
        </div>
        <div className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center">
          <Utensils size={18} className="text-white" />
        </div>
      </div>

      <GlassCard variant="highlight" className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-medium">今日摄入</p>
          <span className="text-[11px] text-text-tertiary">{todayMeals.length} 餐</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MacroBox label="碳水" current={summary.carb} target={todayPlan?.carb} color="#0A84FF" />
          <MacroBox label="蛋白" current={summary.protein} target={todayPlan?.protein} color="#30D158" />
          <MacroBox label="脂肪" current={summary.fat} target={todayPlan?.fat} color="#FFD60A" />
        </div>
        {todayPlan ? (
          <div className="flex flex-col gap-3">
            <MacroProgress label="碳水" current={summary.carb} target={todayPlan.carb} color="#0A84FF" />
            <MacroProgress label="蛋白" current={summary.protein} target={todayPlan.protein} color="#30D158" />
            <MacroProgress label="脂肪" current={summary.fat} target={todayPlan.fat} color="#FFD60A" />
          </div>
        ) : (
          <p className="text-[12px] text-text-tertiary">暂无今日计划目标，完成信息采集后可对比目标。</p>
        )}
      </GlassCard>

      <GlassCard className="mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-accent-blue" />
          <p className="text-[15px] font-semibold">记录一餐</p>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {mealTypes.map(type => (
            <button
              key={type}
              onClick={() => setMealType(type)}
              className={`h-10 rounded-xl border text-[12px] font-medium transition-all ${
                mealType === type ? 'gradient-accent text-white border-transparent' : 'bg-glass border-border-glass text-text-secondary'
              }`}
            >
              {mealTypeLabels[type]}
            </button>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="例如：米饭一碗、鸡胸肉150g、鸡蛋2个"
          className="w-full min-h-[96px] rounded-xl bg-transparent border border-white/10 px-4 py-3 text-[14px] text-text-primary outline-none focus:border-accent-blue resize-none mb-3"
        />

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />

        {photoPreviewUrl && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-glass aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreviewUrl} alt="餐食照片预览" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute right-2 top-2 w-8 h-8 rounded-full bg-black/55 flex items-center justify-center"
                aria-label="移除照片"
                disabled={isWorking}
              >
                <X size={16} className="text-white" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Button variant="secondary" fullWidth onClick={() => photoInputRef.current?.click()} disabled={isWorking}>
                <RotateCcw size={16} className="mr-1.5" />
                重新拍摄
              </Button>
              <Button variant="secondary" fullWidth onClick={recognizePhoto} disabled={isWorking}>
                <Camera size={16} className="mr-1.5" />
                {isRecognizingPhoto ? '估算中' : '估算照片'}
              </Button>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-4">
          <Button variant="secondary" fullWidth onClick={() => photoInputRef.current?.click()} disabled={isWorking} className="px-2 text-[13px]">
            <Camera size={16} className="mr-1.5" />
            拍照
          </Button>
          <Button variant="secondary" fullWidth onClick={estimate} disabled={isWorking} className="px-2 text-[13px]">
            <Bot size={16} className="mr-1.5" />
            {isEstimating ? '估算中' : 'AI 估算'}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setEditMode(true)} disabled={isWorking} className="px-2 text-[13px]">
            <Pencil size={16} className="mr-1.5" />
            手动填写
          </Button>
        </div>

        {editMode && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {items.length > 0 && (
              <div className="rounded-xl bg-glass p-3 mb-4">
                <p className="text-[12px] text-text-secondary font-medium mb-2">AI 食物拆分</p>
                <div className="flex flex-col gap-2">
                  {items.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="text-text-primary">{item.name}{item.amountText ? ` · ${item.amountText}` : ''}</span>
                      <span className="text-text-tertiary shrink-0">碳 {item.carb} / 蛋 {item.protein} / 脂 {item.fat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-4">
              <MacroInput label="碳水" value={carb} onChange={setCarb} />
              <MacroInput label="蛋白" value={protein} onChange={setProtein} />
              <MacroInput label="脂肪" value={fat} onChange={setFat} />
            </div>
            <div className="flex items-center justify-between mb-4 text-[12px] text-text-tertiary">
              <span>估算热量</span>
              <span className="text-text-primary font-semibold">{calories} kcal</span>
            </div>
            <Button fullWidth onClick={saveMeal}>保存这一餐</Button>
          </motion.div>
        )}
      </GlassCard>

      <p className="text-[13px] text-text-secondary font-medium mb-3">今日餐次</p>
      <div className="flex flex-col gap-2.5">
        {todayMeals.length > 0 ? todayMeals.map(meal => (
          <GlassCard key={meal.id} padding="px-4 py-3">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">{mealTypeLabels[meal.mealType]} · {meal.calories ?? calculateMealCalories(meal)} kcal</p>
                <p className="text-[12px] text-text-secondary mt-1 line-clamp-2">{meal.description}</p>
              </div>
              <button onClick={() => deleteMeal(meal.id)} className="w-8 h-8 rounded-full bg-glass flex items-center justify-center shrink-0" aria-label="删除">
                <Trash2 size={14} className="text-text-tertiary" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[12px] text-text-secondary">
              <span>碳水 {meal.carb}g</span>
              <span>蛋白 {meal.protein}g</span>
              <span>脂肪 {meal.fat}g</span>
            </div>
          </GlassCard>
        )) : (
          <GlassCard padding="p-5" className="text-center">
            <p className="text-[14px] font-medium mb-1">今天还没有饮食记录</p>
            <p className="text-[12px] text-text-tertiary">从上方输入一餐食物，保存后这里会显示实际摄入。</p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image data'));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

function MacroBox({ label, current, target, color }: { label: string; current: number; target?: number; color: string }) {
  const diff = target === undefined ? null : Math.round(target - current);
  return (
    <div className="rounded-xl bg-glass px-3 py-3">
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      <p className="text-[18px] font-bold" style={{ color }}>{Math.round(current)}g</p>
      <p className="text-[10px] text-text-tertiary mt-1">
        {diff === null ? '暂无目标' : diff >= 0 ? `剩 ${diff}g` : `超 ${Math.abs(diff)}g`}
      </p>
    </div>
  );
}

function MacroProgress({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const value = target > 0 ? Math.min(120, (current / target) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-text-secondary">{label}</span>
        <span className="text-[12px] font-medium">{Math.round(current)} / {target}g</span>
      </div>
      <ProgressBar value={value} color={color} />
    </div>
  );
}

function MacroInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-text-tertiary block mb-1.5">{label}</span>
      <div className="rounded-xl border border-white/10 px-3 py-2 flex items-center gap-1">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          className="w-full bg-transparent border-none outline-none text-[15px] font-semibold text-text-primary"
        />
        <span className="text-[11px] text-text-tertiary">g</span>
      </div>
    </label>
  );
}
