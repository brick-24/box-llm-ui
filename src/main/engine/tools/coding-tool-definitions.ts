import os from 'node:os';
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

export interface SystemEnvironmentInfo {
  osName: string;
  platform: NodeJS.Platform;
  release: string;
  arch: string;
  shell: string;
  shellType: 'powershell' | 'bash' | 'zsh' | 'cmd' | 'unknown';
  rules: string[];
}

export function getSystemEnvironmentInfo(): SystemEnvironmentInfo {
  const platform = process.platform;
  const release = os.release();
  const arch = process.arch;

  let osName = 'Unknown OS';
  if (platform === 'win32') {
    osName = `Windows (NT ${release})`;
  } else if (platform === 'darwin') {
    osName = `macOS (Darwin ${release})`;
  } else if (platform === 'linux') {
    osName = `Linux (${release})`;
  }

  const isWin = platform === 'win32';
  const shell = isWin ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
  const shellType: 'powershell' | 'bash' = isWin ? 'powershell' : 'bash';

  const rules: string[] = isWin
    ? [
        "DO NOT use POSIX '&&' or '||' statement chaining (PowerShell 5.1 syntax error). Use ';' to separate sequential commands (e.g. 'npm run build; npm test') or invoke separate run_command calls.",
        "DO NOT use bash-specific environment variable exports like 'export VAR=val'. In PowerShell, use '$env:VAR=\"val\"' or pass environment parameters directly.",
        "DO NOT use Unix-specific commands like 'touch', 'ls -la', 'cat file', 'rm -rf'. Use node scripts, git commands, or native PowerShell equivalents.",
        "Always quote file paths or arguments that might contain spaces with double quotes.",
        "For git commands, execute standard git commands (e.g. 'git status', 'git add .', 'git commit -m \"...\"').",
      ]
    : [
        "Use standard POSIX Bash/Zsh syntax.",
        "Command chaining with '&&', '||', and ';' is fully supported.",
        "Environment variables can be exported with 'export VAR=val'.",
        "Standard Unix utilities ('ls', 'mkdir -p', 'rm -rf', etc.) are supported.",
      ];

  return {
    osName,
    platform,
    release,
    arch,
    shell,
    shellType,
    rules,
  };
}

export function buildCodingSystemPrompt(workspacePath: string, userSystemPrompt?: string): string {
  const normalizedPath = workspacePath.replace(/\\/g, '/');
  const env = getSystemEnvironmentInfo();

  const rulesFormatted = env.rules.map((r, i) => `${i + 1}. ${r}`).join('\n');

  const baseInstruction = `You are an elite, autonomous software engineering agent operating directly inside the project workspace at:
\`${normalizedPath}\`

<system_environment>
Operating System: ${env.osName} (${env.platform}, ${env.arch})
Terminal Shell: ${env.shell}
Workspace Root: ${normalizedPath}
</system_environment>

<terminal_execution_rules>
When executing commands via \`run_command\`, commands run inside ${env.shell}.
CRITICAL RULES TO AVOID TERMINAL EXECUTION ERRORS:
${rulesFormatted}
</terminal_execution_rules>

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
5. Respect terminal syntax: Always adhere to the <terminal_execution_rules> above to avoid syntax failures.
6. Be concise and actionable: Explain what you accomplished cleanly with clear next steps.`;

  if (userSystemPrompt && userSystemPrompt.trim()) {
    return `${userSystemPrompt.trim()}\n\n---\n${baseInstruction}`;
  }
  return baseInstruction;
}

