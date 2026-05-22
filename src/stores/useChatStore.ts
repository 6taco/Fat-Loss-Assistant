import { create } from 'zustand';
import { getJson, sendJson } from '@/lib/client-api';
import { ChatMessage, UserProfile, mockChatMessages } from '@/lib/mock-data';
import { getItem, setItem, KEYS } from '@/lib/storage';

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  loadMessages: () => void;
  addMessage: (msg: ChatMessage) => void;
  setTyping: (v: boolean) => void;
}

function getLocalUserId() {
  return getItem<UserProfile | null>(KEYS.USER, null)?.id;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,

  loadMessages: () => {
    const messages = getItem<ChatMessage[]>(KEYS.CHAT, mockChatMessages);
    set({ messages });

    const userId = getLocalUserId();
    if (!userId) return;

    void getJson<{ messages: ChatMessage[] }>(`/api/chat-messages?userId=${encodeURIComponent(userId)}`).then((data) => {
      if (!data?.messages?.length) return;
      setItem(KEYS.CHAT, data.messages);
      set({ messages: data.messages });
    });
  },

  addMessage: (msg) => {
    const messages = [...get().messages, msg];
    setItem(KEYS.CHAT, messages);
    set({ messages });

    const userId = getLocalUserId();
    if (userId) void sendJson('/api/chat-messages', 'POST', { ...msg, userId });
  },

  setTyping: (isTyping) => set({ isTyping }),
}));
