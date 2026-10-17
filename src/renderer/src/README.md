# React Application Root (`src/renderer/src/`)

This directory houses the root React 19 application components, styles, and entrypoints.

---

## Files Overview

### 1. [`App.tsx`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/App.tsx)
- **Role**: Application Root Component & Global Shortcut Router.
- **Key Responsibilities**:
  - Initializes Zustand stores on mount (`initStore`, `initProviders`, `loadSettings`).
  - Sets up global keyboard event listeners:
    - **`Ctrl + .` / `Cmd + .`**: Dispatches `'focus-message-input'` event to immediately enter and focus the message composer input textarea.
    - **`Ctrl + N` / `Cmd + N`**: Triggers `createConversation()`.
    - **`Ctrl + ,` / `Cmd + ,`**: Opens the Settings Modal.
    - **`Escape`**: Dismisses open popovers or modals.
  - Assembles the core window layout: [`TitleBar`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/layout/TitleBar.tsx), collapsible [`Sidebar`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/layout/Sidebar.tsx), [`ChatArea`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/chat/ChatArea.tsx), and [`SettingsModal`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/settings/SettingsModal.tsx).

---

### 2. [`main.tsx`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/main.tsx)
- **Role**: React 19 Bootstrap Entry.
- **Mechanism**: Calls `createRoot(document.getElementById('root')!)` and renders `<App />` within `React.StrictMode`.

---

### 3. [`index.css`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/index.css)
- **Role**: Design System Design Tokens & Typography Architecture.
- **Design Aesthetic**: shadcn/ui zinc monochrome system paired with Apple Human Interface Guidelines:
  - **Color Tokens**: Standardized HSL custom variables for `:root` and `.dark`:
    - Base: `--background: 240 10% 3.9%`, `--foreground: 0 0% 98%`
    - Surfaces: `--card: 240 10% 4.9%`, `--popover: 240 10% 4.9%`
    - Accents: `--primary: 0 0% 98%`, `--secondary: 240 3.7% 15.9%`, `--muted: 240 3.7% 15.9%`
    - Structural: `--border: 240 3.7% 15.9%`, `--ring: 240 4.9% 83.9%`
  - **Scrollbar Styling**: 6px precision scrollbars with translucent zinc thumb styling.
  - **KaTeX Integration**: Embedded KaTeX math formatting rules for LaTeX rendering.
  - **Animations**: Cursor pulse and subtle fade-in transitions.

---

### 4. [`vite-env.d.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/vite-env.d.ts)
- **Role**: TypeScript declarations for Vite client environment variables and the `window.electronAPI` interface.
