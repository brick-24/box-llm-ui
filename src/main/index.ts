import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import crypto from 'node:crypto';
import { AppDatabase } from './storage/database';
import { CredentialManager } from './storage/credentials';
import { ChatEngine } from './engine/chat-engine';
import { DiagnosticsService } from './engine/diagnostics';
import { WorkspaceProcessManager } from './engine/tools/process-manager';
import { registerIpcHandlers } from './ipc/handlers';
import { PROVIDER_PRESETS } from '../shared/constants';
import { ProviderConfig } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let db: AppDatabase;
let creds: CredentialManager;
let chatEngine: ChatEngine;

// Isolate development environment user data so dev runs never pollute production builds
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'universal-llm-client-dev'));
}

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || Boolean(process.env.VITE_DEV_SERVER_URL);
  const preloadPath = path.join(__dirname, '../preload/index.js');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 920,
    minHeight: 620,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#09090b',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      webSecurity: true,
    },
  });

  // Restrict Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' data: https://fonts.gstatic.com; " +
          "img-src 'self' data: blob:; " +
          "connect-src 'self' *;"
        ],
      },
    });
  });

  // Prevent opening arbitrary untrusted windows
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
      import('electron').then(({ shell }) => shell.openExternal(details.url));
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    if (!url.startsWith(devUrl) && !url.startsWith('file://')) {
      event.preventDefault();
      import('electron').then(({ shell }) => shell.openExternal(url));
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

async function initServices() {
  const userDataPath = app.getPath('userData');
  db = new AppDatabase(userDataPath);
  await db.initialize();

  creds = new CredentialManager(userDataPath);
  DiagnosticsService.initialize(db);
  DiagnosticsService.log('info', 'storage', 'Database and services initialized', {
    userDataPath,
    encryptionMode: creds.getEncryptionMode(),
  });

  // Seed default presets if no providers exist
  const existingProviders = db.getProviders();
  if (existingProviders.length === 0) {
    const now = Date.now();
    for (let i = 0; i < PROVIDER_PRESETS.length; i++) {
      const preset = PROVIDER_PRESETS[i];
      const p: ProviderConfig = {
        id: crypto.randomUUID(),
        name: preset.name || 'Provider',
        baseUrl: preset.baseUrl || 'https://api.openai.com/v1',
        chatEndpoint: preset.chatEndpoint || '/chat/completions',
        apiKey: '',
        modelListUrl: preset.modelListUrl || '/models',
        defaultModel: preset.defaultModel || '',
        protocol: preset.protocol || 'openai-chat',
        authMethod: preset.authMethod || 'bearer',
        customHeaders: preset.customHeaders || {},
        customBodyParams: preset.customBodyParams || {},
        requestTimeout: 60000,
        maxRetries: 2,
        streamingEnabled: preset.streamingEnabled !== false,
        customMapping: preset.customMapping,
        createdAt: now + i * 10,
        updatedAt: now + (PROVIDER_PRESETS.length - i) * 10,
      };
      db.saveProvider(p);
    }
    DiagnosticsService.log('info', 'storage', 'Initialized default provider presets');
  } else {
    // Clean up removed default presets if they were seeded and unconfigured
    const defaultRemovedNames = ['Custom JSON API', 'LM Studio (Local)', 'Groq Cloud'];
    const allProviders = db.getProviders();
    const deletedProviderIds = new Set<string>();

    for (const prov of allProviders) {
      if (defaultRemovedNames.includes(prov.name) && !prov.apiKey) {
        db.deleteProvider(prov.id);
        deletedProviderIds.add(prov.id);
        DiagnosticsService.log('info', 'storage', `Cleaned up removed default provider: ${prov.name}`);
      }
    }

    if (deletedProviderIds.size > 0) {
      const remainingProviders = db.getProviders();
      const fallbackProvider = remainingProviders[0];
      if (fallbackProvider) {
        for (const conv of db.getConversations()) {
          if (deletedProviderIds.has(conv.providerId)) {
            db.updateConversation({
              id: conv.id,
              providerId: fallbackProvider.id,
              modelId: fallbackProvider.defaultModel || '',
            });
          }
        }
      }
    }

    // Ensure Google Gemini default provider exists
    const currentProviders = db.getProviders();
    const hasGemini = currentProviders.some(
      (p) => p.name.toLowerCase().includes('gemini') || p.baseUrl.includes('generativelanguage.googleapis.com')
    );
    if (!hasGemini) {
      const geminiPreset = PROVIDER_PRESETS.find((p) => p.name === 'Google Gemini');
      if (geminiPreset) {
        db.saveProvider({
          id: crypto.randomUUID(),
          name: geminiPreset.name || 'Google Gemini',
          baseUrl: geminiPreset.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai',
          chatEndpoint: geminiPreset.chatEndpoint || '/chat/completions',
          apiKey: '',
          modelListUrl: geminiPreset.modelListUrl || '/models',
          defaultModel: geminiPreset.defaultModel || 'gemini-2.5-flash',
          protocol: geminiPreset.protocol || 'openai-chat',
          authMethod: geminiPreset.authMethod || 'bearer',
          customHeaders: geminiPreset.customHeaders || {},
          customBodyParams: geminiPreset.customBodyParams || {},
          requestTimeout: 60000,
          maxRetries: 2,
          streamingEnabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        DiagnosticsService.log('info', 'storage', 'Added Google Gemini as default provider');
      }
    }
  }

  // Create default initial conversation if none exist
  const convs = db.getConversations();
  if (convs.length === 0) {
    const allProv = db.getProviders();
    const firstProv =
      allProv.find((p) => p.name.includes('Gemini')) ||
      allProv.find((p) => p.name.includes('OpenAI')) ||
      allProv[0];
    db.createConversation({
      id: crypto.randomUUID(),
      title: 'New Chat',
      providerId: firstProv ? firstProv.id : '',
      modelId: firstProv ? firstProv.defaultModel : '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  chatEngine = new ChatEngine(db, creds, () => mainWindow);
  registerIpcHandlers(db, creds, chatEngine, () => mainWindow);
}

app.whenReady().then(async () => {
  await initServices();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  try {
    WorkspaceProcessManager.getInstance().killAll();
  } catch (err) {
    console.error('Error terminating background processes on quit:', err);
  }
  if (db) {
    db.persistImmediately();
  }
});
