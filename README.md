# Universal LLM Desktop Client

An iconic, precision-engineered universal AI desktop client built with **Electron**, **React 19**, **TypeScript**, and **SQLite**. Designed with a surgical **shadcn/ui** zinc monochrome aesthetic grounded in **Apple Human Interface Guidelines (HIG)**, featuring multi-provider adaptation, hardware-backed credential encryption, live reasoning accordions, message branching trees, sandboxed live code artifact previews, environment data isolation, and production-ready Windows packaging.

---

## Key Features

### 1. Universal Multi-Provider Engine
- **Pre-Configured & Custom Providers**: First-class integration with **OpenAI**, **Google Gemini** (`generativelanguage.googleapis.com`), **OpenRouter**, and **Ollama**, plus custom REST/OpenAI-compatible endpoints.
- **Dynamic Model Catalog & Limits Resolution**: Automatically queries provider catalogs to resolve accurate context lengths and output token maximums (e.g. 1M+ for Gemini, 128k for GPT-4o, 64k for Claude/DeepSeek).
- **Adaptive Token Slider**: Token bounds dynamically adjust to the selected model's true limits, featuring compact formatting (`128K`, `8.2K`), quick-stop jump buttons, and automated safety clamping.
- **OpenRouter Fallback Handling**: Automatic model array cap enforcement (3-model ceiling) and robust retry logic with secrets-redacted diagnostics.

### 2. Live Collapsible Reasoning Accordion
- **Multi-Protocol Reasoning Extraction**: Seamlessly captures reasoning from both explicit SSE payload fields (`reasoning_content`) and inline `<think>...</think>` tags (DeepSeek-R1, Qwen 2.5, etc.).
- **Live Stopwatch**: Real-time timer counts reasoning duration during generation and displays the final elapsed duration (e.g., `Thought for 4.5s`).
- **Smooth Auto-Collapse**: Automatically tucks reasoning away into a sleek disclosure accordion once generation finishes, keeping answers readable while remaining 1-click inspectable.
- **SQLite Persistence**: Stores reasoning content and duration (`thinking_duration_ms`) directly with message records.

### 3. Message Branching & Sibling Tree Navigation
- **In-Place Message Editing**: Edit any historical prompt to instantly branch the conversation without losing previous responses.
- **Sibling Pagination (`< 1 / 2 >`)**: Seamlessly cycle through alternative response versions or edited prompts with smooth animation.
- **Branch History Isolation**: Context reconstruction (`ChatEngine.resolveBranchHistory`) follows parent pointer chains back to the root, ensuring the model only sees the active branch path.
- **Regenerate Alternative Answers**: Regenerate assistant turns to create sibling choices at any branch node.

### 4. Sandboxed Code & HTML Live Artifacts Preview
- **Dual-Tab Interface**: Code blocks containing HTML, SVG, or interactive web markup feature a dual **`[Preview]`** and **`[Code]`** header toggle.
- **Secure Sandboxed Isolation**: Runs inside an isolated `iframe` with `sandbox="allow-scripts"` and strictly **omits** `allow-same-origin`. This forces an opaque `null` origin, completely isolating previewed scripts from Electron DOM, `localStorage`, and IPC bridges.
- **Responsive Device Switcher**: Inspect layouts in **Desktop** (`100%`), **Tablet** (`768px`), and **Mobile** (`375px` with simulated hardware notch).
- **Fullscreen Modal View**: Expand artifacts into an immersive fullscreen preview with raw code view, hot re-mount reload, and direct `.html` or `.svg` download.

### 5. Document Extraction & Multimodal Vision
- **Comprehensive Document Extraction**: Upload and extract text, page counts, and estimated tokens from `.pdf`, `.docx`, `.txt`, `.md`, and `.json`.
- **Vision Support**: Drag and drop images with inline preview chips, image modal inspection, and base64 payloads to vision-enabled models.
- **Full Conversation Markdown Export**: Export entire chat sessions (including reasoning summaries and timestamps) with one click.

