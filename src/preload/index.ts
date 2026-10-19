import { contextBridge, ipcRenderer } from 'electron';
import {
  ProviderConfig,
  Conversation,
  AppSettings,
  StreamChunkEvent,
  StreamEndEvent,
  StreamErrorEvent,
  MessageAttachment,
} from '../shared/types';
import { SendMessageOptions } from '../main/engine/chat-engine';
import { IPC_CHANNELS } from '../main/ipc/channels';

export interface ElectronAPI {
  // Providers
  getProviders: () => Promise<(ProviderConfig & { isConfigured: boolean })[]>;
  saveProvider: (config: ProviderConfig) => Promise<{ success: boolean }>;
  deleteProvider: (id: string) => Promise<{ success: boolean }>;
  testProvider: (config: ProviderConfig) => Promise<any>;
  fetchModels: (config: ProviderConfig) => Promise<any>;

  // Conversations
  getConversations: () => Promise<Conversation[]>;
  createConversation: (conv: Conversation) => Promise<Conversation>;
  updateConversation: (conv: Partial<Conversation> & { id: string }) => Promise<{ success: boolean }>;
  deleteConversation: (id: string) => Promise<{ success: boolean }>;
  searchConversations: (query: string) => Promise<Conversation[]>;
  exportMarkdown: (conversationId: string) => Promise<{ success: boolean; filePath?: string }>;
  exportJson: () => Promise<{ success: boolean; filePath?: string }>;
  importJson: () => Promise<{ success: boolean; importedConversations: number; importedMessages: number; importedProviders: number }>;

  // Messages
  getMessages: (conversationId: string) => Promise<any[]>;
  sendMessage: (options: SendMessageOptions) => Promise<{ success: boolean }>;
  stopGeneration: (conversationId: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<{ success: boolean }>;

  // Documents
  selectFileDialog: () => Promise<MessageAttachment[]>;
  processFile: (filePath: string) => Promise<MessageAttachment>;
  processBuffer: (base64: string, filename: string, mimeType: string) => Promise<MessageAttachment>;

  // Settings & Diagnostics
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>;
  getDiagnostics: () => Promise<any[]>;
  clearDiagnostics: () => Promise<{ success: boolean }>;
  resetAllData: () => Promise<{ success: boolean; error?: string }>;

  // Window Controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  openExternal: (url: string) => void;

  // Stream Event Listeners
  onStreamChunk: (callback: (data: StreamChunkEvent) => void) => () => void;
  onStreamEnd: (callback: (data: StreamEndEvent) => void) => () => void;
  onStreamError: (callback: (data: StreamErrorEvent) => void) => () => void;
}

const api: ElectronAPI = {
  getProviders: () => ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_GET_ALL),
  saveProvider: (config) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_SAVE, config),
  deleteProvider: (id) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_DELETE, id),
  testProvider: (config) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_TEST, config),
  fetchModels: (config) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_FETCH_MODELS, config),

  getConversations: () => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_GET_ALL),
  createConversation: (conv) => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_CREATE, conv),
  updateConversation: (conv) => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_UPDATE, conv),
  deleteConversation: (id) => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_DELETE, id),
  searchConversations: (query) => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_SEARCH, query),
  exportMarkdown: (id) => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_EXPORT_MARKDOWN, id),
  exportJson: () => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_EXPORT_JSON),
  importJson: () => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_IMPORT_JSON),

  getMessages: (cid) => ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_GET_ALL, cid),
  sendMessage: (options) => ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_SEND, options),
  stopGeneration: (cid) => ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_STOP, cid),
  deleteMessage: (mid) => ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_DELETE, mid),

  selectFileDialog: () => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_SELECT_DIALOG),
  processFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_PROCESS_FILE, filePath),
  processBuffer: (base64, filename, mimeType) =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_PROCESS_BUFFER, base64, filename, mimeType),

  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
  getDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_GET),
  clearDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_CLEAR),
  resetAllData: () => ipcRenderer.invoke(IPC_CHANNELS.APP_RESET_DATA),

  minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  openExternal: (url) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),

  onStreamChunk: (callback) => {
    const handler = (_event: any, data: StreamChunkEvent) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.STREAM_CHUNK, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.STREAM_CHUNK, handler);
  },
  onStreamEnd: (callback) => {
    const handler = (_event: any, data: StreamEndEvent) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.STREAM_END, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.STREAM_END, handler);
  },
  onStreamError: (callback) => {
    const handler = (_event: any, data: StreamErrorEvent) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.STREAM_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.STREAM_ERROR, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
