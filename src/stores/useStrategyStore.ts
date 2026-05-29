import { create } from 'zustand';
import { track } from '@/lib/analytics/client';
import { getActiveAccount, getScopedKey } from '@/lib/accounts';
import { getJson, sendJson } from '@/lib/client-api';
import { getItem, KEYS, setItem } from '@/lib/storage';
import type {
  ActiveStrategy,
  StrategyCurrentResponse,
  StrategyRecommendation,
  StrategyProposalDto,
  UserLifestyleProfile,
} from '@/lib/strategy-engine/types';

interface StrategyState {
  currentStrategy: ActiveStrategy | null;
  recommendation: StrategyRecommendation | null;
  proposals: StrategyProposalDto[];
  executionRate: number;
  isLoading: boolean;
  error: string;
  loadCurrent: () => void;
  saveLifestyle: (profile: Partial<UserLifestyleProfile>) => Promise<UserLifestyleProfile | null>;
  recommend: (profile?: Partial<UserLifestyleProfile>) => Promise<StrategyRecommendation | null>;
  activate: (strategyType?: StrategyRecommendation['strategyType']) => Promise<(StrategyCurrentResponse & { plans?: unknown[] }) | null>;
  recheck: () => Promise<void>;
}

function getLocalUserId() {
  const account = getActiveAccount();
  if (!account) return null;
  return getItem<{ id?: string } | null>(getScopedKey(KEYS.USER), null)?.id || account.id;
}

export const useStrategyStore = create<StrategyState>((set, get) => ({
  currentStrategy: null,
  recommendation: null,
  proposals: [],
  executionRate: 0,
  isLoading: false,
  error: '',

  loadCurrent: () => {
    const local = getItem<StrategyCurrentResponse | null>(getScopedKey(KEYS.STRATEGY), null);
    if (local) {
      set({
        currentStrategy: local.strategy,
        recommendation: local.recommendation,
        proposals: local.adjustmentProposals || [],
        executionRate: local.executionRate || 0,
      });
    }

    const userId = getLocalUserId();
    if (!userId) return;
    set({ isLoading: true, error: '' });
    void getJson<StrategyCurrentResponse>(`/api/strategy/current?userId=${encodeURIComponent(userId)}`).then(data => {
      if (!data?.recommendation) {
        set({ isLoading: false, error: '策略引擎暂时不可用。' });
        return;
      }
      setItem(getScopedKey(KEYS.STRATEGY), data);
      set({
        currentStrategy: data.strategy,
        recommendation: data.recommendation,
        proposals: data.adjustmentProposals || [],
        executionRate: data.executionRate || 0,
        isLoading: false,
      });
      track('strategy_recommend_view', {
        strategy_type: data.recommendation.strategyType,
        confidence: data.recommendation.confidence,
      }, { userId });
    });
  },

  saveLifestyle: async (profile) => {
    const userId = getLocalUserId();
    if (!userId) return null;
    const data = await sendJson<{ profile: UserLifestyleProfile }>('/api/user-lifestyle-profile', 'PATCH', { ...profile, userId });
    if (data?.profile) setItem(getScopedKey(KEYS.LIFESTYLE_PROFILE), data.profile);
    return data?.profile || null;
  },

  recommend: async (profile) => {
    const userId = getLocalUserId();
    if (!userId) return null;
    set({ isLoading: true, error: '' });
    const data = await sendJson<{ recommendation: StrategyRecommendation }>('/api/strategy/recommend', 'POST', { userId, lifestyle: profile });
    if (!data?.recommendation) {
      set({ isLoading: false, error: '策略推荐生成失败。' });
      return null;
    }
    set({ recommendation: data.recommendation, isLoading: false });
    track('strategy_recommend_view', {
      strategy_type: data.recommendation.strategyType,
      confidence: data.recommendation.confidence,
    }, { userId });
    return data.recommendation;
  },

  activate: async (strategyType) => {
    const userId = getLocalUserId();
    if (!userId) return null;
    const recommendation = get().recommendation;
    set({ isLoading: true, error: '' });
    const data = await sendJson<StrategyCurrentResponse & { plans?: unknown[] }>('/api/strategy/activate', 'POST', {
      userId,
      strategyType: strategyType || recommendation?.strategyType,
      intensity: recommendation?.intensity,
      startDate: new Date().toISOString().slice(0, 10),
    });
    if (!data?.strategy) {
      set({ isLoading: false, error: '策略激活失败。' });
      return null;
    }
    const current = await getJson<StrategyCurrentResponse>(`/api/strategy/current?userId=${encodeURIComponent(userId)}`);
    const cacheValue = current || {
      strategy: data.strategy,
      recommendation: data.recommendation || recommendation,
      todayPlan: undefined,
      executionRate: 0,
      adjustmentProposals: [],
      source: 'db' as const,
    };
    setItem(getScopedKey(KEYS.STRATEGY), cacheValue);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('strategy-cache-change'));
    set({
      currentStrategy: current?.strategy || data.strategy,
      recommendation: current?.recommendation || data.recommendation || recommendation,
      proposals: current?.adjustmentProposals || [],
      executionRate: current?.executionRate || 0,
      isLoading: false,
    });
    track('strategy_recommend_accept', {
      strategy_type: data.strategy.strategyType,
      intensity: data.strategy.intensity,
    }, { userId });
    return current || data;
  },

  recheck: async () => {
    const userId = getLocalUserId();
    if (!userId) return;
    set({ isLoading: true, error: '' });
    await sendJson('/api/strategy/recheck', 'POST', { userId });
    set({ isLoading: false });
    get().loadCurrent();
  },
}));
