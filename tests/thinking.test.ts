import { describe, it, expect } from 'vitest';
import { parseThinkingContent } from '../src/renderer/src/utils/thinking';

describe('parseThinkingContent', () => {
  it('extracts explicit reasoning with content', () => {
    const res = parseThinkingContent('Final answer', 'Step-by-step thinking', false);
    expect(res.reasoning).toBe('Step-by-step thinking');
    expect(res.content).toBe('Final answer');
    expect(res.isThinking).toBe(false);
  });

  it('marks isThinking as true while streaming explicit reasoning before content arrives', () => {
    const res = parseThinkingContent('', 'Still thinking...', true);
    expect(res.reasoning).toBe('Still thinking...');
    expect(res.content).toBe('');
    expect(res.isThinking).toBe(true);
  });

  it('marks isThinking as false once content arrives during streaming', () => {
    const res = parseThinkingContent('Hello', 'Finished thoughts', true);
    expect(res.reasoning).toBe('Finished thoughts');
    expect(res.content).toBe('Hello');
    expect(res.isThinking).toBe(false);
  });

  it('extracts inline completed <think> tags', () => {
    const raw = '<think>\nAnalyzing the prompt.\nComputing answer.\n</think>\nHere is the solution.';
    const res = parseThinkingContent(raw, undefined, false);
    expect(res.reasoning).toBe('Analyzing the prompt.\nComputing answer.');
    expect(res.content).toBe('Here is the solution.');
    expect(res.isThinking).toBe(false);
  });

  it('extracts inline streaming unclosed <think> tag', () => {
    const raw = '<think>\nCurrently contemplating...';
    const res = parseThinkingContent(raw, undefined, true);
    expect(res.reasoning).toBe('Currently contemplating...');
    expect(res.content).toBe('');
    expect(res.isThinking).toBe(true);
  });

  it('supports alternative <thought> tags', () => {
    const raw = '<thought>Gemini thinking step</thought>Result';
    const res = parseThinkingContent(raw, undefined, false);
    expect(res.reasoning).toBe('Gemini thinking step');
    expect(res.content).toBe('Result');
    expect(res.isThinking).toBe(false);
  });

  it('returns clean content without reasoning when no thinking tags exist', () => {
    const raw = 'Simple message with no thoughts.';
    const res = parseThinkingContent(raw, undefined, false);
    expect(res.reasoning).toBeUndefined();
    expect(res.content).toBe('Simple message with no thoughts.');
    expect(res.isThinking).toBe(false);
  });

  it('strips redundant inline think tags if explicit reasoning is already provided', () => {
    const raw = '<think>Inline duplicate</think>Clean body';
    const res = parseThinkingContent(raw, 'Explicit thoughts', false);
    expect(res.reasoning).toBe('Explicit thoughts');
    expect(res.content).toBe('Clean body');
  });
});
