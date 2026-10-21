# Settings & Provider Configuration (`src/renderer/src/components/settings/`)

This directory houses the modal dialogs and forms for configuring global application behavior, storage management, and AI provider integrations.

---

## Files Overview

### 1. [`SettingsModal.tsx`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/settings/SettingsModal.tsx)
- **Role**: Master Settings Dialog.
- **Tabs**:
  1. **Providers**:
     - Lists all configured providers with active status indicators.
     - Actions: Set as Active, Edit, Delete, or Add New Provider.
  2. **General**:
     - Theme selection (Dark, Light, System).
     - Typography font size tuning (Compact, Default, Comfort).
     - Message sending shortcut toggle (Enter vs. Ctrl+Enter).
  3. **Defaults & Generation**:
     - Default system instructions.
     - Default temperature slider (0.0 - 1.5).
     - Default max output tokens with quick jump buttons (up to 1M+ tokens).
     - Context warning limit configuration.
  4. **Web Browsing**:
     - Default web browsing behavior toggle on new chats.
     - Search engine provider selection: **DuckDuckGo** (Free / zero-config HTML scraper), **Brave Search**, **Tavily Search**, and **Serper (Google Search)**.
     - Secure local API key storage for external search providers.
     - Max search results slider (3 to 10 results).
     - Interactive search connection tester verifying queries and rendering live results in real-time.
  5. **Diagnostics & Logs**:
     - Live log stream viewer with level filters (`info`, `warn`, `error`) and category tags (`api`, `stream`, `storage`, `document`).
     - Real-time diagnostic log stream from the Electron main process.
  6. **Data & Backup**:
     - Database location and stats.
     - Full database export (`Export Backup JSON`).
     - Restore from backup (`Import JSON`).
     - Factory reset ("Danger Zone"): Clear all conversations, messages, providers, and settings.

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
