import { describe, it, expect } from 'vitest';
import { ChatEngine, isSafetyClassifierVerdict } from '../src/main/engine/chat-engine';

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

  it('correctly detects content-safety classifier verdict outputs', () => {
    expect(isSafetyClassifierVerdict('User Safety: safe Response Safety: safe')).toBe(true);
    expect(isSafetyClassifierVerdict('User Safety: safe\nResponse Safety: safe')).toBe(true);
    expect(isSafetyClassifierVerdict('User Safety: unsafe Response Safety: unsafe')).toBe(true);
    expect(isSafetyClassifierVerdict('  User Safety: safe  Response Safety: safe  ')).toBe(true);

    // Conversational text should NOT be flagged
    expect(isSafetyClassifierVerdict('To learn backend engineering in Go, start with standard library http package.')).toBe(false);
    expect(isSafetyClassifierVerdict('User Safety is very important in software design, so Response Safety should be tested.')).toBe(false);
    expect(isSafetyClassifierVerdict('')).toBe(false);
  });
});

