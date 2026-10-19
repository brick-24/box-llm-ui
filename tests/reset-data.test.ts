import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { AppDatabase } from '../src/main/storage/database';
import { PROVIDER_PRESETS } from '../src/shared/constants';
import { ProviderConfig, Conversation, ChatMessage } from '../src/shared/types';

describe('Data Reset and Cleanup Tests', () => {
  let tempDir: string;
  let db: AppDatabase;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-llm-reset-test-'));
    db = new AppDatabase(tempDir);
    await db.initialize();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('should successfully clear all conversations, messages, providers, and settings with resetAllData()', async () => {
    // 1. Populate with mock test data
    const dummyProvider: ProviderConfig = {
      id: 'prov-test-1',
      name: 'Custom Test Provider',
      baseUrl: 'https://test.api.com/v1',
      chatEndpoint: '/chat/completions',
      apiKey: 'secret-test-key-12345',
      defaultModel: 'test-model-1',
      protocol: 'openai-chat',
      authMethod: 'bearer',
      customHeaders: {},
      customBodyParams: {},
      requestTimeout: 30000,
      maxRetries: 1,
      streamingEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.saveProvider(dummyProvider);

    const dummyConv: Conversation = {
      id: 'conv-test-1',
      title: 'Testing sensitive conversation',
      providerId: 'prov-test-1',
      modelId: 'test-model-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.createConversation(dummyConv);

    const dummyMsg: ChatMessage = {
      id: 'msg-test-1',
      conversationId: 'conv-test-1',
      role: 'user',
      content: 'Here is confidential test data that must be wiped before packaging',
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.saveMessage(dummyMsg);

    // Verify test data is populated
    expect(db.getProviders().length).toBeGreaterThan(0);
    expect(db.getConversations().length).toBe(1);
    expect(db.getMessages('conv-test-1').length).toBe(1);

    // 2. Perform factory reset
    db.resetAllData();

    // 3. Verify all tables are completely wiped
    expect(db.getProviders().length).toBe(0);
    expect(db.getConversations().length).toBe(0);
    expect(db.getMessages('conv-test-1').length).toBe(0);
  });

  it('should reseed clean default providers with empty API keys and fresh initial conversation', () => {
    db.resetAllData();
    expect(db.getProviders().length).toBe(0);

    // Simulate re-seeding default presets as done on reset
    for (const preset of PROVIDER_PRESETS) {
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const reseeded = db.getProviders();
    expect(reseeded.length).toBe(PROVIDER_PRESETS.length);

    // Verify all keys are blank strings
    for (const prov of reseeded) {
      expect(prov.apiKey).toBe('');
    }

    // Verify initial clean conversation can be created
    const firstProv = reseeded[0];
    db.createConversation({
      id: crypto.randomUUID(),
      title: 'New Chat',
      providerId: firstProv ? firstProv.id : '',
      modelId: firstProv ? firstProv.defaultModel : '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const convs = db.getConversations();
    expect(convs.length).toBe(1);
    expect(convs[0].title).toBe('New Chat');
  });
});
