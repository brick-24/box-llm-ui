export const IPC_CHANNELS = {
  // Providers
  PROVIDERS_GET_ALL: 'providers:get-all',
  PROVIDERS_SAVE: 'providers:save',
  PROVIDERS_DELETE: 'providers:delete',
  PROVIDERS_TEST: 'providers:test',
  PROVIDERS_FETCH_MODELS: 'providers:fetch-models',

  // Conversations
  CONVERSATIONS_GET_ALL: 'conversations:get-all',
  CONVERSATIONS_CREATE: 'conversations:create',
  CONVERSATIONS_UPDATE: 'conversations:update',
  CONVERSATIONS_DELETE: 'conversations:delete',
  CONVERSATIONS_SEARCH: 'conversations:search',
  CONVERSATIONS_EXPORT_MARKDOWN: 'conversations:export-markdown',
  CONVERSATIONS_EXPORT_JSON: 'conversations:export-json',
  CONVERSATIONS_IMPORT_JSON: 'conversations:import-json',

  // Messages & Chat
  MESSAGES_GET_ALL: 'messages:get-all',
  MESSAGES_SEND: 'messages:send',
  MESSAGES_STOP: 'messages:stop',
  MESSAGES_DELETE: 'messages:delete',

  // Documents & Attachments
  DOCUMENTS_SELECT_DIALOG: 'documents:select-dialog',
  DOCUMENTS_PROCESS_FILE: 'documents:process-file',
  DOCUMENTS_PROCESS_BUFFER: 'documents:process-buffer',

  // Settings & Diagnostics
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  DIAGNOSTICS_GET: 'diagnostics:get',
  DIAGNOSTICS_CLEAR: 'diagnostics:clear',

  // Window Controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  OPEN_EXTERNAL: 'shell:open-external',

  // Stream Events (Main -> Renderer)
  STREAM_CHUNK: 'chat:stream-chunk',
  STREAM_END: 'chat:stream-end',
  STREAM_ERROR: 'chat:stream-error',
} as const;
