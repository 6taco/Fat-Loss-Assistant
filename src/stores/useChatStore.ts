import { create } from 'zustand';
import { getJson, sendJson } from '@/lib/client-api';
import { ChatMessage, UserProfile } from '@/lib/types';
import { getItem, setItem, KEYS } from '@/lib/storage';
import { getScopedKey } from '@/lib/accounts';
import { isFreshData } from '@/lib/staleness';

// Local history is capped so long-term use cannot exhaust the ~5MB
// localStorage quota (the server list endpoint is capped at 500 as well).
const LOCAL_MESSAGE_LIMIT = 500;

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  lastFetchedAt: number;
  loadMessages: () => void;
  addMessage: (msg: ChatMessage) => void;
  setTyping: (v: boolean) => void;
}

function getLocalUserId() {
  return getItem<UserProfile | null>(getScopedKey(KEYS.USER), null)?.id;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,
  lastFetchedAt: 0,

  loadMessages: () => {
    if (isFreshData(get().lastFetchedAt)) return;
    const messages = getItem<ChatMessage[]>(getScopedKey(KEYS.CHAT), []).slice(-LOCAL_MESSAGE_LIMIT);
    set({ messages });

    const userId = getLocalUserId();
    if (!userId) return;

    void getJson<{ messages: ChatMessage[] }>(`/api/chat-messages?userId=${encodeURIComponent(userId)}`).then((data) => {
      if (!data?.messages?.length) return;
      const capped = data.messages.slice(-LOCAL_MESSAGE_LIMIT);
      setItem(getScopedKey(KEYS.CHAT), capped);
      set({ messages: capped, lastFetchedAt: Date.now() });
    });
  },

  addMessage: (msg) => {
    const messages = [...get().messages, msg].slice(-LOCAL_MESSAGE_LIMIT);
    setItem(getScopedKey(KEYS.CHAT), messages);
    set({ messages, lastFetchedAt: Date.now() });

    const userId = getLocalUserId();
    if (userId) void sendJson('/api/chat-messages', 'POST', { ...msg, userId });
  },

  setTyping: (isTyping) => set({ isTyping }),
}));
