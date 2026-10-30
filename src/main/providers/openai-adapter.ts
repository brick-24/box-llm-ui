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
import {
  resolveModelLimits,
  clampOutputTokens,
  OPENROUTER_CONVERSATIONAL_FREE_MODELS,
} from '../../shared/model-limits';
import { DiagnosticsService } from '../engine/diagnostics';

export function sanitizePayloadForLogging(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayloadForLogging(item));
  }
  const copy: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string') {
      if (value.startsWith('data:') && value.includes(';base64,')) {
        const prefix = value.slice(0, value.indexOf(';base64,') + 8);
        copy[key] = `${prefix}[base64 payload truncated (${value.length} chars)]`;
      } else if (value.length > 2500) {
        copy[key] = `${value.slice(0, 2500)}... [truncated, total ${value.length} chars]`;
      } else {
        copy[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      copy[key] = sanitizePayloadForLogging(value);
    } else {
      copy[key] = value;
    }
  }
  return copy;
}

let discoveredFreeModels: string[] = [];

export function getActiveConversationalFreeModels(): string[] {
  return discoveredFreeModels.length > 0 ? discoveredFreeModels : OPENROUTER_CONVERSATIONAL_FREE_MODELS;
}

export class OpenAiAdapter implements IProviderAdapter {
  public async fetchModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const url = resolveEndpoint(config.baseUrl, config.modelListUrl || '/models');
    const headers = buildAuthHeaders(config, true);

