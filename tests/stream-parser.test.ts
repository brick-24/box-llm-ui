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
});
