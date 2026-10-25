import fs from 'node:fs';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { BrowserWindow } from 'electron';
import { WorkspaceProcessItem, ProcessStatus } from '../../../shared/types';
import { sanitizeCommandForWindows } from './workspace-tools';
import { IPC_CHANNELS } from '../../ipc/channels';
import { DiagnosticsService } from '../diagnostics';

const DANGEROUS_COMMAND_PATTERNS = [
  /rmdir\s+[\/\\]s\s+[\/\\]q\s+[c-z]:[\\\/]?$/i,
  /del\s+[\/\\]f\s+[\/\\]s\s+[\/\\]q\s+[c-z]:[\\\/]?$/i,
  /format\s+[c-z]:/i,
  /rm\s+-rf\s+[\/\\]$/i,
  /mkfs/i,
  /:()\{\s*:\|:&\s*\};:/, // fork bomb
];

const MAX_LOG_LINES = 5000;

interface ManagedProcess {
  info: WorkspaceProcessItem;
  child: ChildProcess;
}

export class WorkspaceProcessManager {
  private static instance: WorkspaceProcessManager | null = null;
  private processes = new Map<string, ManagedProcess>();
  private getMainWindow: (() => BrowserWindow | null) | null = null;

  public static getInstance(): WorkspaceProcessManager {
    if (!this.instance) {
      this.instance = new WorkspaceProcessManager();
    }
    return this.instance;
  }

  public setWindowGetter(getter: () => BrowserWindow | null) {
    this.getMainWindow = getter;
  }

