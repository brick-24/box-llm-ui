import { create } from 'zustand';
import {
  Conversation,
  ChatMessage,
  MessageStatus,
  MessageAttachment,
  StreamChunkEvent,
  StreamEndEvent,
  StreamErrorEvent,
  WorkspaceTreeNode,
  WorkspaceFilePreview,
} from '@shared/types';
import { useProviderStore } from './useProviderStore';
import { useSettingsStore } from './useSettingsStore';
import { buildBranchTree, SiblingInfo } from '../utils/branching';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  allMessages: ChatMessage[];
  messages: ChatMessage[];
  siblingsMap: Map<string, SiblingInfo>;
  activeBranchMap: Record<string, string>;
  attachments: MessageAttachment[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  searchQuery: string;
  selectedAttachmentForModal: MessageAttachment | null;
  isWebBrowsing: boolean;
  activeBrowserDrawerUrl: string | null;
  activeBrowserDrawerTitle: string | null;
  activeBrowserDrawerScreenshot: string | null;
  activeBrowserDrawerMarkdown: string | null;

  // Workspace & Coding Engine State
  workspacePath: string | null;
  isWorkspaceDrawerOpen: boolean;
  workspaceTree: { tree: WorkspaceTreeNode; summary: string; totalFiles: number; totalDirs: number } | null;
  selectedPreviewFile: WorkspaceFilePreview | null;
  isLoadingTree: boolean;

  init: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  createConversation: (providerId?: string, modelId?: string) => Promise<Conversation | null>;
  updateConversation: (updates: Partial<Conversation> & { id: string }) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  toggleWebBrowsing: () => void;
  setWebBrowsing: (enabled: boolean) => void;
  openBrowserDrawer: (url: string, title?: string, screenshot?: string, markdown?: string) => void;
  closeBrowserDrawer: () => void;

  // Workspace Actions
  setWorkspacePath: (path: string | null) => Promise<void>;
  selectWorkspaceDialog: () => Promise<void>;
  toggleWorkspaceDrawer: () => void;
  loadWorkspaceTree: () => Promise<void>;
  openFilePreview: (relativePath: string) => Promise<void>;
  closeFilePreview: () => void;
  openWorkspaceInExplorer: () => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  editAndBranchMessage: (targetMessageId: string, newContent: string) => Promise<void>;
  regenerateMessage: (assistantMessageId: string) => Promise<void>;
  switchBranch: (messageId: string, direction: 'prev' | 'next') => void;
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
  allMessages: [],
  messages: [],
  siblingsMap: new Map(),
  activeBranchMap: {},
  attachments: [],
  isStreaming: false,
  streamingMessageId: null,
  searchQuery: '',
  selectedAttachmentForModal: null,
  isWebBrowsing: false,
  activeBrowserDrawerUrl: null,
  activeBrowserDrawerTitle: null,
  activeBrowserDrawerScreenshot: null,
  activeBrowserDrawerMarkdown: null,
  workspacePath: null,
  isWorkspaceDrawerOpen: false,
  workspaceTree: null,
  selectedPreviewFile: null,
  isLoadingTree: false,

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
      const { conversationId, messageId, fullText, reasoningFullText } = data;
      if (conversationId === get().activeConversationId) {
        set((state) => {
          const hasTarget = state.allMessages.some((m) => m.id === messageId);
          let nextAll: ChatMessage[];

          if (hasTarget) {
            nextAll = state.allMessages.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    content: fullText,
                    reasoningContent: reasoningFullText ?? m.reasoningContent,
                    status: 'streaming',
                  }
                : m
            );
          } else {
            const lastIdx = state.allMessages.findLastIndex(
              (m: ChatMessage) => m.role === 'assistant' && (m.status === 'streaming' || m.id === state.streamingMessageId)
            );
            if (lastIdx !== -1) {
              nextAll = [...state.allMessages];
              nextAll[lastIdx] = {
                ...nextAll[lastIdx],
                id: messageId,
                content: fullText,
                reasoningContent: reasoningFullText ?? nextAll[lastIdx].reasoningContent,
                status: 'streaming',
              };
            } else {
              return { isStreaming: true, streamingMessageId: messageId };
            }
          }

          const { activeMessages, siblingsMap, activeBranchMap } = buildBranchTree(
            nextAll,
            state.activeBranchMap
          );

          return {
            allMessages: nextAll,
            messages: activeMessages,
            siblingsMap,
            activeBranchMap,
            isStreaming: true,
            streamingMessageId: messageId,
          };
        });
      }
    });

    window.electronAPI.onStreamEnd((data: StreamEndEvent) => {
      const {
        conversationId,
        messageId,
        fullText,
        reasoningFullText,
        thinkingDurationMs,
        tokenUsage,
        latencyMs,
        finishReason,
        citations,
        toolCalls,
      } = data;

      if (conversationId === get().activeConversationId) {
        set((state) => {
          const finalStatus = finishReason === 'cancelled' ? 'stopped' : 'completed';
          let nextAll: ChatMessage[];
          const hasTarget = state.allMessages.some((m) => m.id === messageId);

          if (hasTarget) {
            nextAll = state.allMessages.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    content: fullText,
                    reasoningContent: reasoningFullText ?? m.reasoningContent,
                    thinkingDurationMs: thinkingDurationMs ?? m.thinkingDurationMs,
                    status: finalStatus,
                    tokenUsage,
                    latencyMs,
                    finishReason,
                    citations: citations ?? m.citations,
                    toolCalls: toolCalls ?? m.toolCalls,
                  }
                : m
            );
          } else {
            const lastIdx = state.allMessages.findLastIndex(
              (m: ChatMessage) => m.role === 'assistant' && (m.status === 'streaming' || m.id === state.streamingMessageId)
            );
            if (lastIdx !== -1) {
              nextAll = [...state.allMessages];
              nextAll[lastIdx] = {
                ...nextAll[lastIdx],
                id: messageId,
                content: fullText,
                reasoningContent: reasoningFullText ?? nextAll[lastIdx].reasoningContent,
                thinkingDurationMs: thinkingDurationMs ?? nextAll[lastIdx].thinkingDurationMs,
                status: finalStatus,
                tokenUsage,
                latencyMs,
                finishReason,
                citations: citations ?? nextAll[lastIdx].citations,
                toolCalls: toolCalls ?? nextAll[lastIdx].toolCalls,
              };
            } else {
              return { isStreaming: false, streamingMessageId: null };
            }
          }

          const { activeMessages, siblingsMap, activeBranchMap } = buildBranchTree(
            nextAll,
            state.activeBranchMap
          );

          return {
            allMessages: nextAll,
            messages: activeMessages,
            siblingsMap,
            activeBranchMap,
            isStreaming: false,
            streamingMessageId: null,
          };
        });
      }
      // Reload conversations to update timestamps
      window.electronAPI.getConversations().then((updated) => set({ conversations: updated }));
      // Auto-refresh workspace tree if workspace is active
      if (get().workspacePath) {
        get().loadWorkspaceTree();
      }
    });

    window.electronAPI.onStreamError((data: StreamErrorEvent) => {
      const { conversationId, messageId, error } = data;
      if (conversationId === get().activeConversationId) {
        set((state) => {
          let nextAll: ChatMessage[];
          const hasTarget = state.allMessages.some((m) => m.id === messageId);

          if (hasTarget) {
            nextAll = state.allMessages.map((m) =>
              m.id === messageId ? { ...m, status: 'error' as MessageStatus, errorMessage: error } : m
            );
          } else {
            const lastIdx = state.allMessages.findLastIndex(
              (m: ChatMessage) => m.role === 'assistant' && (m.status === 'streaming' || m.id === state.streamingMessageId)
            );
            if (lastIdx !== -1) {
              nextAll = [...state.allMessages];
              nextAll[lastIdx] = {
                ...nextAll[lastIdx],
                id: messageId,
                status: 'error' as MessageStatus,
                errorMessage: error,
              };
            } else {
              return { isStreaming: false, streamingMessageId: null };
            }
          }

          const { activeMessages, siblingsMap, activeBranchMap } = buildBranchTree(
            nextAll,
            state.activeBranchMap
          );

          return {
            allMessages: nextAll,
            messages: activeMessages,
            siblingsMap,
            activeBranchMap,
            isStreaming: false,
            streamingMessageId: null,
          };
        });
      }
    });

    window.electronAPI.onToolCallUpdate?.((data: any) => {
      const { conversationId, messageId, toolCall } = data;
      if (conversationId === get().activeConversationId) {
        set((state) => {
          let nextAll: ChatMessage[];
          const hasTarget = state.allMessages.some((m) => m.id === messageId);

          const updateCalls = (existingCalls?: any[]) => {
            const list = existingCalls ? [...existingCalls] : [];
            const idx = list.findIndex((c) => c.id === toolCall.id);
            if (idx !== -1) {
              list[idx] = toolCall;
            } else {
              list.push(toolCall);
            }
            return list;
          };

          if (hasTarget) {
            nextAll = state.allMessages.map((m) =>
              m.id === messageId ? { ...m, toolCalls: updateCalls(m.toolCalls) } : m
            );
          } else {
            const lastIdx = state.allMessages.findLastIndex(
              (m: ChatMessage) => m.role === 'assistant' && (m.status === 'streaming' || m.id === state.streamingMessageId)
            );
            if (lastIdx !== -1) {
              nextAll = [...state.allMessages];
              nextAll[lastIdx] = {
                ...nextAll[lastIdx],
                toolCalls: updateCalls(nextAll[lastIdx].toolCalls),
              };
            } else {
              return {};
            }
          }

          const { activeMessages, siblingsMap, activeBranchMap } = buildBranchTree(
            nextAll,
            state.activeBranchMap
          );

          return {
            allMessages: nextAll,
            messages: activeMessages,
            siblingsMap,
            activeBranchMap,
          };
        });
      }
    });

    window.electronAPI.onToolCommandOutput?.((data: any) => {
      const { conversationId, messageId, toolCallId, totalOutput } = data;
      if (conversationId === get().activeConversationId) {
        set((state) => {
          let nextAll: ChatMessage[];
          const hasTarget = state.allMessages.some((m) => m.id === messageId);

          const updateOutput = (existingCalls?: any[]) => {
            if (!existingCalls) return [];
            return existingCalls.map((c) =>
              c.id === toolCallId ? { ...c, streamingOutput: totalOutput } : c
            );
          };

          if (hasTarget) {
            nextAll = state.allMessages.map((m) =>
              m.id === messageId ? { ...m, toolCalls: updateOutput(m.toolCalls) } : m
            );
          } else {
            const lastIdx = state.allMessages.findLastIndex(
              (m: ChatMessage) => m.role === 'assistant' && (m.status === 'streaming' || m.id === state.streamingMessageId)
            );
            if (lastIdx !== -1) {
              nextAll = [...state.allMessages];
              nextAll[lastIdx] = {
                ...nextAll[lastIdx],
                toolCalls: updateOutput(nextAll[lastIdx].toolCalls),
              };
            } else {
              return {};
            }
          }

          const { activeMessages, siblingsMap, activeBranchMap } = buildBranchTree(
            nextAll,
            state.activeBranchMap
          );

          return {
            allMessages: nextAll,
            messages: activeMessages,
            siblingsMap,
            activeBranchMap,
          };
        });
      }
    });
  },

  selectConversation: async (id: string) => {
    if (!window.electronAPI) return;
    const conv = get().conversations.find((c) => c.id === id) || null;
    const msgs = await window.electronAPI.getMessages(id);
    const { activeMessages, siblingsMap, activeBranchMap } = buildBranchTree(msgs, {});

    const defaultWeb = useSettingsStore.getState().settings.defaultWebBrowsing;
    const wp = conv?.workspacePath || null;
    set({
      activeConversationId: id,
      activeConversation: conv,
      isWebBrowsing: conv?.webBrowsingEnabled !== undefined ? Boolean(conv.webBrowsingEnabled) : defaultWeb,
      workspacePath: wp,
      allMessages: msgs,
      messages: activeMessages,
      siblingsMap,
      activeBranchMap,
      attachments: [],
      isStreaming: false,
      streamingMessageId: null,
      selectedPreviewFile: null,
    });

    if (wp) {
      get().loadWorkspaceTree();
    } else {
      set({ workspaceTree: null });
    }

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
    const defaultWeb = useSettingsStore.getState().settings.defaultWebBrowsing;

    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: 'New Conversation',
      providerId: pId,
      modelId: mId,
      webBrowsingEnabled: defaultWeb,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const created = await window.electronAPI.createConversation(newConv);
    const updated = await window.electronAPI.getConversations();
    set({ conversations: updated, isWebBrowsing: defaultWeb });
    await get().selectConversation(created.id);
    return created;
  },

  toggleWebBrowsing: () => {
    const nextVal = !get().isWebBrowsing;
    set({ isWebBrowsing: nextVal });
    const { activeConversationId } = get();
    if (activeConversationId) {
      get().updateConversation({ id: activeConversationId, webBrowsingEnabled: nextVal });
    }
  },

  setWebBrowsing: (enabled: boolean) => {
    set({ isWebBrowsing: enabled });
    const { activeConversationId } = get();
    if (activeConversationId) {
      get().updateConversation({ id: activeConversationId, webBrowsingEnabled: enabled });
    }
  },

  openBrowserDrawer: (url: string, title?: string, screenshot?: string, markdown?: string) => {
    set({
      activeBrowserDrawerUrl: url,
      activeBrowserDrawerTitle: title || url,
      activeBrowserDrawerScreenshot: screenshot || null,
      activeBrowserDrawerMarkdown: markdown || null,
    });
  },

  closeBrowserDrawer: () => {
    set({
      activeBrowserDrawerUrl: null,
      activeBrowserDrawerTitle: null,
      activeBrowserDrawerScreenshot: null,
      activeBrowserDrawerMarkdown: null,
    });
  },

  setWorkspacePath: async (path: string | null) => {
    const { activeConversationId } = get();
    set({ workspacePath: path });
    if (activeConversationId) {
      await get().updateConversation({ id: activeConversationId, workspacePath: path || undefined });
    }
    if (path) {
      await get().loadWorkspaceTree();
    } else {
      set({ workspaceTree: null, selectedPreviewFile: null });
    }
  },

  selectWorkspaceDialog: async () => {
    if (!window.electronAPI) return;
    const path = await window.electronAPI.selectWorkspaceDialog();
    if (path) {
      await get().setWorkspacePath(path);
    }
  },

  toggleWorkspaceDrawer: () => {
    set((state) => ({ isWorkspaceDrawerOpen: !state.isWorkspaceDrawerOpen }));
  },

  loadWorkspaceTree: async () => {
    const { workspacePath } = get();
    if (!workspacePath || !window.electronAPI) {
      set({ workspaceTree: null, isLoadingTree: false });
      return;
    }
    set({ isLoadingTree: true });
    try {
      const data = await window.electronAPI.getWorkspaceTree(workspacePath);
      set({ workspaceTree: data, isLoadingTree: false });
    } catch {
      set({ workspaceTree: null, isLoadingTree: false });
    }
  },

  openFilePreview: async (relativePath: string) => {
    const { workspacePath } = get();
    if (!workspacePath || !window.electronAPI) return;
    try {
      const preview = await window.electronAPI.readWorkspaceFile(workspacePath, relativePath);
      if (preview) {
        set({ selectedPreviewFile: preview });
      }
    } catch (err) {
      console.error('Failed to preview file:', err);
    }
  },

  closeFilePreview: () => {
    set({ selectedPreviewFile: null });
  },

  openWorkspaceInExplorer: async () => {
    const { workspacePath } = get();
    if (!workspacePath || !window.electronAPI) return;
    await window.electronAPI.openWorkspaceInExplorer(workspacePath);
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
        set({
          activeConversationId: null,
          activeConversation: null,
          allMessages: [],
          messages: [],
          siblingsMap: new Map(),
          activeBranchMap: {},
        });
      }
    }
  },

  search: async (query: string) => {
    set({ searchQuery: query });
    if (!window.electronAPI) return;
    const res = await window.electronAPI.searchConversations(query);
    set({ conversations: res });
  },

  switchBranch: (messageId: string, direction: 'prev' | 'next') => {
    const { allMessages, siblingsMap, activeBranchMap } = get();
    const info = siblingsMap.get(messageId);
    if (!info || info.total <= 1) return;

    const targetIdx = direction === 'prev' ? info.index - 1 : info.index + 1;
    if (targetIdx < 0 || targetIdx >= info.total) return;

    const targetSibling = info.siblings[targetIdx];
    const targetMsg = allMessages.find((m) => m.id === messageId);
    const parentKey = targetMsg?.parentId || 'root';

    const nextBranchMap = {
      ...activeBranchMap,
      [parentKey]: targetSibling.id,
    };

    const recomputed = buildBranchTree(allMessages, nextBranchMap);
    set({
      messages: recomputed.activeMessages,
      siblingsMap: recomputed.siblingsMap,
      activeBranchMap: recomputed.activeBranchMap,
    });
  },

  sendMessage: async (content: string) => {
    const { activeConversationId, attachments, isStreaming, messages } = get();
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

    const providerId = provStore.activeProviderId || currentConv?.providerId || undefined;
    const modelId = currentConv?.modelId || provStore.activeProvider?.defaultModel || undefined;

    if (currentConv && providerId && (currentConv.providerId !== providerId || currentConv.modelId !== modelId)) {
      get().updateConversation({
        id: currentConv.id,
        providerId,
        modelId: modelId || currentConv.modelId,
      });
    }

    // Connect to the end of the current linear branch
    const parentId = messages.length > 0 ? messages[messages.length - 1].id : null;

    const tempUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: convId,
      parentId,
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
      parentId: tempUserMsg.id,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now() + 1,
      updatedAt: Date.now() + 1,
    };

    const nextBranchMap = {
      ...get().activeBranchMap,
      [parentId || 'root']: tempUserMsg.id,
      [tempUserMsg.id]: tempAssistantMsg.id,
    };

    const nextAll = [...get().allMessages, tempUserMsg, tempAssistantMsg];
    const recomputed = buildBranchTree(nextAll, nextBranchMap);

    set({
      allMessages: nextAll,
      messages: recomputed.activeMessages,
      siblingsMap: recomputed.siblingsMap,
      activeBranchMap: recomputed.activeBranchMap,
      attachments: [],
      isStreaming: true,
      streamingMessageId: tempAssistantMsg.id,
    });

    try {
      await window.electronAPI.sendMessage({
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
        parentId,
        webBrowsing: get().isWebBrowsing,
        workspacePath: get().workspacePath || currentConv?.workspacePath || undefined,
      });

      const dbMsgs = await window.electronAPI.getMessages(convId);
      if (dbMsgs && dbMsgs.length > 0) {
        const fresh = buildBranchTree(dbMsgs, get().activeBranchMap);
        set({
          allMessages: dbMsgs,
          messages: fresh.activeMessages,
          siblingsMap: fresh.siblingsMap,
          activeBranchMap: fresh.activeBranchMap,
          isStreaming: false,
          streamingMessageId: null,
        });
      } else {
        set({ isStreaming: false, streamingMessageId: null });
      }

      const updatedConvs = await window.electronAPI.getConversations();
      set({ conversations: updatedConvs });
    } catch (err: any) {
      set((state) => {
        const nextAllMessages: ChatMessage[] = state.allMessages.map((m) =>
          m.id === tempAssistantMsg.id
            ? { ...m, status: 'error' as MessageStatus, errorMessage: err.message || 'Failed to send message' }
            : m
        );
        const fresh = buildBranchTree(nextAllMessages, state.activeBranchMap);
        return {
          allMessages: nextAllMessages,
          messages: fresh.activeMessages,
          siblingsMap: fresh.siblingsMap,
          activeBranchMap: fresh.activeBranchMap,
          isStreaming: false,
          streamingMessageId: null,
        };
      });
    }
  },

  editAndBranchMessage: async (targetMessageId: string, newContent: string) => {
    const { activeConversationId, allMessages, activeBranchMap, isStreaming } = get();
    if (!newContent.trim() || isStreaming || !activeConversationId) return;

    const targetMsg = allMessages.find((m) => m.id === targetMessageId);
    if (!targetMsg) return;

    const currentConv = get().conversations.find((c) => c.id === activeConversationId);
    const provStore = useProviderStore.getState();
    const settingsStore = useSettingsStore.getState();

    const providerId = provStore.activeProviderId || currentConv?.providerId || undefined;
    const modelId = currentConv?.modelId || provStore.activeProvider?.defaultModel || undefined;

    const newForkedUserMsgId = crypto.randomUUID();
    const newAssistantMsgId = crypto.randomUUID();

    const parentId = targetMsg.parentId || null;
    const parentKey = parentId || 'root';

    const tempUserMsg: ChatMessage = {
      id: newForkedUserMsgId,
      conversationId: activeConversationId,
      parentId,
      role: 'user',
      content: newContent,
      attachments: targetMsg.attachments ? [...targetMsg.attachments] : [],
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const tempAssistantMsg: ChatMessage = {
      id: newAssistantMsgId,
      conversationId: activeConversationId,
      parentId: newForkedUserMsgId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now() + 1,
      updatedAt: Date.now() + 1,
    };

    const nextBranchMap = {
      ...activeBranchMap,
      [parentKey]: newForkedUserMsgId,
      [newForkedUserMsgId]: newAssistantMsgId,
    };

    const nextAll = [...allMessages, tempUserMsg, tempAssistantMsg];
    const { activeMessages, siblingsMap, activeBranchMap: updatedBranchMap } = buildBranchTree(
      nextAll,
      nextBranchMap
    );

    set({
      allMessages: nextAll,
      messages: activeMessages,
      siblingsMap,
      activeBranchMap: updatedBranchMap,
      isStreaming: true,
      streamingMessageId: newAssistantMsgId,
    });

    try {
      await window.electronAPI.sendMessage({
        conversationId: activeConversationId,
        content: newContent,
        attachments: tempUserMsg.attachments,
        systemPrompt: currentConv?.systemPrompt || settingsStore.settings.defaultSystemPrompt,
        temperature: currentConv?.temperature ?? settingsStore.settings.defaultTemperature,
        maxTokens: currentConv?.maxTokens ?? settingsStore.settings.defaultMaxTokens,
        topP: currentConv?.topP,
        providerId,
        modelId,
        messageId: newAssistantMsgId,
        userMessageId: newForkedUserMsgId,
        parentId,
        webBrowsing: get().isWebBrowsing,
        workspacePath: get().workspacePath || currentConv?.workspacePath || undefined,
      });

      const dbMsgs = await window.electronAPI.getMessages(activeConversationId);
      const recomputed = buildBranchTree(dbMsgs, get().activeBranchMap);
      set({
        allMessages: dbMsgs,
        messages: recomputed.activeMessages,
        siblingsMap: recomputed.siblingsMap,
        activeBranchMap: recomputed.activeBranchMap,
        isStreaming: false,
        streamingMessageId: null,
      });

      const updatedConvs = await window.electronAPI.getConversations();
      set({ conversations: updatedConvs });
    } catch (err: any) {
      set((state) => {
        const nextAllMessages: ChatMessage[] = state.allMessages.map((m) =>
          m.id === newAssistantMsgId
            ? { ...m, status: 'error' as MessageStatus, errorMessage: err.message || 'Failed to send message' }
            : m
        );
        const recomputed = buildBranchTree(nextAllMessages, state.activeBranchMap);
        return {
          allMessages: nextAllMessages,
          messages: recomputed.activeMessages,
          siblingsMap: recomputed.siblingsMap,
          activeBranchMap: recomputed.activeBranchMap,
          isStreaming: false,
          streamingMessageId: null,
        };
      });
    }
  },

  regenerateMessage: async (assistantMessageId: string) => {
    const { activeConversationId, allMessages, activeBranchMap, isStreaming } = get();
    if (isStreaming || !activeConversationId) return;

    const assistantMsg = allMessages.find((m) => m.id === assistantMessageId);
    if (!assistantMsg) return;

    let parentUserMsg: ChatMessage | null = null;
    if (assistantMsg.parentId) {
      parentUserMsg = allMessages.find((m) => m.id === assistantMsg.parentId) || null;
    }
    if (!parentUserMsg) {
      const idx = allMessages.findIndex((m) => m.id === assistantMessageId);
      for (let i = idx - 1; i >= 0; i--) {
        if (allMessages[i].role === 'user') {
          parentUserMsg = allMessages[i];
          break;
        }
      }
    }

    if (!parentUserMsg) return;

    const currentConv = get().conversations.find((c) => c.id === activeConversationId);
    const provStore = useProviderStore.getState();
    const settingsStore = useSettingsStore.getState();

    const providerId = provStore.activeProviderId || currentConv?.providerId || undefined;
    const modelId = currentConv?.modelId || provStore.activeProvider?.defaultModel || undefined;

    const newAssistantMsgId = crypto.randomUUID();

    const tempAssistantMsg: ChatMessage = {
      id: newAssistantMsgId,
      conversationId: activeConversationId,
      parentId: parentUserMsg.id,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const nextBranchMap = {
      ...activeBranchMap,
      [parentUserMsg.id]: newAssistantMsgId,
    };

    const nextAll = [...allMessages, tempAssistantMsg];
    const { activeMessages, siblingsMap, activeBranchMap: updatedBranchMap } = buildBranchTree(
      nextAll,
      nextBranchMap
    );

    set({
      allMessages: nextAll,
      messages: activeMessages,
      siblingsMap,
      activeBranchMap: updatedBranchMap,
      isStreaming: true,
      streamingMessageId: newAssistantMsgId,
    });

    try {
      await window.electronAPI.sendMessage({
        conversationId: activeConversationId,
        content: parentUserMsg.content,
        attachments: parentUserMsg.attachments,
        systemPrompt: currentConv?.systemPrompt || settingsStore.settings.defaultSystemPrompt,
        temperature: currentConv?.temperature ?? settingsStore.settings.defaultTemperature,
        maxTokens: currentConv?.maxTokens ?? settingsStore.settings.defaultMaxTokens,
        topP: currentConv?.topP,
        providerId,
        modelId,
        messageId: newAssistantMsgId,
        userMessageId: parentUserMsg.id,
        parentId: parentUserMsg.id,
        isRegeneration: true,
        webBrowsing: get().isWebBrowsing,
        workspacePath: get().workspacePath || currentConv?.workspacePath || undefined,
      });

      const dbMsgs = await window.electronAPI.getMessages(activeConversationId);
      const recomputed = buildBranchTree(dbMsgs, get().activeBranchMap);
      set({
        allMessages: dbMsgs,
        messages: recomputed.activeMessages,
        siblingsMap: recomputed.siblingsMap,
        activeBranchMap: recomputed.activeBranchMap,
        isStreaming: false,
        streamingMessageId: null,
      });

      const updatedConvs = await window.electronAPI.getConversations();
      set({ conversations: updatedConvs });
    } catch (err: any) {
      set((state) => {
        const nextAllMessages: ChatMessage[] = state.allMessages.map((m) =>
          m.id === newAssistantMsgId
            ? { ...m, status: 'error' as MessageStatus, errorMessage: err.message || 'Failed to regenerate response' }
            : m
        );
        const recomputed = buildBranchTree(nextAllMessages, state.activeBranchMap);
        return {
          allMessages: nextAllMessages,
          messages: recomputed.activeMessages,
          siblingsMap: recomputed.siblingsMap,
          activeBranchMap: recomputed.activeBranchMap,
          isStreaming: false,
          streamingMessageId: null,
        };
      });
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
    // Retrying a message triggers regeneration on that turn
    await get().regenerateMessage(messageId);
  },

  deleteMessage: async (messageId: string) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteMessage(messageId);
    }
    set((state) => {
      const nextAll = state.allMessages.filter((m) => m.id !== messageId);
      const recomputed = buildBranchTree(nextAll, state.activeBranchMap);
      return {
        allMessages: nextAll,
        messages: recomputed.activeMessages,
        siblingsMap: recomputed.siblingsMap,
        activeBranchMap: recomputed.activeBranchMap,
      };
    });
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
