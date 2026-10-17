# Document Processing Subsystem (`src/main/documents/`)

This directory implements the file ingestion, document text extraction, and text chunking engine for the universal LLM client.

---

## Files Overview

### 1. [`document-processor.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/document-processor.ts)
- **Role**: Ingestion coordinator.
- **Responsibilities**:
  - Validates file paths, file sizes, and MIME types.
  - Detects format by extension and routes to appropriate extractor:
    - **PDF**: [`pdf-extractor.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/pdf-extractor.ts)
    - **DOCX**: [`docx-extractor.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/docx-extractor.ts)
    - **Code & Text**: [`text-extractor.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/text-extractor.ts)
    - **Images**: Base64 data URI conversion for multimodal vision models.
  - Constructs the standardized [`Attachment`](file:///c:/Users/raghav/Desktop/spare/box/src/shared/types.ts) payload with token estimations.

---

### 2. [`pdf-extractor.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/pdf-extractor.ts)
- **Role**: PDF text extraction.
- **Mechanism**: Reads PDF binary buffers using `pdf-parse`, extracting full text, page counts, and metadata while handling corrupted or encrypted documents gracefully.

---

### 3. [`docx-extractor.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/docx-extractor.ts)
- **Role**: Word document text extraction.
- **Mechanism**: Leverages `mammoth` to extract clean, unformatted raw text from `.docx` XML archives while stripping markup artifacts.

---

### 4. [`text-extractor.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/text-extractor.ts)
- **Role**: Source code and text document extraction.
- **Supported Extensions**: `.txt`, `.md`, `.markdown`, `.json`, `.csv`, `.xml`, `.yaml`, `.yml`, `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.rs`, `.go`, `.html`, `.css`.
- **Mechanism**: Decodes UTF-8 text buffers with BOM stripping.

---

### 5. [`chunker.ts`](file:///c:/Users/raghav/Desktop/spare/box/src/main/documents/chunker.ts)
- **Role**: Document chunking and token estimation.
- **Mechanism**:
  - Implements character and token-aware windowing (`chunkSize`, `chunkOverlap`).
  - Preserves paragraph and sentence boundaries to avoid splitting in the middle of words.
  - Estimates token usage using character-to-token heuristics (approx. 4 characters per token).
