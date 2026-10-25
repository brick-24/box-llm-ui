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
  - **Autonomous Multi-Turn ReAct Agent Loop**:
    - **Web Grounding**: When web browsing is enabled (`webBrowsing: true`), injects OpenAI-compatible tool declarations ([`src/main/browser/web-tools.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/browser/web-tools.ts)) and dispatches `search_web`, `fetch_web_page`, `browse_page`, `take_page_screenshot`.
    - **Agentic Coding Workspace**: When a workspace directory is connected (`workspacePath`), automatically injects all 6 coding tools ([`src/main/engine/tools/coding-tool-definitions.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/tools/coding-tool-definitions.ts)) and prepends ground-truth workspace instructions.
    - **Autonomous Iteration**: Loops up to `maxAgentTurns` (default 20, configurable up to 100 in Settings) whenever the model emits `tool_calls`.
    - **Real-Time Terminal Streaming**: As shell processes run, emits live chunks via IPC channel `chat:tool-command-output` so users observe terminal output character-by-character.
    - **Tool Updates**: Emits real-time IPC updates (`'chat:tool-call-update'`) with running, completed, duration metrics, and error statuses.
    - Collects and deduplicates URL grounding sources into `WebCitation` models attached to assistant messages.
  - **Generation Execution & Retries**:
    - Allocates an `AbortController` tracked in `activeControllers` keyed by `conversationId`.
    - Dispatches streaming or non-streaming requests.
    - Automatic retries with exponential backoff for transient network drops (skipping non-retryable 401/403/404 errors).
  - **IPC Synchronization & Delivery**:
    - Updates SQLite with the completed message, token counts, latency metrics, tool calls JSON, and citation sources JSON.
    - Emits IPC events: `'chat:stream-chunk'`, `'chat:stream-end'`, `'chat:stream-error'`, `'chat:tool-call-update'`, and `'chat:tool-command-output'`.
    - Returns `{ assistantMsgId, fullText, status, toolCalls, citations }` directly.
  - **Cancellation**:
    - `stopGeneration(conversationId)` triggers `controller.abort()`, terminating both network streams and active child shell processes immediately.

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
  - **Streaming Tool Calls Accumulator**:
    - Accumulates fragmented `choices[0].delta.tool_calls` chunks across SSE boundaries by tool index.
    - Merges partial JSON arguments (`delta.function.arguments`) into complete function call payloads.
    - Invokes `onToolCallChunk(index, toolCall)` callbacks for real-time renderer feedback.
  - Tracks token usage (`prompt_tokens`, `completion_tokens`, `total_tokens`) and `finish_reason`.

---

### 3. [`diagnostics.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/diagnostics.ts)
- **Role**: Centralized Structured Telemetry & Diagnostics Logger.
- **Features**:
  - Captures timestamped diagnostic entries (`level: 'info' | 'warn' | 'error'`, `category: 'api' | 'stream' | 'storage' | 'system'`).
  - Emits real-time diagnostic updates to renderer windows via `diagnostics:log`.
  - Maintains an in-memory buffer with retrieval and clearing APIs.

---

### 4. [`tools/workspace-tools.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/tools/workspace-tools.ts)
- **Role**: File Operations Sandbox & Command Execution Engine.
- **Key Capabilities**:
  - **`resolveSafePath(workspaceRoot, targetPath)`**: Enforces strict directory confinement; blocks directory traversal (`../`) and absolute paths resolving outside `workspaceRoot`.
  - **`writeToFile(workspaceRoot, filePath, content, overwrite)`**: Creates parent directories recursively and writes files, reporting byte counts and creation status.
  - **`viewFile(workspaceRoot, filePath, startLine, endLine)`**: Reads text files safely, prepending 1-based line numbers and supporting slice notation up to 800 lines per call.
  - **`replaceFileContent(workspaceRoot, filePath, targetContent, replacementContent)`**: Surgically searches and substitutes text blocks, verifying uniqueness and preventing ambiguous overwrites.
  - **`listDir(workspaceRoot, subPath, maxDepth)`**: Generates structured hierarchical tree objects ([`WorkspaceTreeNode`](file:///c:/Users/raghav/Desktop/spare/box/src/shared/types.ts)) and ASCII summaries while ignoring build artifacts (`node_modules`, `.git`, `dist`).
  - **`runCommand(workspaceRoot, command, options)`**: Spawns terminal processes (PowerShell on Windows, Bash on Unix) inside the workspace root. Enforces dangerous command pattern filters (`rm -rf /`, `mkfs`, fork bombs), timeouts, and live stdout/stderr chunk streaming via `options.onChunk`.
  - **`grepSearch(workspaceRoot, query, isRegex, includesPattern)`**: Recursively searches project files for substring or regex patterns, returning matched file paths, line numbers, and trimmed code snippets.

---

### 5. [`tools/coding-tool-definitions.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/tools/coding-tool-definitions.ts)
- **Role**: OpenAI Function Calling Declarations & Coding System Prompt.
- **Key Exports**:
  - **`CODING_TOOLS`**: Array of 6 standard function tool declarations conforming to OpenAI function calling specifications (`write_to_file`, `view_file`, `replace_file_content`, `list_dir`, `run_command`, `grep_search`).
  - **`buildCodingSystemPrompt(workspacePath, userPrompt)`**: Injects ground-truth guidelines instructing the LLM on workspace path confinement, surgical editing best practices, and automated build/test verification.

