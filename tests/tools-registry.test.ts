import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  AVAILABLE_TOOLS,
  getAvailableTools,
  getToolById,
  getToolDeclarationsForIds,
} from '../src/shared/tools';
import { executeAnyTool } from '../src/main/engine/tools/tool-dispatcher';

describe('Tools Registry & Multi-Tool System', () => {
  const workspaceDir = path.join(process.cwd(), 'workspace');

  beforeEach(() => {
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files in workspace
    const testFile = path.join(workspaceDir, 'test_notes.md');
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    const testPdf = path.join(workspaceDir, 'test_report.pdf');
    if (fs.existsSync(testPdf)) {
      fs.unlinkSync(testPdf);
    }
  });

  it('provides registered tool definitions including browse, make_files, and create_pdfs', () => {
    const tools = getAvailableTools();
    const ids = tools.map((t) => t.id);

    expect(ids).toContain('browse');
    expect(ids).toContain('make_files');
    expect(ids).toContain('create_pdfs');

    const browseTool = getToolById('browse');
    expect(browseTool).toBeDefined();
    expect(browseTool?.functionNames).toContain('search_web');
    expect(browseTool?.functionNames).toContain('fetch_web_page');

    const fileTool = getToolById('make_files');
    expect(fileTool).toBeDefined();
    expect(fileTool?.functionNames).toContain('create_file');
    expect(fileTool?.functionNames).toContain('read_file');

    const pdfTool = getToolById('create_pdfs');
    expect(pdfTool).toBeDefined();
    expect(pdfTool?.functionNames).toContain('generate_pdf');
  });

  it('filters tool declarations accurately according to enabled tool IDs', () => {
    // When no tools enabled
    const noTools = getToolDeclarationsForIds([]);
    expect(noTools).toHaveLength(0);

    // When only browse enabled
    const browseOnly = getToolDeclarationsForIds(['browse']);
    const browseNames = browseOnly.map((t) => t.function.name);
    expect(browseNames).toContain('search_web');
    expect(browseNames).not.toContain('create_file');
    expect(browseNames).not.toContain('generate_pdf');

    // When make_files and create_pdfs enabled
    const fileAndPdf = getToolDeclarationsForIds(['make_files', 'create_pdfs']);
    const names = fileAndPdf.map((t) => t.function.name);
    expect(names).toContain('create_file');
    expect(names).toContain('read_file');
    expect(names).toContain('generate_pdf');
    expect(names).not.toContain('search_web');

    // When all tools enabled
    const all = getToolDeclarationsForIds(['browse', 'make_files', 'create_pdfs']);
    expect(all.length).toBeGreaterThanOrEqual(7);
  });

  it('executes file operations (create_file and read_file) safely via tool dispatcher', async () => {
    // 1. Create a file
    const createRes = await executeAnyTool('create_file', {
      path: 'test_notes.md',
      content: '# Project Analysis\n\nAll tools are functioning properly.',
    });

    expect(createRes.result.success).toBe(true);
    expect(createRes.result.path).toBe('test_notes.md');

    // Verify file exists on disk
    const targetFile = path.join(workspaceDir, 'test_notes.md');
    expect(fs.existsSync(targetFile)).toBe(true);

    // 2. Read the created file
    const readRes = await executeAnyTool('read_file', {
      path: 'test_notes.md',
    });

    expect(readRes.result.success).toBe(true);
    expect(readRes.result.content).toContain('Project Analysis');
    expect(readRes.result.characterCount).toBeGreaterThan(0);
  });

  it('executes PDF generator tool (generate_pdf) via tool dispatcher', async () => {
    const pdfRes = await executeAnyTool('generate_pdf', {
      title: 'Quarterly Executive Summary',
      content: '# Summary\n\nRevenue grew by 25% year-over-year.\n\n- Point A\n- Point B',
      filename: 'test_report.pdf',
    });

    expect(pdfRes.result.success).toBe(true);
    expect(pdfRes.result.filename).toBe('test_report.pdf');
    expect(pdfRes.result.bytes).toBeGreaterThan(100);

    const targetPdf = path.join(workspaceDir, 'test_report.pdf');
    expect(fs.existsSync(targetPdf)).toBe(true);
  });

  it('guards against invalid inputs and path traversal attempts', async () => {
    // Missing required path parameter
    await expect(executeAnyTool('create_file', {})).rejects.toThrow('Missing "path" parameter');
    await expect(executeAnyTool('read_file', {})).rejects.toThrow('Missing "path" parameter');

    // Path traversal attempt outside workspace
    await expect(
      executeAnyTool('create_file', {
        path: '../../../sensitive_system_file.txt',
        content: 'malicious payload',
      })
    ).rejects.toThrow('escapes workspace directory');

    // Unknown tool name
    await expect(executeAnyTool('non_existent_tool', {})).rejects.toThrow('Unknown tool');
  });
});
