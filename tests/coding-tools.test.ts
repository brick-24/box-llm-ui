import { describe, it, expect } from 'vitest';
import {
  CODING_TOOLS,
  buildCodingSystemPrompt,
} from '../src/main/engine/tools/coding-tool-definitions';

describe('Coding Tool Definitions & System Prompt Builder', () => {
  it('exposes all 6 standard coding tools adhering to OpenAI function calling spec', () => {
    const toolNames = CODING_TOOLS.map((t) => t.function.name);
    expect(toolNames).toContain('write_to_file');
    expect(toolNames).toContain('view_file');
    expect(toolNames).toContain('replace_file_content');
    expect(toolNames).toContain('list_dir');
    expect(toolNames).toContain('run_command');
    expect(toolNames).toContain('grep_search');

    for (const tool of CODING_TOOLS) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeDefined();
      expect(tool.function.description).toBeDefined();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
      expect(tool.function.parameters.required).toBeInstanceOf(Array);
    }
  });

  it('builds coding system prompt instructing the agent on workspace constraints', () => {
    const prompt = buildCodingSystemPrompt('/test/my-project', 'You are a helpful coding assistant.');
    expect(prompt).toContain('/test/my-project');
    expect(prompt).toContain('autonomous software engineering agent');
    expect(prompt).toContain('write_to_file');
    expect(prompt).toContain('replace_file_content');
    expect(prompt).toContain('run_command');
    expect(prompt).toContain('You are a helpful coding assistant.');
  });
});
