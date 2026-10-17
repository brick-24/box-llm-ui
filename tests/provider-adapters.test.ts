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
});
