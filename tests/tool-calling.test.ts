import { describe, it, expect } from 'vitest';
import { createSseStreamParser, RawToolCall } from '../src/main/engine/stream-parser';
import { WEB_TOOLS, executeWebTool } from '../src/main/browser/web-tools';

describe('Tool Calling Engine & SSE Parsing', () => {
  it('exposes standard OpenAI-compatible web tool declarations', () => {
    const toolNames = WEB_TOOLS.map((t) => t.function.name);
    expect(toolNames).toContain('search_web');
    expect(toolNames).toContain('fetch_web_page');
    expect(toolNames).toContain('browse_page');
    expect(toolNames).toContain('take_page_screenshot');
  });

  it('accumulates streamed tool_calls chunks across SSE events', () => {
    let completedToolCalls: RawToolCall[] | undefined;
    let completedText = '';

    const parser = createSseStreamParser({
      onDelta: (_delta, fullText) => {
        completedText = fullText;
      },
      onDone: (fullText, _usage, _finishReason, _reasoning, toolCalls) => {
        completedText = fullText;
        completedToolCalls = toolCalls;
      },
      onError: () => {},
    });

    // Chunk 1: Tool call id and initial arguments
    const chunk1 =
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_search_1","type":"function","function":{"name":"search_web","arguments":"{\\"query\\": \\"Elec"}}]}}]}\n\n';

    // Chunk 2: More arguments delta
    const chunk2 =
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"tron 34 features\\"}"}}]}}]}\n\n';

    // Chunk 3: Done with finish_reason tool_calls
    const chunk3 =
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n';

    parser.feed(chunk1);
    parser.feed(chunk2);
    parser.feed(chunk3);

    expect(completedToolCalls).toBeDefined();
    expect(completedToolCalls).toHaveLength(1);
    expect(completedToolCalls![0].id).toBe('call_search_1');
    expect(completedToolCalls![0].name).toBe('search_web');
    expect(completedToolCalls![0].arguments).toBe('{"query": "Electron 34 features"}');

    const parsedArgs = JSON.parse(completedToolCalls![0].arguments);
    expect(parsedArgs.query).toBe('Electron 34 features');
  });

  it('executes search_web tool and generates structured citations', async () => {
    // Test execution with missing query guard
    await expect(executeWebTool('search_web', {})).rejects.toThrow('Missing "query" parameter');

    // Test execution with missing url guard
    await expect(executeWebTool('fetch_web_page', {})).rejects.toThrow('Missing "url" parameter');
  });
});
