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
  contextWarningLimit: 200000,
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
    name: 'OpenRouter (1M+ Models)',
    baseUrl: 'https://openrouter.ai/api/v1',
    chatEndpoint: '/chat/completions',
    modelListUrl: 'https://openrouter.ai/api/v1/models',
    protocol: 'openai-chat',
    authMethod: 'bearer',
    streamingEnabled: true,
    defaultModel: 'google/gemini-2.5-flash',
  },
  {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    chatEndpoint: '/chat/completions',
    modelListUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    protocol: 'openai-chat',
    authMethod: 'bearer',
    streamingEnabled: true,
    defaultModel: 'gemini-2.5-flash',
  },
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    chatEndpoint: '/chat/completions',
    modelListUrl: 'https://api.deepseek.com/models',
    protocol: 'openai-chat',
    authMethod: 'bearer',
    streamingEnabled: true,
    defaultModel: 'deepseek-chat',
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
