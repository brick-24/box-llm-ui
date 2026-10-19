# Test Suite (`tests/`)

This directory contains the unit and integration test suite powered by **Vitest**. Tests run against Node.js runtime environments to validate core engine logic, streaming parsing, multi-provider adaptation, document chunking, and schema validation.

---

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode during development
npm run test:watch
```

---

## Test Files Overview

### 1. [`stream-parser.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/stream-parser.test.ts)
- **Component Tested**: `createSseStreamParser` ([`src/main/engine/stream-parser.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/stream-parser.ts))
- **Test Scenarios**:
  - Incremental SSE chunk parsing with accumulated text and token usage reporting.
  - Split SSE chunk boundary recovery across raw byte buffers.
  - Proxy compatibility: extraction of `choices[0].message.content` when non-streaming JSON or uvicorn responses are received.
  - Reasoning model compatibility: extraction of `choices[0].delta.reasoning_content` (DeepSeek-R1 / Qwen thinking models).

### 2. [`provider-adapters.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/provider-adapters.test.ts)
- **Components Tested**: [`OpenAiAdapter`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/openai-adapter.ts) and [`CustomJsonAdapter`](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/custom-json-adapter.ts)
- **Test Scenarios**:
  - Request body formatting with system prompts, parameters (temperature, maxTokens, topP).
  - Custom body parameters merging.
  - Custom JSON field path mapping (e.g. `output.text` and `token`).
  - Auth header generation across Bearer, Basic, and custom API key header conventions.

### 3. [`document-extraction.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/document-extraction.test.ts)
- **Component Tested**: Document chunker ([`src/main/documents/chunker.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/chunker.ts))
- **Test Scenarios**:
  - Content splitting by chunk size and token estimation.
  - Overlap preservation across chunk boundaries.
  - Empty and small file handling without chunk creation errors.

### 4. [`chat-engine.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/chat-engine.test.ts)
- **Component Tested**: `ChatEngine.generateTitleHeuristic` ([`src/main/engine/chat-engine.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/chat-engine.ts))
- **Test Scenarios**:
  - Smart title extraction from initial user prompt.
  - Markdown symbol stripping (headings `#`, bullets `-`, quotes `>`).
  - Title truncation with word-boundary awareness under 40 characters.

### 5. [`validation.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/validation.test.ts)
- **Component Tested**: Schema validators ([`src/shared/validation.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/shared/validation.ts))
- **Test Scenarios**:
  - Provider configuration validation (URLs, endpoints, auth configurations).
  - Model parameter boundary checks (temperature range 0-2, max tokens >= 1).
  - Conversation and message validation constraints.

### 6. [`thinking.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/thinking.test.ts)
- **Component Tested**: Thinking & reasoning utilities ([`src/renderer/src/utils/thinking.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/utils/thinking.ts))
- **Test Scenarios**:
  - Extraction of inline `<think>...</think>` tags and reasoning blocks.
  - Multi-tag separation and preservation of residual answer content.
  - Duration formatting (`Thought for 4.2s`, `Thought for 1m 15s`).

### 7. [`branching.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/branching.test.ts)
- **Component Tested**: Branch history resolver and sibling tree navigation ([`src/renderer/src/utils/branching.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/utils/branching.ts) and [`ChatEngine.resolveBranchHistory`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/chat-engine.ts))
- **Test Scenarios**:
  - Sibling resolution for parent-linked message nodes.
  - Backward ancestor chain traversal ensuring prompt isolation.
  - Forking alternative branches from edited prompts.

### 8. [`artifacts.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/artifacts.test.ts)
- **Component Tested**: Code artifact detection and sandboxing ([`src/renderer/src/utils/artifact-utils.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/utils/artifact-utils.ts))
- **Test Scenarios**:
  - Detection of HTML, SVG, and interactive markup in code blocks.
  - Extraction of clean executable source from markdown fences.
  - HTML wrapper document generation with sandboxed security policies.

### 9. [`model-limits.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/model-limits.test.ts)
- **Component Tested**: Dynamic model limits catalog resolution ([`src/renderer/src/utils/model-limits.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/utils/model-limits.ts))
- **Test Scenarios**:
  - Resolution of context window and max output tokens for Gemini (1M/2M), Claude, GPT-4o, and DeepSeek.
  - Adaptive slider bounds clamping and compact formatting.

### 10. [`database-migration.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/database-migration.test.ts)
- **Component Tested**: SQLite schema migrations ([`src/main/storage/database.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/storage/database.ts))
- **Test Scenarios**:
  - Safe, non-destructive migration of legacy databases without `parent_id`, `reasoning_content`, or `thinking_duration_ms` columns.
  - Creation of column-dependent indexes.

### 11. [`reset-data.test.ts`](file:///c:/Users/raghav/Desktop/spare/box/tests/reset-data.test.ts)
- **Component Tested**: Database factory reset and cleanup ([`src/main/storage/database.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/storage/database.ts))
- **Test Scenarios**:
  - Complete purging of all SQLite tables (`conversations`, `messages`, `providers`, `settings`, `diagnostics`).
  - Re-seeding of default provider presets with empty API keys and fresh initial "New Chat".
