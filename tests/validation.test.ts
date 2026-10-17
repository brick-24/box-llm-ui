import { describe, it, expect } from 'vitest';
import {
  ProviderConfigSchema,
  ChatMessageSchema,
  ConversationSchema,
  AppSettingsSchema,
} from '../src/shared/validation';
import { DEFAULT_SETTINGS } from '../src/shared/constants';

describe('Zod Schema Validation', () => {
  it('validates a valid ProviderConfig successfully', () => {
    const validConfig = {
      id: 'openai-1',
      name: 'OpenAI Production',
      baseUrl: 'https://api.openai.com/v1',
      chatEndpoint: '/chat/completions',
      apiKey: 'sk-abcdef',
      modelListUrl: 'https://api.openai.com/v1/models',
      defaultModel: 'gpt-4o',
      protocol: 'openai-chat',
      authMethod: 'bearer',
      customHeaders: {},
      customBodyParams: {},
      requestTimeout: 60000,
      maxRetries: 2,
      streamingEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const parsed = ProviderConfigSchema.parse(validConfig);
    expect(parsed.name).toBe('OpenAI Production');
    expect(parsed.streamingEnabled).toBe(true);
  });

  it('rejects an invalid ProviderConfig with missing required fields', () => {
    const invalidConfig = {
      name: '',
      baseUrl: '',
    };

    expect(() => ProviderConfigSchema.parse(invalidConfig)).toThrow();
  });

  it('validates ChatMessage schema', () => {
    const msg = {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Can you summarize this document?',
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const parsed = ChatMessageSchema.parse(msg);
    expect(parsed.role).toBe('user');
  });

  it('validates AppSettings default schema', () => {
    const parsed = AppSettingsSchema.parse(DEFAULT_SETTINGS);
    expect(parsed.theme).toBe('dark');
    expect(parsed.fontSize).toBe('md');
  });
});
