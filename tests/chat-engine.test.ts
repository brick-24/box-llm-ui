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

  it('correctly resolves branch ancestor history for branched conversation paths', () => {
    const messages: any[] = [
      { id: 'u1', role: 'user', content: 'First prompt', parentId: null },
      { id: 'a1', role: 'assistant', content: 'First answer', parentId: 'u1' },
      { id: 'u2_orig', role: 'user', content: 'Follow-up A', parentId: 'a1' },
      { id: 'a2_orig', role: 'assistant', content: 'Answer A', parentId: 'u2_orig' },
      { id: 'u2_fork', role: 'user', content: 'Follow-up B (Edited)', parentId: 'a1' },
    ];

    // Resolving for the forked branch should include only u1, a1, and u2_fork (NOT u2_orig or a2_orig)
    const forkedHistory = ChatEngine.resolveBranchHistory(messages, 'u2_fork');
    expect(forkedHistory.map((m) => m.id)).toEqual(['u1', 'a1', 'u2_fork']);

    // Resolving for the original branch should include u1, a1, u2_orig, a2_orig
    const origHistory = ChatEngine.resolveBranchHistory(messages, 'a2_orig');
    expect(origHistory.map((m) => m.id)).toEqual(['u1', 'a1', 'u2_orig', 'a2_orig']);
  });
});

