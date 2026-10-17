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
