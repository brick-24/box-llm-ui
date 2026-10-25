# Workspace Components (`src/renderer/src/components/workspace/`)

This directory houses the visual components for interacting with local coding workspaces: the slide-over file tree drawer and the line-numbered file preview modal.

---

## Files Overview

### 1. [`WorkspaceDrawer.tsx`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/workspace/WorkspaceDrawer.tsx)
- **Role**: Slide-over Workspace File Tree & Navigation Drawer.
- **Key Features**:
  - **Slide-Over Panel**: Anchored to the right viewport with translucent dark backdrop blur (`bg-zinc-900/95 backdrop-blur-xl`), animated slide transitions, and responsive widths.
  - **Header Controls**:
    - Project folder name and full path tooltip.
    - **Refresh Button (`RotateCw`)**: Re-scans the disk hierarchy on demand.
    - **Open in Explorer (`ExternalLink`)**: Launches the native OS file explorer (Windows Explorer, Finder, or Linux file manager) targeting the workspace root.
    - **Change Folder Button**: Triggers the native folder picker dialog to switch or associate a workspace.
  - **Live Filter Search**: Instant client-side substring filter that expands matching folder branches while pruning non-matching nodes.
  - **Hierarchical Tree View (`TreeNodeView`)**:
    - Recursive directory rendering with collapsible folder chevrons.
    - Extension-tailored iconography:
      - TypeScript (`.ts`, `.tsx`): Blue code icon.
      - JavaScript (`.js`, `.jsx`): Amber code icon.
      - JSON (`.json`): Yellow braces icon.
      - Markdown (`.md`): Purple document icon.
      - Stylesheets (`.css`, `.scss`): Cyan icon.
      - Python (`.py`): Emerald code icon.
    - Formatted file size indicators (`KB`, `MB`).
    - 1-click file selection triggers [`openFilePreview(relativePath)`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/store/useChatStore.ts#L458).
  - **Summary Footer**: Dynamic counts of total indexed files and directories.

---

### 2. [`FilePreviewModal.tsx`](file:///c:/Users/raghav/Desktop/spare/box/src/renderer/src/components/workspace/FilePreviewModal.tsx)
- **Role**: Modal Code Inspector & Content Viewer.
- **Key Features**:
  - Modal overlay with background click dismissal and `Escape` key capture.
  - **Header**: Relative file path title, file size badge, and total line count.
  - **Quick Copy**: One-click clipboard copy button with transient "Copied" feedback state.
  - **Gutter & Code Body**: Dual-column monospace viewer with 1-based line numbering gutter and horizontal scroll containers for long lines.
