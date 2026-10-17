import { describe, it, expect } from 'vitest';
import { ChatEngine } from '../src/main/engine/chat-engine';

describe('ChatEngine Utilities', () => {
  it('generates heuristic titles from user messages cleanly', () => {
    expect(ChatEngine.generateTitleHeuristic('')).toBe('New Conversation');
    expect(ChatEngine.generateTitleHeuristic('Short question?')).toBe('Short question?');
    expect(
      ChatEngine.generateTitleHeuristic(
        '# Please explain how WebAssembly executes in V8 compared to native C++ binaries.'
      )
    ).toContain('Please explain how WebAssembly executes');
    expect(
      ChatEngine.generateTitleHeuristic(
        'Line one of prompt\nLine two of prompt which should be ignored'
      )
    ).toBe('Line one of prompt');
  });
});
