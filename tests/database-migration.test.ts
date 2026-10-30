import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

describe('Database Migration Tests', () => {
  const testDbPath = path.resolve(__dirname, 'test-migration.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should migrate an existing messages table without parent_id column seamlessly', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // 1. Simulate legacy database schema from earlier version (no parent_id column)
    db.run(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        attachments_json TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        token_usage_json TEXT,
        latency_ms INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO messages (id, conversation_id, role, content, status, created_at, updated_at)
      VALUES ('m1', 'c1', 'user', 'hello', 'completed', 1000, 1000);
    `);

    // 2. Perform safe migration sequence
    // First alter table to add missing columns
    try {
      db.run(`ALTER TABLE messages ADD COLUMN parent_id TEXT;`);
    } catch {}
    try {
      db.run(`ALTER TABLE messages ADD COLUMN reasoning_content TEXT;`);
    } catch {}
    try {
      db.run(`ALTER TABLE messages ADD COLUMN thinking_duration_ms INTEGER;`);
    } catch {}
    try {
      db.run(`ALTER TABLE messages ADD COLUMN finish_reason TEXT;`);
    } catch {}
    try {
      db.run(`ALTER TABLE messages ADD COLUMN tool_calls_json TEXT;`);
    } catch {}
    try {
      db.run(`ALTER TABLE messages ADD COLUMN citations_json TEXT;`);
    } catch {}

    // Then create index on parent_id
    expect(() => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);`);
    }).not.toThrow();

    // Verify row was preserved and column is queryable
    const stmt = db.prepare('SELECT id, parent_id, reasoning_content, finish_reason, tool_calls_json, citations_json FROM messages WHERE id = $id');
    stmt.bind({ $id: 'm1' });
    expect(stmt.step()).toBe(true);
    const row = stmt.get();
    stmt.free();

    expect(row[0]).toBe('m1');
    expect(row[1]).toBe(null); // parent_id initialized to null
    expect(row[2]).toBe(null); // reasoning_content initialized to null
    expect(row[3]).toBe(null); // finish_reason initialized to null
    expect(row[4]).toBe(null); // tool_calls_json initialized to null
    expect(row[5]).toBe(null); // citations_json initialized to null
    db.close();
  });

  it('should initialize AppDatabase and persist conversations with web browsing and messages with tool calls & citations', async () => {
    const { AppDatabase } = await import('../src/main/storage/database');
    const tmpDir = path.resolve(__dirname, 'test-db-dir');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const appDb = new AppDatabase(tmpDir);
    await appDb.initialize();

    // 1. Create a conversation with web browsing enabled
    appDb.createConversation({
      id: 'conv-web-1',
      title: 'Web Browsing Chat',
      providerId: 'prov-1',
      modelId: 'gpt-4o',
      webBrowsingEnabled: true,
      createdAt: 1000,
      updatedAt: 1000,
    });

    const conv = appDb.getConversation('conv-web-1');
    expect(conv).toBeDefined();
    expect(conv?.webBrowsingEnabled).toBe(true);

    // 2. Save a message with tool calls and citations
    appDb.saveMessage({
      id: 'msg-web-1',
      conversationId: 'conv-web-1',
      role: 'assistant',
      content: 'Here are the latest Electron 34 features...',
      status: 'completed',
      toolCalls: [
        {
          id: 'call-1',
          name: 'search_web',
          input: { query: 'Electron 34 release' },
          output: { results: [{ title: 'Electron 34.0.0', url: 'https://electronjs.org' }] },
          status: 'completed',
          durationMs: 450,
        },
      ],
      citations: [
        {
          title: 'Electron 34.0.0',
          url: 'https://www.electronjs.org/blog/electron-34-0',
          snippet: 'Electron 34.0.0 has been released with Chromium 132.',
        },
      ],
      createdAt: 1010,
      updatedAt: 1010,
    });

    const msgs = appDb.getMessages('conv-web-1');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].toolCalls).toHaveLength(1);
    expect(msgs[0].toolCalls?.[0].name).toBe('search_web');
    expect(msgs[0].citations).toHaveLength(1);
    expect(msgs[0].citations?.[0].url).toBe('https://www.electronjs.org/blog/electron-34-0');

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
