import { createServer } from 'vite';
import * as esbuild from 'esbuild';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import electron from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function startDev() {
  console.log('[Dev] Starting Universal LLM Desktop Client dev environment...');

  // Ensure output dirs exist
  fs.mkdirSync(path.join(rootDir, 'dist/main'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'dist/preload'), { recursive: true });

  const wasmSrc = path.join(rootDir, 'node_modules/sql.js/dist/sql-wasm.wasm');
  const wasmDest = path.join(rootDir, 'dist/main/sql-wasm.wasm');
  if (fs.existsSync(wasmSrc)) {
    fs.copyFileSync(wasmSrc, wasmDest);
  }

  // 1. Start Vite dev server
  const server = await createServer({
    configFile: path.join(rootDir, 'vite.config.ts'),
    server: { port: 5173 },
  });
  await server.listen();
  console.log('[Dev] Vite renderer dev server running on http://localhost:5173');

  // 2. Build Main & Preload
  const buildMainAndPreload = async () => {
    await esbuild.build({
      entryPoints: [path.join(rootDir, 'src/main/index.ts')],
      bundle: true,
      platform: 'node',
      target: 'node22',
      outfile: path.join(rootDir, 'dist/main/index.js'),
      external: [
        'electron',
        'sql.js',
        'pdf-parse',
        'mammoth',
        'node:sqlite',
        'node:crypto',
        'node:fs',
        'node:path',
        'node:os',
        'node:http',
        'node:https',
        'node:stream',
      ],
      sourcemap: 'inline',
      format: 'cjs',
      define: {
        'process.env.NODE_ENV': '"development"',
      },
    });

    await esbuild.build({
      entryPoints: [path.join(rootDir, 'src/preload/index.ts')],
      bundle: true,
      platform: 'node',
      target: 'node22',
      outfile: path.join(rootDir, 'dist/preload/index.js'),
      external: ['electron'],
      sourcemap: 'inline',
      format: 'cjs',
    });
  };

  await buildMainAndPreload();
  console.log('[Dev] Main and Preload built.');

  // 3. Launch Electron
  console.log('[Dev] Spawning Electron process...');
  const electronProcess = spawn(electron, ['.'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER_URL: 'http://localhost:5173',
    },
  });

  electronProcess.on('close', async () => {
    console.log('[Dev] Electron closed, stopping dev server...');
    await server.close();
    process.exit(0);
  });
}

startDev().catch((err) => {
  console.error('[Dev Error]', err);
  process.exit(1);
});
