import fs from 'node:fs';
import path from 'node:path';

function getWorkspaceDir(): string {
  // Use project workspace or a dedicated user workspace directory
  const root = process.cwd();
  const target = path.join(root, 'workspace');
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}

function resolveSafePath(inputPath: string): string {
  const workspace = getWorkspaceDir();
  // Strip null bytes and leading slashes/backslashes
  const sanitized = inputPath.replace(/\0/g, '').replace(/^[\\/]+/, '');
  const resolved = path.resolve(workspace, sanitized);

  // Ensure path is within workspace directory
  if (!resolved.startsWith(workspace)) {
    throw new Error(`Access denied: path "${inputPath}" escapes workspace directory.`);
  }
  return resolved;
}

export async function executeFileTool(
  toolName: string,
  args: Record<string, any>
): Promise<{ result: any }> {
  switch (toolName) {
    case 'create_file': {
      const filePath = String(args.path || '').trim();
      if (!filePath) {
        throw new Error('Missing "path" parameter for create_file');
      }
      const content = typeof args.content === 'string' ? args.content : String(args.content ?? '');
      const fullPath = resolveSafePath(filePath);

      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, content, 'utf-8');

      const relative = path.relative(getWorkspaceDir(), fullPath);
      return {
        result: {
          success: true,
          path: relative,
          fullPath,
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
          message: `File "${relative}" written successfully (${content.length} characters).`,
        },
      };
    }

    case 'read_file': {
      const filePath = String(args.path || '').trim();
      if (!filePath) {
        throw new Error('Missing "path" parameter for read_file');
      }
      const fullPath = resolveSafePath(filePath);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: "${filePath}"`);
      }

      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const relative = path.relative(getWorkspaceDir(), fullPath);

      return {
        result: {
          success: true,
          path: relative,
          content,
          characterCount: content.length,
        },
      };
    }

    default:
      throw new Error(`Unknown file tool: ${toolName}`);
  }
}
