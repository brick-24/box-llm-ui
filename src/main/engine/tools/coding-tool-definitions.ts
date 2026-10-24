import { ToolDefinition } from '../../browser/web-tools';

export const CODING_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'write_to_file',
      description:
        'Creates or overwrites a file in the project workspace. Parent directories are automatically created if they do not exist.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Relative path of the file to create or overwrite from the workspace root (e.g., "src/App.tsx", "package.json").',
          },
          content: {
            type: 'string',
            description: 'The complete text or code content to write to the file.',
          },
          overwrite: {
            type: 'boolean',
            description: 'Whether to overwrite an existing file (default: true).',
          },
        },
        required: ['filePath', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'view_file',
      description:
        'Reads and inspects the contents of a file in the project workspace with line numbers. Supports slice ranges for inspecting large files.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Relative path of the file to view (e.g., "src/index.ts", "package.json").',
          },
          startLine: {
            type: 'number',
            description: '1-indexed starting line number (optional, default: 1).',
          },
          endLine: {
            type: 'number',
            description: '1-indexed ending line number inclusive (optional).',
          },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_file_content',
      description:
        'Surgically replaces an exact, unique block of text inside an existing file in the project workspace. targetContent must match the file content exactly including indentation.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Relative path of the file to modify.',
          },
          targetContent: {
            type: 'string',
            description: 'The exact string snippet currently in the file that needs to be replaced. Must be unique within the file.',
          },
          replacementContent: {
            type: 'string',
            description: 'The new string snippet to substitute in place of targetContent.',
          },
        },
        required: ['filePath', 'targetContent', 'replacementContent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description:
        'Lists files and directories in the workspace as a structured tree. Automatically ignores build artifacts like node_modules, .git, and dist.',
      parameters: {
        type: 'object',
        properties: {
          dirPath: {
            type: 'string',
            description: 'Relative directory path from workspace root to list (default: "." for workspace root).',
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum folder traversal depth (default: 3).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description:
        'Executes a terminal/shell command (e.g. npm, npx, node, git, python, cargo, pytest) directly in the workspace directory with live output streaming.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command line string to execute in the workspace root.',
          },
          timeoutMs: {
            type: 'number',
            description: 'Command execution timeout in milliseconds (default: 60000ms).',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep_search',
      description:
        'Searches for a text pattern or regex across workspace files, returning file names, line numbers, and matching snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The text string or regex pattern to search for.',
          },
          isRegex: {
            type: 'boolean',
            description: 'Whether to treat query as a regular expression (default: false).',
          },
          includesPattern: {
            type: 'string',
            description: 'Optional file path filter or extension (e.g. "src/", ".tsx").',
          },
        },
        required: ['query'],
      },
    },
  },
];

export function buildCodingSystemPrompt(workspacePath: string, userSystemPrompt?: string): string {
  const normalizedPath = workspacePath.replace(/\\/g, '/');
  const baseInstruction = `You are an elite, autonomous software engineering agent operating directly inside the project workspace at:
\`${normalizedPath}\`

You have full access to workspace coding tools:
- \`write_to_file\`: Create new project files or overwrite existing ones.
- \`view_file\`: Inspect files with line numbers before making edits.
- \`replace_file_content\`: Surgically edit specific code blocks without rewriting whole files.
- \`list_dir\`: Discover directory hierarchy and project layout.
- \`run_command\`: Execute shell commands (npm, npx, git, python, build tools, test runners).
- \`grep_search\`: Search code patterns across the codebase.

Engineering Guidelines:
1. Ground truth first: Inspect existing files (\`view_file\` / \`list_dir\`) before modifying or building on top of them.
2. For project creation: Scaffold complete, production-ready code with proper configs (e.g. package.json, tsconfig.json, vite.config.ts), run setup commands (e.g. \`npm install\`), and verify that builds succeed.
3. Surgical edits: Prefer \`replace_file_content\` for targeted modifications.
4. Verify changes: Run tests or build commands using \`run_command\` whenever appropriate to verify your work before concluding.
5. Be concise and actionable: Explain what you accomplished cleanly with clear next steps.`;

  if (userSystemPrompt && userSystemPrompt.trim()) {
    return `${userSystemPrompt.trim()}\n\n---\n${baseInstruction}`;
  }
  return baseInstruction;
}
