import { describe, it, expect } from 'vitest';
import {
  htmlToMarkdown,
  extractTitle,
  extractMetaDescription,
} from '../src/main/browser/page-fetcher';

describe('Page Content Extractor & Markdown Converter', () => {
  it('extracts title and meta description accurately', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Electron 34.0.0 | Electron Blog</title>
          <meta name="description" content="Discover the latest changes in Electron 34." />
        </head>
        <body>
          <p>Hello</p>
        </body>
      </html>
    `;

    expect(extractTitle(html)).toBe('Electron 34.0.0 | Electron Blog');
    expect(extractMetaDescription(html)).toBe('Discover the latest changes in Electron 34.');
  });

  it('strips non-content elements and converts articles to clean markdown', () => {
    const html = `
      <div>
        <nav><a href="/home">Home</a><a href="/about">About</a></nav>
        <script>console.log("analytics tracking code");</script>
        <style>.ad-banner { display: block; }</style>
        <header>Header content</header>
        <article>
          <h1>Electron 34 Release</h1>
          <p>Electron 34 includes <strong>Chromium 132</strong> and <em>Node 20</em>.</p>
          <blockquote>Great desktop runtime performance.</blockquote>
          <h2>Highlights</h2>
          <ul>
            <li>V8 13.2 engine upgrade</li>
            <li>New WebContentsView APIs</li>
          </ul>
          <pre><code>const { app } = require('electron');\napp.quit();</code></pre>
          <p>Read more at <a href="https://electronjs.org">official docs</a>.</p>
        </article>
        <footer>Copyright 2026 Electron</footer>
      </div>
    `;

    const md = htmlToMarkdown(html);

    // Strips script, style, nav, footer, header
    expect(md).not.toContain('analytics tracking code');
    expect(md).not.toContain('.ad-banner');
    expect(md).not.toContain('Copyright 2026 Electron');

    // Retains structured markdown
    expect(md).toContain('# Electron 34 Release');
    expect(md).toContain('**Chromium 132**');
    expect(md).toContain('*Node 20*');
    expect(md).toContain('> Great desktop runtime performance.');
    expect(md).toContain('## Highlights');
    expect(md).toContain('- V8 13.2 engine upgrade');
    expect(md).toContain('- New WebContentsView APIs');
    expect(md).toContain("const { app } = require('electron');");
    expect(md).toContain('[official docs](https://electronjs.org)');
  });
});
