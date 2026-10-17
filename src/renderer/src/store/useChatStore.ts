import { create } from 'zustand';
import {
  Conversation,
  ChatMessage,
  MessageAttachment,
  StreamChunkEvent,
  StreamEndEvent,
  StreamErrorEvent,
} from '@shared/types';
import { useProviderStore } from './useProviderStore';
import { useSettingsStore } from './useSettingsStore';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  messages: ChatMessage[];
  attachments: MessageAttachment[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  searchQuery: string;
  selectedAttachmentForModal: MessageAttachment | null;

  init: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  createConversation: (providerId?: string, modelId?: string) => Promise<Conversation | null>;
  updateConversation: (updates: Partial<Conversation> & { id: string }) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  search: (query: string) => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;

  addAttachment: (att: MessageAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  setSelectedAttachmentForModal: (att: MessageAttachment | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeConversation: null,
  messages: [],
  attachments: [],
  isStreaming: false,
  streamingMessageId: null,
  searchQuery: '',
  selectedAttachmentForModal: null,

  init: async () => {
    if (!window.electronAPI) return;

    // Load initial conversations
    const convs = await window.electronAPI.getConversations();
    set({ conversations: convs });

    if (convs.length > 0) {
      await get().selectConversation(convs[0].id);
    }

    // Subscribe to IPC stream events
    window.electronAPI.onStreamChunk((data: StreamChunkEvent) => {
      const { conversationId, messageId, fullText } = data;
      if (conversationId === get().activeConversationId) {
        set((state) => {
          const hasTarget = state.messages.some((m) => m.id === messageId);
          if (hasTarget) {
            return {
              isStreaming: true,
              streamingMessageId: messageId,
              messages: state.messages.map((m) =>
                m.id === messageId ? { ...m, content: fullText, status: 'streaming' } : m
              ),
            };
          }
          // Fallback: match the active streaming assistant message
          const lastIdx = state.messages.findLastIndex(
            (m) => m.role === 'assistant' && (m.status === 'streaming' || m.id === state.streamingMessageId)
          );
          if (lastIdx !== -1) {
            const next = [...state.messages];
            next[lastIdx] = {
              ...next[lastIdx],
              id: messageId,
              content: fullText,
              status: 'streaming',
            };
            return {
              isStreaming: true,
              streamingMessageId: messageId,
              messages: next,
            };
          }
          return {
            isStreaming: true,
            streamingMessageId: messageId,
          };
        });
      }
    });

    window.electronAPI.onStreamEnd((data: StreamEndEvent) => {
      const { conversationId, messageId, fullText, tokenUsage, latencyMs, finishReason } = data;
      if (conversationId === get().activeConversationId) {
        set((state) => {
          const finalStatus = finishReason === 'cancelled' ? 'stopped' : 'completed';
          const hasTarget = state.messages.some((m) => m.id === messageId);
          if (hasTarget) {
            return {
              isStreaming: false,
              streamingMessageId: null,
              messages: state.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      content: fullText,
                      status: finalStatus,
                      tokenUsage,
                      latencyMs,
                    }
                  : m
              ),
            };
          }
          const lastIdx = state.messages.findLastIndex(
            (m) => m.role === 'assistant' && (m.status === 'streaming' || m.id === state.streamingMessageId)
          );
          if (lastIdx !== -1) {
            const next = [...state.messages];
            next[lastIdx] = {
              ...next[lastIdx],
              id: messageId,
              content: fullText,
              status: finalStatus,
              tokenUsage,
              latencyMs,
            };
            return {
              isStreaming: false,
              streamingMessageId: null,
              messages: next,
            };
          }
          return {
            isStreaming: false,
            streamingMessageId: null,
          };
        });
      }
      // Reload conversations to update timestamps
      window.electronAPI.getConversations().then((updated) => set({ conversations: updated }));
    });

    window.electronAPI.onStreamError((data: StreamErrorEvent) => {
      const { conversationId, messageId, error } = data;
      if (conversationId === get().activeConversationId) {
        set((state) => {
          const hasTarget = state.messages.some((m) => m.id === messageId);
          if (hasTarget) {
            return {
              isStreaming: false,
              streamingMessageId: null,
              messages: state.messages.map((m) =>
                m.id === messageId ? { ...m, status: 'error', errorMessage: error } : m
              ),
            };
          }
          const lastIdx = state.messages.findLastIndex(
            (m) => m.role === 'assistant' && (m.status === 'streaming' || m.id === state.streamingMessageId)
          );
          if (lastIdx !== -1) {
            const next = [...state.messages];
            next[lastIdx] = {
              ...next[lastIdx],
              id: messageId,
              status: 'error',
              errorMessage: error,
            };
            return {
              isStreaming: false,
              streamingMessageId: null,
              messages: next,
            };
          }
          return {
            isStreaming: false,
            streamingMessageId: null,
          };
        });
      }
    });
  },

  selectConversation: async (id: string) => {
    if (!window.electronAPI) return;
    const conv = get().conversations.find((c) => c.id === id) || null;
    const msgs = await window.electronAPI.getMessages(id);
    set({
      activeConversationId: id,
      activeConversation: conv,
      messages: msgs,
      attachments: [],
      isStreaming: false,
      streamingMessageId: null,
    });

    // If conversation has provider, sync with provider store
    if (conv?.providerId) {
      useProviderStore.getState().setActiveProvider(conv.providerId);
    }
  },

  createConversation: async (providerId, modelId) => {
    if (!window.electronAPI) return null;
    const provStore = useProviderStore.getState();
    const activeProv = provStore.activeProvider || provStore.providers[0];

    const pId = providerId || activeProv?.id || '';
    const mId = modelId || activeProv?.defaultModel || provStore.models[0]?.id || 'default';

    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: 'New Conversation',
      providerId: pId,
      modelId: mId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const created = await window.electronAPI.createConversation(newConv);
    const updated = await window.electronAPI.getConversations();
    set({ conversations: updated });
    await get().selectConversation(created.id);
    return created;
  },

  updateConversation: async (updates) => {
    if (!window.electronAPI) return;
    await window.electronAPI.updateConversation(updates);
    const convs = await window.electronAPI.getConversations();
    const active = convs.find((c) => c.id === get().activeConversationId) || null;
    set({ conversations: convs, activeConversation: active });
  },

  deleteConversation: async (id: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.deleteConversation(id);
    const convs = await window.electronAPI.getConversations();
    set({ conversations: convs });

    if (get().activeConversationId === id) {
      if (convs.length > 0) {
        await get().selectConversation(convs[0].id);
      } else {
        set({ activeConversationId: null, activeConversation: null, messages: [] });
      }
    }
  },

  search: async (query: string) => {
    set({ searchQuery: query });
    if (!window.electronAPI) return;
    const res = await window.electronAPI.searchConversations(query);
    set({ conversations: res });
  },

  sendMessage: async (content: string) => {
    const { activeConversationId, attachments, isStreaming } = get();
    if (!content.trim() && attachments.length === 0) return;
    if (isStreaming) return;

    let convId = activeConversationId;
    if (!convId) {
      const created = await get().createConversation();
      if (!created) return;
      convId = created.id;
    }

    const currentConv = get().conversations.find((c) => c.id === convId);
    const provStore = useProviderStore.getState();
    const settingsStore = useSettingsStore.getState();

    const providerId = currentConv?.providerId || provStore.activeProviderId || undefined;
    const modelId = currentConv?.modelId || provStore.activeProvider?.defaultModel || undefined;

    // Optimistically add user message and pending assistant message
    const tempUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'user',
      content,
      attachments: [...attachments],
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const tempAssistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now() + 1,
      updatedAt: Date.now() + 1,
    };

    set((state) => ({
      messages: [...state.messages, tempUserMsg, tempAssistantMsg],
      attachments: [],
      isStreaming: true,
      streamingMessageId: tempAssistantMsg.id,
    }));

    try {
      const res = await window.electronAPI.sendMessage({
        conversationId: convId,
        content,
        attachments: tempUserMsg.attachments,
        systemPrompt: currentConv?.systemPrompt || settingsStore.settings.defaultSystemPrompt,
        temperature: currentConv?.temperature ?? settingsStore.settings.defaultTemperature,
        maxTokens: currentConv?.maxTokens ?? settingsStore.settings.defaultMaxTokens,
        topP: currentConv?.topP,
        providerId,
        modelId,
        messageId: tempAssistantMsg.id,
        userMessageId: tempUserMsg.id,
      });

      // Synchronize fresh messages directly from the database to present full output all at once
      const dbMsgs = await window.electronAPI.getMessages(convId);
      if (dbMsgs && dbMsgs.length > 0) {
        set({
          messages: dbMsgs,
          isStreaming: false,
          streamingMessageId: null,
        });
      } else if (res && res.fullText) {
        set((state) => ({
          isStreaming: false,
          streamingMessageId: null,
          messages: state.messages.map((m) =>
            m.id === tempAssistantMsg.id
              ? { ...m, content: res.fullText, status: res.status || 'completed' }
              : m
          ),
        }));
      } else {
        set({
          isStreaming: false,
          streamingMessageId: null,
        });
      }

      // Update conversations list to sync any automatic title/timestamp updates
      const updatedConvs = await window.electronAPI.getConversations();
      set({ conversations: updatedConvs });
    } catch (err: any) {
      set((state) => ({
        isStreaming: false,
        streamingMessageId: null,
        messages: state.messages.map((m) =>
          m.id === tempAssistantMsg.id
            ? { ...m, status: 'error', errorMessage: err.message || 'Failed to send message' }
            : m
        ),
      }));
    }
  },

  stopGeneration: async () => {
    const { activeConversationId, isStreaming } = get();
    if (!activeConversationId || !isStreaming) return;
    if (window.electronAPI) {
      await window.electronAPI.stopGeneration(activeConversationId);
    }
    set({ isStreaming: false, streamingMessageId: null });
  },

  retryMessage: async (messageId: string) => {
    const { messages } = get();
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    // Find preceding user message
    let userMsg: ChatMessage | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i];
        break;
      }
    }

    if (!userMsg) return;

    // Remove the failed message and resend
    await window.electronAPI.deleteMessage(messageId);
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }));

    await get().sendMessage(userMsg.content);
  },

  deleteMessage: async (messageId: string) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteMessage(messageId);
    }
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }));
  },

  addAttachment: (att: MessageAttachment) => {
    set((state) => ({ attachments: [...state.attachments, att] }));
  },

  removeAttachment: (id: string) => {
    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id),
    }));
  },

  clearAttachments: () => {
    set({ attachments: [] });
  },

  setSelectedAttachmentForModal: (att: MessageAttachment | null) => {
    set({ selectedAttachmentForModal: att });
  },
}));