### 6. Data Isolation, Packaging Cleanup & Factory Reset
- **Dev vs. Production Data Isolation**: Development runs automatically operate within `universal-llm-client-dev`, while the packaged executable operates within `Universal LLM`. Testing databases, conversations, and personal API keys never bleed into production.
- **Automated Clean Commands**: One-command purging (`npm run clean:data`) and combined clean-then-package (`npm run dist:clean`) to guarantee pristine installers.
- **In-App Factory Reset ("Danger Zone")**: One-click reset in **Settings** > **Data & Backup** wipes all SQLite records, deletes the master keychain key, re-seeds clean provider presets with empty API keys, and reloads the UI to a pristine out-of-the-box state.
- **Clean NSIS Uninstallation**: Configured with `deleteAppDataOnUninstall` to ensure Windows uninstallation removes all residual application databases and keys.

### 7. Native Sandboxed Web Surfing, Autonomous ReAct & Grounding
- **Zero-Download Embedded Chromium Sandbox**: Runs on Electron's native Chromium engine using an isolated session partition (`persist:web-agent`). No external 300MB Playwright or Puppeteer binaries are downloaded. Automatically denies hardware permissions (camera, microphone, geolocation) and restricts non-web protocols.
- **Autonomous Multi-Turn ReAct Agent Loop**: When 🌐 Web is toggled, models autonomously dispatch tool calls (`search_web`, `fetch_web_page`, `browse_page`, `take_page_screenshot`) over up to 6 iterative turns to search, read sources, and ground their answers.
- **Multi-Provider Web Search**: Free, zero-setup **DuckDuckGo** privacy scraper out-of-the-box, with optional API providers for **Brave Search**, **Tavily Search**, and **Serper (Google)**.
- **Real-Time Tool Execution Cards**: Live cards in chat bubbles with running timers, animated spinners, query badges, and 1-click inspector buttons.
- **Interactive Slide-Over Browser Drawer**: Inspect extracted web content in a slide-over panel featuring a distraction-free **Markdown Reader View** and a high-resolution **Chromium Off-Screen Visual Screenshot View**.
- **Grounding Citation Chips**: Rich source chips backing assistant responses complete with Google-resolved domain favicons.

### 8. Autonomous Agentic Coding Engine & Project Workspace
- **Open Any Project Folder**: Connect any local workspace folder on your disk directly to a conversation thread.
- **Autonomous Multi-Turn Coding Loop**: When working in a workspace, models autonomously dispatch coding tools over up to 20 turns (configurable) to inspect, scaffold, edit, and test code.
- **6 Standard Coding Tools**:
  - `write_to_file`: Creates new project files and scaffolds parent directories automatically.
  - `view_file`: Inspects files with line numbers and optional line-range slicing.
  - `replace_file_content`: Performs surgical block edits without re-generating entire files.
  - `list_dir`: Explores the directory structure with file sizes and directory counts.
  - `run_command`: Spawns shell processes (`npm`, `npx`, `git`, `python`, etc.) bound strictly to the workspace root.
  - `grep_search`: Performs fast regex and substring pattern searches across all project files.
- **Real-Time Streaming Terminal Output**: Terminal commands stream live stdout and stderr chunks directly to the UI over IPC (`chat:tool-command-output`), rendering into dark monospaced terminal cards with exit-code badges (`exit 0`).
- **Path Traversal Security Sandbox**: All file accesses are verified by `resolveSafePath`, strictly preventing directory traversal (`../`) or escaping the workspace root.
- **Interactive Workspace Drawer**: Slide-over panel featuring a recursive file tree with file-type extension icons, file sizes, live search filter, and an "Open in Explorer" shortcut.
- **Line-Numbered File Preview Modal**: Fullscreen/dialog inspection of any workspace file with line numbers, file metadata, and one-click clipboard copying.
- **Execution & Safety Policies**: Configurable in **Settings** > **Defaults & Generation** (`auto` autonomous execution, `confirm-destructive`, or `confirm-all`), along with custom command timeouts and agent turn limits.

