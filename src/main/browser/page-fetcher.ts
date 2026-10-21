import { decodeHtmlEntities } from './search-service';

export interface FetchedPage {
  url: string;
  title: string;
  description?: string;
  content: string;
  characterCount: number;
  truncated: boolean;
}

export interface FetchOptions {
  maxCharacters?: number;
  timeoutMs?: number;
}

export function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match && match[1]) {
    return decodeHtmlEntities(match[1].replace(/<[^>]*>/g, '').trim());
  }
  return '';
}

export function extractMetaDescription(html: string): string | undefined {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  if (match && match[1]) {
    return decodeHtmlEntities(match[1].trim());
  }
  return undefined;
}

export function htmlToMarkdown(html: string, baseUrl?: string): string {
  let text = html;

  // 1. Remove non-content elements
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  text = text.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  text = text.replace(/<(nav|footer|aside)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');

  // 2. Pre-formatted code blocks
  text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    return `\n\n\`\`\`\n${decodeHtmlEntities(code.trim())}\n\`\`\`\n\n`;
  });
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
    return `\n\n\`\`\`\n${decodeHtmlEntities(code.trim())}\n\`\`\`\n\n`;
  });
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => {
    return `\`${decodeHtmlEntities(code.trim())}\``;
  });

  // 3. Headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // 4. Strong and emphasis
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');

  // 5. Blockquotes
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, quote) => {
    const clean = quote.replace(/<[^>]*>/g, '').trim();
    return `\n\n> ${clean}\n\n`;
  });

  // 6. Links
  text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, content) => {
    const linkText = content.replace(/<[^>]*>/g, '').trim();
    if (!linkText || href.startsWith('javascript:') || href.startsWith('#')) {
      return linkText;
    }
    let fullUrl = href;
    if (baseUrl && !href.startsWith('http://') && !href.startsWith('https://')) {
      try {
        fullUrl = new URL(href, baseUrl).toString();
      } catch {}
    }
    return `[${linkText}](${fullUrl})`;
  });

  // 7. Lists
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, item) => {
    const itemText = item.replace(/<[^>]*>/g, '').trim();
    return `\n- ${itemText}`;
  });
  text = text.replace(/<\/(ul|ol)>/gi, '\n\n');

  // 8. Line breaks and paragraphs
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|tr|section|article)>/gi, '\n\n');

  // 9. Strip any remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // 10. Decode entities
  text = decodeHtmlEntities(text);

  // 11. Normalize excessive whitespace and blank lines
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

export async function fetchWebPage(
  url: string,
  options?: FetchOptions
): Promise<FetchedPage> {
  const maxCharacters = options?.maxCharacters || 12000;
  const timeoutMs = options?.timeoutMs || 10000;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http and https are allowed.`);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (UniversalLLM/1.0)',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP error fetching ${url}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const isHtml = contentType.includes('html') || contentType.includes('xml');

  const rawBody = await response.text();
  let title = '';
  let description: string | undefined;
  let markdown = '';

  if (isHtml) {
    title = extractTitle(rawBody) || parsedUrl.hostname;
    description = extractMetaDescription(rawBody);
    markdown = htmlToMarkdown(rawBody, url);
  } else {
    title = parsedUrl.pathname.split('/').pop() || parsedUrl.hostname;
    markdown = rawBody.trim();
  }

  const fullCount = markdown.length;
  let truncated = false;

  if (markdown.length > maxCharacters) {
    // Truncate at word boundary
    const cut = markdown.lastIndexOf(' ', maxCharacters);
    markdown = (cut > 0 ? markdown.substring(0, cut) : markdown.substring(0, maxCharacters)) +
      `\n\n*(Content truncated: showing first ${maxCharacters.toLocaleString()} of ${fullCount.toLocaleString()} characters)*`;
    truncated = true;
  }

  return {
    url,
    title,
    description,
    content: markdown,
    characterCount: markdown.length,
    truncated,
  };
}
