# Client State Management (`src/renderer/src/store/`)

This directory houses the global client state stores implemented using **Zustand**.

---

## Files Overview

### 1. [`useChatStore.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/store/useChatStore.ts)
- **Role**: Master Chat & Conversation State Store.
- **State Model**:
  - `conversations: Conversation[]`: List of all conversation headers.
  - `activeConversationId: string | null`: Selected conversation thread.
  - `messages: ChatMessage[]`: Active message list.
  - `attachments: Attachment[]`: Staged file attachments for the next message.
  - `isStreaming: boolean`: True during active model generation.
  - `streamingMessageId: string | null`: Target assistant message identifier.
  - `searchQuery: string`: Active sidebar search filter.
- **Key Actions**:
  - **`initStore()`**: Subscribes to IPC streaming events (`onStreamChunk`, `onStreamEnd`, `onStreamError`) and initial conversations fetch.
  - **`sendMessage(content)`**:
    - Optimistically appends the user message and a pending assistant placeholder.
    - Dispatches generation request via `window.electronAPI.sendMessage(...)`.
    - **All-at-Once Delivery**: On completion, reloads fresh messages directly from SQLite (`window.electronAPI.getMessages(convId)`), updating the assistant message with full content instantly.
  - **`stopGeneration()`**: Signals the main process to abort active generation.
  - **`retryMessage(messageId)`**: Re-submits the user prompt preceding a failed assistant message.
  - **`createConversation()`, `deleteConversation()`, `updateConversation()`**: Manages thread lifecycle and selection.

---

### 2. [`useProviderStore.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/store/useProviderStore.ts)
- **Role**: AI Provider Registry & Model Discovery Store.
- **State Model**:
  - `providers: ProviderConfig[]`: All configured providers.
  - `activeProviderId: string`: Current active provider ID.
  - `models: ModelOption[]`: List of models fetched from the active provider.
- **Key Actions**:
  - `initProviders()`: Loads saved providers from the main process.
  - `setActiveProvider(id)`: Changes the active provider and refreshes model choices.
  - `saveProvider(config)`: Saves or updates provider credentials and endpoints.
  - `fetchModelsForProvider(id)`: Invokes the remote `/models` endpoint to discover available models.
  - `testConnection(config)`: Runs a live connectivity handshake.

---

### 3. [`useSettingsStore.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/store/useSettingsStore.ts)
- **Role**: Preferences & Diagnostics Store.
- **State Model**:
  - `settings: AppSettings`: Theme, font size, default parameters, system prompt.
  - `diagnostics: DiagnosticsLog[]`: In-memory log events stream.
  - `isSettingsOpen: boolean`: Visibility of the settings modal.
  - `isDiagnosticsOpen: boolean`: Visibility of the diagnostics log panel.
- **Key Actions**:
  - `loadSettings()`: Loads persisted preferences from SQLite.
  - `updateSettings(partial)`: Writes updated preferences to SQLite and applies theme classes.
  - `setSettingsOpen(bool)`, `setDiagnosticsOpen(bool)`: Controls modal visibility.
