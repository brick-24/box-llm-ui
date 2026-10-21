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
  - `isWebBrowsing: boolean`: Toggle state for live web search and browsing grounding.
  - `activeBrowserDrawerUrl`: Currently inspected URL in slide-over drawer.
  - `activeBrowserDrawerTitle`, `activeBrowserDrawerScreenshot`, `activeBrowserDrawerMarkdown`: Cached drawer reader text and visual screenshot.
  - `searchQuery: string`: Active sidebar search filter.
- **Key Actions**:
  - **`initStore()`**: Subscribes to IPC streaming events (`onStreamChunk`, `onStreamEnd`, `onStreamError`, `onToolCallUpdate`) and initial conversations fetch.
  - **`toggleWebBrowsing()`**: Toggles web search and page reading capabilities for the conversation.
  - **`openBrowserDrawer(url, title, screenshot, markdown)`** / **`closeBrowserDrawer()`**: Controls slide-over web drawer preview.
  - **`sendMessage(content)`**:
    - Optimistically appends the user message and a pending assistant placeholder.
    - Dispatches generation request via `window.electronAPI.sendMessage(...)`, including `webBrowsing` flag.
    - Updates real-time tool execution cards during generation.
    - **All-at-Once Delivery**: On completion, reloads fresh messages directly from SQLite (`window.electronAPI.getMessages(convId)`), updating the assistant message with full content, tool calls, and citation chips instantly.
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
  - `settings: AppSettings`: Theme, font size, default parameters, system prompt, search providers, and web browsing defaults.
  - `activeTab: 'providers' | 'general' | 'generation' | 'web' | 'diagnostics' | 'backup'`: Active tab in settings dialog.
  - `isSettingsOpen: boolean`: Visibility of the settings modal.
- **Key Actions**:
  - `loadSettings()`: Loads persisted preferences from SQLite.
  - `updateSettings(partial)`: Writes updated preferences to SQLite and applies theme classes.
  - `openSettings(tab?)`, `closeSettings()`: Controls modal visibility and navigation.
