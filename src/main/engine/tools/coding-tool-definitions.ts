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
        'Executes a single simple terminal command directly in the workspace directory with live output streaming. MANDATORY: Keep commands simple and atomic (e.g. "npm test", "git status", "npm run build"). NEVER use "&&", "||", or compound command chaining. Execute each command as a separate step.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description:
              'A single, simple shell command string to execute in the workspace root (e.g. "npm install", "git status", "npx vitest run"). STRICT RULE: Only ONE simple command per call. NEVER use "&&", "||", or bash chaining syntax. Keep commands simple.',
          },
          timeoutMs: {
            type: 'number',
            description: 'Command execution timeout in milliseconds (default: 60000ms). Only applicable for foreground commands.',
          },
          isDaemon: {
            type: 'boolean',
            description:
              'Set to true for long-running processes that should run concurrently in the background (e.g. "npm run dev", "npm start", dev servers, file watchers). Box starts the process in the background, monitors initial bootstrap for 2 seconds, and returns its processId so you can run other commands or tests in parallel.',
          },
          waitMsBeforeAsync: {
            type: 'number',
            description:
              'Milliseconds to wait after starting a background process to confirm successful startup before returning control (default: 2000ms).',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_process',
      description:
        'Manage background and concurrent workspace processes. Allows listing active processes, checking real-time logs, sending stdin input, or terminating running processes.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'status', 'logs', 'send_input', 'kill'],
            description:
              'Management action to perform: "list" (show all workspace processes), "status" (check running status and PID), "logs" (view recent terminal output), "send_input" (write text to process stdin), or "kill" (terminate the process tree).',
          },
          processId: {
            type: 'string',
            description: 'The process ID to manage (required for status, logs, send_input, and kill).',
          },
          input: {
            type: 'string',
            description: 'The text input to write to process stdin (required when action is "send_input").',
          },
          lines: {
            type: 'number',
            description: 'Number of recent log lines to retrieve (default: 50, max: 200). Used when action is "logs".',
          },
        },
        required: ['action'],
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
        "KEEP COMMANDS SIMPLE AND ATOMIC: Execute ONE simple command per `run_command` call (e.g. 'npm install', 'git status', 'npm run build'). DO NOT combine commands.",
        "STRICTLY FORBIDDEN: NEVER use '&&' or '||'. Windows PowerShell (powershell.exe) does NOT support POSIX '&&' or '||' and will throw an immediate syntax error. Do NOT chain commands with '&&' or '||'.",
        "NO COMPLEX COMPOUND CHAINS: If you need to run two tasks (e.g. build then test), execute the first command ('npm run build'), inspect the result, and then execute the second command ('npm test') in your next turn. Keep commands dead simple.",
        "DO NOT use bash-specific commands or syntax: No 'export VAR=val' (use '$env:VAR=\"val\"'), no 'touch', no 'ls -la' (use 'dir' or the built-in list_dir tool), no 'cat' (use view_file tool), no 'rm -rf'.",
        "PREFER BUILT-IN TOOLS: For viewing, editing, listing, or searching files, always prefer 'view_file', 'replace_file_content', 'write_to_file', and 'list_dir' rather than shell commands.",
        "DO NOT run 'cd <directory>': Commands already run with working directory set to the workspace root.",
        "Always quote file paths or arguments containing spaces with double quotes.",
        "For git commands, execute standard simple git commands (e.g. 'git status', 'git add .', 'git commit -m \"...\"').",
      ]
    : [
        "KEEP COMMANDS SIMPLE AND ATOMIC: Prefer running simple, focused commands.",
        "Use standard POSIX Bash/Zsh syntax.",
        "Environment variables can be exported with 'export VAR=val'.",
        "PREFER BUILT-IN TOOLS: For viewing, editing, or searching files, use the built-in tools (view_file, replace_file_content, grep_search).",
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

export function buildGeneralSystemPrompt(userSystemPrompt?: string): string {
  const env = getSystemEnvironmentInfo();
  const envBlock = `<user_environment>
Operating System: ${env.osName} (${env.platform}, ${env.arch})
Default Terminal Shell: ${env.shell}
</user_environment>
${
  env.platform === 'win32'
    ? `<terminal_guidelines>
The user is on Windows. When providing terminal commands or scripts:
1. KEEP COMMANDS SIMPLE AND ATOMIC: One single command at a time.
2. NEVER use POSIX '&&' or '||' (PowerShell 5.1 syntax error). Use separate lines or PowerShell ';' if strictly necessary.
3. Use PowerShell syntax ($env:VAR="val" instead of export).
4. Avoid Unix-only commands ('ls -la', 'touch', 'rm -rf', 'cat'). Use native PowerShell or cross-platform node/npm/git commands.
</terminal_guidelines>`
    : ''
}`;

  if (userSystemPrompt && userSystemPrompt.trim()) {
    return `${userSystemPrompt.trim()}\n\n${envBlock}`;
  }
  return envBlock;
}

export function buildCodingSystemPrompt(workspacePath: string, userSystemPrompt?: string): string {
  const normalizedPath = workspacePath.replace(/\\/g, '/');
  const env = getSystemEnvironmentInfo();

  const rulesFormatted = env.rules.map((r, i) => `${i + 1}. ${r}`).join('\n');

  const windowsDirectives = env.platform === 'win32'
    ? `\n# CRITICAL WINDOWS POWERSHELL DIRECTIVE:
You are running on Windows. The shell is powershell.exe.
1. KEEP ALL TERMINAL COMMANDS SIMPLE AND ATOMIC: Only ONE simple command per run_command call.
2. NEVER use "&&" or "||" under any circumstances. They cause immediate syntax errors in PowerShell.
3. DO NOT chain commands. Run commands step-by-step individually.
4. Do NOT use bash commands like "cat", "touch", "export". Use the built-in tools (view_file, write_to_file, replace_file_content).\n`
    : '';

  const baseInstruction = `${windowsDirectives}You are an elite, autonomous software engineering agent operating directly inside the project workspace at:
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
- \`run_command\`: Execute shell commands (npm, npx, git, python, build tools, test runners). Supports \`isDaemon: true\` to run dev servers/watchers concurrently in the background!
- \`manage_process\`: Inspect, send input, or kill active background processes.
- \`grep_search\`: Search code patterns across the codebase.

Engineering Guidelines:
1. Ground truth first: Inspect existing files (\`view_file\` / \`list_dir\`) before modifying or building on top of them.
2. For project creation: Scaffold complete, production-ready code with proper configs (e.g. package.json, tsconfig.json, vite.config.ts), run setup commands (e.g. \`npm install\`), and verify that builds succeed.
3. Surgical edits: Prefer \`replace_file_content\` for targeted modifications.
4. Verify changes: Run tests or build commands using \`run_command\` whenever appropriate to verify your work before concluding.
5. Concurrent / Background Processes: When launching a web app, dev server, or watcher (e.g. \`npm run dev\`, \`python app.py\`), use \`run_command\` with \`isDaemon: true\`. Box runs it concurrently in the background and returns its processId, allowing you to run tests or other terminal commands in parallel.
6. KEEP COMMANDS SIMPLE: Execute simple atomic commands. Never chain with "&&" or "||".
7. Respect terminal syntax: Always adhere to the <terminal_execution_rules> above to avoid syntax failures.
8. Be concise and actionable: Explain what you accomplished cleanly with clear next steps.

REMINDER: On Windows PowerShell, NEVER use "&&" or "||". Keep commands simple and atomic.`;

  if (userSystemPrompt && userSystemPrompt.trim()) {
    return `${baseInstruction}\n\n---\nAdditional User Instructions:\n${userSystemPrompt.trim()}`;
  }
  return baseInstruction;
}

