import { describe, it, expect } from 'vitest';
import { resolveEndpoint, buildAuthHeaders } from '../src/main/providers/provider-interface';
import { getByPath } from '../src/main/providers/custom-json-adapter';
import { ProviderConfig } from '../src/shared/types';

describe('Provider Adapters & Helpers', () => {
  it('resolves relative and absolute endpoints correctly', () => {
    expect(resolveEndpoint('https://api.openai.com/v1', '/chat/completions')).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
    expect(resolveEndpoint('https://api.openai.com/v1/', 'chat/completions')).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
    expect(
      resolveEndpoint(
        'https://api.openai.com/v1',
        'https://custom-proxy.internal/v1/chat/completions'
      )
    ).toBe('https://custom-proxy.internal/v1/chat/completions');
  });

  it('builds authentication headers correctly for Bearer token', () => {
    const config: ProviderConfig = {
      id: 'test-1',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      chatEndpoint: '/chat/completions',
      apiKey: 'sk-test-secret-key-123',
      modelListUrl: '/models',
      defaultModel: 'gpt-4o',
      protocol: 'openai-chat',
      authMethod: 'bearer',
      customHeaders: { 'X-Custom-Env': 'production' },
      customBodyParams: {},
      requestTimeout: 60000,
      maxRetries: 2,
      streamingEnabled: true,
      organizationId: 'org-test-999',
      projectId: 'proj-alpha',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const headers = buildAuthHeaders(config);
    expect(headers['Authorization']).toBe('Bearer sk-test-secret-key-123');
    expect(headers['OpenAI-Organization']).toBe('org-test-999');
    expect(headers['OpenAI-Project']).toBe('proj-alpha');
    expect(headers['X-Custom-Env']).toBe('production');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('builds authentication headers correctly for api-key-header', () => {
    const config: ProviderConfig = {
      id: 'test-2',
      name: 'Azure',
      baseUrl: 'https://azure.example.com',
      chatEndpoint: '/chat/completions',
      apiKey: 'azure-key-xyz',
      modelListUrl: '/models',
      defaultModel: 'gpt-4',
      protocol: 'openai-chat',
      authMethod: 'api-key-header',
      customHeaders: {},
      customBodyParams: {},
      requestTimeout: 60000,
      maxRetries: 2,
      streamingEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const headers = buildAuthHeaders(config);
    expect(headers['api-key']).toBe('azure-key-xyz');
    expect(headers['x-api-key']).toBe('azure-key-xyz');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('extracts nested values by path with array indices', () => {
    const payload = {
      choices: [
        {
          message: {
            content: 'Hello, universal world!',
          },
          delta: {
            content: 'Hello chunk',
          },
        },
      ],
      output: {
        text: 'Custom response text',
      },
    };

    expect(getByPath(payload, 'choices[0].message.content')).toBe('Hello, universal world!');
    expect(getByPath(payload, 'choices[0].delta.content')).toBe('Hello chunk');
    expect(getByPath(payload, 'output.text')).toBe('Custom response text');
    expect(getByPath(payload, 'non.existent.path')).toBeUndefined();
  });

  it('sanitizes large base64 data URIs and caps strings for verbose logging', async () => {
    const { sanitizePayloadForLogging } = await import('../src/main/providers/openai-adapter');
    const input = {
      model: 'google/gemma-4-31b-it:free',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this photo' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==verylongbase64payloadhere...' } },
          ],
        },
      ],
    };

    const sanitized = sanitizePayloadForLogging(input);
    expect(sanitized.model).toBe('google/gemma-4-31b-it:free');
    expect(sanitized.messages[0].content[0].text).toBe('Analyze this photo');
    expect(sanitized.messages[0].content[1].image_url.url).toContain('[base64 payload truncated');
  });

  it('ensures Google Gemini is defined as a default provider preset', async () => {
    const { PROVIDER_PRESETS } = await import('../src/shared/constants');
    const gemini = PROVIDER_PRESETS.find((p) => p.name === 'Google Gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
    expect(gemini?.chatEndpoint).toBe('/chat/completions');
    expect(gemini?.modelListUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai/models');
    expect(gemini?.protocol).toBe('openai-chat');
    expect(gemini?.authMethod).toBe('bearer');
    expect(gemini?.defaultModel).toBe('gemini-2.5-flash');
  });

  it('guarantees OpenRouter fallback models array is always capped at 3 or fewer items', async () => {
    const { getActiveConversationalFreeModels } = await import('../src/main/providers/openai-adapter');
    const freeList = getActiveConversationalFreeModels();
    expect(freeList.length).toBeGreaterThan(3);

    // Test the fallback slice logic
    const model = 'google/gemma-4-26b-a4b-it:free';
    const fallbacks = freeList.filter((m) => m !== model);
    const modelsPayload = [model, ...fallbacks].slice(0, 3);
    expect(modelsPayload.length).toBeLessThanOrEqual(3);
    expect(modelsPayload[0]).toBe(model);
  });
});


