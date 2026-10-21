import { AppSettings, WebCitation } from '../../shared/types';
import { executeWebSearch, SearchResult } from './search-service';
import { fetchWebPage, FetchedPage } from './page-fetcher';
import { browserSession, BrowseResult } from './browser-session';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export const WEB_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description:
        'Search the live web for recent information, facts, news, documentation, or references. Returns relevant search results with titles, URLs, and summaries.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The query to search for on the web',
          },
          numResults: {
            type: 'number',
            description: 'Number of search results to return (default 5, max 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_web_page',
      description:
        'Fast reader-mode fetcher. Downloads and extracts clean readable text and markdown from a web page URL. Best for reading articles, blogs, documentation, and static pages.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The absolute HTTP or HTTPS URL to fetch and read',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browse_page',
      description:
        'Interactive Chromium browser engine. Renders modern JavaScript, handles Single Page Applications (SPAs), and extracts the rendered DOM content.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the webpage to browse',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'take_page_screenshot',
      description:
        'Capture a visual screenshot image of a web page using the browser engine. Returns visual confirmation of how the page renders.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the page to screenshot',
          },
        },
        required: ['url'],
      },
    },
  },
];

export interface ToolExecutionOutput {
  result: any;
  citations?: WebCitation[];
}

export async function executeWebTool(
  toolName: string,
  args: Record<string, any>,
  settings?: AppSettings
): Promise<ToolExecutionOutput> {
  switch (toolName) {
    case 'search_web': {
      const query = String(args.query || '').trim();
      if (!query) {
        throw new Error('Missing "query" parameter for search_web');
      }
      const numResults = typeof args.numResults === 'number' ? args.numResults : undefined;
      const searchResults: SearchResult[] = await executeWebSearch(query, settings, numResults);

      const citations: WebCitation[] = searchResults.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
      }));

      return {
        result: {
          query,
          count: searchResults.length,
          results: searchResults,
        },
        citations,
      };
    }

    case 'fetch_web_page': {
      const url = String(args.url || '').trim();
      if (!url) {
        throw new Error('Missing "url" parameter for fetch_web_page');
      }
      const page: FetchedPage = await fetchWebPage(url);
      const citation: WebCitation = {
        title: page.title || url,
        url: page.url,
        snippet: page.description || page.content.slice(0, 200).replace(/\n/g, ' '),
      };

      return {
        result: {
          url: page.url,
          title: page.title,
          content: page.content,
          characterCount: page.characterCount,
          truncated: page.truncated,
        },
        citations: [citation],
      };
    }

    case 'browse_page': {
      const url = String(args.url || '').trim();
      if (!url) {
        throw new Error('Missing "url" parameter for browse_page');
      }
      const page: BrowseResult = await browserSession.browsePage(url);
      const citation: WebCitation = {
        title: page.title || url,
        url: page.url,
        snippet: page.description || page.content.slice(0, 200).replace(/\n/g, ' '),
      };

      return {
        result: {
          url: page.url,
          title: page.title,
          content: page.content,
          characterCount: page.characterCount,
          truncated: page.truncated,
          screenshotCaptured: Boolean(page.screenshotDataUrl),
        },
        citations: [citation],
      };
    }

    case 'take_page_screenshot': {
      const url = String(args.url || '').trim();
      if (!url) {
        throw new Error('Missing "url" parameter for take_page_screenshot');
      }
      const screenshotDataUrl = await browserSession.captureScreenshot(url);
      const citation: WebCitation = {
        title: `Screenshot: ${url}`,
        url,
      };

      return {
        result: {
          url,
          screenshotDataUrl,
          message: 'Screenshot captured successfully',
        },
        citations: [citation],
      };
    }

    default:
      throw new Error(`Unknown web tool: ${toolName}`);
  }
}
