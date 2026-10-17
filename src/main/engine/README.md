# Chat Engine & Diagnostics (`src/main/engine/`)

This directory contains the core orchestration engine for executing LLM completions, parsing incremental SSE streams, managing abort signals, and recording diagnostic telemetry.

---

## Files Overview

### 1. [`chat-engine.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/chat-engine.ts)
- **Role**: Primary Chat Execution Controller.
- **Key Responsibilities**:
  - **Message Lifecycle**:
    1. Generates heuristic conversation titles from the initial user prompt (`generateTitleHeuristic`).
    2. Persists the user message to SQLite (`db.saveMessage`).
    3. Persists an assistant placeholder message with `'streaming'` status.
  - **Provider & Auth Resolution**:
    - Resolves the target provider configuration from SQLite.
    - Decrypts the stored API key using hardware-backed OS Keychain / AES-GCM via [`CredentialManager`](file:///c:/Users/raghav/Desktop/spare/box/src/main/storage/credentials.ts).
    - Obtains the protocol adapter from [`AdapterFactory`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/adapter-factory.ts).
  - **Generation Execution & Retries**:
    - Allocates an `AbortController` tracked in `activeControllers` keyed by `conversationId`.
    - Dispatches streaming or non-streaming requests.
    - Automatic retries with exponential backoff for transient network drops (skipping non-retryable 401/403/404 errors).
  - **IPC Synchronization & Delivery**:
    - Updates SQLite with the completed message, token counts, and latency metrics.
    - Emits IPC events: `'chat:stream-chunk'`, `'chat:stream-end'`, and `'chat:stream-error'`.
    - Returns `{ assistantMsgId, fullText, status }` directly so the caller receives the complete text all at once.
  - **Cancellation**:
    - `stopGeneration(conversationId)` triggers `controller.abort()`, releasing HTTP connections immediately.

---

### 2. [`stream-parser.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/stream-parser.ts)
- **Role**: Robust Server-Sent Events (SSE) Parser.
- **Key Features**:
  - Wraps `eventsource-parser` to handle fragmented network chunks split across packet boundaries.
  - **Universal Delta Extraction**:
    - Standard: `choices[0].delta.content`
    - Proxy/Direct: `choices[0].message.content`
    - Text: `choices[0].text`
    - Reasoning models: `choices[0].delta.reasoning_content` (DeepSeek-R1 / Qwen thinking blocks)
    - Multimodal arrays: extracts `item.text` from content arrays.
  - Tracks token usage (`prompt_tokens`, `completion_tokens`, `total_tokens`) and `finish_reason`.

---

### 3. [`diagnostics.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/diagnostics.ts)
- **Role**: Centralized Structured Telemetry & Diagnostics Logger.
- **Features**:
  - Captures timestamped diagnostic entries (`level: 'info' | 'warn' | 'error'`, `category: 'api' | 'stream' | 'storage' | 'system'`).
  - Emits real-time diagnostic updates to renderer windows via `diagnostics:log`.
  - Maintains an in-memory buffer with retrieval and clearing APIs.