### 9. Security, Storage & Ergonomics
- **Hardware-Backed Credential Security**: API keys are securely encrypted using native OS Keychains via Electron `safeStorage` (Windows DPAPI, macOS Keychain, Linux Secret Service), with automatic AES-256-GCM fallback.
- **Embedded WebAssembly SQLite**: Thread history, provider credentials, workspace paths, and settings are persisted locally via `sql.js` with safe, non-destructive schema migrations.
- **shadcn/ui Zinc Monochrome Aesthetic**: Precision 1px borders, deep dark mode surfaces (`#09090B`), subtle elevations, and Geist typography.
- **Rich Markdown & LaTeX**: Full GitHub Flavored Markdown (tables, blockquotes, checklists) and inline/display math formulas rendered with **KaTeX**.
- **Keyboard-First Workflow**: Global shortcuts, including **`Ctrl + .`** to immediately jump into the composer from anywhere.

---

## Keyboard Shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| **`Ctrl + .`** / **`Cmd + .`** | **Focus Message Composer Input** | Global Window |
| **`Ctrl + N`** / **`Cmd + N`** | **Create New Conversation** | Global Window |
| **`Ctrl + ,`** / **`Cmd + ,`** | **Open Settings Modal** | Global Window |
| **`⌘K`** / **`Ctrl + K`** | **Focus Sidebar Thread Search** | Global Window |
| **`Enter`** | **Submit Message** | Inside Composer |
| **`Shift + Enter`** | **Insert Newline** | Inside Composer |
| **`Escape`** | **Dismiss Modals / Cancel Edit / Close Fullscreen** | Global Window |

---

## Architecture & Process Model

The application strictly adheres to Electron's security model with context isolation and dedicated process boundaries:

```mermaid
graph TD
    subgraph Renderer ["Renderer Process (React 19 + Vite)"]
        UI[shadcn/ui Zinc Interface]
        Artifacts[Sandboxed Live Preview: Desktop/Tablet/Mobile]
        Branching[Message Branch Tree: Sibling Pagination]
        Thinking[Reasoning Accordion + Stopwatch]
        BrowserDrawer[Web Browser Drawer: Reader + Screenshot]
        WorkspaceDrawer[Workspace Drawer: File Tree + Preview]
        ToolCards[ToolCallCard: Trajectory + Live Terminal]
        DangerZone[Factory Reset & Data Management]
        Zustand[Zustand Stores: useChatStore, useProviderStore, useSettingsStore]
        Bridge[window.electronAPI]
    end

    subgraph Preload ["Preload Script (Context Isolation)"]
        CB[contextBridge.exposeInMainWorld]
    end

    subgraph Main ["Main Process (Node.js + Electron)"]
        IPC[IPC Handler Registry + Reset Handler]
        Engine[ChatEngine + Multi-Turn ReAct Loop]
        WorkspaceTools[WorkspaceTools Sandbox & Traversal Guards]
        Shell[Terminal Shell: PowerShell / Bash]
        BrowserSession[Chromium Session persist:web-agent]
        SearchEng[Search Service: DuckDuckGo / Brave / Tavily / Serper]
        PageFetch[Reader Page Fetcher: HTML to Markdown]
        DocProc[Document Processor: PDF, DOCX, Text, Images]
        Adapters[Multi-Protocol Adapters: OpenAI, Gemini, OpenRouter, Ollama]
        DB[(SQLite via sql.js + Dev/Prod Isolation)]
        Keyring[(safeStorage / DPAPI / AES-256-GCM)]
    end

    subgraph External ["External Services & Filesystem"]
        APIs[OpenAI / Gemini / OpenRouter / Ollama / Custom API]
        Web[Live Web: DuckDuckGo / Brave / Tavily / Target URLs]
        FS[(Local Project Workspace Directory)]
    end

    UI --> Zustand
    Artifacts --> UI
    Branching --> UI
    Thinking --> UI
    BrowserDrawer --> UI
    WorkspaceDrawer --> UI
    ToolCards --> UI
    DangerZone --> Bridge
    Zustand --> Bridge
    Bridge --> CB
    CB --> IPC
    IPC --> Engine
    Engine --> WorkspaceTools
    WorkspaceTools --> FS
    WorkspaceTools --> Shell
    Engine --> BrowserSession
    Engine --> SearchEng
    Engine --> PageFetch
    IPC --> DocProc
    IPC --> DB
    IPC --> Keyring
    Engine --> Adapters
    Adapters --> APIs
    SearchEng --> Web
    BrowserSession --> Web
    PageFetch --> Web
```

