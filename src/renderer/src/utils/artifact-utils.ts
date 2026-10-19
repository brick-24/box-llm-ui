/**
 * Utilities for detecting, preparing, and safely rendering code artifacts
 * (HTML, SVG, interactive web snippets) in an isolated sandbox.
 */

export type ArtifactType = 'html' | 'svg';
export type DeviceViewport = 'desktop' | 'tablet' | 'mobile';

export const VIEWPORT_WIDTHS: Record<DeviceViewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

/**
 * Checks if a given language and code snippet qualifies as a renderable artifact.
 */
export function isArtifactPreviewable(language?: string, code?: string): boolean {
  if (!code || !code.trim()) return false;

  const normalizedLang = (language || '').trim().toLowerCase();

  if (['html', 'htm'].includes(normalizedLang)) {
    return true;
  }

  if (normalizedLang === 'svg') {
    return true;
  }

  // Detect SVG in XML or generic markup
  if (['xml', 'markup', ''].includes(normalizedLang)) {
    const trimmed = code.trim();
    if (/<svg[\s>]/i.test(trimmed) && /<\/svg>/i.test(trimmed)) {
      return true;
    }
    if (/<!DOCTYPE\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
      return true;
    }
  }

  // Detect standalone HTML markup even if untagged
  if (!normalizedLang) {
    const trimmed = code.trim();
    if (
      (trimmed.startsWith('<!DOCTYPE html>') || trimmed.startsWith('<html')) &&
      trimmed.includes('</html>')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether the previewable artifact is HTML or SVG.
 */
export function getArtifactType(language?: string, code?: string): ArtifactType | null {
  if (!isArtifactPreviewable(language, code)) return null;

  const normalizedLang = (language || '').trim().toLowerCase();
  if (normalizedLang === 'svg') return 'svg';

  const trimmed = (code || '').trim();
  if (/<svg[\s>]/i.test(trimmed) && /<\/svg>/i.test(trimmed) && !trimmed.includes('<html')) {
    return 'svg';
  }

  return 'html';
}

/**
 * Returns appropriate file extension for exporting the artifact.
 */
export function getArtifactExtension(type: ArtifactType): string {
  return type === 'svg' ? '.svg' : '.html';
}

/**
 * Returns MIME type for artifact export.
 */
export function getArtifactMimeType(type: ArtifactType): string {
  return type === 'svg' ? 'image/svg+xml' : 'text/html';
}

/**
 * Generates safely sandboxed HTML document string to be injected via srcDoc.
 *
 * Security Note:
 * The resulting document MUST be rendered inside an iframe with:
 *   sandbox="allow-scripts" (WITHOUT allow-same-origin)
 * This guarantees the sandbox is bound to origin 'null' and has no access
 * to host localStorage, parent window DOM, or Electron IPC.
 */
export function generateSandboxedHtml(
  code: string,
  type: ArtifactType,
  isDarkTheme: boolean = true
): string {
  if (type === 'svg') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SVG Preview</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      height: 100%;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;
      background-color: ${isDarkTheme ? '#09090b' : '#ffffff'};
      background-image: ${
        isDarkTheme
          ? 'radial-gradient(circle, #27272a 1px, transparent 1px)'
          : 'radial-gradient(circle, #e4e4e7 1px, transparent 1px)'
      };
      background-size: 16px 16px;
      color: ${isDarkTheme ? '#fafafa' : '#09090b'};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .svg-container {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      max-width: 100%;
      max-height: 100%;
    }
    svg {
      max-width: 100%;
      max-height: 85vh;
      height: auto;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
    }
  </style>
</head>
<body>
  <div class="svg-container">
    ${code}
  </div>
</body>
</html>`;
  }

  // HTML rendering
  const trimmed = code.trim();
  const isFullDoc =
    /<!DOCTYPE\s+html/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed) ||
    /<head[\s>]/i.test(trimmed) ||
    /<body[\s>]/i.test(trimmed);

  const safeErrorHandlerScript = `
  <script>
    window.onerror = function(msg, url, line, col, error) {
      console.warn('[Live Preview Warning]:', msg, 'at line', line);
      return false;
    };
  </script>`;

  if (isFullDoc) {
    let result = code;

    // Inject meta viewport if missing in head
    if (!/<meta[^>]+viewport/i.test(result)) {
      const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
      if (/<head[\s>]/i.test(result)) {
        result = result.replace(/<head([\s>])/i, `<head$1\n  ${viewportMeta}`);
      }
    }

    // Inject safe error handler
    if (/<head[\s>]/i.test(result)) {
      result = result.replace(/<head([\s>])/i, `<head$1\n  ${safeErrorHandlerScript}`);
    } else if (/<body[\s>]/i.test(result)) {
      result = result.replace(/<body([\s>])/i, `<body$1\n  ${safeErrorHandlerScript}`);
    } else {
      result = safeErrorHandlerScript + result;
    }

    return result;
  }

  // Fragment wrapping
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Artifact Preview</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      background-color: ${isDarkTheme ? '#09090b' : '#ffffff'};
      color: ${isDarkTheme ? '#fafafa' : '#09090b'};
      overflow-x: hidden;
    }
  </style>
  ${safeErrorHandlerScript}
</head>
<body>
  ${code}
</body>
</html>`;
}
