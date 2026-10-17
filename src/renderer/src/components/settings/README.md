# Settings & Provider Configuration (`src/renderer/src/components/settings/`)

This directory houses the modal dialogs and forms for configuring global application behavior, storage management, and AI provider integrations.

---

## Files Overview

### 1. [`SettingsModal.tsx`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/settings/SettingsModal.tsx)
- **Role**: Master Settings Dialog.
- **Tabs**:
  1. **General**:
     - Theme selection (Dark, Light, System).
     - Typography font size tuning (12px - 18px).
     - Default system prompt.
     - Default generation parameters (Temperature slider 0.0 - 2.0, Max output tokens presets up to 1,000,000, Context Warning Limit presets up to 2,000,000).
  2. **Providers**:
     - Lists all configured providers with active status indicators.
     - Actions: Set as Active, Edit, Delete, or Add New Provider.
  3. **Data & Storage**:
     - Database location and stats.
     - Full database export (`Export Backup JSON`).
     - Restore from backup (`Import JSON`).
     - Danger zone: Clear all conversations and reset settings.
  4. **Diagnostics**:
     - Live log stream viewer with level filters (`info`, `warn`, `error`) and category tags (`api`, `stream`, `storage`).
     - Real-time diagnostic log stream from the Electron main process.

---

### 2. [`ProviderForm.tsx`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/settings/ProviderForm.tsx)
- **Role**: Dynamic AI Provider Configuration Editor.
- **Configurable Fields**:
  - **Provider Name**: Display title (e.g., `OpenAI`, `Groq Cloud`, `My Local Server`).
  - **Protocol Selection**: `'openai-chat'`, `'openai-responses'`, or `'custom-json'`.
  - **Base URL & Endpoints**: Root API URL and custom chat completion endpoints (e.g., `/chat/completions`).
  - **Authentication**: Bearer token, Basic Auth, or None, with masked password input and reveal toggle.
  - **Model Discovery**: "Fetch Models" button that queries the host's `/models` endpoint to populate available model IDs dynamically.
  - **Default Model**: Selected model identifier.
  - **Streaming Toggle**: Enables or disables SSE streaming.
  - **Advanced Configurations**:
    - Custom HTTP headers (key-value pairs).
    - Custom JSON body parameters.
    - Custom field path mapping (`responsePath`, `streamChunkPath`, `roleMapping`) for arbitrary non-OpenAI endpoints.
  - **Live Connection Test**: Interactive "Test Connection" button that issues a live handshake to verify reachability and displays latency metrics.
