import { AppSettings, ProviderConfig } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 'md',
  density: 'comfortable',
  defaultSystemPrompt: 'You are a helpful, capable, and universal AI assistant. Provide clear, accurate, and structured answers.',
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  sendOnEnter: true,
  localPdfOcrFallback: false,
  contextWarningLimit: 32000,
};

export const PROVIDER_PRESETS: Partial<ProviderConfig>[] = [
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    chatEndpoint: '/chat/completions',
    modelListUrl: 'https://api.openai.com/v1/models',
    protocol: 'openai-chat',
    authMethod: 'bearer',
    streamingEnabled: true,
    defaultModel: 'gpt-4o',
  },
  {
    name: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    chatEndpoint: '/chat/completions',
    modelListUrl: 'https://api.groq.com/openai/v1/models',
    protocol: 'openai-chat',
    authMethod: 'bearer',
    streamingEnabled: true,
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    chatEndpoint: '/chat/completions',
    modelListUrl: 'http://localhost:11434/v1/models',
    protocol: 'openai-chat',
    authMethod: 'none',
    streamingEnabled: true,
    defaultModel: 'llama3:latest',
  },
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    chatEndpoint: '/chat/completions',
    modelListUrl: 'https://openrouter.ai/api/v1/models',
    protocol: 'openai-chat',
    authMethod: 'bearer',
    streamingEnabled: true,
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    name: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    chatEndpoint: '/chat/completions',
    modelListUrl: 'http://localhost:1234/v1/models',
    protocol: 'openai-chat',
    authMethod: 'none',
    streamingEnabled: true,
    defaultModel: '',
  },
  {
    name: 'Custom JSON API',
    baseUrl: 'https://api.example.com',
    chatEndpoint: '/v1/generate',
    modelListUrl: 'https://api.example.com/v1/models',
    protocol: 'custom-json',
    authMethod: 'bearer',
    streamingEnabled: false,
    defaultModel: 'default',
    customMapping: {
      roleMapping: {
        system: 'system',
        user: 'user',
        assistant: 'assistant',
      },
      modelField: 'model',
      messagesField: 'messages',
      streamField: 'stream',
      responsePath: 'output.text',
      streamChunkPath: 'token',
    },
  },
];

export const WELCOME_SUGGESTIONS = [
  {
    title: 'Code Architecture',
    prompt: 'Design a clean, modular TypeScript interface for an event-driven processing pipeline with retry strategies.',
    icon: 'code',
  },
  {
    title: 'Data & Document Analysis',
    prompt: 'I will upload a PDF or document. Please analyze the core findings, highlight key statistics, and summarize risks.',
    icon: 'file-text',
  },
  {
    title: 'Debugging & Refactoring',
    prompt: 'Explain the difference between optimistic concurrency and pessimistic locking in relational databases with practical code examples.',
    icon: 'bug',
  },
  {
    title: 'Technical Writing',
    prompt: 'Draft an API reference guide following OpenAPI best practices for authentication and rate limiting.',
    icon: 'pen-tool',
  },
];
