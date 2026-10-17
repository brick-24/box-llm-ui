import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function build() {
  console.log('[Build] Compiling main and preload processes...');
  
  // Ensure dist directories exist
  fs.mkdirSync(path.join(rootDir, 'dist/main'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'dist/preload'), { recursive: true });

  // Copy sql-wasm.wasm if present in node_modules/sql.js
  const wasmSrc = path.join(rootDir, 'node_modules/sql.js/dist/sql-wasm.wasm');
  const wasmDest = path.join(rootDir, 'dist/main/sql-wasm.wasm');
  if (fs.existsSync(wasmSrc)) {
    fs.copyFileSync(wasmSrc, wasmDest);
    console.log('[Build] Copied sql-wasm.wasm to dist/main');
  }

  // Build Main process
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
      'node:stream'
    ],
    sourcemap: true,
    format: 'cjs',
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
  });

  // Build Preload process
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'src/preload/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    outfile: path.join(rootDir, 'dist/preload/index.js'),
    external: ['electron'],
    sourcemap: true,
    format: 'cjs',
  });

  console.log('[Build] Main and preload compilation succeeded.');
}

build().catch((err) => {
  console.error('[Build Error]', err);
  process.exit(1);
});
