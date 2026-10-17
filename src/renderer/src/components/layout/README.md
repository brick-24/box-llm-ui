# Window Layout Components (`src/renderer/src/components/layout/`)

This directory contains the primary framing and structural components for the desktop application window.

---

## Files Overview

### 1. [`TitleBar.tsx`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/layout/TitleBar.tsx)
- **Role**: Custom Frameless Window TitleBar.
- **Design Specifications**:
  - Precision height (36px / `h-9`) with zinc bottom border (`border-b border-border`).
  - Electron draggable region (`-webkit-app-region: drag`) with non-draggable interactive controls (`no-drag`).
- **Features**:
  - **Monochrome Brandmark**: Minimalist icon with application title.
  - **Live Model Pill**: Displays the currently selected model with a status dot.
  - **Window Controls**: Accessible Minimize, Maximize/Restore, and Close buttons styled with hover states (and standard red close hover).

---

### 2. [`Sidebar.tsx`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/layout/Sidebar.tsx)
- **Role**: Conversation Thread Navigator & Command Sidebar.
- **Key Features**:
  - **Primary Action**: "New Chat" button with a sleek keyboard shortcut badge (`Ctrl+N` / `⌘N`).
  - **Search Bar**: Real-time thread search with magnifying glass icon and `⌘K` badge.
  - **Thread Categorization**:
    - **Pinned Threads**: Starred conversations pinned to the top.
    - **Recent Threads**: Chronologically grouped conversation threads.
  - **Item Interactions**:
    - High-contrast active thread selection with 1px border.
    - Inline Rename with input field and confirmation.
    - Pin/Unpin toggle.
    - Delete conversation with confirmation dialog.
  - **Sidebar Footer**:
    - Settings button with `Ctrl+,` shortcut indicator.
    - Diagnostics toggle button for inspecting system logs.
