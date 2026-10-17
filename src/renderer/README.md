# Renderer Process Root (`src/renderer/`)

This directory contains the client frontend application built with **React 19**, **Vite**, **TypeScript**, and **Tailwind CSS**, adhering to the **shadcn/ui** zinc aesthetic and Apple Human Interface Guidelines.

---

## Directory Structure

```
src/renderer/
├── index.html        # Single-page application HTML entrypoint
└── src/              # React application source code
    ├── App.tsx       # Root component with keyboard shortcuts and layout wiring
    ├── main.tsx      # React root mount and DOM initialization
    ├── index.css     # Design system CSS tokens, HSL variables, typography
    ├── vite-env.d.ts # Vite client type definitions
    ├── components/   # Modular UI components (chat, layout, settings)
    └── store/        # Zustand state stores (chat, providers, settings)
```

---

## Files Overview

### 1. [`index.html`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/index.html)
- **Role**: SPA HTML entrypoint.
- **Key Features**:
  - Sets dark background canvas (`bg-[#09090b]`) preventing flash-of-white during window boot.
  - Configures responsive viewport metadata and dark mode color scheme.
  - Imports modern typography from Google Fonts:
    - **Geist Sans**: Modern, precision-engineered geometric sans-serif for UI labels and headings.
    - **Geist Mono**: Surgical monospace font for code blocks, token counts, and latency chips.
  - Mounts `<div id="root"></div>` and loads [`src/main.tsx`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/main.tsx).
