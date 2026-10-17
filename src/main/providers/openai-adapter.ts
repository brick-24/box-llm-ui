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
import { createSseStreamParser } from '../engine/stream-parser';

export class OpenAiAdapter implements IProviderAdapter {
  public async fetchModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const url = resolveEndpoint(config.baseUrl, config.modelListUrl || '/models');
    const headers = buildAuthHeaders(config, true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.requestTimeout || 15000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status} (${res.statusText}): ${errText.slice(0, 300)}`);
      }

      const json = await res.json();
      const models: ModelInfo[] = [];

      // Case 1: Standard OpenAI { data: [ { id: "gpt-4" } ] }
      if (Array.isArray(json.data)) {
        for (const item of json.data) {
          if (item && item.id) {
            models.push({
              id: item.id,
              name: item.id,
              description: item.owned_by ? `Owned by: ${item.owned_by}` : undefined,
              contextLength: item.context_length,
            });
          }
        }
      } else if (Array.isArray(json.models)) {
        // Case 2: Ollama style { models: [ { name: "llama3:latest", details: ... } ] }
        for (const item of json.models) {
          const id = item.name || item.id || item.model;
          if (id) {
            models.push({
              id,
              name: id,
              description: item.details?.parameter_size ? `Size: ${item.details.parameter_size}` : undefined,
            });
          }
        }
      } else if (Array.isArray(json)) {
        // Case 3: Direct array [ { id: "..." } ]
        for (const item of json) {
          const id = typeof item === 'string' ? item : item.id || item.name;
          if (id) {
            models.push({ id, name: id });
          }
        }
      }

      // Sort models alphabetically
      models.sort((a, b) => a.id.localeCompare(b.id));
      return models;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${config.requestTimeout || 15000}ms fetching models from ${url}`);
      }
      throw err;
    }
  }

  public async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      const models = await this.fetchModels(config);
      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        message: `Successfully connected! Retrieved ${models.length} available models.`,
        latencyMs,
        details: {
          modelCount: models.length,
          sampleModels: models.slice(0, 5).map((m) => m.id),
        },
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        message: err.message || 'Connection test failed',
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
    const url = resolveEndpoint(config.baseUrl, config.chatEndpoint || '/chat/completions');
    const headers = buildAuthHeaders(config);

    const formattedMessages = formatMessagesWithAttachments(
      params.messages,
      params.systemPrompt,
      true
    );

    const body: Record<string, any> = {
      model: params.model,
      messages: formattedMessages,
      stream: true,
      stream_options: { include_usage: true },
      ...config.customBodyParams,
    };

    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens;
    if (params.topP !== undefined) body.top_p = params.topP;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errBody = await res.text();
      let parsedErr = errBody;
      try {
        const j = JSON.parse(errBody);
        if (j.error?.message) parsedErr = j.error.message;
      } catch {}
      throw new Error(`API Error ${res.status}: ${parsedErr}`);
    }

    if (!res.body) {
      throw new Error('Response body is empty, cannot read stream.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let streamCompleted = false;
    const parser = createSseStreamParser({
      onDelta: (delta, fullText) => {
        callbacks.onChunk(delta, fullText);
      },
      onDone: (fullText, usage, finishReason) => {
        streamCompleted = true;
        callbacks.onEnd(fullText, usage, finishReason);
      },
      onError: (err) => {
        callbacks.onError(err);
      },
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        parser.feed(text);
      }
      // If server finished stream without explicit [DONE]
      if (!streamCompleted) {
        callbacks.onEnd(
          parser.getFullText(),
          parser.getTokenUsage(),
          parser.getFinishReason() || 'stop'
        );
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Generation was cancelled by user
        callbacks.onEnd(
          parser.getFullText(),
          parser.getTokenUsage(),
          'cancelled'
        );
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
    const url = resolveEndpoint(config.baseUrl, config.chatEndpoint || '/chat/completions');
    const headers = buildAuthHeaders(config);

    const formattedMessages = formatMessagesWithAttachments(
      params.messages,
      params.systemPrompt,
      true
    );

    const body: Record<string, any> = {
      model: params.model,
      messages: formattedMessages,
      stream: false,
      ...config.customBodyParams,
    };

    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens;
    if (params.topP !== undefined) body.top_p = params.topP;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errBody = await res.text();
      let parsed = errBody;
      try {
        const j = JSON.parse(errBody);
        if (j.error?.message) parsed = j.error.message;
      } catch {}
      throw new Error(`API Error ${res.status}: ${parsed}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';
    const tokenUsage: TokenUsage | undefined = json.usage ? {
      promptTokens: json.usage.prompt_tokens,
      completionTokens: json.usage.completion_tokens,
      totalTokens: json.usage.total_tokens,
    } : undefined;

    return { content, tokenUsage };
  }
}
