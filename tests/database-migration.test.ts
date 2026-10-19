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

    // Then create index on parent_id
    expect(() => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);`);
    }).not.toThrow();

    // Verify row was preserved and column is queryable
    const stmt = db.prepare('SELECT id, parent_id, reasoning_content FROM messages WHERE id = $id');
    stmt.bind({ $id: 'm1' });
    expect(stmt.step()).toBe(true);
    const row = stmt.get();
    stmt.free();

    expect(row[0]).toBe('m1');
    expect(row[1]).toBe(null); // parent_id initialized to null
    expect(row[2]).toBe(null); // reasoning_content initialized to null
    db.close();
  });
});
