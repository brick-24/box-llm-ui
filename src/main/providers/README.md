# Multi-Protocol AI Provider Adapters (`src/main/providers/`)

This directory contains protocol adapters enabling the application to connect to any LLM endpoint, from commercial APIs (OpenAI, Anthropic, OpenRouter, Groq) to local inference engines (Ollama, LM Studio, vLLM) and arbitrary custom REST APIs.

---

## Files Overview

### 1. [`provider-interface.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/provider-interface.ts)
- **Role**: Provider abstraction contract.
- **`IProviderAdapter` Interface**:
  - `streamMessage(config, params, callbacks, signal)`: Dispatches streaming requests with `onChunk`, `onEnd`, `onError`.
  - `sendMessage(config, params, signal)`: Dispatches non-streaming completion requests.
  - `testConnection(config)`: Pings the endpoint to verify authentication and reachability.
  - `fetchModels(config)`: Discovers model lists from the remote host.
- **Helper Utilities**:
  - `buildAuthHeaders(config)`: Builds `Authorization: Bearer <key>`, Basic auth, or custom header mappings.
  - `formatMessagesWithAttachments(...)`: Serializes messages and multimodal image attachments into standard OpenAI content arrays.
  - `resolveEndpoint(baseUrl, path)`: Safely combines base URL and endpoint paths without double-slash bugs.

---

### 2. [`adapter-factory.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/adapter-factory.ts)
- **Role**: Factory pattern selector.
- **Behavior**: Instantiates and returns the appropriate adapter instance based on `config.protocol`:
  - `'openai-chat'` -> [`OpenAiAdapter`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/openai-adapter.ts)
  - `'openai-responses'` -> [`ResponsesAdapter`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/responses-adapter.ts)
  - `'custom-json'` -> [`CustomJsonAdapter`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/custom-json-adapter.ts)

---

### 3. [`openai-adapter.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/openai-adapter.ts)
- **Role**: Universal OpenAI-compatible Chat Completions adapter.
- **Compatible Providers**: OpenAI, Groq Cloud, OpenRouter, DeepSeek, Together AI, Mistral, Ollama, LM Studio, LocalAI, vLLM, and custom FastAPI/uvicorn proxies.
- **Key Capabilities**:
  - **Dual Response Support**: Seamlessly parses both true SSE streams (`text/event-stream`) and direct JSON responses (`application/json`) even when `stream: true` is sent.
  - **Reasoning Model Support**: Automatically handles `choice.delta.reasoning_content` (DeepSeek-R1 / Qwen thinking models).
  - **Function Calling & Web Tools**: Serializes OpenAI-compatible `tools` schemas and `tool_choice: 'auto'`, accumulates streamed `tool_calls` payloads, and serializes historical tool executions with `role: 'tool'` and corresponding `tool_call_id`.
  - **Image Attachments**: Converts image attachments into OpenAI multimodal content blocks (`{ type: 'image_url', image_url: { url: ... } }`).

---

### 4. [`responses-adapter.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/responses-adapter.ts)
- **Role**: Adapter for the OpenAI Responses API (`/v1/responses`).
- **Features**: Formats structured inputs, system instructions, and response modalities.

---

### 5. [`custom-json-adapter.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/custom-json-adapter.ts)
- **Role**: Schema-agnostic REST Adapter.
- **Features**:
  - Configured via `customMapping` settings in the provider UI.
  - Resolves arbitrary JSON paths using dot-notation (`output.text`, `choices[0].text`, `token`).
  - Supports arbitrary custom headers, custom body parameters, and custom role mappings (`system`, `user`, `assistant`).
