import initSqlJs, { Database } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import {
  Conversation,
  ChatMessage,
  ProviderConfig,
  AppSettings,
  DiagnosticLog,
} from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/constants';

function safeParseStringArray(val: any): string[] {
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export class AppDatabase {
  private db: Database | null = null;
  private dbPath: string;
  private isDirty = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(userDataPath: string) {
    this.dbPath = path.join(userDataPath, 'universal-llm.sqlite');
  }

  public async initialize(): Promise<void> {
    const wasmPaths = [
      path.join(__dirname, 'sql-wasm.wasm'),
      path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(process.resourcesPath || '', 'sql-wasm.wasm'),
    ];

    let wasmBinary: ArrayBuffer | undefined;
    for (const p of wasmPaths) {
      if (fs.existsSync(p)) {
        const fileBuf = fs.readFileSync(p);
        wasmBinary = fileBuf.buffer.slice(
          fileBuf.byteOffset,
          fileBuf.byteOffset + fileBuf.byteLength
        );
        break;
      }
    }

    const SQL = await initSqlJs({
      wasmBinary,
    });

    if (fs.existsSync(this.dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(fileBuffer);
      } catch (err) {
        console.error('[Database] Failed to read existing SQLite DB, creating new:', err);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    this.runMigrations();
    this.persistImmediately();
  }

  private runMigrations() {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        system_prompt TEXT,
        temperature REAL,
        max_tokens INTEGER,
        top_p REAL,
        is_pinned INTEGER DEFAULT 0,
        web_browsing_enabled INTEGER DEFAULT 0,
        enabled_tools_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        attachments_json TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        token_usage_json TEXT,
        latency_ms INTEGER,
        finish_reason TEXT,
        tool_calls_json TEXT,
        citations_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS diagnostics (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        details_json TEXT
      );
    `);

    // Safe incremental migrations for existing databases (run before creating column-dependent indexes)
    try {
      this.db.run(`ALTER TABLE conversations ADD COLUMN web_browsing_enabled INTEGER DEFAULT 0;`);
    } catch {}
    try {
      this.db.run(`ALTER TABLE conversations ADD COLUMN enabled_tools_json TEXT;`);
    } catch {}
    try {
      this.db.run(`ALTER TABLE messages ADD COLUMN parent_id TEXT;`);
    } catch {}
    try {
      this.db.run(`ALTER TABLE messages ADD COLUMN reasoning_content TEXT;`);
    } catch {}
    try {
      this.db.run(`ALTER TABLE messages ADD COLUMN thinking_duration_ms INTEGER;`);
    } catch {}
    try {
      this.db.run(`ALTER TABLE messages ADD COLUMN finish_reason TEXT;`);
    } catch {}
    try {
      this.db.run(`ALTER TABLE messages ADD COLUMN tool_calls_json TEXT;`);
    } catch {}
    try {
      this.db.run(`ALTER TABLE messages ADD COLUMN citations_json TEXT;`);
    } catch {}

    // Indexes created after all columns exist
    try {
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);`);
    } catch {}
    try {
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);`);
    } catch {}
    try {
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);`);
    } catch {}
    try {
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);`);
    } catch {}
  }

  private queueSave() {
    this.isDirty = true;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.persistImmediately();
    }, 500);
  }

  public persistImmediately(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const tempPath = `${this.dbPath}.tmp`;
      fs.writeFileSync(tempPath, buffer);
      fs.renameSync(tempPath, this.dbPath);
      this.isDirty = false;
    } catch (err) {
      console.error('[Database] Error saving SQLite database to disk:', err);
    }
  }

  // === Providers ===
  public getProviders(): ProviderConfig[] {
    if (!this.db) return [];
    const res = this.db.exec('SELECT config_json FROM providers ORDER BY updated_at DESC');
    if (!res.length || !res[0].values) return [];
    return res[0].values.map((row) => JSON.parse(row[0] as string));
  }

  public saveProvider(config: ProviderConfig): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO providers (id, config_json, created_at, updated_at)
      VALUES ($id, $json, $created, $updated)
      ON CONFLICT(id) DO UPDATE SET
        config_json = $json,
        updated_at = $updated
    `);
    stmt.run({
      $id: config.id,
      $json: JSON.stringify(config),
      $created: config.createdAt,
      $updated: config.updatedAt,
    });
    stmt.free();
    this.queueSave();
  }

  public deleteProvider(id: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare('DELETE FROM providers WHERE id = $id');
    stmt.run({ $id: id });
    stmt.free();
    this.queueSave();
  }

  // === Conversations ===
  public getConversations(): Conversation[] {
    if (!this.db) return [];
    const res = this.db.exec(`
      SELECT id, title, provider_id, model_id, system_prompt, temperature, max_tokens, top_p, is_pinned, created_at, updated_at, web_browsing_enabled, enabled_tools_json
      FROM conversations
      ORDER BY is_pinned DESC, updated_at DESC
    `);
    if (!res.length || !res[0].values) return [];
    return res[0].values.map((row) => ({
      id: row[0] as string,
      title: row[1] as string,
      providerId: row[2] as string,
      modelId: row[3] as string,
      systemPrompt: (row[4] as string) || undefined,
      temperature: row[5] !== null ? Number(row[5]) : undefined,
      maxTokens: row[6] !== null ? Number(row[6]) : undefined,
      topP: row[7] !== null ? Number(row[7]) : undefined,
      isPinned: Boolean(row[8]),
      createdAt: Number(row[9]),
      updatedAt: Number(row[10]),
      webBrowsingEnabled: Boolean(row[11]),
      enabledTools: row[12] ? safeParseStringArray(row[12]) : (Boolean(row[11]) ? ['browse'] : []),
    }));
  }

  public createConversation(conv: Conversation): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, title, provider_id, model_id, system_prompt, temperature, max_tokens, top_p, is_pinned, web_browsing_enabled, enabled_tools_json, created_at, updated_at)
      VALUES ($id, $title, $providerId, $modelId, $systemPrompt, $temperature, $maxTokens, $topP, $isPinned, $webBrowsingEnabled, $enabledToolsJson, $createdAt, $updatedAt)
    `);
    stmt.run({
      $id: conv.id,
      $title: conv.title,
      $providerId: conv.providerId,
      $modelId: conv.modelId,
      $systemPrompt: conv.systemPrompt || null,
      $temperature: conv.temperature !== undefined ? conv.temperature : null,
      $maxTokens: conv.maxTokens !== undefined ? conv.maxTokens : null,
      $topP: conv.topP !== undefined ? conv.topP : null,
      $isPinned: conv.isPinned ? 1 : 0,
      $webBrowsingEnabled: (conv.enabledTools ? conv.enabledTools.includes('browse') : conv.webBrowsingEnabled) ? 1 : 0,
      $enabledToolsJson: conv.enabledTools ? JSON.stringify(conv.enabledTools) : (conv.webBrowsingEnabled ? JSON.stringify(['browse']) : null),
      $createdAt: conv.createdAt,
      $updatedAt: conv.updatedAt,
    });
    stmt.free();
    this.queueSave();
  }

  public updateConversation(conv: Partial<Conversation> & { id: string }): void {
    if (!this.db) return;
    const current = this.getConversation(conv.id);
    if (!current) return;
    const merged: Conversation = {
      ...current,
      ...conv,
      updatedAt: conv.updatedAt || Date.now(),
    };

    const isWeb = merged.enabledTools
      ? merged.enabledTools.includes('browse')
      : Boolean(merged.webBrowsingEnabled);

    const stmt = this.db.prepare(`
      UPDATE conversations SET
        title = $title,
        provider_id = $providerId,
        model_id = $modelId,
        system_prompt = $systemPrompt,
        temperature = $temperature,
        max_tokens = $maxTokens,
        top_p = $topP,
        is_pinned = $isPinned,
        web_browsing_enabled = $webBrowsingEnabled,
        enabled_tools_json = $enabledToolsJson,
        updated_at = $updatedAt
      WHERE id = $id
    `);
    stmt.run({
      $id: merged.id,
      $title: merged.title,
      $providerId: merged.providerId,
      $modelId: merged.modelId,
      $systemPrompt: merged.systemPrompt || null,
      $temperature: merged.temperature !== undefined ? merged.temperature : null,
      $maxTokens: merged.maxTokens !== undefined ? merged.maxTokens : null,
      $topP: merged.topP !== undefined ? merged.topP : null,
      $isPinned: merged.isPinned ? 1 : 0,
      $webBrowsingEnabled: isWeb ? 1 : 0,
      $enabledToolsJson: merged.enabledTools ? JSON.stringify(merged.enabledTools) : (isWeb ? JSON.stringify(['browse']) : null),
      $updatedAt: merged.updatedAt,
    });
    stmt.free();
    this.queueSave();
  }

  public getConversation(id: string): Conversation | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`
      SELECT id, title, provider_id, model_id, system_prompt, temperature, max_tokens, top_p, is_pinned, created_at, updated_at, web_browsing_enabled, enabled_tools_json
      FROM conversations WHERE id = $id
    `);
    stmt.bind({ $id: id });
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.get();
    stmt.free();
    return {
      id: row[0] as string,
      title: row[1] as string,
      providerId: row[2] as string,
      modelId: row[3] as string,
      systemPrompt: (row[4] as string) || undefined,
      temperature: row[5] !== null ? Number(row[5]) : undefined,
      maxTokens: row[6] !== null ? Number(row[6]) : undefined,
      topP: row[7] !== null ? Number(row[7]) : undefined,
      isPinned: Boolean(row[8]),
      createdAt: Number(row[9]),
      updatedAt: Number(row[10]),
      webBrowsingEnabled: Boolean(row[11]),
      enabledTools: row[12] ? safeParseStringArray(row[12]) : (Boolean(row[11]) ? ['browse'] : []),
    };
  }

  public deleteConversation(id: string): void {
    if (!this.db) return;
    const stmt1 = this.db.prepare('DELETE FROM messages WHERE conversation_id = $id');
    stmt1.run({ $id: id });
    stmt1.free();

    const stmt2 = this.db.prepare('DELETE FROM conversations WHERE id = $id');
    stmt2.run({ $id: id });
    stmt2.free();

    this.queueSave();
  }

  public searchConversations(query: string): Conversation[] {
    if (!this.db || !query.trim()) return this.getConversations();
    const cleanQuery = `%${query.trim().toLowerCase()}%`;

    const stmt = this.db.prepare(`
      SELECT DISTINCT c.id, c.title, c.provider_id, c.model_id, c.system_prompt, c.temperature, c.max_tokens, c.top_p, c.is_pinned, c.created_at, c.updated_at, c.web_browsing_enabled, c.enabled_tools_json
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE LOWER(c.title) LIKE $q OR LOWER(m.content) LIKE $q
      ORDER BY c.is_pinned DESC, c.updated_at DESC
    `);
    stmt.bind({ $q: cleanQuery });
    const results: Conversation[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      results.push({
        id: row[0] as string,
        title: row[1] as string,
        providerId: row[2] as string,
        modelId: row[3] as string,
        systemPrompt: (row[4] as string) || undefined,
        temperature: row[5] !== null ? Number(row[5]) : undefined,
        maxTokens: row[6] !== null ? Number(row[6]) : undefined,
        topP: row[7] !== null ? Number(row[7]) : undefined,
        isPinned: Boolean(row[8]),
        createdAt: Number(row[9]),
        updatedAt: Number(row[10]),
        webBrowsingEnabled: Boolean(row[11]),
        enabledTools: row[12] ? safeParseStringArray(row[12]) : (Boolean(row[11]) ? ['browse'] : []),
      });
    }
    stmt.free();
    return results;
  }

  // === Messages ===
  public getMessages(conversationId: string): ChatMessage[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT id, conversation_id, parent_id, role, content, attachments_json, status, error_message, token_usage_json, latency_ms, reasoning_content, thinking_duration_ms, finish_reason, created_at, updated_at, tool_calls_json, citations_json
      FROM messages WHERE conversation_id = $cid
      ORDER BY created_at ASC
    `);
    stmt.bind({ $cid: conversationId });
    const msgs: ChatMessage[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      msgs.push({
        id: row[0] as string,
        conversationId: row[1] as string,
        parentId: (row[2] as string) || null,
        role: row[3] as any,
        content: row[4] as string,
        attachments: row[5] ? JSON.parse(row[5] as string) : undefined,
        status: row[6] as any,
        errorMessage: (row[7] as string) || undefined,
        tokenUsage: row[8] ? JSON.parse(row[8] as string) : undefined,
        latencyMs: row[9] !== null ? Number(row[9]) : undefined,
        reasoningContent: (row[10] as string) || undefined,
        thinkingDurationMs: row[11] !== null ? Number(row[11]) : undefined,
        finishReason: (row[12] as string) || undefined,
        createdAt: Number(row[13]),
        updatedAt: Number(row[14]),
        toolCalls: row[15] ? JSON.parse(row[15] as string) : undefined,
        citations: row[16] ? JSON.parse(row[16] as string) : undefined,
      });
    }
    stmt.free();
    return msgs;
  }

  public saveMessage(msg: ChatMessage): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, parent_id, role, content, attachments_json, status, error_message, token_usage_json, latency_ms, reasoning_content, thinking_duration_ms, finish_reason, tool_calls_json, citations_json, created_at, updated_at)
      VALUES ($id, $cid, $parentId, $role, $content, $attachments, $status, $error, $usage, $latency, $reasoning, $thinkingDuration, $finishReason, $toolCalls, $citations, $created, $updated)
      ON CONFLICT(id) DO UPDATE SET
        parent_id = $parentId,
        content = $content,
        attachments_json = $attachments,
        status = $status,
        error_message = $error,
        token_usage_json = $usage,
        latency_ms = $latency,
        reasoning_content = $reasoning,
        thinking_duration_ms = $thinkingDuration,
        finish_reason = $finishReason,
        tool_calls_json = $toolCalls,
        citations_json = $citations,
        updated_at = $updated
    `);
    stmt.run({
      $id: msg.id,
      $cid: msg.conversationId,
      $parentId: msg.parentId || null,
      $role: msg.role,
      $content: msg.content,
      $attachments: msg.attachments ? JSON.stringify(msg.attachments) : null,
      $status: msg.status,
      $error: msg.errorMessage || null,
      $usage: msg.tokenUsage ? JSON.stringify(msg.tokenUsage) : null,
      $latency: msg.latencyMs !== undefined ? msg.latencyMs : null,
      $reasoning: msg.reasoningContent || null,
      $thinkingDuration: msg.thinkingDurationMs !== undefined ? msg.thinkingDurationMs : null,
      $finishReason: msg.finishReason || null,
      $toolCalls: msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
      $citations: msg.citations ? JSON.stringify(msg.citations) : null,
      $created: msg.createdAt,
      $updated: msg.updatedAt,
    });
    stmt.free();

    // Bump conversation updated_at
    const convStmt = this.db.prepare('UPDATE conversations SET updated_at = $now WHERE id = $id');
    convStmt.run({ $now: Date.now(), $id: msg.conversationId });
    convStmt.free();

    this.queueSave();
  }

  public updateMessage(messageId: string, updates: Partial<ChatMessage>): void {
    if (!this.db) return;
    const stmtSelect = this.db.prepare(`
      SELECT id, conversation_id, parent_id, role, content, attachments_json, status, error_message, token_usage_json, latency_ms, reasoning_content, thinking_duration_ms, finish_reason, created_at, updated_at, tool_calls_json, citations_json
      FROM messages WHERE id = $id
    `);
    stmtSelect.bind({ $id: messageId });
    if (!stmtSelect.step()) {
      stmtSelect.free();
      return;
    }
    const row = stmtSelect.get();
    stmtSelect.free();

    const existing: ChatMessage = {
      id: row[0] as string,
      conversationId: row[1] as string,
      parentId: (row[2] as string) || null,
      role: row[3] as any,
      content: row[4] as string,
      attachments: row[5] ? JSON.parse(row[5] as string) : undefined,
      status: row[6] as any,
      errorMessage: (row[7] as string) || undefined,
      tokenUsage: row[8] ? JSON.parse(row[8] as string) : undefined,
      latencyMs: row[9] !== null ? Number(row[9]) : undefined,
      reasoningContent: (row[10] as string) || undefined,
      thinkingDurationMs: row[11] !== null ? Number(row[11]) : undefined,
      finishReason: (row[12] as string) || undefined,
      createdAt: Number(row[13]),
      updatedAt: Number(row[14]),
      toolCalls: row[15] ? JSON.parse(row[15] as string) : undefined,
      citations: row[16] ? JSON.parse(row[16] as string) : undefined,
    };

    const merged = { ...existing, ...updates, updatedAt: updates.updatedAt || Date.now() };
    this.saveMessage(merged);
  }

  public deleteMessage(messageId: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = $id');
    stmt.run({ $id: messageId });
    stmt.free();
    this.queueSave();
  }

  // === Settings ===
  public getSettings(): AppSettings {
    if (!this.db) return DEFAULT_SETTINGS;
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = "app_settings"');
    if (!stmt.step()) {
      stmt.free();
      return DEFAULT_SETTINGS;
    }
    const val = stmt.get()[0] as string;
    stmt.free();
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(val) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public saveSettings(settings: AppSettings): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES ("app_settings", $val)
      ON CONFLICT(key) DO UPDATE SET value = $val
    `);
    stmt.run({ $val: JSON.stringify(settings) });
    stmt.free();
    this.queueSave();
  }

  // === Diagnostics ===
  public addDiagnostic(log: DiagnosticLog): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO diagnostics (id, timestamp, level, category, message, details_json)
      VALUES ($id, $ts, $lvl, $cat, $msg, $details)
    `);
    stmt.run({
      $id: log.id,
      $ts: log.timestamp,
      $lvl: log.level,
      $cat: log.category,
      $msg: log.message,
      $details: log.details ? JSON.stringify(log.details) : null,
    });
    stmt.free();
    this.queueSave();
  }

  public getDiagnostics(limit = 100): DiagnosticLog[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT id, timestamp, level, category, message, details_json
      FROM diagnostics
      ORDER BY timestamp DESC
      LIMIT $limit
    `);
    stmt.bind({ $limit: limit });
    const logs: DiagnosticLog[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      logs.push({
        id: row[0] as string,
        timestamp: Number(row[1]),
        level: row[2] as any,
        category: row[3] as any,
        message: row[4] as string,
        details: row[5] ? JSON.parse(row[5] as string) : undefined,
      });
    }
    stmt.free();
    return logs;
  }

  public clearDiagnostics(): void {
    if (!this.db) return;
    this.db.run('DELETE FROM diagnostics');
    this.queueSave();
  }

  // === Export & Import ===
  public exportAllData(): { conversations: Conversation[]; messages: ChatMessage[]; providers: ProviderConfig[]; settings: AppSettings } {
    const convs = this.getConversations();
    const allMsgs: ChatMessage[] = [];
    for (const c of convs) {
      allMsgs.push(...this.getMessages(c.id));
    }
    return {
      conversations: convs,
      messages: allMsgs,
      providers: this.getProviders(),
      settings: this.getSettings(),
    };
  }

  public importData(data: { conversations?: Conversation[]; messages?: ChatMessage[]; providers?: ProviderConfig[] }): { importedConversations: number; importedMessages: number; importedProviders: number } {
    let convCount = 0;
    let msgCount = 0;
    let provCount = 0;

    if (Array.isArray(data.providers)) {
      for (const p of data.providers) {
        this.saveProvider(p);
        provCount++;
      }
    }

    if (Array.isArray(data.conversations)) {
      for (const c of data.conversations) {
        this.createConversation(c);
        convCount++;
      }
    }

    if (Array.isArray(data.messages)) {
      for (const m of data.messages) {
        this.saveMessage(m);
        msgCount++;
      }
    }

    this.persistImmediately();
    return { importedConversations: convCount, importedMessages: msgCount, importedProviders: provCount };
  }

  public resetAllData(): void {
    if (!this.db) return;
    this.db.run(`
      DELETE FROM messages;
      DELETE FROM conversations;
      DELETE FROM providers;
      DELETE FROM settings;
      DELETE FROM diagnostics;
    `);
    this.persistImmediately();
  }
}
