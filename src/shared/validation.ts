import { z } from 'zod';

export const ApiProtocolSchema = z.enum(['openai-chat', 'openai-responses', 'custom-json']);
export const AuthMethodSchema = z.enum(['bearer', 'api-key-header', 'basic', 'custom-header', 'none']);

export const CustomJsonMappingSchema = z.object({
  requestTemplate: z.string().optional(),
  roleMapping: z.object({
    system: z.string().optional(),
    user: z.string().optional(),
    assistant: z.string().optional(),
    tool: z.string().optional(),
  }).optional(),
  modelField: z.string().optional(),
  messagesField: z.string().optional(),
  streamField: z.string().optional(),
  responsePath: z.string().optional(),
  streamChunkPath: z.string().optional(),
}).optional();

export const ProviderConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Provider name is required'),
  baseUrl: z.string().min(1, 'Base API URL is required'),
  chatEndpoint: z.string().min(1, 'Chat endpoint is required'),
  apiKey: z.string().default(''),
  modelListUrl: z.string().min(1, 'Model-list URL is required'),
  defaultModel: z.string().default(''),
  protocol: ApiProtocolSchema,
  authMethod: AuthMethodSchema,
  customHeaders: z.record(z.string()).default({}),
  customBodyParams: z.record(z.any()).default({}),
  requestTimeout: z.number().int().positive().default(60000),
  maxRetries: z.number().int().min(0).max(5).default(2),
  streamingEnabled: z.boolean().default(true),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  tenantId: z.string().optional(),
  apiVersion: z.string().optional(),
  modelListAuth: z.object({
    inherit: z.boolean().default(true),
    customHeaders: z.record(z.string()).optional(),
    authMethod: AuthMethodSchema.optional(),
    apiKey: z.string().optional(),
  }).optional(),
  fileUploadEndpoint: z.string().optional(),
  embeddingsEndpoint: z.string().optional(),
  customMapping: CustomJsonMappingSchema,
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
});

export const MessageAttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().optional(),
  size: z.number().nonnegative(),
  type: z.string(),
  strategy: z.enum(['local-extraction', 'provider-native']),
  extractedText: z.string().optional(),
  previewDataUrl: z.string().optional(),
  tokenEstimate: z.number().optional(),
  pageCount: z.number().optional(),
  isScanned: z.boolean().optional(),
  status: z.enum(['pending', 'success', 'warning', 'error']),
  errorMessage: z.string().optional(),
});

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  parentId: z.string().nullable().optional(),
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  reasoningContent: z.string().optional(),
  thinkingDurationMs: z.number().optional(),
  attachments: z.array(MessageAttachmentSchema).optional(),
  status: z.enum(['sending', 'streaming', 'completed', 'error', 'stopped']),
  errorMessage: z.string().optional(),
  tokenUsage: z.object({
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
    totalTokens: z.number().optional(),
  }).optional(),
  latencyMs: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const ConversationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  isPinned: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const AppSettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  fontSize: z.enum(['sm', 'md', 'lg']),
  density: z.enum(['comfortable', 'compact']),
  defaultSystemPrompt: z.string(),
  defaultTemperature: z.number(),
  defaultMaxTokens: z.number(),
  sendOnEnter: z.boolean(),
  localPdfOcrFallback: z.boolean(),
  contextWarningLimit: z.number(),
  activeProviderId: z.string().optional(),
});