    DiagnosticsService.log('info', 'api', `[API Request] GET ${url} (fetching model catalog)`, {
      url,
      method: 'GET',
      headers: DiagnosticsService.redactSecrets(headers),
    });

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
        DiagnosticsService.log('error', 'api', `[API Response Error] HTTP ${res.status} fetching models from ${url}`, {
          url,
          status: res.status,
          statusText: res.statusText,
          error: errText.slice(0, 500),
        });
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
        const cleanId = id.startsWith('models/') ? id.replace(/^models\//, '') : id;
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

        const limits = resolveModelLimits(cleanId, {
          contextLength: typeof rawCtx === 'number' && rawCtx > 0 ? rawCtx : undefined,
          maxOutputTokens: typeof rawMaxOutput === 'number' && rawMaxOutput > 0 ? rawMaxOutput : undefined,
        });

        return {
          id: cleanId,
          name: displayName || cleanId,
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
        // Case 2: Ollama / Gemini style { models: [ { name: "llama3:latest", details: ... } ] }
        for (const item of json.models) {
          const id = item.name || item.id || item.model;
          if (id) {
            const desc = item.description || (item.details?.parameter_size ? `Size: ${item.details.parameter_size}` : undefined);
            models.push(buildEnrichedModel(id, item.displayName || id, desc, item));
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

      // Filter out non-conversational content safety / guardrail / embedding / image models
      const conversationalModels = models.filter((m) => {
        const idLower = m.id.toLowerCase();
        const isExcluded =
          idLower.includes('content-safety') ||
          idLower.includes('llama-guard') ||
          idLower.includes('safeguard') ||
          idLower.includes('moderation') ||
          idLower.includes('embedding') ||
          idLower.includes('imagen') ||
          idLower.includes('aqa') ||
          idLower.includes('tts') ||
          (m.description && /safety classifier|content moderation|guardrail/i.test(m.description));
        return !isExcluded;
      });

      // If fetching from OpenRouter, dynamically populate active free conversational models
      if (config.baseUrl.includes('openrouter.ai') || url.includes('openrouter.ai')) {
        const liveFree = conversationalModels
          .filter((m) => m.id.endsWith(':free'))
          .map((m) => m.id);
        if (liveFree.length > 0) {
          discoveredFreeModels = liveFree;
        }
      }

      DiagnosticsService.log('info', 'api', `[API Response] Retrieved ${conversationalModels.length} models from ${config.name}`, {
        url,
        status: res.status,
        modelCount: conversationalModels.length,
        discoveredFreeModels: discoveredFreeModels.length > 0 ? discoveredFreeModels : undefined,
        sampleModels: conversationalModels.slice(0, 8).map((m) => m.id),
      });

      // Sort models alphabetically
      conversationalModels.sort((a, b) => a.id.localeCompare(b.id));
      return conversationalModels;
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
      DiagnosticsService.log('info', 'api', `[Connection Test] Successful for ${config.name} (${latencyMs}ms)`, {
        provider: config.name,
        latencyMs,
        modelCount: models.length,
      });
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
      DiagnosticsService.log('warn', 'api', `[Connection Test] Failed for ${config.name} (${latencyMs}ms): ${err.message}`, {
        provider: config.name,
        latencyMs,
        error: err.message,
      });
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

    const isOpenRouter = config.baseUrl.includes('openrouter.ai') || url.includes('openrouter.ai');
    if (isOpenRouter) {
      if (!headers['HTTP-Referer']) headers['HTTP-Referer'] = 'https://github.com/universal-llm-box';
      if (!headers['X-Title']) headers['X-Title'] = 'Box AI Client';
    }

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

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools;
      if (params.toolChoice) {
        body.tool_choice = params.toolChoice;
      }
    }

    if (isOpenRouter) {
      const freeList = getActiveConversationalFreeModels();
      if (params.model === 'openrouter/free') {
        body.model = freeList[0];
        body.models = freeList.slice(0, 3);
      } else if (params.model.endsWith(':free')) {
        const fallbacks = freeList.filter((m) => m !== params.model);
        body.models = [params.model, ...fallbacks].slice(0, 3);
      }
    }

    if (Array.isArray(body.models) && body.models.length > 3) {
      body.models = body.models.slice(0, 3);
    }

    const modelLimits = resolveModelLimits(body.model || params.model);

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

    DiagnosticsService.log('info', 'api', `[API Request] POST ${url} (${body.model || params.model}) [Stream]`, {
      url,
      method: 'POST',
      requestedModel: params.model,
      activeModel: body.model,
      fallbackModels: body.models,
      stream: true,
      hasTools: Boolean(params.tools?.length),
      maxTokens: body.max_tokens ?? body.max_completion_tokens,
      temperature: body.temperature,
      topP: body.top_p,
      messageCount: formattedMessages.length,
      messages: sanitizePayloadForLogging(formattedMessages),
      headers: DiagnosticsService.redactSecrets(headers),
    });

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

      DiagnosticsService.log('error', 'api', `[API Response Error] HTTP ${res.status} from ${url}: ${parsedErr}`, {
        url,
        status: res.status,
        statusText: res.statusText,
        error: parsedErr,
        model: body.model || params.model,
      });
      throw new Error(`API Error ${res.status}: ${parsedErr}`);
    }

    if (!res.body) {
      throw new Error('Response body is empty, cannot read stream.');
    }

    DiagnosticsService.log('info', 'api', `[API Response Headers] HTTP ${res.status} ${res.statusText}`, {
      url,
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type') || undefined,
      rateLimitRemaining: res.headers.get('x-ratelimit-remaining-requests') || res.headers.get('x-ratelimit-remaining') || undefined,
    });

    const handleStreamComplete = (
      fullText: string,
      usage?: TokenUsage,
      finishReason?: string,
      reasoningFullText?: string,
      thinkingDurationMs?: number,
      toolCalls?: any[]
    ) => {
      DiagnosticsService.log('info', 'api', `[API Response Body] Stream complete (${fullText.length} chars, reasoning: ${reasoningFullText?.length || 0} chars, toolCalls: ${toolCalls?.length || 0})`, {
        model: body.model || params.model,
        finishReason: finishReason || 'stop',
        tokenUsage: usage,
        textLength: fullText.length,
        reasoningLength: reasoningFullText?.length || 0,
        thinkingDurationMs,
        toolCalls,
        receivedContent: fullText,
      });
      callbacks.onEnd(fullText, usage, finishReason, reasoningFullText, thinkingDurationMs, toolCalls);
    };

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

      let reasoning = '';
      if (typeof choice?.message?.reasoning_content === 'string') {
        reasoning = choice.message.reasoning_content;
      } else if (typeof choice?.message?.thought === 'string') {
        reasoning = choice.message.thought;
      } else if (typeof choice?.message?.reasoning === 'string') {
        reasoning = choice.message.reasoning;
      }

      const usage = json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined;

      const nonStreamToolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name || '',
        arguments: tc.function?.arguments || '',
      }));

      const finishReason = choice?.finish_reason || 'stop';
      callbacks.onChunk(content, content, reasoning || undefined, reasoning || undefined);
      handleStreamComplete(content, usage, finishReason, reasoning || undefined, undefined, nonStreamToolCalls);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let streamCompleted = false;
    let thinkingStartTime: number | null = null;
    let thinkingEndTime: number | null = null;

    const parser = createSseStreamParser({
      onDelta: (delta, fullText, reasoningDelta, reasoningFullText) => {
        if (reasoningDelta && !thinkingStartTime) {
          thinkingStartTime = Date.now();
        }
        if (delta && thinkingStartTime && !thinkingEndTime) {
          thinkingEndTime = Date.now();
        }
        callbacks.onChunk(delta, fullText, reasoningDelta, reasoningFullText);
      },
      onToolCallDelta: (toolCalls) => {
        callbacks.onToolCallDelta?.(toolCalls);
      },
      onDone: (fullText, usage, finishReason, reasoningFullText, toolCalls) => {
        streamCompleted = true;
        if (thinkingStartTime && !thinkingEndTime) {
          thinkingEndTime = Date.now();
        }
        const thinkingDurationMs =
          thinkingStartTime && thinkingEndTime
            ? Math.max(0, thinkingEndTime - thinkingStartTime)
            : undefined;
        handleStreamComplete(fullText, usage, finishReason, reasoningFullText, thinkingDurationMs, toolCalls);
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
        let fullReasoning = parser.getFullReasoning();
        let usage = parser.getTokenUsage();
        let finish = parser.getFinishReason() || 'stop';

        // Fallback: if parser produced empty text, maybe rawAccumulated is a single JSON response
        if (!full && rawAccumulated.trim()) {
          try {
            const json = JSON.parse(rawAccumulated.trim());
            const choice = json.choices?.[0];
            full = choice?.message?.content || choice?.delta?.content || choice?.text || '';
            const fallbackReasoning = choice?.message?.reasoning_content || choice?.message?.thought || choice?.message?.reasoning || '';
            if (fallbackReasoning && !fullReasoning) {
              fullReasoning = fallbackReasoning;
            }
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
                const rPiece = c?.delta?.reasoning_content || c?.message?.reasoning_content || c?.delta?.thought || '';
                if (piece) full += piece;
                if (rPiece) fullReasoning += rPiece;
                if (c?.finish_reason) finish = c.finish_reason;
              } catch {}
            }
          }
        }

        if (thinkingStartTime && !thinkingEndTime) {
          thinkingEndTime = Date.now();
        }
        const thinkingDurationMs =
          thinkingStartTime && thinkingEndTime
            ? Math.max(0, thinkingEndTime - thinkingStartTime)
            : undefined;

        handleStreamComplete(full, usage, finish, fullReasoning || undefined, thinkingDurationMs);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (thinkingStartTime && !thinkingEndTime) {
          thinkingEndTime = Date.now();
        }
        const thinkingDurationMs =
          thinkingStartTime && thinkingEndTime
            ? Math.max(0, thinkingEndTime - thinkingStartTime)
            : undefined;

        callbacks.onEnd(
          parser.getFullText(),
          parser.getTokenUsage(),
          'cancelled',
          parser.getFullReasoning() || undefined,
          thinkingDurationMs
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
  ): Promise<{ content: string; tokenUsage?: TokenUsage; reasoningContent?: string; finishReason?: string; toolCalls?: any[] }> {
    const url = resolveEndpoint(config.baseUrl, config.chatEndpoint || '/chat/completions');
    const headers = buildAuthHeaders(config);

    const isOpenRouter = config.baseUrl.includes('openrouter.ai') || url.includes('openrouter.ai');
    if (isOpenRouter) {
      if (!headers['HTTP-Referer']) headers['HTTP-Referer'] = 'https://github.com/universal-llm-box';
      if (!headers['X-Title']) headers['X-Title'] = 'Box AI Client';
    }

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

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools;
      if (params.toolChoice) {
        body.tool_choice = params.toolChoice;
      }
    }

    if (isOpenRouter) {
      const freeList = getActiveConversationalFreeModels();
      if (params.model === 'openrouter/free') {
        body.model = freeList[0];
        body.models = freeList.slice(0, 3);
      } else if (params.model.endsWith(':free')) {
        const fallbacks = freeList.filter((m) => m !== params.model);
        body.models = [params.model, ...fallbacks].slice(0, 3);
      }
    }

    if (Array.isArray(body.models) && body.models.length > 3) {
      body.models = body.models.slice(0, 3);
    }

    const modelLimits = resolveModelLimits(body.model || params.model);

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

    DiagnosticsService.log('info', 'api', `[API Request] POST ${url} (${body.model || params.model}) [Sync]`, {
      url,
      method: 'POST',
      requestedModel: params.model,
      activeModel: body.model,
      fallbackModels: body.models,
      stream: false,
      hasTools: Boolean(params.tools?.length),
      maxTokens: body.max_tokens ?? body.max_completion_tokens,
      temperature: body.temperature,
      topP: body.top_p,
      messageCount: formattedMessages.length,
      messages: sanitizePayloadForLogging(formattedMessages),
      headers: DiagnosticsService.redactSecrets(headers),
    });

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

      DiagnosticsService.log('error', 'api', `[API Response Error] HTTP ${res.status} from ${url}: ${parsed}`, {
        url,
        status: res.status,
        statusText: res.statusText,
        error: parsed,
        model: body.model || params.model,
      });
      throw new Error(`API Error ${res.status}: ${parsed}`);
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    const content = choice?.message?.content || '';
    const reasoningContent =
      choice?.message?.reasoning_content ||
      choice?.message?.thought ||
      choice?.message?.reasoning ||
      undefined;
    const tokenUsage: TokenUsage | undefined = json.usage ? {
      promptTokens: json.usage.prompt_tokens,
      completionTokens: json.usage.completion_tokens,
      totalTokens: json.usage.total_tokens,
    } : undefined;

    const rawToolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name || '',
      arguments: tc.function?.arguments || '',
    }));

    DiagnosticsService.log('info', 'api', `[API Response Body] Response received (${content.length} chars, reasoning: ${reasoningContent?.length || 0} chars, toolCalls: ${rawToolCalls?.length || 0})`, {
      model: body.model || params.model,
      tokenUsage,
      textLength: content.length,
      reasoningLength: reasoningContent?.length || 0,
      toolCalls: rawToolCalls,
      receivedContent: content,
    });

    const finishReason = choice?.finish_reason || 'stop';

    return { content, tokenUsage, reasoningContent, finishReason, toolCalls: rawToolCalls };
  }
}
