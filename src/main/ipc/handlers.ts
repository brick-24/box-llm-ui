import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { IPC_CHANNELS } from './channels';
import { PROVIDER_PRESETS } from '../../shared/constants';
import { AppDatabase } from '../storage/database';
import { CredentialManager } from '../storage/credentials';
import { ChatEngine, SendMessageOptions } from '../engine/chat-engine';
import { DocumentProcessor } from '../documents/document-processor';
import { AdapterFactory } from '../providers/adapter-factory';
import { DiagnosticsService } from '../engine/diagnostics';
import {
  ProviderConfigSchema,
  ConversationSchema,
  AppSettingsSchema,
} from '../../shared/validation';
import { ProviderConfig, Conversation } from '../../shared/types';

export function registerIpcHandlers(
  db: AppDatabase,
  creds: CredentialManager,
  chatEngine: ChatEngine,
  getMainWindow: () => BrowserWindow | null
) {
  // === PROVIDERS ===
  ipcMain.handle(IPC_CHANNELS.PROVIDERS_GET_ALL, async () => {
    const list = db.getProviders();
    // Mask sensitive API keys when returning to renderer for security
    return list.map((p) => {
      const decrypted = creds.decrypt(p.apiKey);
      const isConfigured = Boolean(decrypted && decrypted.trim());
      const maskedKey = isConfigured
        ? (decrypted.length > 8 ? `••••••••••••${decrypted.slice(-4)}` : '••••••••')
        : '';
      return {
        ...p,
        apiKey: maskedKey,
        isConfigured,
      };
    });
  });

  ipcMain.handle(IPC_CHANNELS.PROVIDERS_SAVE, async (_event, rawConfig: ProviderConfig) => {
    const validated = ProviderConfigSchema.parse(rawConfig);
    // If the apiKey is masked (e.g. starts with ••••), keep existing stored encrypted key
    let finalKey = validated.apiKey;
    if (finalKey.startsWith('•') || finalKey.startsWith('••••')) {
      const existing = db.getProviders().find((p) => p.id === validated.id);
      if (existing) {
        finalKey = existing.apiKey; // already encrypted
      }
    } else if (finalKey) {
      finalKey = creds.encrypt(finalKey);
    }

    const configToSave: ProviderConfig = {
      ...validated,
      apiKey: finalKey,
      updatedAt: Date.now(),
    };

    db.saveProvider(configToSave);
    DiagnosticsService.log('info', 'storage', `Saved provider configuration: ${validated.name}`);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PROVIDERS_DELETE, async (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid ID');
    db.deleteProvider(id);
    DiagnosticsService.log('info', 'storage', `Deleted provider ${id}`);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PROVIDERS_TEST, async (_event, rawConfig: ProviderConfig) => {
    const validated = ProviderConfigSchema.parse(rawConfig);
    let resolvedKey = validated.apiKey;
    if (resolvedKey.startsWith('•') || resolvedKey.startsWith('••••')) {
      const existing = db.getProviders().find((p) => p.id === validated.id);
      if (existing) {
        resolvedKey = creds.decrypt(existing.apiKey);
      }
    }

    const fullConfig: ProviderConfig = {
      ...validated,
      apiKey: resolvedKey,
    };

    const adapter = AdapterFactory.getAdapter(fullConfig.protocol);
    DiagnosticsService.log('info', 'api', `Testing connection for ${fullConfig.name} (${fullConfig.baseUrl})`);
    return await adapter.testConnection(fullConfig);
  });

  ipcMain.handle(IPC_CHANNELS.PROVIDERS_FETCH_MODELS, async (_event, rawConfig: ProviderConfig) => {
    const validated = ProviderConfigSchema.parse(rawConfig);
    let resolvedKey = validated.apiKey;
    if (resolvedKey.startsWith('•') || resolvedKey.startsWith('••••')) {
      const existing = db.getProviders().find((p) => p.id === validated.id);
      if (existing) {
        resolvedKey = creds.decrypt(existing.apiKey);
      }
    }

    const fullConfig: ProviderConfig = {
      ...validated,
      apiKey: resolvedKey,
    };

    const adapter = AdapterFactory.getAdapter(fullConfig.protocol);
    return await adapter.fetchModels(fullConfig);
  });

  // === CONVERSATIONS ===
  ipcMain.handle(IPC_CHANNELS.CONVERSATIONS_GET_ALL, async () => {
    return db.getConversations();
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATIONS_CREATE, async (_event, rawConv: Conversation) => {
    const validated = ConversationSchema.parse(rawConv);
    db.createConversation(validated);
    return validated;
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATIONS_UPDATE, async (_event, conv: Partial<Conversation> & { id: string }) => {
    if (!conv.id) throw new Error('Conversation ID required');
    db.updateConversation(conv);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATIONS_DELETE, async (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid ID');
    chatEngine.stopGeneration(id);
    db.deleteConversation(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATIONS_SEARCH, async (_event, query: string) => {
    return db.searchConversations(query || '');
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATIONS_EXPORT_MARKDOWN, async (_event, conversationId: string) => {
    const conv = db.getConversation(conversationId);
    if (!conv) throw new Error('Conversation not found');
    const msgs = db.getMessages(conversationId);

    let md = `# ${conv.title}\n\n`;
    md += `*Exported on ${new Date().toLocaleString()}*\n`;
    md += `*Model: ${conv.modelId}*\n\n---\n\n`;

    if (conv.systemPrompt) {
      md += `> **System Prompt:** ${conv.systemPrompt}\n\n---\n\n`;
    }

    for (const m of msgs) {
      const roleLabel = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : m.role;
      md += `### ${roleLabel}\n\n`;

      if (m.reasoningContent) {
        const durationStr = m.thinkingDurationMs ? ` (${(m.thinkingDurationMs / 1000).toFixed(1)}s)` : '';
        md += `<details>\n<summary>Thinking Process${durationStr}</summary>\n\n${m.reasoningContent}\n\n</details>\n\n`;
      }

      md += `${m.content}\n\n`;

      if (m.attachments && m.attachments.length > 0) {
        md += `*Attachments:*\n`;
        for (const a of m.attachments) {
          md += `- ${a.name} (${a.type}, ${a.size} bytes)\n`;
        }
        md += '\n';
      }
      md += '---\n\n';
    }

    const win = getMainWindow();
    if (!win) return { success: false };

    const saveRes = await dialog.showSaveDialog(win, {
      title: 'Export Conversation as Markdown',
      defaultPath: `${conv.title.replace(/[\\/:*?"<>|]/g, '_')}.md`,
      filters: [{ name: 'Markdown Files', extensions: ['md'] }],
    });

    if (!saveRes.canceled && saveRes.filePath) {
      fs.writeFileSync(saveRes.filePath, md, 'utf8');
      return { success: true, filePath: saveRes.filePath };
    }
    return { success: false, cancelled: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATIONS_EXPORT_JSON, async () => {
    const data = db.exportAllData();
    const win = getMainWindow();
    if (!win) return { success: false };

    const saveRes = await dialog.showSaveDialog(win, {
      title: 'Export All Conversations (JSON)',
      defaultPath: `universal-llm-backup-${Date.now()}.json`,
      filters: [{ name: 'JSON Archive', extensions: ['json'] }],
    });

    if (!saveRes.canceled && saveRes.filePath) {
      fs.writeFileSync(saveRes.filePath, JSON.stringify(data, null, 2), 'utf8');
      return { success: true, filePath: saveRes.filePath };
    }
    return { success: false, cancelled: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONVERSATIONS_IMPORT_JSON, async () => {
    const win = getMainWindow();
    if (!win) return { success: false };

    const openRes = await dialog.showOpenDialog(win, {
      title: 'Import Conversation Archive',
      filters: [{ name: 'JSON Archive', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (!openRes.canceled && openRes.filePaths[0]) {
      const content = fs.readFileSync(openRes.filePaths[0], 'utf8');
      const parsed = JSON.parse(content);
      const res = db.importData(parsed);
      return { success: true, ...res };
    }
    return { success: false, cancelled: true };
  });

  // === MESSAGES ===
  ipcMain.handle(IPC_CHANNELS.MESSAGES_GET_ALL, async (_event, conversationId: string) => {
    if (typeof conversationId !== 'string') return [];
    return db.getMessages(conversationId);
  });

  ipcMain.handle(IPC_CHANNELS.MESSAGES_SEND, async (_event, options: SendMessageOptions) => {
    try {
      const result = await chatEngine.executeChat(options);
      return { success: result.status !== 'error', ...result };
    } catch (err: any) {
      console.error('[Handlers] Error executing chat:', err);
      return { success: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.MESSAGES_STOP, async (_event, conversationId: string) => {
    return chatEngine.stopGeneration(conversationId);
  });

  ipcMain.handle(IPC_CHANNELS.MESSAGES_DELETE, async (_event, messageId: string) => {
    db.deleteMessage(messageId);
    return { success: true };
  });

  // === DOCUMENTS ===
  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_SELECT_DIALOG, async () => {
    const win = getMainWindow();
    if (!win) return null;

    const res = await dialog.showOpenDialog(win, {
      title: 'Attach Documents or Images',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'All Supported Files',
          extensions: [
            'pdf', 'docx', 'txt', 'md', 'csv', 'json', 'xml', 'html',
            'png', 'jpg', 'jpeg', 'webp', 'gif',
            'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'sql', 'sh', 'yaml', 'yml'
          ],
        },
        { name: 'Documents (PDF, DOCX, Text, Markdown)', extensions: ['pdf', 'docx', 'txt', 'md', 'csv', 'json'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      ],
    });

    if (res.canceled || !res.filePaths.length) {
      return [];
    }

    const attachments = [];
    for (const fp of res.filePaths) {
      try {
        const att = await DocumentProcessor.processFile(fp);
        attachments.push(att);
        DiagnosticsService.log('info', 'document', `Processed file ${att.name}`, {
          type: att.type,
          size: att.size,
          tokens: att.tokenEstimate,
        });
      } catch (err: any) {
        DiagnosticsService.log('error', 'document', `Failed to process ${path.basename(fp)}: ${err.message}`);
      }
    }
    return attachments;
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_PROCESS_FILE, async (_event, filePath: string) => {
    if (typeof filePath !== 'string' || !fs.existsSync(filePath)) {
      throw new Error('File path does not exist');
    }
    return await DocumentProcessor.processFile(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_PROCESS_BUFFER, async (_event, base64: string, filename: string, mimeType: string) => {
    const buffer = Buffer.from(base64, 'base64');
    return await DocumentProcessor.processBuffer(buffer, filename, mimeType);
  });

  // === SETTINGS ===
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return db.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, rawSettings: any) => {
    const validated = AppSettingsSchema.parse(rawSettings);
    db.saveSettings(validated);
    DiagnosticsService.log('info', 'storage', 'Application settings updated');
    return { success: true };
  });

  // === DIAGNOSTICS ===
  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_GET, async () => {
    return DiagnosticsService.getLogs(150);
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_CLEAR, async () => {
    DiagnosticsService.clearLogs();
    return { success: true };
  });

  // === FACTORY RESET ===
  ipcMain.handle(IPC_CHANNELS.APP_RESET_DATA, async () => {
    try {
      // 1. Wipe database tables
      db.resetAllData();

      // 2. Reset stored credentials
      creds.reset();

      // 3. Re-seed default provider presets with empty API keys
      const now = Date.now();
      for (let i = 0; i < PROVIDER_PRESETS.length; i++) {
        const preset = PROVIDER_PRESETS[i];
        db.saveProvider({
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
        });
      }

      // 4. Create fresh default conversation
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

      DiagnosticsService.log('info', 'storage', 'Application reset to factory defaults');
      return { success: true };
    } catch (err: any) {
      console.error('[Handlers] Failed to reset application data:', err);
      DiagnosticsService.log('error', 'storage', 'Failed to reset application data', { error: String(err) });
      return { success: false, error: err?.message || 'Failed to reset application data' };
    }
  });

  // === WINDOW & SYSTEM ===
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    getMainWindow()?.close();
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, (_event, url: string) => {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
    }
  });

  // === BROWSER & WEB SURFING ===
  ipcMain.handle(IPC_CHANNELS.BROWSER_VIEW_PAGE, async (_event, url: string, takeScreenshot = true) => {
    try {
      const { browserSession } = await import('../browser/browser-session');
      return await browserSession.browsePage(url, { takeScreenshot });
    } catch (err: any) {
      console.error('[Handlers] Failed to browse page:', err);
      return { url, title: url, content: '', characterCount: 0, truncated: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_SEARCH_TEST, async (_event, query: string) => {
    try {
      const { executeWebSearch } = await import('../browser/search-service');
      const settings = db.getSettings();
      return await executeWebSearch(query, settings);
    } catch (err: any) {
      console.error('[Handlers] Failed to search web:', err);
      return [];
    }
  });

  // === WORKSPACE & CODING ENGINE ===
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SELECT_DIALOG, async () => {
    const win = getMainWindow();
    if (!win) return null;

    const res = await dialog.showOpenDialog(win, {
      title: 'Select Project Workspace Directory',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (res.canceled || !res.filePaths.length) {
      return null;
    }

    const selectedPath = res.filePaths[0];
    try {
      const { WorkspaceTools } = await import('../engine/tools/workspace-tools');
      await WorkspaceTools.ensureGitRepo(selectedPath);
    } catch (err) {
      console.warn('[Handlers] Git auto-init non-fatal warning:', err);
    }

    return selectedPath;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_TREE, async (_event, workspacePath: string) => {
    if (!workspacePath || typeof workspacePath !== 'string') return null;
    try {
      const { WorkspaceTools } = await import('../engine/tools/workspace-tools');
      return WorkspaceTools.listDir(workspacePath, undefined, 15);
    } catch (err: any) {
      console.error('[Handlers] Failed to get workspace tree:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_READ_FILE, async (_event, workspacePath: string, relativePath: string) => {
    if (!workspacePath || !relativePath) return null;
    try {
      const { WorkspaceTools } = await import('../engine/tools/workspace-tools');
      const safe = WorkspaceTools.resolveSafePath(workspacePath, relativePath);
      const stat = fs.statSync(safe);
      if (stat.isDirectory()) return null;
      const content = fs.readFileSync(safe, 'utf8');
      const lines = content.split(/\r?\n/).length;
      return {
        path: relativePath,
        content,
        sizeBytes: stat.size,
        lines,
      };
    } catch (err: any) {
      console.error('[Handlers] Failed to read workspace file:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN_EXPLORER, async (_event, workspacePath: string) => {
    if (!workspacePath) return { success: false };
    try {
      await shell.openPath(workspacePath);
      return { success: true };
    } catch (err: any) {
      console.error('[Handlers] Failed to open path in explorer:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GIT_STATUS, async (_event, workspacePath: string) => {
    if (!workspacePath) return { isRepo: false, branch: '', changes: [], clean: true };
    try {
      const { WorkspaceTools } = await import('../engine/tools/workspace-tools');
      return await WorkspaceTools.getGitStatus(workspacePath);
    } catch (err: any) {
      console.error('[Handlers] Failed to get git status:', err);
      return { isRepo: false, branch: '', changes: [], clean: true, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GIT_LOG, async (_event, workspacePath: string, limit?: number) => {
    if (!workspacePath) return [];
    try {
      const { WorkspaceTools } = await import('../engine/tools/workspace-tools');
      return await WorkspaceTools.getGitLog(workspacePath, limit || 15);
    } catch (err: any) {
      console.error('[Handlers] Failed to get git log:', err);
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GIT_DIFF, async (_event, workspacePath: string, filePath?: string) => {
    if (!workspacePath) return '';
    try {
      const { WorkspaceTools } = await import('../engine/tools/workspace-tools');
      return await WorkspaceTools.getGitDiff(workspacePath, filePath);
    } catch (err: any) {
      console.error('[Handlers] Failed to get git diff:', err);
      return '';
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GIT_INIT, async (_event, workspacePath: string) => {
    if (!workspacePath) return { isRepo: false, initialized: false, message: 'No workspace path' };
    try {
      const { WorkspaceTools } = await import('../engine/tools/workspace-tools');
      return await WorkspaceTools.ensureGitRepo(workspacePath);
    } catch (err: any) {
      console.error('[Handlers] Failed to initialize git repo:', err);
      return { isRepo: false, initialized: false, message: err.message };
    }
  });

  // === PROCESS & MULTI-TERMINAL ENGINE ===
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_PROCESS_START,
    async (
      _event,
      workspacePathOrParams: any,
      commandArg?: string,
      options?: { isDaemon?: boolean; name?: string; waitMsBeforeAsync?: number }
    ) => {
      try {
        const { WorkspaceProcessManager } = await import('../engine/tools/process-manager');
        const manager = WorkspaceProcessManager.getInstance();
        manager.setWindowGetter(getMainWindow);
        return await manager.startProcess(workspacePathOrParams, commandArg, options);
      } catch (err: any) {
        console.error('[Handlers] Failed to start process:', err);
        throw err;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_PROCESS_LIST, async (_event, workspacePath?: string) => {
    try {
      const { WorkspaceProcessManager } = await import('../engine/tools/process-manager');
      const manager = WorkspaceProcessManager.getInstance();
      return manager.listProcesses(workspacePath);
    } catch (err: any) {
      console.error('[Handlers] Failed to list processes:', err);
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_PROCESS_KILL, async (_event, processId: string) => {
    try {
      const { WorkspaceProcessManager } = await import('../engine/tools/process-manager');
      const manager = WorkspaceProcessManager.getInstance();
      return await manager.killProcess(processId);
    } catch (err: any) {
      console.error('[Handlers] Failed to kill process:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_PROCESS_INPUT, async (_event, processId: string, input: string) => {
    try {
      const { WorkspaceProcessManager } = await import('../engine/tools/process-manager');
      const manager = WorkspaceProcessManager.getInstance();
      return manager.sendInput(processId, input);
    } catch (err: any) {
      console.error('[Handlers] Failed to send process input:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_PROCESS_LOGS, async (_event, processId: string, lines?: number) => {
    try {
      const { WorkspaceProcessManager } = await import('../engine/tools/process-manager');
      const manager = WorkspaceProcessManager.getInstance();
      return manager.getProcessLogs(processId, lines);
    } catch (err: any) {
      console.error('[Handlers] Failed to get process logs:', err);
      return [];
    }
  });
}
