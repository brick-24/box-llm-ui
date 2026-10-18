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
import { resolveModelLimits, clampOutputTokens } from '../../shared/model-limits';
import { DiagnosticsService } from '../engine/diagnostics';
import { sanitizePayloadForLogging } from './openai-adapter';

export class ResponsesAdapter implements IProviderAdapter {
  public async fetchModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const url = resolveEndpoint(config.baseUrl, config.modelListUrl || '/models');
    const headers = buildAuthHeaders(config, true);

    DiagnosticsService.log('info', 'api', `[Responses API Request] GET ${url}`, {
      url,
      method: 'GET',
      headers: DiagnosticsService.redactSecrets(headers),
    });

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text();
      DiagnosticsService.log('error', 'api', `[Responses API Error] HTTP ${res.status}: ${errText.slice(0, 300)}`, {
        url,
        status: res.status,
        error: errText.slice(0, 300),
      });
      throw new Error(`HTTP ${res.status} fetching models: ${errText}`);
    }
    const json = await res.json();
    const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
    const models = list.map((item: any) => {
      const id = item.id || item.name;
      const limits = resolveModelLimits(id, {
        contextLength: item.context_length || item.context_window,
        maxOutputTokens: item.max_output_tokens || item.max_completion_tokens,
      });
      return {
        id,
        name: item.name || id,
        contextLength: limits.contextLength,
        maxOutputTokens: limits.maxOutputTokens,
        defaultOutputTokens: limits.defaultOutputTokens,
      };
    });

    DiagnosticsService.log('info', 'api', `[Responses API Response] Retrieved ${models.length} models`, {
      url,
      modelCount: models.length,
      sampleModels: models.slice(0, 8).map((m: any) => m.id),
    });

    return models;
  }

  public async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const models = await this.fetchModels(config);
      const latencyMs = Date.now() - start;
      DiagnosticsService.log('info', 'api', `[Responses API Test] Success (${latencyMs}ms)`, {
        modelCount: models.length,
      });
      return {
        success: true,
        message: `Responses API connection verified. (${models.length} models)`,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      DiagnosticsService.log('warn', 'api', `[Responses API Test] Failed (${latencyMs}ms): ${err.message}`);
      return {
        success: false,
        message: err.message || 'Responses API connection test failed',
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
    const url = resolveEndpoint(config.baseUrl, config.chatEndpoint || '/responses');
    const headers = buildAuthHeaders(config);

    const formattedMessages = formatMessagesWithAttachments(
      params.messages,
      params.systemPrompt,
      true
    );

    const body: Record<string, any> = {
      model: params.model,
      input: formattedMessages,
      stream: true,
      ...config.customBodyParams,
    };

    const limits = resolveModelLimits(params.model);
    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.maxTokens !== undefined) {
      body.max_output_tokens = clampOutputTokens(params.maxTokens, limits.maxOutputTokens);
    }

    DiagnosticsService.log('info', 'api', `[Responses API Request] POST ${url} (${params.model}) [Stream]`, {
      url,
      method: 'POST',
      model: params.model,
      stream: true,
      maxOutputTokens: body.max_output_tokens,
      temperature: body.temperature,
      headers: DiagnosticsService.redactSecrets(headers),
      input: sanitizePayloadForLogging(formattedMessages),
    });

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      DiagnosticsService.log('error', 'api', `[Responses API Error] HTTP ${res.status}: ${errText.slice(0, 300)}`, {
        url,
        status: res.status,
        error: errText.slice(0, 300),
      });
      throw new Error(`Responses API Error ${res.status}: ${errText}`);
    }

    if (!res.body) {
      throw new Error('Empty response body from Responses API');
    }

    DiagnosticsService.log('info', 'api', `[Responses API Response Headers] HTTP ${res.status}`, {
      url,
      status: res.status,
      contentType: res.headers.get('content-type'),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let tokenUsage: TokenUsage | undefined;

    const parser = createParser({
      onEvent: (event: any) => {
        if (event.data === '[DONE]') {
          DiagnosticsService.log('info', 'api', `[Responses API Response Body] Stream complete (${fullText.length} chars)`, {
            tokenUsage,
            textLength: fullText.length,
            receivedContent: fullText,
          });
          callbacks.onEnd(fullText, tokenUsage, 'stop');
          return;
        }
        try {
          const json = JSON.parse(event.data);
          // Handle response.text.delta or response.output_text.delta
          if (json.type === 'response.text.delta' && json.delta) {
            fullText += json.delta;
            callbacks.onChunk(json.delta, fullText);
          } else if (json.delta?.text) {
            fullText += json.delta.text;
            callbacks.onChunk(json.delta.text, fullText);
          } else if (json.type === 'response.completed' && json.response?.usage) {
            tokenUsage = {
              promptTokens: json.response.usage.input_tokens,
              completionTokens: json.response.usage.output_tokens,
              totalTokens: json.response.usage.total_tokens,
            };
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
      DiagnosticsService.log('info', 'api', `[Responses API Response Body] Stream complete (${fullText.length} chars)`, {
        tokenUsage,
        textLength: fullText.length,
        receivedContent: fullText,
      });
      callbacks.onEnd(fullText, tokenUsage, 'stop');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        callbacks.onEnd(fullText, tokenUsage, 'cancelled');
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
    const url = resolveEndpoint(config.baseUrl, config.chatEndpoint || '/responses');
    const headers = buildAuthHeaders(config);

    const formattedMessages = formatMessagesWithAttachments(
      params.messages,
      params.systemPrompt,
      true
    );

    const body: Record<string, any> = {
      model: params.model,
      input: formattedMessages,
      stream: false,
      ...config.customBodyParams,
    };

    const limits = resolveModelLimits(params.model);
    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.maxTokens !== undefined) {
      body.max_output_tokens = clampOutputTokens(params.maxTokens, limits.maxOutputTokens);
    }

    DiagnosticsService.log('info', 'api', `[Responses API Request] POST ${url} (${params.model}) [Sync]`, {
      url,
      method: 'POST',
      model: params.model,
      stream: false,
      maxOutputTokens: body.max_output_tokens,
      temperature: body.temperature,
      headers: DiagnosticsService.redactSecrets(headers),
      input: sanitizePayloadForLogging(formattedMessages),
    });

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      DiagnosticsService.log('error', 'api', `[Responses API Error] HTTP ${res.status}: ${errText.slice(0, 300)}`, {
        url,
        status: res.status,
        error: errText.slice(0, 300),
      });
      throw new Error(`Responses API Error ${res.status}: ${errText}`);
    }

    const json = await res.json();
    const content = json.output_text || json.output?.[0]?.content?.[0]?.text || '';

    DiagnosticsService.log('info', 'api', `[Responses API Response Body] Response received (${content.length} chars)`, {
      textLength: content.length,
      receivedContent: content,
    });

    return { content };
  }
}
