# Shared Domain Models & Contracts (`src/shared/`)

This directory contains pure TypeScript contracts, constants, default seeds, and schema validation logic shared across both the Electron main process and the React renderer process.

---

## Files Overview

### 1. [`types.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/shared/types.ts)
Defines the authoritative TypeScript interfaces and domain models:
- **`ChatMessage`**: Core message entity containing `id`, `conversationId`, `role` (`'user' | 'assistant' | 'system'`), `content`, `attachments`, `status` (`'pending' | 'streaming' | 'completed' | 'error' | 'stopped'`), `tokenUsage`, `latencyMs`, timestamps.
- **`Conversation`**: Conversation thread containing `id`, `title`, `providerId`, `modelId`, `systemPrompt`, parameter overrides (`temperature`, `maxTokens`, `topP`), `isPinned`, timestamps.
- **`ProviderConfig`**: Configuration for AI backends including `id`, `name`, `baseUrl`, `chatEndpoint`, `apiKey`, `protocol` (`'openai-chat' | 'openai-responses' | 'custom-json'`), `defaultModel`, `customHeaders`, `customBodyParams`, `streamingEnabled`.
- **`Attachment`**: Uploaded file metadata including `id`, `name`, `size`, `mimeType`, `content` (base64 or extracted text), and token count.
- **`AppSettings`**: Global user preferences for theme, font size, streaming preferences, and default generation parameters.
- **`StreamChunkEvent` / `StreamEndEvent` / `StreamErrorEvent`**: Strong typing for streaming IPC payloads.

---

### 2. [`constants.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/shared/constants.ts)
Contains immutable system defaults, initial providers, and starter prompts:
- **`DEFAULT_PROVIDERS`**: Seed configurations for popular LLM endpoints:
  - **OpenAI**: `https://api.openai.com/v1` (GPT-4o)
  - **OpenRouter**: `https://openrouter.ai/api/v1` (Gemini 2.5 Flash)
  - **DeepSeek**: `https://api.deepseek.com` (DeepSeek-Chat)
  - **Ollama**: `http://localhost:11434/v1` (Local llama3)
- **`DEFAULT_APP_SETTINGS`**: Initial settings (`theme: 'system'`, `defaultMaxTokens: 4096`, `defaultTemperature: 0.7`, `fontSize: 'md'`, `contextWarningLimit: 200000` supporting up to 1M+ models).
- **`STARTER_PROMPTS`**: Pre-configured cards for the Welcome Screen.

---

### 3. [`validation.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/shared/validation.ts)
Pure validation utilities used prior to database persistence and network dispatch:
- **`validateProviderConfig(config)`**: Verifies base URL format, endpoint paths, and required protocol configuration.
- **`validateParameters(params)`**: Ensures temperature is between `0.0` and `2.0`, max tokens is positive, and top-p is between `0.0` and `1.0`.
- **`validateUrl(url)`**: Safe URL parsing preventing malformed or dangerous protocol schemes.
