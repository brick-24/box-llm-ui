import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  WorkspaceTreeNode,
  GitStatusResult,
  GitCommitItem,
  GitFileChange,
  GitFileStatus,
} from '../../../shared/types';

export interface CommandExecutionResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

export interface ViewFileResult {
  filePath: string;
  totalLines: number;
  startLine: number;
  endLine: number;
  content: string;
  isTruncated: boolean;
}

export interface GrepMatch {
  file: string;
  filePath?: string;
  lineNumber: number;
  lineContent: string;
}

export interface GrepResult {
  query: string;
  totalMatches: number;
  matches: GrepMatch[];
  isTruncated: boolean;
}

const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.vite',
  '.turbo',
  'coverage',
  '.cache',
  '.gemini',
]);

const DANGEROUS_COMMAND_PATTERNS = [
  /rmdir\s+[\/\\]s\s+[\/\\]q\s+[c-z]:[\\\/]?$/i,
  /del\s+[\/\\]f\s+[\/\\]s\s+[\/\\]q\s+[c-z]:[\\\/]?$/i,
  /format\s+[c-z]:/i,
  /rm\s+-rf\s+[\/\\]$/i,
  /mkfs/i,
  /:()\{\s*:\|:&\s*\};:/, // fork bomb
];

export class WorkspaceTools {
  public readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  public resolveSafePath(targetPath: string): string {
    return WorkspaceTools.resolveSafePath(this.workspaceRoot, targetPath);
  }

  public writeToFile(filePath: string, content: string, overwrite = true) {
    return WorkspaceTools.writeToFile(this.workspaceRoot, filePath, content, overwrite);
  }

  public viewFile(filePath: string, startLine?: number, endLine?: number) {
    return WorkspaceTools.viewFile(this.workspaceRoot, filePath, startLine, endLine);
  }

  public replaceFileContent(filePath: string, targetContent: string, replacementContent: string) {
    return WorkspaceTools.replaceFileContent(this.workspaceRoot, filePath, targetContent, replacementContent);
  }

  public listDir(subPath = '', maxDepth = 15) {
    return WorkspaceTools.listDir(this.workspaceRoot, subPath, maxDepth);
  }

  public runCommand(
    command: string,
    optionsOrChunk?:
      | ((chunk: string) => void)
      | { timeoutMs?: number; onChunk?: (chunk: string) => void; signal?: AbortSignal }
  ) {
    const opts = typeof optionsOrChunk === 'function' ? { onChunk: optionsOrChunk } : optionsOrChunk;
    return WorkspaceTools.runCommand(this.workspaceRoot, command, opts);
  }

  public grepSearch(query: string, isRegex = false, includesPattern?: string) {
    return WorkspaceTools.grepSearch(this.workspaceRoot, query, isRegex, includesPattern);
  }

  public getWorkspaceTree(maxDepth = 20) {
    return WorkspaceTools.listDir(this.workspaceRoot, '', maxDepth);
  }

  public ensureGitRepo() {
    return WorkspaceTools.ensureGitRepo(this.workspaceRoot);
  }

  public getGitStatus() {
    return WorkspaceTools.getGitStatus(this.workspaceRoot);
  }

  public getGitLog(limit = 15) {
    return WorkspaceTools.getGitLog(this.workspaceRoot, limit);
  }

  public getGitDiff(filePath?: string) {
    return WorkspaceTools.getGitDiff(this.workspaceRoot, filePath);
  }

  /**
   * Resolves a target path against the workspace root and ensures it does not escape.
   */
  public static resolveSafePath(workspaceRoot: string, targetPath: string): string {
    if (!workspaceRoot || typeof workspaceRoot !== 'string') {
      throw new Error('Workspace root path must be specified');
    }

    const absRoot = path.resolve(workspaceRoot);
    const resolved = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(absRoot, targetPath);

    // Normalize for Windows / Unix case-insensitive or slash differences
    const normRoot = absRoot.replace(/\\/g, '/').toLowerCase();
    const normResolved = resolved.replace(/\\/g, '/').toLowerCase();

    if (normResolved !== normRoot && !normResolved.startsWith(normRoot.endsWith('/') ? normRoot : `${normRoot}/`)) {
      throw new Error(
        `Path traversal violation: Access to "${targetPath}" is outside workspace root ("${workspaceRoot}")`
      );
    }

    return resolved;
  }

