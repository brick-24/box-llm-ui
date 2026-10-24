import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceTools } from '../src/main/engine/tools/workspace-tools';

describe('WorkspaceTools - Agentic Coding Engine', () => {
  let tempDir: string;
  let tools: WorkspaceTools;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'box-workspace-test-'));
    tools = new WorkspaceTools(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('safely resolves paths and blocks directory traversal outside workspace root', () => {
    // Valid path inside workspace
    const safe = tools.resolveSafePath('src/index.ts');
    expect(safe).toBe(path.resolve(tempDir, 'src/index.ts'));

    // Traversal attack should be blocked
    expect(() => tools.resolveSafePath('../../etc/passwd')).toThrow(/outside workspace root|traversal/i);
    expect(() => tools.resolveSafePath('../secret.txt')).toThrow(/outside workspace root|traversal/i);
  });

  it('writes files and creates parent directories automatically', async () => {
    const res = await tools.writeToFile('src/utils/math.ts', 'export const add = (a: number, b: number) => a + b;\n');
    expect(res.success).toBe(true);
    expect(res.bytesWritten).toBeGreaterThan(0);

    const fullPath = path.join(tempDir, 'src/utils/math.ts');
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.readFileSync(fullPath, 'utf-8')).toContain('export const add');
  });

  it('views files with line numbering and slice ranges', async () => {
    const fileContent = 'line 1\nline 2\nline 3\nline 4\nline 5';
    await tools.writeToFile('test.txt', fileContent);

    // Read whole file
    const full = await tools.viewFile('test.txt');
    expect(full.totalLines).toBe(5);
    expect(full.content).toContain('1: line 1');
    expect(full.content).toContain('5: line 5');

    // Read sliced range
    const slice = await tools.viewFile('test.txt', 2, 4);
    expect(slice.content).toContain('2: line 2');
    expect(slice.content).toContain('4: line 4');
    expect(slice.content).not.toContain('1: line 1');
    expect(slice.content).not.toContain('5: line 5');
  });

  it('surgically replaces content and rejects if target not found', async () => {
    await tools.writeToFile('app.ts', 'const PORT = 3000;\nconst HOST = "localhost";\n');

    // Replace PORT
    const replaceRes = tools.replaceFileContent('app.ts', 'const PORT = 3000;', 'const PORT = 8080;');
    expect(replaceRes.success).toBe(true);

    const updated = fs.readFileSync(path.join(tempDir, 'app.ts'), 'utf-8');
    expect(updated).toContain('const PORT = 8080;');
    expect(updated).not.toContain('const PORT = 3000;');

    // Rejects if target text is missing
    expect(() =>
      tools.replaceFileContent('app.ts', 'const MISSING = true;', 'const FOUND = true;')
    ).toThrow(/Target content not found/i);
  });

  it('lists directories and reports sizes and types', async () => {
    await tools.writeToFile('index.ts', 'console.log("hello");');
    await tools.writeToFile('sub/helper.ts', 'export const help = true;');

    const list = await tools.listDir('.');
    expect(list.totalEntries).toBe(2);
    const names = list.entries.map((e) => e.name);
    expect(names).toContain('index.ts');
    expect(names).toContain('sub');
  });

  it('searches patterns with grepSearch across files', async () => {
    await tools.writeToFile('src/alpha.ts', 'function computeHash() { return 42; }');
    await tools.writeToFile('src/beta.ts', 'function computeSignature() { return "sig"; }');

    const result = await tools.grepSearch('computeHash');
    expect(result.matchCount).toBe(1);
    expect(result.matches[0].filePath).toContain('alpha.ts');
    expect(result.matches[0].lineContent).toContain('computeHash');
  });

  it('executes safe terminal commands with output streaming', async () => {
    const chunks: string[] = [];
    const command = 'node -e "console.log(\'Hello Workspace\')"';

    const res = await tools.runCommand(command, (chunk) => {
      chunks.push(chunk);
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Hello Workspace');
    expect(chunks.join('')).toContain('Hello Workspace');
  });

  it('blocks dangerous terminal commands per safety policy', async () => {
    await expect(tools.runCommand('rm -rf /')).rejects.toThrow(/Command blocked by safety policy/i);
    await expect(tools.runCommand('mkfs.ext4 /dev/sda')).rejects.toThrow(/Command blocked by safety policy/i);
  });

  it('generates a hierarchical workspace tree', async () => {
    await tools.writeToFile('src/index.ts', 'console.log("root");');
    await tools.writeToFile('package.json', '{}');

    const treeData = await tools.getWorkspaceTree();
    expect(treeData.totalFiles).toBe(2);
    expect(treeData.tree.children?.length).toBeGreaterThanOrEqual(2);
    expect(treeData.summary).toContain('index.ts');
    expect(treeData.summary).toContain('package.json');
  });
});
