import { AppSettings } from '../../shared/types';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(Number(dec));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });
}

export function cleanDuckDuckGoUrl(rawUrl: string): string {
  try {
    if (rawUrl.includes('uddg=')) {
      const match = rawUrl.match(/uddg=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    if (rawUrl.startsWith('//')) {
      return `https:${rawUrl}`;
    }
    if (rawUrl.startsWith('/')) {
      return `https://duckduckgo.com${rawUrl}`;
    }
  } catch {}
  return rawUrl;
}

export function stripHtmlTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, '').trim())
    .replace(/\s+/g, ' ');
}

export function parseDuckDuckGoHtml(html: string, maxResults = 5): SearchResult[] {
  const results: SearchResult[] = [];

  // Split by result container delimiter so nested divs inside snippet/title don't prematurely close the match
  const parts = html.split(/<div[^>]*class="[^"]*(?:result results_links|web-result)[^"]*"/i).slice(1);

  for (const part of parts) {
    if (results.length >= maxResults) break;

    // Extract title link
    const titleLinkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
    const titleMatch = titleLinkRegex.exec(part);
    if (!titleMatch) continue;

    const rawUrl = titleMatch[1];
    const rawTitle = titleMatch[2];
    const url = cleanDuckDuckGoUrl(rawUrl);
    const title = stripHtmlTags(rawTitle);

    // Extract snippet
    const snippetRegex = /<(?:a|div)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i;
    const snippetMatch = snippetRegex.exec(part);
    const snippet = snippetMatch ? stripHtmlTags(snippetMatch[1]) : '';

    if (url.startsWith('http://') || url.startsWith('https://')) {
      results.push({ title, url, snippet });
    }
  }

  // Fallback: Lite version table layout (<a class="result-link" href="...">...</a> and <td class="result-snippet">)
  if (results.length === 0) {
    const liteLinkRegex = /<a[^>]*class="[^"]*result-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let liteMatch: RegExpExecArray | null;
    while ((liteMatch = liteLinkRegex.exec(html)) !== null && results.length < maxResults) {
      const url = cleanDuckDuckGoUrl(liteMatch[1]);
      const title = stripHtmlTags(liteMatch[2]);
      if (url.startsWith('http://') || url.startsWith('https://')) {
        results.push({ title, url, snippet: '' });
      }
    }
  }

  // Fallback 2: General title links if structure was slightly altered
  if (results.length === 0) {
    const generalLinkRegex = /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi;
    let genMatch: RegExpExecArray | null;
    while ((genMatch = generalLinkRegex.exec(html)) !== null && results.length < maxResults) {
      const url = cleanDuckDuckGoUrl(genMatch[1]);
      const title = stripHtmlTags(genMatch[2]);
      if (url.startsWith('http://') || url.startsWith('https://')) {
        results.push({ title, url, snippet: '' });
      }
    }
  }

  return results;
}

export async function searchDuckDuckGo(query: string, maxResults = 5): Promise<SearchResult[]> {
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
  };

  const response = await fetch(endpoint, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed with status ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  return parseDuckDuckGoHtml(html, maxResults);
}

export async function searchBrave(
  query: string,
  apiKey: string,
  maxResults = 5
): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
  const response = await fetch(url, {
    headers: {
      'X-Subscription-Token': apiKey,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const webResults = data.web?.results || [];
  return webResults.slice(0, maxResults).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || '',
  }));
}

export async function searchTavily(
  query: string,
  apiKey: string,
  maxResults = 5
): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const results = data.results || [];
  return results.slice(0, maxResults).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
  }));
}

export async function searchSerper(
  query: string,
  apiKey: string,
  maxResults = 5
): Promise<SearchResult[]> {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: maxResults,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const results = data.organic || [];
  return results.slice(0, maxResults).map((r: any) => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
  }));
}

export async function executeWebSearch(
  query: string,
  settings?: AppSettings,
  maxResults?: number
): Promise<SearchResult[]> {
  const limit = maxResults || settings?.maxSearchResults || 5;
  const provider = settings?.searchProvider || 'duckduckgo';
  const apiKey = settings?.searchApiKey?.trim();

  try {
    if (provider === 'brave' && apiKey) {
      return await searchBrave(query, apiKey, limit);
    }
    if (provider === 'tavily' && apiKey) {
      return await searchTavily(query, apiKey, limit);
    }
    if (provider === 'serper' && apiKey) {
      return await searchSerper(query, apiKey, limit);
    }
  } catch (err) {
    console.warn(`[SearchService] Provider ${provider} failed, falling back to DuckDuckGo:`, err);
  }

  // Default / fallback is DuckDuckGo
  return await searchDuckDuckGo(query, limit);
}
