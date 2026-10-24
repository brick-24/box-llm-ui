import { createParser } from 'eventsource-parser';
import { TokenUsage } from '../../shared/types';

export interface RawToolCall {
  id: string;
  name: string;
  arguments: string;
  thoughtSignature?: string;
  extraContent?: Record<string, any>;
}

export interface ParseOptions {
  onDelta: (delta: string, fullText: string, reasoningDelta?: string, reasoningFullText?: string) => void;
  onDone: (
    fullText: string,
    usage?: TokenUsage,
    finishReason?: string,
    reasoningFullText?: string,
    toolCalls?: RawToolCall[]
  ) => void;
  onError: (err: Error) => void;
  onToolCallDelta?: (toolCalls: RawToolCall[]) => void;
  customChunkExtractor?: (json: any) => { delta?: string; finishReason?: string; usage?: TokenUsage; reasoningDelta?: string };
}

export function createSseStreamParser(options: ParseOptions) {
  let fullText = '';
  let fullReasoning = '';
  let tokenUsage: TokenUsage | undefined;
  let finishReason: string | undefined;
  const accumulatedToolCalls: RawToolCall[] = [];

  const parser = createParser({
    onEvent: (event: any) => {
      const data = event.data?.trim();
      if (!data) return;

      if (data === '[DONE]') {
        options.onDone(
          fullText,
          tokenUsage,
          finishReason,
          fullReasoning || undefined,
          accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined
        );
        return;
      }

      try {
        const json = JSON.parse(data);

        if (options.customChunkExtractor) {
          const extracted = options.customChunkExtractor(json);
          if (extracted.reasoningDelta) {
            fullReasoning += extracted.reasoningDelta;
          }
          if (extracted.delta) {
            fullText += extracted.delta;
          }
          if (extracted.delta || extracted.reasoningDelta) {
            options.onDelta(
              extracted.delta || '',
              fullText,
              extracted.reasoningDelta || undefined,
              fullReasoning || undefined
            );
          }
          if (extracted.usage) tokenUsage = extracted.usage;
          if (extracted.finishReason) finishReason = extracted.finishReason;
          return;
        }

        // Standard OpenAI format:
        // { choices: [ { delta: { content?: string, reasoning_content?: string, tool_calls?: [] }, finish_reason?: string } ], usage?: { prompt_tokens, completion_tokens, total_tokens } }
        if (json.usage) {
          tokenUsage = {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          };
        }

        const choice = json.choices?.[0];
        if (choice) {
          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          const deltaToolCalls = choice.delta?.tool_calls ?? choice.message?.tool_calls;
          if (Array.isArray(deltaToolCalls)) {
            for (const tc of deltaToolCalls) {
              const idx = typeof tc.index === 'number' ? tc.index : accumulatedToolCalls.length;
              const sig =
                tc.thought_signature ||
                tc.thoughtSignature ||
                tc.extra_content?.google?.thought_signature ||
                tc.extra_content?.vertex?.thought_signature ||
                tc.extra_content?.thought_signature ||
                choice.delta?.extra_content?.google?.thought_signature ||
                choice.message?.extra_content?.google?.thought_signature ||
                choice.extra_content?.google?.thought_signature ||
                json.extra_content?.google?.thought_signature;

              const extra =
                tc.extra_content ||
                choice.delta?.extra_content ||
                choice.message?.extra_content ||
                choice.extra_content ||
                json.extra_content;

              if (!accumulatedToolCalls[idx]) {
                accumulatedToolCalls[idx] = {
                  id: tc.id || `call_${Date.now()}_${idx}`,
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                  thoughtSignature: sig,
                  extraContent: extra,
                };
              } else {
                if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                if (tc.function?.name) accumulatedToolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments) accumulatedToolCalls[idx].arguments += tc.function.arguments;
                if (sig && !accumulatedToolCalls[idx].thoughtSignature) accumulatedToolCalls[idx].thoughtSignature = sig;
                if (extra && !accumulatedToolCalls[idx].extraContent) accumulatedToolCalls[idx].extraContent = extra;
              }
            }
            if (options.onToolCallDelta) {
              options.onToolCallDelta(accumulatedToolCalls);
            }
          }

          const deltaContent = choice.delta?.content ?? choice.text ?? choice.message?.content;
          const deltaReasoning =
            choice.delta?.reasoning_content ??
            choice.message?.reasoning_content ??
            choice.delta?.reasoning ??
            choice.message?.reasoning ??
            choice.delta?.thought ??
            choice.message?.thought;

          let contentPiece = '';
          if (typeof deltaContent === 'string') {
            contentPiece = deltaContent;
          } else if (Array.isArray(deltaContent)) {
            contentPiece = deltaContent.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('');
          }

          let reasoningPiece = '';
          if (typeof deltaReasoning === 'string') {
            reasoningPiece = deltaReasoning;
          } else if (Array.isArray(deltaReasoning)) {
            reasoningPiece = deltaReasoning.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('');
          }

          if (contentPiece) {
            fullText += contentPiece;
          }
          if (reasoningPiece) {
            fullReasoning += reasoningPiece;
          }

          if (contentPiece || reasoningPiece) {
            options.onDelta(
              contentPiece,
              fullText,
              reasoningPiece || undefined,
              fullReasoning || undefined
            );
          }
        }
      } catch (err) {
        // Non-fatal JSON parse error for malformed SSE ping or comment
      }
    },
  });

  return {
    feed: (chunk: string) => parser.feed(chunk),
    getFullText: () => fullText,
    getFullReasoning: () => fullReasoning,
    getTokenUsage: () => tokenUsage,
    getFinishReason: () => finishReason,
    getToolCalls: () => accumulatedToolCalls,
  };
}
