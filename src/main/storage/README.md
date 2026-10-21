# Persistence & Credential Storage (`src/main/storage/`)

This directory provides local database persistence and hardware-backed credential encryption for the application.

---

## Files Overview

### 1. [`database.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/storage/database.ts)
- **Role**: SQLite Database Manager powered by `sql.js` (WebAssembly SQLite).
- **Database Location**: `<userData>/universal-llm.sqlite` (e.g., `%APPDATA%/universal-llm-client/universal-llm.sqlite`).
- **Schema & Migrations**:
  - Automatically runs idempotent migrations on startup (`runMigrations`).
  - **`conversations`**: `id`, `title`, `provider_id`, `model_id`, `system_prompt`, `temperature`, `max_tokens`, `top_p`, `is_pinned`, `web_browsing_enabled`, `created_at`, `updated_at`.
  - **`messages`**: `id`, `conversation_id`, `parent_id`, `role`, `content`, `reasoning_content`, `thinking_duration_ms`, `attachments_json`, `tool_calls_json`, `citations_json`, `status`, `error_message`, `token_usage_json`, `latency_ms`, `created_at`, `updated_at`.
  - **`providers`**: `id`, `config_json`, `created_at`, `updated_at`.
  - **`settings`**: `key`, `value_json`, `updated_at` (including `defaultWebBrowsing`, `searchProvider`, `searchApiKey`, `maxSearchResults`).
- **Performance & Durability**:
  - Fast in-memory query execution with debounced disk persistence (`queueSave`, `persistImmediately`).
  - Full-text search queries using indexed SQL `LIKE` statements across titles and messages.
  - Backup & restore methods (`exportData`, `importData`) creating portable JSON dumps.

---

### 2. [`credentials.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/storage/credentials.ts)
- **Role**: Hardware-backed Credential Vault.
- **Encryption Schemes**:
  1. **Primary (`os-keychain`)**:
     - Uses Electron's native `safeStorage` API.
     - Windows: DPAPI (Data Protection API) hardware encryption tied to the user login credentials.
     - macOS: Apple Keychain Services.
     - Linux: GNOME Keyring / KWallet via Secret Service API.
     - Encrypted payloads prefixed with `safe:<base64>`.
  2. **Fallback (`aes-gcm-fallback`)**:
     - Automatically activated if OS Keychain is unavailable (e.g. headless/containerized environments).
     - Generates a cryptographically random 256-bit key stored with `0600` permissions at `<userData>/.master.key`.
     - Uses AES-256-GCM with a unique 12-byte initialization vector (IV) and authentication tag per encryption.
