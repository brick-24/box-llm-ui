import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceProcessManager } from '../src/main/engine/tools/process-manager';

describe('WorkspaceProcessManager - Multi-Process Engine', () => {
  let tempDir: string;
  let manager: WorkspaceProcessManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'box-process-test-'));
    manager = WorkspaceProcessManager.getInstance();
  });

  afterEach(async () => {
    manager.killAll();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('starts a background process and captures initial logs', async () => {
    // Launch a simple node script that prints logs and keeps running
    const script = `
      console.log('Server started on port 3000');
      setInterval(() => {
        console.log('Heartbeat tick');
      }, 500);
    `;

    const command = `node -e "${script.replace(/\r?\n\s*/g, ' ')}"`;
    const proc = await manager.startProcess({
      workspacePath: tempDir,
      command,
      name: 'node-dev-server',
      waitMsBeforeAsync: 1200,
    });

    expect(proc.id).toBeDefined();
    expect(proc.status).toBe('running');
    expect(proc.pid).toBeGreaterThan(0);
    expect(proc.name).toBe('node-dev-server');
    expect(proc.workspaceRoot).toBe(path.resolve(tempDir));

    // Initial logs should contain startup banner
    let logs = manager.getProcessLogs(proc.id, 20);
    if (!logs.some((l) => l.includes('Server started on port 3000'))) {
      await new Promise((r) => setTimeout(r, 400));
      logs = manager.getProcessLogs(proc.id, 20);
    }
    expect(logs.some((l) => l.includes('Server started on port 3000'))).toBe(true);

    // Verify it is listed in active processes
    const list = manager.listProcesses(tempDir);
    expect(list.some((p) => p.id === proc.id)).toBe(true);

    // Kill the process
    const killed = await manager.killProcess(proc.id);
    expect(killed.success).toBe(true);

    const updated = manager.getProcess(proc.id);
    expect(updated?.status).toBe('killed');
  });

  it('runs multiple processes concurrently in parallel', async () => {
    const script1 = `
      console.log('Worker 1 active');
      setInterval(() => {}, 1000);
    `;
    const script2 = `
      console.log('Worker 2 active');
      setInterval(() => {}, 1000);
    `;

    const proc1 = await manager.startProcess({
      workspacePath: tempDir,
      command: `node -e "${script1.replace(/\r?\n\s*/g, ' ')}"`,
      name: 'worker-1',
      waitMsBeforeAsync: 600,
    });

    const proc2 = await manager.startProcess({
      workspacePath: tempDir,
      command: `node -e "${script2.replace(/\r?\n\s*/g, ' ')}"`,
      name: 'worker-2',
      waitMsBeforeAsync: 600,
    });

    expect(proc1.status).toBe('running');
    expect(proc2.status).toBe('running');
    expect(proc1.id).not.toBe(proc2.id);
    expect(proc1.pid).not.toBe(proc2.pid);

    const all = manager.listProcesses(tempDir);
    expect(all.length).toBeGreaterThanOrEqual(2);

    await manager.killProcess(proc1.id);
    await manager.killProcess(proc2.id);

    expect(manager.getProcess(proc1.id)?.status).toBe('killed');
    expect(manager.getProcess(proc2.id)?.status).toBe('killed');
  });

  it('pipes interactive stdin input to running process', async () => {
    const script = `
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      console.log('Awaiting input');
      rl.on('line', (line) => {
        console.log('Echo: ' + line);
      });
    `;

    const proc = await manager.startProcess({
      workspacePath: tempDir,
      command: `node -e "${script.replace(/\r?\n\s*/g, ' ')}"`,
      name: 'echo-interactive',
      waitMsBeforeAsync: 600,
    });

    expect(proc.status).toBe('running');

    // Send input via manager
    const sent = manager.sendInput(proc.id, 'hello box');
    expect(sent.success).toBe(true);

    // Wait briefly for stdout to receive echo
    await new Promise((r) => setTimeout(r, 600));

    const logs = manager.getProcessLogs(proc.id, 20);
    expect(logs.some((l) => l.includes('Echo: hello box'))).toBe(true);

    await manager.killProcess(proc.id);
  });

  it('terminates all processes cleanly with killAll()', async () => {
    const script = `setInterval(() => {}, 1000);`;
    const p1 = await manager.startProcess({
      workspacePath: tempDir,
      command: `node -e "${script}"`,
      name: 'killall-1',
      waitMsBeforeAsync: 400,
    });
    const p2 = await manager.startProcess({
      workspacePath: tempDir,
      command: `node -e "${script}"`,
      name: 'killall-2',
      waitMsBeforeAsync: 400,
    });

    expect(p1.status).toBe('running');
    expect(p2.status).toBe('running');

    manager.killAll();

    expect(manager.getProcess(p1.id)?.status).toBe('killed');
    expect(manager.getProcess(p2.id)?.status).toBe('killed');
  });
});
