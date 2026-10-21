import { describe, it, expect } from 'vitest';
import { createSseStreamParser } from '../src/main/engine/stream-parser';

describe('SSE Stream Parser', () => {
  it('parses incremental SSE chunks correctly and accumulates fullText', () => {
    const receivedDeltas: string[] = [];
    let completedText = '';
    let completedUsage: any = null;

    const parser = createSseStreamParser({
      onDelta: (delta, fullText) => {
        receivedDeltas.push(delta);
      },
      onDone: (fullText, usage) => {
        completedText = fullText;
        completedUsage = usage;
      },
      onError: (err) => {
        throw err;
      },
    });

    const chunk1 = 'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n';
    const chunk2 = 'data: {"choices":[{"delta":{"content":"world!"}}]}\n\n';
    const chunk3 = 'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\ndata: [DONE]\n\n';

    parser.feed(chunk1);
    parser.feed(chunk2);
    parser.feed(chunk3);

    expect(receivedDeltas).toEqual(['Hello ', 'world!']);
    expect(completedText).toBe('Hello world!');
    expect(completedUsage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it('handles split SSE chunks across chunk boundaries', () => {
    let completedText = '';

    const parser = createSseStreamParser({
      onDelta: () => {},
      onDone: (fullText) => {
        completedText = fullText;
      },
      onError: () => {},
    });

    // Event is split in the middle of "choices"
    const partA = 'data: {"choi';
    const partB = 'ces":[{"delta":{"content":"Split chunk test"}}]}\n\ndata: [DONE]\n\n';

    parser.feed(partA);
    parser.feed(partB);

    expect(completedText).toBe('Split chunk test');
  });

  it('handles message.content and reasoning_content from OpenAI proxies', () => {
    let completedText = '';

    const parser = createSseStreamParser({
      onDelta: () => {},
      onDone: (fullText) => {
        completedText = fullText;
      },
      onError: () => {},
    });

    const chunk1 = 'data: {"choices":[{"message":{"content":"Direct message content"}}]}\n\ndata: [DONE]\n\n';
    parser.feed(chunk1);

    expect(completedText).toBe('Direct message content');
  });

  it('handles reasoning_content from thinking models separately from content', () => {
    let completedText = '';
    let completedReasoning = '';
    const receivedReasoningDeltas: string[] = [];

    const parser = createSseStreamParser({
      onDelta: (delta, fullText, reasoningDelta, reasoningFullText) => {
        if (reasoningDelta) receivedReasoningDeltas.push(reasoningDelta);
      },
      onDone: (fullText, _usage, _finishReason, reasoningFullText) => {
        completedText = fullText;
        completedReasoning = reasoningFullText || '';
      },
      onError: () => {},
    });

    const chunk1 = 'data: {"choices":[{"delta":{"reasoning_content":"Thinking "}}]}\n\n';
    const chunk2 = 'data: {"choices":[{"delta":{"reasoning_content":"step 1..."}}]}\n\n';
    const chunk3 = 'data: {"choices":[{"delta":{"content":"Final answer."}}]}\n\n';
    const chunk4 = 'data: [DONE]\n\n';

    parser.feed(chunk1);
    parser.feed(chunk2);
    parser.feed(chunk3);
    parser.feed(chunk4);

    expect(receivedReasoningDeltas).toEqual(['Thinking ', 'step 1...']);
    expect(completedReasoning).toBe('Thinking step 1...');
    expect(completedText).toBe('Final answer.');
    expect(parser.getFullReasoning()).toBe('Thinking step 1...');
    expect(parser.getFullText()).toBe('Final answer.');
  });

  it('captures finish_reason length when maximum token limit is hit during streaming', () => {
    let capturedFinishReason: string | undefined;
    let completedText = '';

    const parser = createSseStreamParser({
      onDelta: () => {},
      onDone: (fullText, _usage, finishReason) => {
        completedText = fullText;
        capturedFinishReason = finishReason;
      },
      onError: () => {},
    });

    const chunk1 = 'data: {"choices":[{"delta":{"content":"Truncated response due to "},"finish_reason":null}]}\n\n';
    const chunk2 = 'data: {"choices":[{"delta":{"content":"max tokens"},"finish_reason":"length"}]}\n\n';
    const chunk3 = 'data: [DONE]\n\n';

    parser.feed(chunk1);
    parser.feed(chunk2);
    parser.feed(chunk3);

    expect(completedText).toBe('Truncated response due to max tokens');
    expect(capturedFinishReason).toBe('length');
    expect(parser.getFinishReason()).toBe('length');
  });
});