---

## Directory & Subsystem Documentation

Every subsystem in this repository contains dedicated technical documentation:

| Directory | Documentation Link | Description |
|---|---|---|
| **`scripts/`** | [**`scripts/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/scripts/README.md) | Esbuild and Vite build, development, and clean-data automation scripts. |
| **`tests/`** | [**`tests/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/tests/README.md) | 81-test Vitest suite covering stream parsers, adapters, branching, thinking, artifacts, web search, page reading, tool calling, workspace sandbox tools, and coding definitions. |
| **`src/`** | [**`src/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/README.md) | High-level architectural overview of the source tree. |
| **`src/shared/`** | [**`src/shared/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/shared/README.md) | Shared domain contracts, data types, constants, tool schemas, and validation. |
| **`src/preload/`** | [**`src/preload/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/preload/README.md) | Secure context bridge exposing `window.electronAPI`. |
| **`src/main/`** | [**`src/main/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/main/README.md) | Electron main process entry, window lifecycle, dev/prod data isolation, and security headers. |
| **`src/main/browser/`** | [**`src/main/browser/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/main/browser/README.md) | Sandboxed Chromium session (`persist:web-agent`), search service (DDG/Brave/Tavily/Serper), page reader, and autonomous tools. |
| **`src/main/documents/`** | [**`src/main/documents/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/README.md) | Document parsing and token chunking (PDF, DOCX, TXT, MD, images). |
| **`src/main/engine/`** | [**`src/main/engine/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/README.md) | Chat completion orchestrator, multi-turn ReAct tool loop, branch history resolver, SSE stream parser, and diagnostics. |
| **`src/main/engine/tools/`** | [**`src/main/engine/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/main/engine/README.md) | Workspace file operations sandbox (`WorkspaceTools`), path traversal guards, command execution, and coding tool schemas. |
| **`src/main/ipc/`** | [**`src/main/ipc/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/main/ipc/README.md) | Inter-process communication channel definitions and handler mappings. |
| **`src/main/providers/`** | [**`src/main/providers/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/main/providers/README.md) | Multi-protocol provider adapters with function calling and tool execution support. |
| **`src/main/storage/`** | [**`src/main/storage/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/main/storage/README.md) | SQLite database management, safe column migrations, factory reset, and OS keychain encryption. |
| **`src/renderer/`** | [**`src/renderer/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/README.md) | Vite frontend entrypoint and index HTML configuration. |
| **`src/renderer/src/`** | [**`src/renderer/src/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/README.md) | React 19 root component, design system tokens, and global listeners. |
| **`src/renderer/src/components/`** | [**`src/renderer/src/components/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/README.md) | UI components domain overview. |
| **`src/renderer/src/components/chat/`** | [**`src/renderer/src/components/chat/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/chat/README.md) | Message items, live terminal tool cards, citations, slide-over browser drawer, branching buttons, and composer. |
| **`src/renderer/src/components/workspace/`** | [**`src/renderer/src/components/workspace/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/workspace/README.md) | Workspace drawer, interactive file tree with search filter, and line-numbered file preview modal. |
| **`src/renderer/src/components/layout/`** | [**`src/renderer/src/components/layout/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/layout/README.md) | Window titlebar and conversation navigation sidebar. |
| **`src/renderer/src/components/settings/`** | [**`src/renderer/src/components/settings/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/settings/README.md) | Settings modal with Web Browsing tab, provider forms, diagnostics, and Danger Zone reset. |
| **`src/renderer/src/store/`** | [**`src/renderer/src/store/README.md`**](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/store/README.md) | Zustand state stores (`useChatStore`, `useProviderStore`, `useSettingsStore`). |

