'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Camera, Pencil, Plus, RotateCcw, Trash2, Utensils, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import GlassCard from '@/components/ui/GlassCard';
import ProgressBar from '@/components/ui/ProgressBar';
import { showAppToast } from '@/components/ui/ToastHost';
import { track } from '@/lib/analytics/client';
import { groupMealsByType } from '@/lib/meal-groups';
import { calculateMealCalories, type FoodItem, type MealLog, mealTypeLabels, type MealType, sumMealMacros } from '@/lib/mock-data';
import { useMealStore } from '@/stores/useMealStore';
import { usePlanStore } from '@/stores/usePlanStore';
import { useUserStore } from '@/stores/useUserStore';
import { getTodayIso } from '@/lib/date-utils';

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
    confidence?: number;
    warnings?: string[];
  };
  error?: string;
  provider?: string;
  reviewProvider?: string;
}

export default function MealsPage() {
  const { user } = useUserStore();
  const { meals, loadMeals, addMeal, deleteMeal } = useMealStore();
  const { plans, loadPlans } = usePlanStore();
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<FoodItem[]>([]);
  const [carb, setCarb] = useState(0);
  const [protein, setProtein] = useState(0);
  const [fat, setFat] = useState(0);
  const [calories, setCalories] = useState(0);
  const [confidence, setConfidence] = useState<number | undefined>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isRecognizingPhoto, setIsRecognizingPhoto] = useState(false);
  const [recognitionStep, setRecognitionStep] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // 在组件内部计算今天的日期，确保每次渲染都是最新的
  const todayIso = useMemo(() => getTodayIso(), []);

  // 等待用户数据加载完成后再加载饮食记录
  useEffect(() => {
    if (user?.id) {
      loadMeals();
      loadPlans();
    }
  }, [user?.id, loadMeals, loadPlans]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  const todayMeals = useMemo(() => {
    console.log('[MealsPage] todayIso:', todayIso);
    console.log('[MealsPage] Total meals:', meals.length);
    console.log('[MealsPage] All meal dates:', meals.map(m => m.date));
    const filtered = meals.filter(meal => meal.date === todayIso);
    console.log('[MealsPage] Filtered today meals:', filtered.length);
    return filtered;
  }, [meals, todayIso]);
  const summary = useMemo(() => sumMealMacros(todayMeals), [todayMeals]);
  const todayMealGroups = useMemo(() => groupMealsByType(todayMeals), [todayMeals]);
  const todayPlan = plans.find(plan => plan.date === todayIso);
  const canSave = description.trim().length > 0 && (carb > 0 || protein > 0 || fat > 0 || calories > 0);
  const isWorking = isEstimating || isRecognizingPhoto;

  const applyEstimate = (estimate: NonNullable<EstimateResponse['estimate']>) => {
    if (estimate.description) setDescription(estimate.description);
    setItems(estimate.items || []);
    setCarb(estimate.carb);
    setProtein(estimate.protein);
    setFat(estimate.fat);
    setCalories(estimate.calories || calculateMealCalories(estimate));
    setConfidence(estimate.confidence);
    setWarnings(estimate.warnings || []);
    setEditMode(true);
  };

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

      applyEstimate(data.estimate);
      showAppToast('AI 已生成估算，请确认后保存。', 'success');
    } catch {
      setEditMode(true);
      showAppToast('AI 暂时无法估算，请手动填写营养数据。', 'error');
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
    setRecognitionStep('');
  };

  const clearPhoto = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setSelectedPhoto(null);
    setPhotoPreviewUrl(null);
    setRecognitionStep('');
  };

  const recognizePhoto = async () => {
    if (!selectedPhoto) {
      showAppToast('请先拍摄或选择餐食照片。', 'error');
      return;
    }

    setIsRecognizingPhoto(true);
    setRecognitionStep('正在压缩图片');
    try {
      const imageDataUrl = await fileToCompressedDataUrl(selectedPhoto);
      setRecognitionStep('正在识别食物');
      await pause(250);
      setRecognitionStep('正在估算重量');
      await pause(250);
      setRecognitionStep('正在计算营养');

      const response = await fetch('/api/nutrition-estimate/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl, mealType }),
      });
      const data = (await response.json()) as EstimateResponse;
      if (!response.ok || !data.estimate) throw new Error(data.error || '照片估算失败');

      applyEstimate(data.estimate);
      setRecognitionStep('请确认结果');
      track('photo_upload', {
        meal_type: mealType,
        confidence: data.estimate.confidence,
        source: 'vision_estimate',
        review_provider: data.reviewProvider || 'unknown',
      });
      showAppToast(data.reviewProvider ? '照片已识别并复核，请确认后保存。' : '照片已识别，请确认后保存。', 'success');
    } catch {
      setEditMode(true);
      setRecognitionStep('');
      showAppToast('照片暂时无法估算，请重拍或手动填写。', 'error');
    } finally {
      setIsRecognizingPhoto(false);
    }
  };

  const updateItem = (index: number, patch: Partial<FoodItem>) => {
    const nextItems = items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
    setItems(nextItems);
    syncTotalsFromItems(nextItems);
  };

  const syncTotalsFromItems = (nextItems: FoodItem[]) => {
    const totals = nextItems.reduce(
      (sum, item) => ({
        carb: sum.carb + item.carb,
        protein: sum.protein + item.protein,
        fat: sum.fat + item.fat,
        calories: sum.calories + (item.calories ?? calculateMealCalories(item)),
      }),
      { carb: 0, protein: 0, fat: 0, calories: 0 },
    );
    setCarb(Math.round(totals.carb));
    setProtein(Math.round(totals.protein));
    setFat(Math.round(totals.fat));
    setCalories(Math.round(totals.calories));
  };

  const saveMeal = () => {
    if (!canSave) {
      showAppToast('请确认食物描述和至少一项营养数据。', 'error');
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
      calories: calories || calculateMealCalories({ carb, protein, fat }),
      source: items.length ? 'ai' : 'manual',
      createdAt: new Date().toISOString(),
    };

    addMeal(meal);
    setDescription('');
    setItems([]);
    setCarb(0);
    setProtein(0);
    setFat(0);
    setCalories(0);
    setConfidence(undefined);
    setWarnings([]);
    setEditMode(false);
    clearPhoto();
    showAppToast('饮食记录已保存。', 'success');
  };

  return (
    <div className="px-5 pt-14 pb-32 min-h-dvh">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold">饮食记录</h1>
          <p className="text-[13px] text-text-tertiary mt-1">拍照估算每餐摄入，对比今日目标</p>
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

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />

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
            {recognitionStep && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className="text-[12px] text-text-secondary">{recognitionStep}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Button variant="secondary" fullWidth onClick={() => photoInputRef.current?.click()} disabled={isWorking}>
                <RotateCcw size={16} className="mr-1.5" />
                重新拍摄
              </Button>
              <Button variant="secondary" fullWidth onClick={recognizePhoto} disabled={isWorking}>
                <Camera size={16} className="mr-1.5" />
                {isRecognizingPhoto ? '识别中' : '拍照估算'}
              </Button>
            </div>
            <p className="text-[11px] text-text-tertiary mt-2">照片只用于本次识别，不会保存。结果是估算，称重会更准确。</p>
          </motion.div>
        )}

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="也可以直接输入：米饭半碗、鸡胸肉150g、青菜一份、奶茶半杯"
          className="w-full min-h-[88px] rounded-xl bg-transparent border border-white/10 px-4 py-3 text-[14px] text-text-primary outline-none focus:border-accent-blue resize-none mb-3"
        />

        {editMode && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {items.length > 0 && (
              <FoodReceipt
                items={items}
                confidence={confidence}
                warnings={warnings}
                onUpdate={updateItem}
              />
            )}

            <div className="grid grid-cols-4 gap-2 mb-4">
              <MacroInput label="热量" value={calories} unit="kcal" onChange={setCalories} />
              <MacroInput label="碳水" value={carb} unit="g" onChange={setCarb} />
              <MacroInput label="蛋白" value={protein} unit="g" onChange={setProtein} />
              <MacroInput label="脂肪" value={fat} unit="g" onChange={setFat} />
            </div>
            <Button fullWidth onClick={saveMeal}>确认并写入饮食记录</Button>
          </motion.div>
        )}
      </GlassCard>

      <p className="text-[13px] text-text-secondary font-medium mb-3">今日餐次</p>
      <div className="flex flex-col gap-2.5">
        {todayMealGroups.length > 0 ? todayMealGroups.map(group => (
          <GlassCard key={group.mealType} padding="px-4 py-3">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[14px] font-semibold">{mealTypeLabels[group.mealType]} · {Math.round(group.summary.calories)} kcal</p>
                <p className="text-[11px] text-text-tertiary mt-1">{group.meals.length} 条记录</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-right text-[11px] text-text-secondary shrink-0">
                <span>碳水 {Math.round(group.summary.carb)}g</span>
                <span>蛋白 {Math.round(group.summary.protein)}g</span>
                <span>脂肪 {Math.round(group.summary.fat)}g</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {group.meals.map(meal => (
                <div key={meal.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[12px] text-text-secondary line-clamp-2">{meal.description}</p>
                    <p className="text-[10px] text-text-tertiary mt-1">{meal.calories ?? calculateMealCalories(meal)} kcal</p>
                  </div>
                  <button onClick={() => deleteMeal(meal.id)} className="w-8 h-8 rounded-full bg-glass flex items-center justify-center shrink-0" aria-label="删除">
                    <Trash2 size={14} className="text-text-tertiary" />
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        )) : (
          <GlassCard padding="p-5" className="text-center">
            <p className="text-[14px] font-medium mb-1">今天还没有饮食记录</p>
            <p className="text-[12px] text-text-tertiary">从上方拍照或输入一餐，保存后这里会显示实际摄入。</p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

function FoodReceipt({
  items,
  confidence,
  warnings,
  onUpdate,
}: {
  items: FoodItem[];
  confidence?: number;
  warnings: string[];
  onUpdate: (index: number, patch: Partial<FoodItem>) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-text-secondary font-medium">AI 食物小票</p>
        {confidence !== undefined && <span className="text-[10px] text-text-tertiary">置信度 {Math.round(confidence * 100)}%</span>}
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="rounded-lg bg-black/10 p-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <input
                value={item.name}
                onChange={(event) => onUpdate(index, { name: event.target.value })}
                className="min-w-0 flex-1 bg-transparent border-none outline-none text-[13px] font-semibold text-text-primary"
              />
              <span className="text-[11px] text-text-tertiary shrink-0">{item.calories ?? calculateMealCalories(item)} kcal</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <MiniInput label="重量" value={item.weightGram ?? 0} unit="g" onChange={(value) => onUpdate(index, { weightGram: value })} />
              <MiniInput label="碳水" value={item.carb} unit="g" onChange={(value) => onUpdate(index, { carb: value })} />
              <MiniInput label="蛋白" value={item.protein} unit="g" onChange={(value) => onUpdate(index, { protein: value })} />
              <MiniInput label="脂肪" value={item.fat} unit="g" onChange={(value) => onUpdate(index, { fat: value })} />
            </div>
          </div>
        ))}
      </div>
      {warnings.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {warnings.map((warning, index) => (
            <p key={`${warning}-${index}`} className="text-[11px] text-text-tertiary">{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
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

function MacroInput({ label, value, unit, onChange }: { label: string; value: number; unit: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] text-text-tertiary block mb-1.5">{label}</span>
      <div className="rounded-xl border border-white/10 px-2 py-2 flex items-center gap-1">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          className="w-full bg-transparent border-none outline-none text-[14px] font-semibold text-text-primary"
        />
        <span className="text-[9px] text-text-tertiary">{unit}</span>
      </div>
    </label>
  );
}

function MiniInput({ label, value, unit, onChange }: { label: string; value: number; unit: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-[9px] text-text-tertiary block mb-1">{label}</span>
      <div className="rounded-lg border border-white/10 px-2 py-1.5 flex items-center gap-1">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          className="w-full bg-transparent border-none outline-none text-[12px] font-medium text-text-primary"
        />
        <span className="text-[8px] text-text-tertiary">{unit}</span>
      </div>
    </label>
  );
}

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const image = await loadImage(file);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not supported');
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    image.src = url;
  });
}

function pause(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
