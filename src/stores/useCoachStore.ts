import { create } from 'zustand';
import { track } from '@/lib/analytics/client';
import { getJson, sendJson } from '@/lib/client-api';
import { syncLocalDataToServer } from '@/lib/client-sync';
import type { ActionProposal, CoachFeed } from '@/lib/mock-data';
import { getActiveAccount, getScopedKey } from '@/lib/accounts';
import { getItem, KEYS, setItem } from '@/lib/storage';

interface CoachState {
  feed: CoachFeed;
  isLoading: boolean;
  error: string;
  loadFeed: () => void;
  runDaily: () => Promise<void>;
  runWeekly: () => Promise<void>;
  acceptProposal: (id: string) => Promise<void>;
  dismissProposal: (id: string) => Promise<void>;
}

const emptyFeed: CoachFeed = {
  insights: [],
  proposals: [],
  notifications: [],
  memories: [],
};

function getLocalUserId() {
  const account = getActiveAccount();
  if (!account) return null;
  return getItem<{ id?: string } | null>(getScopedKey(KEYS.USER), null)?.id || account.id;
}

function getCoachFeedKey() {
  return getScopedKey('coach-feed');
}

export const useCoachStore = create<CoachState>((set, get) => ({
  feed: emptyFeed,
  isLoading: false,
  error: '',

  loadFeed: () => {
    const localFeed = getItem<CoachFeed>(getCoachFeedKey(), emptyFeed);
    set({ feed: normalizeFeed(localFeed), error: '' });

    const userId = getLocalUserId();
    if (!userId) return;

    set({ isLoading: true });
    void getJson<{ feed: CoachFeed }>(`/api/coach/feed?userId=${encodeURIComponent(userId)}`).then(data => {
      const feed = normalizeFeed(data?.feed || localFeed);
      setItem(getCoachFeedKey(), feed);
      set({ feed, isLoading: false });
    });
  },

  runDaily: async () => {
    await syncLocalDataToServer();
    const userId = getLocalUserId();
    if (!userId) return;

    set({ isLoading: true, error: '' });
    const data = await sendJson<{ feed: CoachFeed; error?: string; warning?: string; source?: string }>('/api/coach/run-daily', 'POST', { userId, force: true });
    if (!data?.feed) {
      set({ isLoading: false, error: data?.error || data?.warning || '每日教练分析生成失败，请稍后重试。' });
      return;
    }
    const feed = normalizeFeed(data.feed);
    setItem(getCoachFeedKey(), feed);
    set({
      feed,
      isLoading: false,
      error: data.source === 'local' ? (data.warning || '教练数据暂未写入数据库，请检查数据库连接。') : '',
    });
  },

  runWeekly: async () => {
    await syncLocalDataToServer();
    const userId = getLocalUserId();
    if (!userId) return;

    set({ isLoading: true, error: '' });
    const data = await sendJson<{ feed: CoachFeed; error?: string; warning?: string; source?: string }>('/api/coach/run-weekly', 'POST', { userId, force: true });
    if (!data?.feed) {
      set({ isLoading: false, error: data?.error || data?.warning || '每周教练策略生成失败，请稍后重试。' });
      return;
    }
    const feed = normalizeFeed(data.feed);
    setItem(getCoachFeedKey(), feed);
    set({
      feed,
      isLoading: false,
      error: data.source === 'local' ? (data.warning || '教练数据暂未写入数据库，请检查数据库连接。') : '',
    });
  },

  acceptProposal: async (id: string) => {
    await syncLocalDataToServer();
    const userId = getLocalUserId();
    if (!userId) return;

    set({ isLoading: true, error: '' });
    const data = await sendJson<{ proposal: ActionProposal; error?: string }>(`/api/coach/proposals/${id}/accept`, 'POST', { userId });
    if (!data?.proposal) {
      set({ isLoading: false, error: data?.error || '采纳建议失败。' });
      return;
    }
    const feed = {
      ...get().feed,
      proposals: get().feed.proposals.filter(proposal => proposal.id !== id),
      memories: get().feed.memories,
    };
    setItem(getCoachFeedKey(), feed);
    set({ feed, isLoading: false });
    track('proposal_accept', {
      proposal_id: id,
      proposal_type: data.proposal.type,
      origin: 'coach_feed',
    }, { userId });
    get().loadFeed();
  },

  dismissProposal: async (id: string) => {
    const userId = getLocalUserId();
    if (!userId) return;

    set({ isLoading: true, error: '' });
    const data = await sendJson<{ proposal: ActionProposal; error?: string }>(`/api/coach/proposals/${id}/dismiss`, 'POST', { userId });
    if (!data?.proposal) {
      set({ isLoading: false, error: data?.error || '忽略建议失败。' });
      return;
    }
    const feed = { ...get().feed, proposals: get().feed.proposals.filter(proposal => proposal.id !== id) };
    setItem(getCoachFeedKey(), feed);
    set({ feed, isLoading: false });
    track('proposal_dismiss', {
      proposal_id: id,
      proposal_type: data.proposal.type,
      origin: 'coach_feed',
    }, { userId });
    get().loadFeed();
  },
}));

function normalizeFeed(feed: Partial<CoachFeed> | null | undefined): CoachFeed {
  return {
    insights: Array.isArray(feed?.insights) ? feed.insights : [],
    proposals: Array.isArray(feed?.proposals)
      ? feed.proposals.map(normalizeProposal)
      : [],
    notifications: Array.isArray(feed?.notifications) ? feed.notifications : [],
    memories: Array.isArray(feed?.memories) ? feed.memories : [],
  };
}

function normalizeProposal(proposal: any): ActionProposal {
  return {
    ...proposal,
    toolName: proposal.toolName,
    executionState: proposal.executionState || 'pending_confirmation',
    diffPreview: proposal.diffPreview,
    approvedAt: proposal.approvedAt,
    approvedByUserId: proposal.approvedByUserId,
  };
}
