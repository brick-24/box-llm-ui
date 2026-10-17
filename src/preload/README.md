# Electron Preload Script (`src/preload/`)

This directory contains the secure context bridge between Electron's isolated renderer execution environment and the Node.js main process.

---

## Files Overview

### 1. [`index.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/preload/index.ts)
- **Role**: Secure Context Isolation Bridge.
- **Mechanism**: Exposes the `window.electronAPI` interface to the renderer window using Electron's `contextBridge.exposeInMainWorld`.
- **Security Posture**:
  - `contextIsolation: true` and `nodeIntegration: false` are strictly enforced.
  - Renderer cannot access raw `ipcRenderer`, Node.js `fs`, or native binaries directly.
  - All communication is routed through strictly typed IPC channels.

---

## Exposed API Surface (`window.electronAPI`)

| Category | Method | Description |
|---|---|---|
| **Conversations** | `getConversations()` | Retrieves all conversation headers ordered by pin status and recency. |
| | `createConversation(data)` | Inserts a new conversation and persists to SQLite. |
| | `updateConversation(data)` | Updates metadata (title, model, system prompt, temperature). |
| | `deleteConversation(id)` | Deletes a conversation and all its associated messages. |
| | `searchConversations(query)` | Full-text search across titles and message bodies. |
| **Messages** | `getMessages(conversationId)` | Retrieves all messages in a conversation thread. |
| | `sendMessage(options)` | Dispatches user message, kicks off AI generation, and returns full output. |
| | `stopGeneration(conversationId)` | Aborts active HTTP/SSE generation via `AbortController`. |
| | `deleteMessage(messageId)` | Deletes a single message from the database. |
| **Streaming Events** | `onStreamChunk(cb)` | Listens for incoming token deltas during generation. |
| | `onStreamEnd(cb)` | Listens for generation completion, latency, and token metrics. |
| | `onStreamError(cb)` | Listens for generation errors or network timeouts. |
| **Providers** | `getProviders()` | Retrieves all configured providers (with decrypted status). |
| | `saveProvider(config)` | Creates or updates a provider, securely encrypting API keys. |
| | `deleteProvider(id)` | Removes a provider configuration. |
| | `testProvider(config)` | Tests connectivity to the provider endpoint. |
| | `fetchModels(providerId)` | Queries provider `/models` endpoint to discover supported models. |
| **Documents** | `selectDocumentDialog()` | Opens native file dialog for `.pdf`, `.docx`, `.txt`, `.md`, images. |
| | `processDocument(path)` | Extracts text, metadata, and token estimations from disk files. |
| **System & Window** | `minimize()`, `maximize()`, `close()` | Custom frameless window controls. |
| | `openExternal(url)` | Securely opens links in the user's default browser. |
| | `getSettings()`, `saveSettings()` | Reads and writes application preferences. |
| | `getDiagnostics()` | Accesses system logs and performance metrics. |
| | `exportData()`, `importData()` | Full SQLite backup and restore via JSON. |