  /**
   * Returns path relative to workspace root with forward slashes for clean presentation.
   */
  public static getRelativePath(workspaceRoot: string, absPath: string): string {
    const rel = path.relative(path.resolve(workspaceRoot), absPath);
    return rel.replace(/\\/g, '/') || '.';
  }

  /**
   * Writes content to a file in the workspace, creating parent directories if needed.
   */
  public static writeToFile(
    workspaceRoot: string,
    filePath: string,
    content: string,
    overwrite = true
  ): { filePath: string; bytesWritten: number; isNew: boolean } {
    const safePath = this.resolveSafePath(workspaceRoot, filePath);
    const existed = fs.existsSync(safePath);

    if (existed && !overwrite) {
      throw new Error(`File already exists at "${filePath}" and overwrite is false.`);
    }

    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(safePath, content, 'utf8');
    const bytesWritten = Buffer.byteLength(content, 'utf8');

    return {
      success: true,
      filePath: this.getRelativePath(workspaceRoot, safePath),
      bytesWritten,
      isNew: !existed,
    };
  }

  /**
   * Reads and inspects a file in the workspace with line numbers and optional line slicing.
   */
  public static viewFile(
    workspaceRoot: string,
    filePath: string,
    startLine?: number,
    endLine?: number
  ): ViewFileResult {
    const safePath = this.resolveSafePath(workspaceRoot, filePath);

    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found: "${filePath}"`);
    }

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      throw new Error(`Cannot view directory "${filePath}" with view_file. Use list_dir instead.`);
    }

    // Safety guard against massive binaries or huge dumps
    if (stat.size > 5 * 1024 * 1024) {
      throw new Error(
        `File "${filePath}" is too large to view directly (${(stat.size / (1024 * 1024)).toFixed(1)}MB > 5MB limit).`
      );
    }

    const raw = fs.readFileSync(safePath, 'utf8');
    const allLines = raw.split(/\r?\n/);
    const totalLines = allLines.length;

    const s = Math.max(1, startLine || 1);
    const e = Math.min(totalLines, endLine || Math.min(totalLines, s + 799));

    const sliced = allLines.slice(s - 1, e);
    const formatted = sliced.map((line, idx) => `${s + idx}: ${line}`);

    return {
      filePath: this.getRelativePath(workspaceRoot, safePath),
      totalLines,
      startLine: s,
      endLine: e,
      content: formatted.join('\n'),
      isTruncated: s > 1 || e < totalLines,
    };
  }

  /**
   * Surgically replaces targetContent with replacementContent in the file.
   */
  public static replaceFileContent(
    workspaceRoot: string,
    filePath: string,
    targetContent: string,
    replacementContent: string
  ): { filePath: string; replaced: boolean; occurrences: number } {
    const safePath = this.resolveSafePath(workspaceRoot, filePath);

    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found: "${filePath}"`);
    }

    const original = fs.readFileSync(safePath, 'utf8');

    if (!original.includes(targetContent)) {
      throw new Error(
        `Target content not found in "${filePath}". Please view the file first to ensure exact indentation and whitespace.`
      );
    }

    // Check count of target occurrences
    const occurrences = original.split(targetContent).length - 1;
    if (occurrences > 1) {
      throw new Error(
        `Target content appears ${occurrences} times in "${filePath}". Please provide more surrounding context lines to identify a unique block.`
      );
    }

    const updated = original.replace(targetContent, replacementContent);
    fs.writeFileSync(safePath, updated, 'utf8');

    return {
      success: true,
      filePath: this.getRelativePath(workspaceRoot, safePath),
      replaced: true,
      occurrences,
    };
  }

  /**
   * Lists the contents of a directory in the workspace as a structured tree.
   */
  public static listDir(
    workspaceRoot: string,
    subPath = '',
    maxDepth = 15
  ): { tree: WorkspaceTreeNode; summary: string; totalFiles: number; totalDirs: number } {
    const targetDir = this.resolveSafePath(workspaceRoot, subPath);

    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory not found: "${subPath || '.'}"`);
    }

    let totalFiles = 0;
    let totalDirs = 0;
    const MAX_NODES = 5000;

    const buildTree = (currentDir: string, depth: number): WorkspaceTreeNode => {
      const relPath = this.getRelativePath(workspaceRoot, currentDir);
      const name = path.basename(currentDir) || path.basename(workspaceRoot);
      const isDir = fs.statSync(currentDir).isDirectory();

      if (!isDir) {
        totalFiles++;
        return {
          name,
          path: relPath,
          isDir: false,
          sizeBytes: fs.statSync(currentDir).size,
        };
      }

      totalDirs++;
      const node: WorkspaceTreeNode = {
        name,
        path: relPath,
        isDir: true,
        children: [],
      };

      if (depth >= maxDepth || totalFiles + totalDirs >= MAX_NODES) {
        return node;
      }

      let entries: string[] = [];
      try {
        entries = fs.readdirSync(currentDir);
      } catch {
        return node;
      }

      // Sort: folders first, then alphabetical
      const sorted = entries
        .filter((entry) => !DEFAULT_IGNORED_DIRS.has(entry))
        .sort((a, b) => {
          const aPath = path.join(currentDir, a);
          const bPath = path.join(currentDir, b);
          let aIsDir = false;
          let bIsDir = false;
          try {
            aIsDir = fs.statSync(aPath).isDirectory();
            bIsDir = fs.statSync(bPath).isDirectory();
          } catch {}
          if (aIsDir && !bIsDir) return -1;
          if (!aIsDir && bIsDir) return 1;
          return a.localeCompare(b);
        });

      for (const entry of sorted) {
        const full = path.join(currentDir, entry);
        try {
          node.children?.push(buildTree(full, depth + 1));
        } catch {}
      }

      return node;
    };

    const tree = buildTree(targetDir, 0);

    // Format ASCII summary
    const lines: string[] = [];
    const printNode = (n: WorkspaceTreeNode, indent: string) => {
      if (n.isDir) {
        lines.push(`${indent}📁 ${n.name}/`);
        if (n.children) {
          for (const child of n.children) {
            printNode(child, `${indent}  `);
          }
        }
      } else {
        const sizeKb = n.sizeBytes !== undefined ? ` (${(n.sizeBytes / 1024).toFixed(1)} KB)` : '';
        lines.push(`${indent}📄 ${n.name}${sizeKb}`);
      }
    };
    printNode(tree, '');

    return {
      tree,
      summary: lines.slice(0, 200).join('\n'),
      totalFiles,
      totalDirs,
      totalEntries: tree.children?.length ?? 0,
      entries: tree.children || [],
    };
  }

  /**
   * Runs a terminal command in the workspace directory with live stdout/stderr streaming and safety checks.
   */
  public static async runCommand(
    workspaceRoot: string,
    command: string,
    options: {
      timeoutMs?: number;
      onChunk?: (chunk: string) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<CommandExecutionResult> {
    const absRoot = path.resolve(workspaceRoot);
    if (!fs.existsSync(absRoot)) {
      throw new Error(`Workspace root does not exist: "${workspaceRoot}"`);
    }

    // Safety checks against dangerous patterns
    for (const pat of DANGEROUS_COMMAND_PATTERNS) {
      if (pat.test(command.trim())) {
        throw new Error(`Command blocked by safety policy: Potential dangerous system command ("${command}")`);
      }
    }

    const timeoutMs = options.timeoutMs || 60000;
    const startTime = Date.now();

    return new Promise<CommandExecutionResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let isDone = false;

      const isWin = process.platform === 'win32';
      const shellCmd = isWin ? 'powershell.exe' : 'bash';
      const shellArgs = isWin ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command] : ['-c', command];

      const child = spawn(shellCmd, shellArgs, {
        cwd: absRoot,
        env: {
          ...process.env,
          CI: '1',
          FORCE_COLOR: '0',
          PAGER: 'cat',
        },
      });

      const timer = setTimeout(() => {
        if (!isDone) {
          timedOut = true;
          killChild();
        }
      }, timeoutMs);

      const killChild = () => {
        try {
          if (isWin && child.pid) {
            spawn('taskkill', ['/pid', child.pid.toString(), '/T', '/F']);
          } else if (child.pid) {
            child.kill('SIGKILL');
          }
        } catch {}
      };

      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          if (!isDone) {
            killChild();
          }
        });
      }

      child.stdout.on('data', (data: Buffer) => {
        const str = data.toString('utf8');
        stdout += str;
        if (options.onChunk) {
          options.onChunk(str);
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        const str = data.toString('utf8');
        stderr += str;
        if (options.onChunk) {
          options.onChunk(str);
        }
      });

      child.on('close', (code) => {
        if (isDone) return;
        isDone = true;
        clearTimeout(timer);

        // Truncate extreme outputs (keep first 25KB and last 25KB)
        const truncate = (text: string, maxLen = 50000): string => {
          if (text.length <= maxLen) return text;
          const half = Math.floor(maxLen / 2);
          return `${text.slice(0, half)}\n\n... [${text.length - maxLen} characters truncated] ...\n\n${text.slice(text.length - half)}`;
        };

        resolve({
          command,
          exitCode: code,
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          timedOut,
          durationMs: Date.now() - startTime,
        });
      });

      child.on('error', (err) => {
        if (isDone) return;
        isDone = true;
        clearTimeout(timer);
        resolve({
          command,
          exitCode: 1,
          stdout,
          stderr: `${stderr}\n${err.message}`,
          timedOut,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Searches the workspace files for text matches or regular expressions.
   */
  public static grepSearch(
    workspaceRoot: string,
    query: string,
    isRegex = false,
    includesPattern?: string
  ): GrepResult {
    const absRoot = path.resolve(workspaceRoot);
    if (!fs.existsSync(absRoot)) {
      throw new Error(`Workspace root not found: "${workspaceRoot}"`);
    }

    let regex: RegExp;
    try {
      regex = isRegex ? new RegExp(query, 'i') : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    } catch (e: any) {
      throw new Error(`Invalid search pattern: ${e.message}`);
    }

    const matches: GrepMatch[] = [];
    const MAX_MATCHES = 50;
    let isTruncated = false;

    const searchDir = (currentDir: string) => {
      if (matches.length >= MAX_MATCHES) {
        isTruncated = true;
        return;
      }

      let entries: string[] = [];
      try {
        entries = fs.readdirSync(currentDir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (DEFAULT_IGNORED_DIRS.has(entry)) continue;
        const full = path.join(currentDir, entry);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          searchDir(full);
        } else if (stat.isFile() && stat.size < 2 * 1024 * 1024) {
          const relPath = this.getRelativePath(workspaceRoot, full);
          if (includesPattern && !relPath.toLowerCase().includes(includesPattern.toLowerCase())) {
            continue;
          }

          try {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                matches.push({
                  file: relPath,
                  filePath: relPath,
                  lineNumber: i + 1,
                  lineContent: lines[i].trim().slice(0, 200),
                });
                if (matches.length >= MAX_MATCHES) {
                  isTruncated = true;
                  return;
                }
              }
            }
          } catch {}
        }
      }
    };

    searchDir(absRoot);

    return {
      query,
      totalMatches: matches.length,
      matchCount: matches.length,
      matches,
      isTruncated,
    };
  }

  /**
   * Checks if workspace has a .git repository initialized, and initializes one if not.
   */
  public static async ensureGitRepo(
    workspaceRoot: string
  ): Promise<{ isRepo: boolean; initialized: boolean; message: string }> {
    const absRoot = path.resolve(workspaceRoot);
    if (!fs.existsSync(absRoot)) {
      return { isRepo: false, initialized: false, message: 'Workspace directory does not exist' };
    }

    const gitDir = path.join(absRoot, '.git');
    if (fs.existsSync(gitDir)) {
      return { isRepo: true, initialized: false, message: 'Git repository already initialized' };
    }

    try {
      const res = await this.runCommand(absRoot, 'git init');
      if (res.exitCode === 0) {
        return { isRepo: true, initialized: true, message: 'Initialized empty Git repository' };
      }
      return {
        isRepo: false,
        initialized: false,
        message: res.stderr.trim() || 'Failed to initialize Git repository (exit code ' + res.exitCode + ')',
      };
    } catch (err: any) {
      return { isRepo: false, initialized: false, message: err.message || 'Git is not installed or available' };
    }
  }

  /**
   * Retrieves parsed git status with modified, added, deleted, and untracked files.
   */
  public static async getGitStatus(workspaceRoot: string): Promise<GitStatusResult> {
    const absRoot = path.resolve(workspaceRoot);
    const gitDir = path.join(absRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      return {
        isRepo: false,
        branch: '',
        changes: [],
        clean: true,
        error: 'Not a git repository',
      };
    }

    try {
      const res = await this.runCommand(absRoot, 'git status --porcelain=v1 -b');
      if (res.exitCode !== 0) {
        return {
          isRepo: true,
          branch: '',
          changes: [],
          clean: true,
          error: res.stderr.trim() || 'git status failed',
        };
      }

      const lines = res.stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
      let branch = 'main';

      if (lines.length > 0 && lines[0].startsWith('##')) {
        const header = lines[0].slice(2).trim();
        // Format e.g. "main...origin/main [ahead 1]" or "No commits yet on main" or "HEAD (no branch)"
        const match = header.match(/^([^\s.]+)/);
        if (match) {
          branch = match[1];
        } else if (header.includes('No commits yet on')) {
          branch = header.replace('No commits yet on', '').trim();
        }
      }

      const changes: GitFileChange[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.length < 3) continue;

        const statusCode = line.slice(0, 2);
        const rawPath = line.slice(3).trim();
        // Handle renamed: "old.txt -> new.txt"
        const filePath = rawPath.includes(' -> ') ? rawPath.split(' -> ')[1] : rawPath;

        let status: GitFileStatus = 'modified';
        let staged = false;

        if (statusCode === '??') {
          status = 'untracked';
          staged = false;
        } else if (statusCode[0] === 'A' || statusCode[1] === 'A') {
          status = 'added';
          staged = statusCode[0] === 'A';
        } else if (statusCode[0] === 'D' || statusCode[1] === 'D') {
          status = 'deleted';
          staged = statusCode[0] === 'D';
        } else if (statusCode[0] === 'R' || statusCode[1] === 'R') {
          status = 'renamed';
          staged = true;
        } else if (statusCode[0] === 'C' || statusCode[1] === 'C') {
          status = 'copied';
          staged = true;
        } else {
          status = 'modified';
          staged = statusCode[0] !== ' ' && statusCode[0] !== '?';
        }

        changes.push({
          path: filePath,
          status,
          staged,
          statusCode,
        });
      }

      return {
        isRepo: true,
        branch,
        changes,
        clean: changes.length === 0,
      };
    } catch (err: any) {
      return {
        isRepo: true,
        branch: '',
        changes: [],
        clean: true,
        error: err.message,
      };
    }
  }

  /**
   * Retrieves recent commit history.
   */
  public static async getGitLog(workspaceRoot: string, limit = 15): Promise<GitCommitItem[]> {
    const absRoot = path.resolve(workspaceRoot);
    const gitDir = path.join(absRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      return [];
    }

    try {
      const res = await this.runCommand(absRoot, `git log -n ${limit} --pretty=format:"%h|%an|%ad|%s" --date=short`);
      if (res.exitCode !== 0 || !res.stdout.trim()) {
        return [];
      }

      const commits: GitCommitItem[] = [];
      const lines = res.stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          const hash = parts[0].trim();
          const author = parts[1].trim();
          const date = parts[2].trim();
          const message = parts.slice(3).join('|').trim();

          const lowerAuthor = author.toLowerCase();
          const lowerMsg = message.toLowerCase();
          const isAgent =
            lowerAuthor.includes('agent') ||
            lowerAuthor.includes('assistant') ||
            lowerAuthor.includes('ai') ||
            lowerAuthor.includes('bot') ||
            lowerMsg.includes('[agent]') ||
            lowerMsg.includes('agent:');

          commits.push({
            hash,
            author,
            date,
            message,
            isAgent,
          });
        }
      }

      return commits;
    } catch {
      return [];
    }
  }

  /**
   * Retrieves git diff for a specific file or the entire working tree.
   */
  public static async getGitDiff(workspaceRoot: string, filePath?: string): Promise<string> {
    const absRoot = path.resolve(workspaceRoot);
    const gitDir = path.join(absRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      return '';
    }

    try {
      let cmd = 'git diff HEAD';
      if (filePath) {
        const safe = this.resolveSafePath(absRoot, filePath);
        const rel = this.getRelativePath(absRoot, safe);
        cmd = `git diff HEAD -- "${rel}"`;
      }

      let res = await this.runCommand(absRoot, cmd);
      if (res.exitCode !== 0 || !res.stdout.trim()) {
        // Fallback without HEAD (in case there are no commits yet)
        const fallbackCmd = filePath
          ? `git diff -- "${this.getRelativePath(absRoot, this.resolveSafePath(absRoot, filePath))}"`
          : 'git diff';
        res = await this.runCommand(absRoot, fallbackCmd);
      }

      return res.stdout || '';
    } catch {
      return '';
    }
  }
}