  /**
   * Starts a new process in the workspace.
   * If isDaemon is true, returns as soon as the process successfully bootstraps (after waitMsBeforeAsync),
   * allowing it to continue running in the background.
   */
  public async startProcess(
    workspaceRootOrParams:
      | string
      | {
          workspacePath: string;
          command: string;
          name?: string;
          isDaemon?: boolean;
          waitMsBeforeAsync?: number;
          timeoutMs?: number;
        },
    commandArg?: string,
    optionsArg: {
      isDaemon?: boolean;
      name?: string;
      waitMsBeforeAsync?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<WorkspaceProcessItem> {
    let workspaceRoot: string;
    let command: string;
    let options: {
      isDaemon?: boolean;
      name?: string;
      waitMsBeforeAsync?: number;
      timeoutMs?: number;
    };

    if (typeof workspaceRootOrParams === 'object' && workspaceRootOrParams !== null) {
      workspaceRoot = workspaceRootOrParams.workspacePath;
      command = workspaceRootOrParams.command;
      options = {
        isDaemon: workspaceRootOrParams.isDaemon ?? true,
        name: workspaceRootOrParams.name,
        waitMsBeforeAsync: workspaceRootOrParams.waitMsBeforeAsync,
        timeoutMs: workspaceRootOrParams.timeoutMs,
      };
    } else {
      workspaceRoot = String(workspaceRootOrParams || '');
      command = commandArg || '';
      options = optionsArg || {};
    }

    const absRoot = path.resolve(workspaceRoot);
    if (!fs.existsSync(absRoot)) {
      throw new Error(`Workspace root does not exist: "${workspaceRoot}"`);
    }

    const trimmed = command.trim();
    for (const pat of DANGEROUS_COMMAND_PATTERNS) {
      if (pat.test(trimmed)) {
        throw new Error(`Command blocked by safety policy: Potential dangerous system command ("${command}")`);
      }
    }

    const isWin = process.platform === 'win32';
    let effectiveCommand = command;

    if (isWin) {
      const sanitized = sanitizeCommandForWindows(command);
      if (sanitized.wasModified) {
        effectiveCommand = sanitized.command;
        DiagnosticsService.log(
          'info',
          'workspace',
          `[ProcessManager] Auto-sanitized Windows PowerShell command (${sanitized.reason})`,
          { original: command, sanitized: effectiveCommand }
        );
      }
    }

    const id = `proc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const name = options.name || command.split(' ')[0] || 'process';
    const isDaemon = Boolean(options.isDaemon);

    const info: WorkspaceProcessItem = {
      id,
      workspaceRoot: absRoot,
      name,
      command,
      status: 'running',
      exitCode: null,
      startedAt: Date.now(),
      logs: [],
      isDaemon,
    };

    const shellCmd = isWin ? 'powershell.exe' : 'bash';
    const shellArgs = isWin
      ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', effectiveCommand]
      : ['-c', effectiveCommand];

    const child = spawn(shellCmd, shellArgs, {
      cwd: absRoot,
      env: {
        ...process.env,
        CI: '1',
        FORCE_COLOR: '0',
        PAGER: 'cat',
      },
    });

    info.pid = child.pid;
    const managed: ManagedProcess = { info, child };
    this.processes.set(id, managed);

    DiagnosticsService.log('info', 'workspace', `[ProcessManager] Started process "${name}" (ID: ${id}, PID: ${child.pid}, daemon: ${isDaemon})`, {
      id,
      pid: child.pid,
      command,
      isDaemon,
    });

    const appendChunk = (chunk: string) => {
      const rawLines = chunk.split('\n');
      for (const line of rawLines) {
        if (line.length > 0 || rawLines.length > 1) {
          info.logs.push(line);
        }
      }
      if (info.logs.length > MAX_LOG_LINES) {
        info.logs = info.logs.slice(-MAX_LOG_LINES);
      }

      const win = this.getMainWindow?.();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.WORKSPACE_PROCESS_OUTPUT_EVENT, {
          processId: id,
          chunk,
          totalLogs: info.logs.length,
        });
      }
    };

    child.stdout?.on('data', (d) => appendChunk(d.toString('utf8')));
    child.stderr?.on('data', (d) => appendChunk(d.toString('utf8')));

    const handleExit = (code: number | null, signal: string | null) => {
      if (info.status === 'killed') {
        info.stoppedAt = info.stoppedAt || Date.now();
      } else {
        info.status = code === 0 ? 'completed' : 'failed';
        info.stoppedAt = Date.now();
      }
      info.exitCode = code;

      DiagnosticsService.log('info', 'workspace', `[ProcessManager] Process exited "${name}" (ID: ${id}, code: ${code}, signal: ${signal}, status: ${info.status})`, {
        id,
        exitCode: code,
        signal,
        status: info.status,
      });

      const win = this.getMainWindow?.();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.WORKSPACE_PROCESS_EXIT_EVENT, {
          processId: id,
          exitCode: code,
          status: info.status,
        });
      }
    };

    child.on('close', handleExit);
    child.on('error', (err) => {
      appendChunk(`[Process Error] ${err.message}\n`);
      handleExit(-1, null);
    });

    if (isDaemon) {
      // For daemons, wait briefly for initial output or early exit
      const waitMs = options.waitMsBeforeAsync ?? 2000;
      await new Promise<void>((resolve, reject) => {
        let earlyExitListener: any;
        const timer = setTimeout(() => {
          child.removeListener('close', earlyExitListener);
          resolve();
        }, waitMs);

        earlyExitListener = (code: number | null) => {
          clearTimeout(timer);
          if (code !== null && code !== 0) {
            reject(new Error(`Daemon failed to start (exit code ${code}): ${info.logs.join('\n')}`));
          } else {
            resolve();
          }
        };

        child.once('close', earlyExitListener);
      });

      return { ...info, logs: [...info.logs] };
    } else {
      // For foreground, wait for process completion or timeout
      const timeoutMs = options.timeoutMs || 60000;
      return new Promise<WorkspaceProcessItem>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.killProcess(id);
          reject(new Error(`Command timed out after ${timeoutMs}ms: "${command}"`));
        }, timeoutMs);

        child.once('close', () => {
          clearTimeout(timer);
          resolve({ ...info, logs: [...info.logs] });
        });
      });
    }
  }

  public listProcesses(workspaceRoot?: string): WorkspaceProcessItem[] {
    const list: WorkspaceProcessItem[] = [];
    for (const managed of this.processes.values()) {
      if (!workspaceRoot || path.resolve(managed.info.workspaceRoot) === path.resolve(workspaceRoot)) {
        list.push({ ...managed.info, logs: [...managed.info.logs] });
      }
    }
    return list.sort((a, b) => b.startedAt - a.startedAt);
  }

  public getProcess(processId: string): WorkspaceProcessItem | null {
    const managed = this.processes.get(processId);
    if (!managed) return null;
    return { ...managed.info, logs: [...managed.info.logs] };
  }

  public getProcessLogs(processId: string, lines = 200): string[] {
    const managed = this.processes.get(processId);
    if (!managed) return [];
    return managed.info.logs.slice(-lines);
  }

  public sendInput(processId: string, input: string): { success: boolean; error?: string } {
    const managed = this.processes.get(processId);
    if (!managed) {
      return { success: false, error: `Process not found: ${processId}` };
    }
    if (managed.info.status !== 'running') {
      return { success: false, error: `Process ${processId} is not running (${managed.info.status})` };
    }
    try {
      if (managed.child.stdin && managed.child.stdin.writable) {
        managed.child.stdin.write(`${input}\n`);
        return { success: true };
      }
      return { success: false, error: 'Stdin is not writable' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async killProcess(processId: string): Promise<{ success: boolean; error?: string }> {
    const managed = this.processes.get(processId);
    if (!managed) {
      return { success: false, error: `Process not found: ${processId}` };
    }

    if (managed.info.status !== 'running') {
      return { success: true }; // Already stopped
    }

    managed.info.status = 'killed';
    managed.info.stoppedAt = Date.now();

    try {
      if (process.platform === 'win32' && managed.child.pid) {
        spawn('taskkill', ['/pid', managed.child.pid.toString(), '/T', '/F']);
      } else if (managed.child.pid) {
        managed.child.kill('SIGTERM');
        setTimeout(() => {
          try {
            managed.child.kill('SIGKILL');
          } catch {}
        }, 1000);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async killAll(workspaceRoot?: string): Promise<void> {
    const promises: Promise<any>[] = [];
    for (const [id, managed] of this.processes.entries()) {
      if (!workspaceRoot || path.resolve(managed.info.workspaceRoot) === path.resolve(workspaceRoot)) {
        if (managed.info.status === 'running') {
          promises.push(this.killProcess(id));
        }
      }
    }
    await Promise.allSettled(promises);
  }

  public clearTerminatedProcesses(workspaceRoot?: string): void {
    for (const [id, managed] of this.processes.entries()) {
      if (!workspaceRoot || path.resolve(managed.info.workspaceRoot) === path.resolve(workspaceRoot)) {
        if (managed.info.status !== 'running') {
          this.processes.delete(id);
        }
      }
    }
  }
}
