import {
  IProviderAdapter,
  ChatRequestParams,
  StreamCallbacks,
  resolveEndpoint,
  buildAuthHeaders,
  formatMessagesWithAttachments,
} from './provider-interface';
import {
  ProviderConfig,
  ModelInfo,
  ConnectionTestResult,
  TokenUsage,
} from '../../shared/types';
import { createParser } from 'eventsource-parser';

export function getByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  // Replace array index notation like choices[0] with choices.0
  const normalized = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '');
  const keys = normalized.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

export class CustomJsonAdapter implements IProviderAdapter {
  public async fetchModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const url = resolveEndpoint(config.baseUrl, config.modelListUrl || '/models');
    const headers = buildAuthHeaders(config, true);

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    const list = Array.isArray(json.models)
      ? json.models
      : Array.isArray(json.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : [];

    return list.map((item: any) => {
      const id = typeof item === 'string' ? item : item.id || item.name || item.model;
      return { id, name: id };
    });
  }

  public async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const models = await this.fetchModels(config);
      return {
        success: true,
        message: `Custom API connected. Found ${models.length} models.`,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Custom API test failed: ${err.message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  public async streamMessage(
    config: ProviderConfig,
    params: ChatRequestParams,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const mapping = config.customMapping || {};
    const url = resolveEndpoint(config.baseUrl, config.chatEndpoint);
    const headers = buildAuthHeaders(config);

    const roleMap = mapping.roleMapping || {};
    const formatted = params.messages.map((m) => ({
      role: roleMap[m.role] || m.role,
      content: m.content,
    }));

    const modelKey = mapping.modelField || 'model';
    const messagesKey = mapping.messagesField || 'messages';
    const streamKey = mapping.streamField || 'stream';

    const body: Record<string, any> = {
      [modelKey]: params.model,
      [messagesKey]: formatted,
      [streamKey]: true,
      ...config.customBodyParams,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Custom API HTTP ${res.status}: ${await res.text()}`);
    }

    if (!res.body) {
      throw new Error('Empty response body from Custom API');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    const chunkPath = mapping.streamChunkPath || 'delta.content';

    const parser = createParser({
      onEvent: (event: any) => {
        if (event.data === '[DONE]') {
          callbacks.onEnd(fullText, undefined, 'stop');
          return;
        }
        try {
          const json = JSON.parse(event.data);
          const delta = getByPath(json, chunkPath) || getByPath(json, 'choices[0].delta.content') || getByPath(json, 'text');
          if (delta && typeof delta === 'string') {
            fullText += delta;
            callbacks.onChunk(delta, fullText);
          }
        } catch {}
      },
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
      callbacks.onEnd(fullText, undefined, 'stop');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        callbacks.onEnd(fullText, undefined, 'cancelled');
        return;
      }
      throw err;
    }
  }

  public async sendMessage(
    config: ProviderConfig,
    params: ChatRequestParams,
    signal?: AbortSignal
  ): Promise<{ content: string; tokenUsage?: TokenUsage }> {
    const mapping = config.customMapping || {};
    const url = resolveEndpoint(config.baseUrl, config.chatEndpoint);
    const headers = buildAuthHeaders(config);

    const roleMap = mapping.roleMapping || {};
    const formatted = params.messages.map((m) => ({
      role: roleMap[m.role] || m.role,
      content: m.content,
    }));

    const modelKey = mapping.modelField || 'model';
    const messagesKey = mapping.messagesField || 'messages';
    const streamKey = mapping.streamField || 'stream';

    const body: Record<string, any> = {
      [modelKey]: params.model,
      [messagesKey]: formatted,
      [streamKey]: false,
      ...config.customBodyParams,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Custom API HTTP ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const responsePath = mapping.responsePath || 'choices[0].message.content';
    const content = getByPath(json, responsePath) || getByPath(json, 'output.text') || getByPath(json, 'response') || JSON.stringify(json);

    return { content: String(content) };
  }
}
