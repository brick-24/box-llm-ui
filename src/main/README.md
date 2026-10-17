# Electron Main Process (`src/main/`)

This directory contains the Node.js backend runtime for the desktop application, responsible for native OS window management, SQLite persistence, hardware-backed credential encryption, IPC dispatching, document processing, and AI provider communications.

---

## Directory Structure

```
src/main/
├── index.ts              # Main entrypoint: App lifecycle, window creation, security headers
├── documents/            # Document parsing and token chunking (PDF, DOCX, TXT, MD)
├── engine/               # LLM execution engine, streaming parser, diagnostics logging
├── ipc/                  # IPC channel definitions and event handlers
├── providers/            # Multi-protocol provider adapters (OpenAI, Responses, Custom JSON)
└── storage/              # SQLite database (sql.js) and safeStorage credential vault
```

---

## Key Files & Responsibilities

### 1. [`index.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/index.ts)
- **Application Lifecycle**:
  - Initializes the single-instance lock to prevent duplicate app instances.
  - Initializes storage ([`AppDatabase`](file:///c:/Users/raghav/Desktop/spare/box/src/main/storage/database.ts)) and credential encryption ([`CredentialManager`](file:///c:/Users/raghav/Desktop/spare/box/src/main/storage/credentials.ts)).
  - Instantiates services: [`ChatEngine`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/chat-engine.ts), [`DocumentProcessor`](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/document-processor.ts), and [`DiagnosticsService`](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/diagnostics.ts).
- **Window Management**:
  - Creates a frameless `BrowserWindow` (`frame: false`, `titleBarStyle: 'hidden'`) with custom titlebar controls matching the shadcn/ui zinc aesthetic.
  - Manages window state preservation (width, height, maximize status).
  - Loads Vite dev server (`http://localhost:5173`) in development or compiled `dist/renderer/index.html` in production.
- **Security Hardening**:
  - Implements strict Content Security Policy (CSP) headers.
  - Disables Node integration in the renderer (`nodeIntegration: false`, `contextIsolation: true`).
  - Intercepts and denies untrusted new window creation (`setWindowOpenHandler`), redirecting external URLs to the system browser via `shell.openExternal`.
- **IPC Handler Registration**:
  - Calls `registerIpcHandlers` ([`src/main/ipc/handlers.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/ipc/handlers.ts)) to bind all renderer-callable channels.
