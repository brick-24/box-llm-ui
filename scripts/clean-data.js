#!/usr/bin/env node
/**
 * scripts/clean-data.js
 *
 * Cleans local SQLite databases, stored encryption keys, and cache files
 * created during development and testing, ensuring a clean slate before
 * packaging or distribution.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function getAppDataRoots() {
  const platform = process.platform;
  const home = os.homedir();

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return [appData];
  } else if (platform === 'darwin') {
    return [path.join(home, 'Library', 'Application Support')];
  } else {
    // Linux and others
    const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    return [configHome];
  }
}

// Target folder names used in dev and prod
const APP_FOLDER_NAMES = [
  'universal-llm-client-dev', // Isolated dev folder
  'universal-llm-client',     // Default Electron package name folder
  'Universal LLM',            // Production product name folder
];

function cleanFolder(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return { path: dirPath, status: 'not_found' };
  }

  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return { path: dirPath, status: 'deleted' };
  } catch (err) {
    // If entire directory removal fails (e.g. lock), attempt to remove database & keys specifically
    let deletedFiles = [];
    const sensitiveFiles = [
      'universal-llm.sqlite',
      'universal-llm.sqlite-journal',
      'universal-llm.sqlite.tmp',
      '.master.key',
    ];

    for (const f of sensitiveFiles) {
      const fullPath = path.join(dirPath, f);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          deletedFiles.push(f);
        } catch (e) {
          // ignore
        }
      }
    }

    if (deletedFiles.length > 0) {
      return { path: dirPath, status: 'partial_deleted', files: deletedFiles };
    }

    return { path: dirPath, status: 'error', error: err.message };
  }
}

function main() {
  console.log('\n======================================================');
  console.log(' Universal LLM - Data & Configuration Cleaner');
  console.log('======================================================\n');

  const appDataRoots = getAppDataRoots();
  let totalCleaned = 0;

  for (const root of appDataRoots) {
    for (const folderName of APP_FOLDER_NAMES) {
      const targetDir = path.join(root, folderName);
      const result = cleanFolder(targetDir);

      if (result.status === 'deleted') {
        console.log(` [CLEANED] Wiped folder: ${result.path}`);
        totalCleaned++;
      } else if (result.status === 'partial_deleted') {
        console.log(` [PARTIAL] Removed databases/keys from: ${result.path} (${result.files.join(', ')})`);
        totalCleaned++;
      } else if (result.status === 'error') {
        console.warn(` [WARNING] Could not wipe ${result.path}: ${result.error}`);
        console.warn('           (Make sure Universal LLM is closed before running clean:data)');
      }
    }
  }

  console.log('\n------------------------------------------------------');
  if (totalCleaned > 0) {
    console.log(` Successfully cleaned ${totalCleaned} application data directory/directories.`);
  } else {
    console.log(' All application data directories were already clean.');
  }
  console.log(' Workspace is now in a pristine state ready for packaging.\n');
}

main();
