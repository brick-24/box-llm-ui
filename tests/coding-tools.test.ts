import { describe, it, expect } from 'vitest';
import {
  CODING_TOOLS,
  buildCodingSystemPrompt,
  buildGeneralSystemPrompt,
  getSystemEnvironmentInfo,
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

  it('builds coding system prompt instructing the agent on workspace constraints and environment', () => {
    const prompt = buildCodingSystemPrompt('/test/my-project', 'You are a helpful coding assistant.');
    expect(prompt).toContain('/test/my-project');
    expect(prompt).toContain('autonomous software engineering agent');
    expect(prompt).toContain('write_to_file');
    expect(prompt).toContain('replace_file_content');
    expect(prompt).toContain('run_command');
    expect(prompt).toContain('You are a helpful coding assistant.');
    expect(prompt).toContain('<system_environment>');
    expect(prompt).toContain('<terminal_execution_rules>');
    expect(prompt).toContain('Terminal Shell:');
  });

  it('detects host OS and shell execution syntax rules', () => {
    const env = getSystemEnvironmentInfo();
    expect(env.osName).toBeDefined();
    expect(env.platform).toBe(process.platform);
    expect(env.arch).toBe(process.arch);
    expect(env.shell).toBeDefined();
    expect(env.rules.length).toBeGreaterThan(0);

    if (process.platform === 'win32') {
      expect(env.shell).toBe('powershell.exe');
      expect(env.rules.some((r: string) => r.includes('&&'))).toBe(true);
    }
  });

  it('builds general system prompt injecting environment rules for non-workspace chats', () => {
    const prompt = buildGeneralSystemPrompt('Be a concise helper.');
    expect(prompt).toContain('Be a concise helper.');
    expect(prompt).toContain('<user_environment>');
    if (process.platform === 'win32') {
      expect(prompt).toContain('<terminal_guidelines>');
      expect(prompt).toContain('KEEP COMMANDS SIMPLE AND ATOMIC');
    }
  });

  it('explicitly warns against && and || in run_command tool schema', () => {
    const runTool = CODING_TOOLS.find((t) => t.function.name === 'run_command');
    expect(runTool).toBeDefined();
    expect(runTool!.function.description).toContain('Keep commands simple and atomic');
    expect(runTool!.function.parameters.properties.command.description).toContain('NEVER use "&&", "||"');
  });
});

