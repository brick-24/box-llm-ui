import { describe, it, expect } from 'vitest';
import {
  decodeHtmlEntities,
  cleanDuckDuckGoUrl,
  stripHtmlTags,
  parseDuckDuckGoHtml,
} from '../src/main/browser/search-service';

describe('Web Search Service', () => {
  it('decodes HTML entities correctly', () => {
    expect(decodeHtmlEntities('&amp; &lt; &gt; &quot; &#39; &#x27;')).toBe('& < > " \' \'');
    expect(decodeHtmlEntities('Hello&#32;World')).toBe('Hello World');
    expect(decodeHtmlEntities('Electron&#x20;34')).toBe('Electron 34');
  });

  it('unwraps DuckDuckGo redirect URLs with uddg parameters', () => {
    const rawRedirect = '//duckduckgo.com/l/?kh=-1&uddg=https%3A%2F%2Fwww.electronjs.org%2Fblog%2Felectron-34-0';
    expect(cleanDuckDuckGoUrl(rawRedirect)).toBe('https://www.electronjs.org/blog/electron-34-0');

    const directUrl = 'https://github.com/electron/electron';
    expect(cleanDuckDuckGoUrl(directUrl)).toBe('https://github.com/electron/electron');
  });

  it('strips HTML tags and normalizes whitespace', () => {
    const htmlSnippet = '<b>Electron 34.0.0</b> has been <i>released</i> with &amp; Chromium 132.';
    expect(stripHtmlTags(htmlSnippet)).toBe('Electron 34.0.0 has been released with & Chromium 132.');
  });

  it('parses structured search results from DuckDuckGo HTML output', () => {
    const mockHtml = `
      <html>
        <body>
          <div class="result results_links results_links_deep web-result">
            <h2 class="result__title">
              <a class="result__a" href="/l/?uddg=https%3A%2F%2Fwww.electronjs.org%2Fblog%2Felectron-34-0">
                Electron <b>34.0.0</b> Release Notes
              </a>
            </h2>
            <a class="result__snippet" href="/l/?uddg=https%3A%2F%2Fwww.electronjs.org%2Fblog%2Felectron-34-0">
              Electron 34.0.0 has been released with Chromium 132 and Node 20.
            </a>
          </div>

          <div class="result results_links results_links_deep web-result">
            <h2 class="result__title">
              <a class="result__a" href="/l/?uddg=https%3A%2F%2Fgithub.com%2Felectron%2Felectron">
                electron/electron: Build cross-platform desktop apps
              </a>
            </h2>
            <div class="result__snippet">
              Build cross-platform desktop apps with JavaScript, HTML, and CSS.
            </div>
          </div>
        </body>
      </html>
    `;

    const results = parseDuckDuckGoHtml(mockHtml, 5);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Electron 34.0.0 Release Notes');
    expect(results[0].url).toBe('https://www.electronjs.org/blog/electron-34-0');
    expect(results[0].snippet).toBe('Electron 34.0.0 has been released with Chromium 132 and Node 20.');

    expect(results[1].title).toBe('electron/electron: Build cross-platform desktop apps');
    expect(results[1].url).toBe('https://github.com/electron/electron');
    expect(results[1].snippet).toBe('Build cross-platform desktop apps with JavaScript, HTML, and CSS.');
  });
});
