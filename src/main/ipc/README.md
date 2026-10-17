# IPC Layer (`src/main/ipc/`)

This directory defines the inter-process communication (IPC) interface between Electron's main process and the React renderer process.

---

## Files Overview

### 1. [`channels.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/ipc/channels.ts)
Contains constant definitions for all IPC channel identifiers, avoiding magic strings across the codebase:

```typescript
export const IPC_CHANNELS = {
  // Conversations
  CONVERSATIONS_GET_ALL: 'conversations:get-all',
  CONVERSATIONS_CREATE: 'conversations:create',
  CONVERSATIONS_UPDATE: 'conversations:update',
  CONVERSATIONS_DELETE: 'conversations:delete',
  CONVERSATIONS_SEARCH: 'conversations:search',

  // Messages
  MESSAGES_GET_ALL: 'messages:get-all',
  MESSAGES_SEND: 'messages:send',
  MESSAGES_STOP: 'messages:stop',
  MESSAGES_DELETE: 'messages:delete',

  // Providers & Models
  PROVIDERS_GET_ALL: 'providers:get-all',
  PROVIDERS_SAVE: 'providers:save',
  PROVIDERS_DELETE: 'providers:delete',
  PROVIDERS_TEST: 'providers:test',
  PROVIDERS_FETCH_MODELS: 'providers:fetch-models',

  // Documents
  DOCUMENTS_SELECT_DIALOG: 'documents:select-dialog',
  DOCUMENTS_PROCESS: 'documents:process',

  // Settings & Storage
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  DATA_EXPORT: 'data:export',
  DATA_IMPORT: 'data:import',

  // System & Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  SHELL_OPEN_EXTERNAL: 'shell:open-external',
};
```

---

### 2. [`handlers.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/ipc/handlers.ts)
- **Role**: IPC Request Dispatcher and Controller.
- **Responsibilities**:
  - Implements `registerIpcHandlers(deps)` taking instances of `AppDatabase`, `ChatEngine`, `DocumentProcessor`, `CredentialManager`, and a window resolver.
  - **Conversations**: CRUD operations on conversation threads and full-text keyword searches.
  - **Messages**:
    - Dispatches generation requests to `chatEngine.executeChat(options)`.
    - Handles `stopGeneration(conversationId)`.
  - **Providers**:
    - Saves provider configs, encrypting `apiKey` through `CredentialManager.encrypt()`.
    - Returns provider lists with decrypted flags so the UI knows an API key is configured without exposing raw secrets.
    - Connects to provider `/models` endpoints to list available models.
  - **Documents**: Opens native file dialogs and runs text/image extraction.
  - **Backup & Restore**: Exports full database state to portable JSON and imports backup snapshots.
