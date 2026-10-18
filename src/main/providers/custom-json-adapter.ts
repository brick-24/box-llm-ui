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
import { resolveModelLimits } from '../../shared/model-limits';
import { DiagnosticsService } from '../engine/diagnostics';
import { sanitizePayloadForLogging } from './openai-adapter';

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

    DiagnosticsService.log('info', 'api', `[Custom API Request] GET ${url}`, {
      url,
      method: 'GET',
      headers: DiagnosticsService.redactSecrets(headers),
    });

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text();
      DiagnosticsService.log('error', 'api', `[Custom API Error] HTTP ${res.status}: ${errText.slice(0, 300)}`, {
        url,
        status: res.status,
        error: errText.slice(0, 300),
      });
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }
    const json = await res.json();
    const list = Array.isArray(json.models)
      ? json.models
      : Array.isArray(json.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : [];

    const parsedModels = list.map((item: any) => {
      const id = typeof item === 'string' ? item : item.id || item.name || item.model;
      const limits = resolveModelLimits(id, {
        contextLength: typeof item === 'object' ? item.context_length || item.context_window : undefined,
        maxOutputTokens: typeof item === 'object' ? item.max_output_tokens || item.max_tokens : undefined,
      });
      return {
        id,
        name: typeof item === 'object' ? item.name || id : id,
        contextLength: limits.contextLength,
        maxOutputTokens: limits.maxOutputTokens,
        defaultOutputTokens: limits.defaultOutputTokens,
      };
    });

    DiagnosticsService.log('info', 'api', `[Custom API Response] Retrieved ${parsedModels.length} models`, {
      url,
      modelCount: parsedModels.length,
      sampleModels: parsedModels.slice(0, 8).map((m: any) => m.id),
    });

    return parsedModels;
  }

  public async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const models = await this.fetchModels(config);
      const latencyMs = Date.now() - start;
      DiagnosticsService.log('info', 'api', `[Custom API Test] Success (${latencyMs}ms)`, {
        modelCount: models.length,
      });
      return {
        success: true,
        message: `Custom API connected. Found ${models.length} models.`,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      DiagnosticsService.log('warn', 'api', `[Custom API Test] Failed (${latencyMs}ms): ${err.message}`);
      return {
        success: false,
        message: `Custom API test failed: ${err.message}`,
        latencyMs,
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

    DiagnosticsService.log('info', 'api', `[Custom API Request] POST ${url} (${params.model}) [Stream]`, {
      url,
      method: 'POST',
      model: params.model,
      stream: true,
      headers: DiagnosticsService.redactSecrets(headers),
      messages: sanitizePayloadForLogging(formatted),
    });

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      DiagnosticsService.log('error', 'api', `[Custom API Error] HTTP ${res.status}: ${errText.slice(0, 300)}`, {
        url,
        status: res.status,
        error: errText.slice(0, 300),
      });
      throw new Error(`Custom API HTTP ${res.status}: ${errText}`);
    }

    if (!res.body) {
      throw new Error('Empty response body from Custom API');
    }

    DiagnosticsService.log('info', 'api', `[Custom API Response Headers] HTTP ${res.status}`, {
      url,
      status: res.status,
      contentType: res.headers.get('content-type'),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    const chunkPath = mapping.streamChunkPath || 'delta.content';

    const parser = createParser({
      onEvent: (event: any) => {
        if (event.data === '[DONE]') {
          DiagnosticsService.log('info', 'api', `[Custom API Response Body] Stream complete (${fullText.length} chars)`, {
            textLength: fullText.length,
            receivedContent: fullText,
          });
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
      DiagnosticsService.log('info', 'api', `[Custom API Response Body] Stream complete (${fullText.length} chars)`, {
        textLength: fullText.length,
        receivedContent: fullText,
      });
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

    DiagnosticsService.log('info', 'api', `[Custom API Request] POST ${url} (${params.model}) [Sync]`, {
      url,
      method: 'POST',
      model: params.model,
      stream: false,
      headers: DiagnosticsService.redactSecrets(headers),
      messages: sanitizePayloadForLogging(formatted),
    });

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      DiagnosticsService.log('error', 'api', `[Custom API Error] HTTP ${res.status}: ${errText.slice(0, 300)}`, {
        url,
        status: res.status,
        error: errText.slice(0, 300),
      });
      throw new Error(`Custom API HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    const responsePath = mapping.responsePath || 'choices[0].message.content';
    const content = getByPath(json, responsePath) || getByPath(json, 'output.text') || getByPath(json, 'response') || JSON.stringify(json);

    DiagnosticsService.log('info', 'api', `[Custom API Response Body] Response received (${String(content).length} chars)`, {
      textLength: String(content).length,
      receivedContent: String(content),
    });

    return { content: String(content) };
  }
}