---

## Quick Start

### 1. Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v9.0.0 or higher

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/brick-24/box-llm-ui.git
cd box

# Install dependencies
npm install
```

### 3. Development Mode
Starts Vite's hot-reloading dev server and launches Electron with an isolated development profile (`universal-llm-client-dev`):
```bash
npm run dev
```

### 4. Running Unit Tests
Runs the complete 81-test Vitest test suite validating stream parsers, adapters, message branching, thinking accordions, live artifacts, web search, page reading, tool calling, SQLite migrations, data resets, workspace sandbox tools, and coding schemas:
```bash
npm test
```

### 5. Production Build
Compiles the Vite frontend bundle and uses `esbuild` to assemble `dist/main` and `dist/preload`:
```bash
npm run build
```

### 6. Packaging Windows Executables (.exe)
Build standalone Windows installers and portable binaries:
```bash
# Package Windows NSIS installer and portable executable
npm run dist:win

# Automatically wipe local dev/test databases first, then package
npm run dist:clean

# Build unpacked native directory for instant local testing
npm run dist:dir
```

Output files in [`release/`](file:///c:/Users/raghav/Desktop/spare/box/release):
- **`Universal LLM-Setup-1.0.0.exe`**: Standard Windows installer wizard with Start Menu and Desktop shortcuts.
- **`Universal LLM-Portable-1.0.0.exe`**: Zero-install standalone executable that runs directly from any folder or USB drive.

### 7. Clearing Local Data
Purge local development and test databases at any time:
```bash
npm run clean:data
```
Or open **Settings** > **Data & Backup** > **Reset to Factory Defaults** directly inside the app.

---

## Technology Stack

| Domain | Technology | Description |
|---|---|---|
| **Runtime** | [Electron 34](https://www.electronjs.org/) | Cross-platform desktop shell with Chromium & Node.js |
| **Frontend** | [React 19](https://react.dev/) | Modern reactive user interface library |
| **Build Tooling** | [Vite 6](https://vitejs.dev/) + [esbuild](https://esbuild.github.io/) | Lightning-fast HMR and dual-process bundling |
| **Packaging** | [electron-builder 25](https://www.electron.build/) | NSIS Windows installer and Portable `.exe` packaging |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) | Semantic HSL design tokens matching shadcn/ui zinc |
| **State Management**| [Zustand 5](https://github.com/pmndrs/zustand) | Minimalist, unopinionated reactive client stores |
| **Database** | [sql.js](https://sql.js.org/) | In-process WebAssembly SQLite engine with auto-migrations |
| **Security** | `safeStorage` (Electron) | Hardware-backed DPAPI / Keychain credential encryption |
| **Markdown & Math** | `react-markdown` + `KaTeX` | LaTeX equations, tables, and syntax-highlighted code |
| **Sandbox Preview** | Native isolated `<iframe>` | `allow-scripts` without `allow-same-origin` (safe null origin) |
| **Testing** | [Vitest](https://vitest.dev/) | 81 tests across 16 suites validating full client pipeline |

---

## License

This project is licensed under the [MIT License](file:///c:/Users/raghav/Desktop/spare/box/package.json).
