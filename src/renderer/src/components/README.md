# UI Components Architecture (`src/renderer/src/components/`)

This directory houses all visual presentation and interactive components, organized into distinct architectural domains.

---

## Component Domains

```
src/renderer/src/components/
├── chat/        # Message feed, input composer, attachment chips, code blocks, markdown
├── layout/      # Frameless window TitleBar and conversation management Sidebar
├── settings/    # Application settings modal and dynamic provider configuration forms
└── workspace/   # Workspace drawer, interactive file tree with search, and line-numbered file preview modal
```

---

## Design Principles Applied

1. **shadcn/ui Precision**: Surgical 1px borders (`border-border`), high-contrast monochromes (zinc dark palette), minimal radii (`rounded-lg`, `rounded-md`), and elevated surfaces.
2. **Apple HIG Usability**: Distinct hierarchy, clear active states, accessibility tooltips, fluid disclosure chevrons, and keyboard navigation.
3. **Responsive Adaptability**: Flex and grid structures that smoothly scale from compact windows to full-screen desktop displays.
