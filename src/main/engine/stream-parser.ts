import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';
import { TokenUsage } from '../../shared/types';

export interface ParseOptions {
  onDelta: (delta: string, fullText: string) => void;
  onDone: (fullText: string, usage?: TokenUsage, finishReason?: string) => void;
  onError: (err: Error) => void;
  customChunkExtractor?: (json: any) => { delta?: string; finishReason?: string; usage?: TokenUsage };
}

export function createSseStreamParser(options: ParseOptions) {
  let fullText = '';
  let tokenUsage: TokenUsage | undefined;
  let finishReason: string | undefined;

  const parser = createParser({
    onEvent: (event: any) => {
      const data = event.data?.trim();
      if (!data) return;

    if (data === '[DONE]') {
      options.onDone(fullText, tokenUsage, finishReason);
      return;
    }

    try {
      const json = JSON.parse(data);

      if (options.customChunkExtractor) {
        const extracted = options.customChunkExtractor(json);
        if (extracted.delta) {
          fullText += extracted.delta;
          options.onDelta(extracted.delta, fullText);
        }
        if (extracted.usage) tokenUsage = extracted.usage;
        if (extracted.finishReason) finishReason = extracted.finishReason;
        return;
      }

      // Standard OpenAI format:
      // { choices: [ { delta: { content?: string }, finish_reason?: string } ], usage?: { prompt_tokens, completion_tokens, total_tokens } }
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

        let deltaContent = choice.delta?.content ?? choice.text ?? choice.message?.content;
        if (deltaContent === undefined && (choice.delta?.reasoning_content || choice.message?.reasoning_content)) {
          deltaContent = choice.delta?.reasoning_content || choice.message?.reasoning_content;
        }

        if (typeof deltaContent === 'string' && deltaContent.length > 0) {
          fullText += deltaContent;
          options.onDelta(deltaContent, fullText);
        } else if (Array.isArray(deltaContent)) {
          const piece = deltaContent.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('');
          if (piece) {
            fullText += piece;
            options.onDelta(piece, fullText);
          }
        }
      }
    } catch (err) {
      // Non-fatal JSON parse error for malformed SSE ping or comment
    }
  } });

  return {
    feed: (chunk: string) => parser.feed(chunk),
    getFullText: () => fullText,
    getTokenUsage: () => tokenUsage,
    getFinishReason: () => finishReason,
  };
}
