import { describe, it, expect } from 'vitest';
import { createSseStreamParser, RawToolCall } from '../src/main/engine/stream-parser';
import { WEB_TOOLS, executeWebTool } from '../src/main/browser/web-tools';
import { formatMessagesWithAttachments } from '../src/main/providers/provider-interface';

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

  it('captures thought_signature from Gemini function call SSE chunks', () => {
    let completedToolCalls: RawToolCall[] | undefined;

    const parser = createSseStreamParser({
      onDelta: () => {},
      onDone: (_text, _usage, _finish, _reasoning, toolCalls) => {
        completedToolCalls = toolCalls;
      },
      onError: () => {},
    });

    const geminiChunk =
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"default_api:list_dir","arguments":"{\\"dirPath\\":\\".\\"}"},"extra_content":{"google":{"thought_signature":"sig_abc_123"}}}]}}]}\n\ndata: [DONE]\n\n';

    parser.feed(geminiChunk);

    expect(completedToolCalls).toBeDefined();
    expect(completedToolCalls![0].name).toBe('default_api:list_dir');
    expect(completedToolCalls![0].thoughtSignature).toBe('sig_abc_123');
    expect(completedToolCalls![0].extraContent?.google?.thought_signature).toBe('sig_abc_123');
  });

  it('preserves thought_signature in formatMessagesWithAttachments for multi-turn Gemini requests', () => {
    const mockMessages = [
      {
        id: 'msg_1',
        conversationId: 'conv_1',
        role: 'user',
        content: 'list files in workspace',
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'msg_2',
        conversationId: 'conv_1',
        role: 'assistant',
        content: '',
        status: 'completed',
        toolCalls: [
          {
            id: 'call_1',
            name: 'default_api:list_dir',
            input: { dirPath: '.' },
            status: 'completed',
            thoughtSignature: 'test_signature_xyz',
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'msg_3',
        conversationId: 'conv_1',
        role: 'tool',
        toolCallId: 'call_1',
        content: '{"files":["package.json"]}',
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const formatted = formatMessagesWithAttachments(mockMessages, 'System instructions');

    expect(formatted).toHaveLength(4); // system + user + assistant + tool
    const assistantPayload = formatted[2];
    expect(assistantPayload.role).toBe('assistant');
    expect(assistantPayload.thought_signature).toBe('test_signature_xyz');
    expect(assistantPayload.extra_content?.google?.thought_signature).toBe('test_signature_xyz');
    expect(assistantPayload.tool_calls[0].thought_signature).toBe('test_signature_xyz');
    expect(assistantPayload.tool_calls[0].extra_content?.google?.thought_signature).toBe('test_signature_xyz');
  });

  it('injects fallback skip_thought_signature_validator when thoughtSignature is missing', () => {
    const mockMessages = [
      {
        id: 'msg_1',
        conversationId: 'conv_1',
        role: 'assistant',
        content: '',
        status: 'completed',
        toolCalls: [
          {
            id: 'call_2',
            name: 'write_to_file',
            input: { filePath: 'test.ts', content: 'hello' },
            status: 'completed',
            // No thoughtSignature provided
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const formatted = formatMessagesWithAttachments(mockMessages);
    const assistantPayload = formatted[0];
    expect(assistantPayload.thought_signature).toBe('skip_thought_signature_validator');
    expect(assistantPayload.extra_content?.google?.thought_signature).toBe('skip_thought_signature_validator');
    expect(assistantPayload.tool_calls[0].thought_signature).toBe('skip_thought_signature_validator');
    expect(assistantPayload.tool_calls[0].extra_content?.google?.thought_signature).toBe('skip_thought_signature_validator');
  });
});

