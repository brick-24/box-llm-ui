export type ApiProtocol = 'openai-chat' | 'openai-responses' | 'custom-json';

export type AuthMethod = 'bearer' | 'api-key-header' | 'basic' | 'custom-header' | 'none';

export interface CustomJsonMapping {
  requestTemplate?: string;
  roleMapping?: {
    system?: string;
    user?: string;
    assistant?: string;
    tool?: string;
  };
  modelField?: string;
  messagesField?: string;
  streamField?: string;
  responsePath?: string;
  streamChunkPath?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  chatEndpoint: string;
  apiKey: string;
  modelListUrl: string;
  defaultModel: string;
  protocol: ApiProtocol;
  authMethod: AuthMethod;
  customHeaders: Record<string, string>;
  customBodyParams: Record<string, any>;
  requestTimeout: number; // in milliseconds
  maxRetries: number;
  streamingEnabled: boolean;
  organizationId?: string;
  projectId?: string;
  tenantId?: string;
  apiVersion?: string;
  modelListAuth?: {
    inherit: boolean;
    customHeaders?: Record<string, string>;
    authMethod?: AuthMethod;
    apiKey?: string;
  };
  fileUploadEndpoint?: string;
  embeddingsEndpoint?: string;
  customMapping?: CustomJsonMapping;
  createdAt: number;
  updatedAt: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  maxOutputTokens?: number;
  defaultOutputTokens?: number;
  isCustom?: boolean;
}

export type AttachmentStrategy = 'local-extraction' | 'provider-native';
export type ExtractionStatus = 'pending' | 'success' | 'warning' | 'error';

export interface MessageAttachment {
  id: string;
  name: string;
  path?: string;
  size: number;
  type: string;
  strategy: AttachmentStrategy;
  extractedText?: string;
  previewDataUrl?: string; // base64 thumbnail for images
  tokenEstimate?: number;
  pageCount?: number;
  isScanned?: boolean;
  status: ExtractionStatus;
  errorMessage?: string;
}

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
export type MessageStatus = 'sending' | 'streaming' | 'completed' | 'error' | 'stopped';

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  parentId?: string | null;
  role: MessageRole;
  content: string;
  reasoningContent?: string;
  thinkingDurationMs?: number;
  attachments?: MessageAttachment[];
  status: MessageStatus;
  errorMessage?: string;
  tokenUsage?: TokenUsage;
  latencyMs?: number;
  finishReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  providerId: string;
  modelId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  fontSize: 'sm' | 'md' | 'lg';
  density: 'comfortable' | 'compact';
  defaultSystemPrompt: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  sendOnEnter: boolean;
  localPdfOcrFallback: boolean;
  contextWarningLimit: number;
  activeProviderId?: string;
}

export interface DiagnosticLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  category: 'api' | 'stream' | 'document' | 'storage' | 'security';
  message: string;
  details?: Record<string, any>;
}

export interface StreamChunkEvent {
  conversationId: string;
  messageId: string;
  delta: string;
  fullText: string;
  reasoningDelta?: string;
  reasoningFullText?: string;
}

export interface StreamEndEvent {
  conversationId: string;
  messageId: string;
  fullText: string;
  reasoningFullText?: string;
  thinkingDurationMs?: number;
  tokenUsage?: TokenUsage;
  latencyMs?: number;
  finishReason?: string;
}

export interface StreamErrorEvent {
  conversationId: string;
  messageId: string;
  error: string;
  details?: Record<string, any>;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  details?: Record<string, any>;
}
