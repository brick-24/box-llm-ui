export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export type ToolCategoryId = 'web' | 'filesystem' | 'export' | 'utility';

export interface ToolItem {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: ToolCategoryId;
  icon: 'globe' | 'file-code' | 'file-text' | 'wrench' | 'terminal';
  badge?: string;
  status: 'active' | 'beta' | 'coming_soon';
  defaultEnabled?: boolean;
  functionNames: string[];
  declarations: ToolDefinition[];
}

export const WEB_TOOL_DECLARATIONS: ToolDefinition[] = [
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

export const FILE_TOOL_DECLARATIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_file',
      description:
        'Create or overwrite a file with specific text content. Useful for writing scripts, configuration files, documents, and code snippets.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative file path or file name (e.g., "notes.md", "src/index.ts", "output.json")',
          },
          content: {
            type: 'string',
            description: 'The full text content to write into the file',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the text contents of an existing file by path. Useful for inspecting existing project files or reviewing generated outputs.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative file path or file name to read',
          },
        },
        required: ['path'],
      },
    },
  },
];

export const PDF_TOOL_DECLARATIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'generate_pdf',
      description:
        'Generate a structured, styled PDF or printable report from markdown or text content. Useful for exporting summaries, formal reports, and shareable documents.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The title of the document or report',
          },
          content: {
            type: 'string',
            description: 'The markdown or text content of the document to format as a PDF report',
          },
          filename: {
            type: 'string',
            description: 'Optional output filename (defaults to sanitized title with .pdf extension)',
          },
        },
        required: ['title', 'content'],
      },
    },
  },
];

export const AVAILABLE_TOOLS: ToolItem[] = [
  {
    id: 'browse',
    name: 'Web Browsing & Search',
    shortName: 'Browse',
    description: 'Search live web, read articles, inspect SPAs, and capture webpage screenshots.',
    category: 'web',
    icon: 'globe',
    badge: 'Active',
    status: 'active',
    defaultEnabled: false,
    functionNames: ['search_web', 'fetch_web_page', 'browse_page', 'take_page_screenshot'],
    declarations: WEB_TOOL_DECLARATIONS,
  },
  {
    id: 'make_files',
    name: 'File Operations',
    shortName: 'Make Files',
    description: 'Create, write, and inspect local project files, code, and documentation.',
    category: 'filesystem',
    icon: 'file-code',
    badge: 'Ready',
    status: 'active',
    defaultEnabled: false,
    functionNames: ['create_file', 'read_file'],
    declarations: FILE_TOOL_DECLARATIONS,
  },
  {
    id: 'create_pdfs',
    name: 'PDF Generator',
    shortName: 'Create PDFs',
    description: 'Generate formatted, styled PDF reports and printable export documents from chat.',
    category: 'export',
    icon: 'file-text',
    badge: 'Ready',
    status: 'active',
    defaultEnabled: false,
    functionNames: ['generate_pdf'],
    declarations: PDF_TOOL_DECLARATIONS,
  },
];

export function getAvailableTools(): ToolItem[] {
  return AVAILABLE_TOOLS;
}

export function getToolById(id: string): ToolItem | undefined {
  return AVAILABLE_TOOLS.find((t) => t.id === id);
}

export function getToolDeclarationsForIds(enabledIds: string[]): ToolDefinition[] {
  if (!enabledIds || enabledIds.length === 0) return [];
  const enabledSet = new Set(enabledIds);
  const result: ToolDefinition[] = [];
  for (const tool of AVAILABLE_TOOLS) {
    if (enabledSet.has(tool.id)) {
      result.push(...tool.declarations);
    }
  }
  return result;
}

export function isToolFunction(functionName: string): boolean {
  return AVAILABLE_TOOLS.some((t) => t.functionNames.includes(functionName));
}
