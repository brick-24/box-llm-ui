import fs from 'node:fs';
import path from 'node:path';

function getWorkspaceDir(): string {
  const root = process.cwd();
  const target = path.join(root, 'workspace');
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_+/g, '_');
}

export async function executePdfTool(
  toolName: string,
  args: Record<string, any>
): Promise<{ result: any }> {
  switch (toolName) {
    case 'generate_pdf': {
      const title = String(args.title || 'Untitled Document').trim();
      const content = typeof args.content === 'string' ? args.content : String(args.content ?? '');
      if (!content.trim()) {
        throw new Error('Missing "content" parameter for generate_pdf');
      }

      let rawFilename = args.filename ? String(args.filename).trim() : `${title.toLowerCase().slice(0, 30)}.pdf`;
      if (!rawFilename.endsWith('.pdf') && !rawFilename.endsWith('.html')) {
        rawFilename += '.pdf';
      }
      const safeName = sanitizeFilename(rawFilename);
      const workspace = getWorkspaceDir();
      const outputPath = path.join(workspace, safeName);

      // Generate a styled, printable HTML document representation
      const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 2cm; size: A4; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
    }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 0; }
    h2, h3 { color: #334155; margin-top: 24px; }
    pre, code { font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; background: #f8fafc; border-radius: 4px; }
    pre { padding: 12px; border: 1px solid #e2e8f0; overflow-x: auto; }
    p { margin-bottom: 12px; }
    .header-meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="header-meta">Generated on ${new Date().toLocaleString()}</div>
  <div class="content">
    ${formatSimpleMarkdown(content)}
  </div>
</body>
</html>`;

      await fs.promises.writeFile(outputPath, htmlDocument, 'utf-8');

      return {
        result: {
          success: true,
          filename: safeName,
          title,
          path: outputPath,
          bytes: Buffer.byteLength(htmlDocument, 'utf-8'),
          message: `Document "${safeName}" generated successfully. Ready for preview and print.`,
        },
      };
    }

    default:
      throw new Error(`Unknown PDF tool: ${toolName}`);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatSimpleMarkdown(text: string): string {
  return text
    .split('\n\n')
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (trimmed.startsWith('# ')) {
        return `<h1>${escapeHtml(trimmed.slice(2))}</h1>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
      }
      if (trimmed.startsWith('### ')) {
        return `<h3>${escapeHtml(trimmed.slice(4))}</h3>`;
      }
      if (trimmed.startsWith('- ')) {
        const items = trimmed
          .split('\n')
          .map((line) => `<li>${escapeHtml(line.replace(/^[-\*]\s*/, ''))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}
