# Native Web Surfing & Search Engine (`src/main/browser/`)

This directory contains the sandboxed browser runtime, multi-provider web search engine, reader-mode page extractor, and autonomous tool calling interface.

---

## Directory Structure

```
src/main/browser/
├── browser-session.ts    # Sandboxed Chromium offscreen window management & screenshot capture
├── page-fetcher.ts       # Fast HTTP reader-mode extractor (HTML-to-markdown)
├── search-service.ts     # Multi-provider web search engine (DuckDuckGo, Brave, Tavily, Serper)
└── web-tools.ts          # OpenAI-compatible tool specifications & execution dispatcher
```

---

## Files Overview

### 1. [`browser-session.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/browser/browser-session.ts)
- **Role**: Sandboxed Chromium Off-Screen Browser Manager.
- **Key Features**:
  - **Zero External Downloads**: Utilizes Electron's built-in Chromium engine via isolated partition `persist:web-agent`. No external 300MB Playwright or Puppeteer binaries are downloaded.
  - **Off-Screen Rendering**: Creates hidden `BrowserWindow` instances (`show: false`, `width: 1280, height: 800`) to navigate dynamic single-page applications (SPAs) and execute client-side JavaScript.
  - **Hardware Security Sandbox**:
    - Strips Node.js integration (`nodeIntegration: false`, `contextIsolation: true`).
    - Automatically denies hardware permissions (camera, microphone, geolocation, desktop capture, notifications).
    - Protocol guards block non-web protocols (`file:`, `javascript:`, `data:`, `about:`).
  - **Visual Screenshots**: Generates high-fidelity base64-encoded PNG screenshots via `webContents.capturePage()` for slide-over drawer viewing and vision models.
  - **Headless Node/Vitest Fallback**: Detects non-Electron testing environments and automatically falls back to `fetchWebPage` without crashing.

---

### 2. [`page-fetcher.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/browser/page-fetcher.ts)
- **Role**: High-Speed Reader-Mode Article Extractor.
- **Key Features**:
  - **Boilerplate Stripping**: Removes intrusive noise tags (`<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<aside>`, `<noscript>`, `<iframe>`, `<svg>`).
  - **HTML to Clean Markdown**: Converts semantic headings (`<h1>`-`<h6>`), lists (`<ul>`, `<ol>`, `<li>`), blockquotes, paragraphs, and anchor links into clean markdown.
  - **Token Safety Truncation**: Enforces a default 12,000 character ceiling to prevent blowing model context windows while ensuring comprehensive coverage.
  - **Anti-Bot Spoofing**: Mimics modern desktop Chrome User-Agent and headers to bypass generic web scraper blocks.

---

### 3. [`search-service.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/browser/search-service.ts)
- **Role**: Universal Web Search Orchestrator.
- **Supported Providers**:
  - **DuckDuckGo (Default / Free)**: Zero-config HTML privacy scraper. Resolves real destination URLs from DuckDuckGo `//duckduckgo.com/l/?uddg=...` wrappers and decodes HTML entities.
  - **Brave Search API**: High-speed, independent web index for privacy-focused setups (`https://api.search.brave.com/res/v1/web/search`).
  - **Tavily Search API**: Engineered specifically for LLMs and autonomous research agents (`https://api.tavily.com/search`).
  - **Serper (Google Search)**: Google Search API for live web results and rich snippets (`https://google.serper.dev/search`).
- **Configurable Result Limits**: Supports 3 to 10 results per query with query sanitation and error fallback.

---

### 4. [`web-tools.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/browser/web-tools.ts)
- **Role**: Autonomous Tool Declarations & Dispatcher.
- **Tool Specifications (OpenAI Function Calling format)**:
  - `search_web`: Performs live web searches returning titles, snippets, and source URLs.
  - `fetch_web_page`: Fast reader extraction of articles into markdown.
  - `browse_page`: Full Chromium navigation evaluating dynamic JavaScript and extracting DOM text.
  - `take_page_screenshot`: Captures full off-screen screenshots of web pages.
- **`executeWebTool(name, args, settings)`**: Type-safe dispatcher validating inputs and returning stringified tool results with structured citation metadata.
