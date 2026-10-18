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
import { resolveModelLimits, clampOutputTokens } from '../../shared/model-limits';

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

      const buildEnrichedModel = (
        id: string,
        displayName?: string,
        description?: string,
        rawItem?: any
      ): ModelInfo => {
        const rawCtx =
          rawItem?.context_length ??
          rawItem?.context_window ??
          rawItem?.max_context_length ??
          rawItem?.max_model_len ??
          rawItem?.details?.context_length;

        const rawMaxOutput =
          rawItem?.top_provider?.max_completion_tokens ??
          rawItem?.per_request_limits?.completion_tokens ??
          rawItem?.max_output_tokens ??
          rawItem?.max_completion_tokens ??
          rawItem?.max_tokens;

        const limits = resolveModelLimits(id, {
          contextLength: typeof rawCtx === 'number' && rawCtx > 0 ? rawCtx : undefined,
          maxOutputTokens: typeof rawMaxOutput === 'number' && rawMaxOutput > 0 ? rawMaxOutput : undefined,
        });

        return {
          id,
          name: displayName || id,
          description,
          contextLength: limits.contextLength,
          maxOutputTokens: limits.maxOutputTokens,
          defaultOutputTokens: limits.defaultOutputTokens,
        };
      };

      // Case 1: Standard OpenAI / OpenRouter { data: [ { id: "gpt-4o", name: ... } ] }
      if (Array.isArray(json.data)) {
        for (const item of json.data) {
          if (item && item.id) {
            const desc = item.description || (item.owned_by ? `Owned by: ${item.owned_by}` : undefined);
            models.push(buildEnrichedModel(item.id, item.name || item.id, desc, item));
          }
        }
      } else if (Array.isArray(json.models)) {
        // Case 2: Ollama style { models: [ { name: "llama3:latest", details: ... } ] }
        for (const item of json.models) {
          const id = item.name || item.id || item.model;
          if (id) {
            const desc = item.details?.parameter_size ? `Size: ${item.details.parameter_size}` : undefined;
            models.push(buildEnrichedModel(id, id, desc, item));
          }
        }
      } else if (Array.isArray(json)) {
        // Case 3: Direct array [ { id: "..." } ]
        for (const item of json) {
          const id = typeof item === 'string' ? item : item.id || item.name;
          if (id) {
            models.push(
              buildEnrichedModel(
                id,
                typeof item === 'object' ? item.name || id : id,
                typeof item === 'object' ? item.description : undefined,
                typeof item === 'object' ? item : undefined
              )
            );
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

    const modelLimits = resolveModelLimits(params.model);

    if (modelLimits.isReasoning) {
      if (params.maxTokens !== undefined) {
        body.max_completion_tokens = clampOutputTokens(params.maxTokens, modelLimits.maxOutputTokens);
      }
    } else {
      if (params.temperature !== undefined) body.temperature = params.temperature;
      if (params.maxTokens !== undefined) {
        body.max_tokens = clampOutputTokens(params.maxTokens, modelLimits.maxOutputTokens);
      }
    }
    if (params.topP !== undefined && !modelLimits.isReasoning) body.top_p = params.topP;

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
        if (j.error?.message) {
          parsedErr = j.error.message;
        } else if (Array.isArray(j.detail)) {
          parsedErr = j.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
        } else if (typeof j.detail === 'string') {
          parsedErr = j.detail;
        }
      } catch {}
      throw new Error(`API Error ${res.status}: ${parsedErr}`);
    }

    if (!res.body) {
      throw new Error('Response body is empty, cannot read stream.');
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // The server answered with a non-streamed JSON response despite stream: true
      const json = await res.json();
      const choice = json.choices?.[0];
      let content = '';
      if (typeof choice?.message?.content === 'string') {
        content = choice.message.content;
      } else if (Array.isArray(choice?.message?.content)) {
        content = choice.message.content.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('');
      } else if (typeof choice?.delta?.content === 'string') {
        content = choice.delta.content;
      } else if (typeof choice?.text === 'string') {
        content = choice.text;
      }

      if (!content && choice?.message?.reasoning_content) {
        content = choice.message.reasoning_content;
      }

      const usage = json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined;

      const finishReason = choice?.finish_reason || 'stop';
      callbacks.onChunk(content, content);
      callbacks.onEnd(content, usage, finishReason);
      return;
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

    let rawAccumulated = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        rawAccumulated += text;
        parser.feed(text);
      }
      // If server finished stream without explicit [DONE]
      if (!streamCompleted) {
        let full = parser.getFullText();
        let usage = parser.getTokenUsage();
        let finish = parser.getFinishReason() || 'stop';

        // Fallback: if parser produced empty text, maybe rawAccumulated is a single JSON response
        if (!full && rawAccumulated.trim()) {
          try {
            const json = JSON.parse(rawAccumulated.trim());
            const choice = json.choices?.[0];
            full = choice?.message?.content || choice?.delta?.content || choice?.text || choice?.message?.reasoning_content || '';
            if (json.usage) {
              usage = {
                promptTokens: json.usage.prompt_tokens,
                completionTokens: json.usage.completion_tokens,
                totalTokens: json.usage.total_tokens,
              };
            }
            if (choice?.finish_reason) finish = choice.finish_reason;
          } catch {
            const lines = rawAccumulated.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === '[DONE]') continue;
              try {
                const clean = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
                const j = JSON.parse(clean);
                const c = j.choices?.[0];
                const piece = c?.delta?.content || c?.text || c?.message?.content || '';
                if (piece) full += piece;
                if (c?.finish_reason) finish = c.finish_reason;
              } catch {}
            }
          }
        }

        callbacks.onEnd(full, usage, finish);
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

    const modelLimits = resolveModelLimits(params.model);

    if (modelLimits.isReasoning) {
      if (params.maxTokens !== undefined) {
        body.max_completion_tokens = clampOutputTokens(params.maxTokens, modelLimits.maxOutputTokens);
      }
    } else {
      if (params.temperature !== undefined) body.temperature = params.temperature;
      if (params.maxTokens !== undefined) {
        body.max_tokens = clampOutputTokens(params.maxTokens, modelLimits.maxOutputTokens);
      }
    }
    if (params.topP !== undefined && !modelLimits.isReasoning) body.top_p = params.topP;

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
        if (j.error?.message) {
          parsed = j.error.message;
        } else if (Array.isArray(j.detail)) {
          parsed = j.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
        } else if (typeof j.detail === 'string') {
          parsed = j.detail;
        }
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
