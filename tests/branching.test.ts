import { describe, it, expect } from 'vitest';
import {
  normalizeMessageParents,
  buildBranchTree,
  getAncestorChain,
} from '../src/renderer/src/utils/branching';
import { ChatMessage } from '../src/shared/types';

describe('Branching Utilities', () => {
  const createMockMsg = (
    id: string,
    role: 'user' | 'assistant',
    content: string,
    parentId: string | null = null,
    createdAt = Date.now()
  ): ChatMessage => ({
    id,
    conversationId: 'conv-1',
    parentId,
    role,
    content,
    status: 'completed',
    createdAt,
    updatedAt: createdAt,
  });

  it('normalizes legacy flat messages by connecting them sequentially', () => {
    const raw = [
      createMockMsg('1', 'user', 'Hello', null, 100),
      createMockMsg('2', 'assistant', 'Hi there', null, 200),
      createMockMsg('3', 'user', 'How are you?', null, 300),
    ];

    const normalized = normalizeMessageParents(raw);
    expect(normalized[0].parentId).toBeNull();
    expect(normalized[1].parentId).toBe('1');
    expect(normalized[2].parentId).toBe('2');
  });

  it('builds linear active thread when no branches exist', () => {
    const messages = [
      createMockMsg('u1', 'user', 'What is Go?', null, 100),
      createMockMsg('a1', 'assistant', 'Go is an open-source programming language.', 'u1', 200),
    ];

    const result = buildBranchTree(messages);
    expect(result.activeMessages.map((m) => m.id)).toEqual(['u1', 'a1']);
    expect(result.siblingsMap.get('u1')?.total).toBe(1);
    expect(result.siblingsMap.get('a1')?.total).toBe(1);
  });

  it('handles user message branching and allows switching between branches', () => {
    // Turn 1: original user prompt & reply
    const u1 = createMockMsg('u1', 'user', 'Tell me a joke', null, 100);
    const a1 = createMockMsg('a1', 'assistant', 'Why did the chicken cross the road?', 'u1', 200);

    // Turn 1 fork: user edits prompt to "Tell me a poem"
    const u1_fork = createMockMsg('u1_fork', 'user', 'Tell me a poem', null, 300);
    const a1_fork = createMockMsg('a1_fork', 'assistant', 'Roses are red, violets are blue...', 'u1_fork', 400);

    const all = [u1, a1, u1_fork, a1_fork];

    // By default, latest branch (fork) should be selected
    const defaultTree = buildBranchTree(all);
    expect(defaultTree.activeMessages.map((m) => m.id)).toEqual(['u1_fork', 'a1_fork']);

    // Sibling pagination check on user turn 1
    const forkSiblings = defaultTree.siblingsMap.get('u1_fork');
    expect(forkSiblings?.total).toBe(2);
    expect(forkSiblings?.index).toBe(1); // 2nd of 2

    const origSiblings = defaultTree.siblingsMap.get('u1');
    expect(origSiblings?.total).toBe(2);
    expect(origSiblings?.index).toBe(0); // 1st of 2

    // Switching branch selection to 'u1' should display original branch
    const switchedTree = buildBranchTree(all, { root: 'u1' });
    expect(switchedTree.activeMessages.map((m) => m.id)).toEqual(['u1', 'a1']);
  });

  it('handles assistant regeneration branching', () => {
    const u1 = createMockMsg('u1', 'user', 'Code snippet in Python', null, 100);
    const a1_v1 = createMockMsg('a1_v1', 'assistant', 'print("Version 1")', 'u1', 200);
    const a1_v2 = createMockMsg('a1_v2', 'assistant', 'print("Version 2")', 'u1', 300);

    const all = [u1, a1_v1, a1_v2];

    const tree = buildBranchTree(all);
    expect(tree.activeMessages.map((m) => m.id)).toEqual(['u1', 'a1_v2']);

    const aSiblings = tree.siblingsMap.get('a1_v2');
    expect(aSiblings?.total).toBe(2);
    expect(aSiblings?.index).toBe(1);

    // Switch to version 1 of assistant response
    const v1Tree = buildBranchTree(all, { u1: 'a1_v1' });
    expect(v1Tree.activeMessages.map((m) => m.id)).toEqual(['u1', 'a1_v1']);
  });

  it('computes correct ancestor chain from leaf to root', () => {
    const u1 = createMockMsg('u1', 'user', '1', null, 100);
    const a1 = createMockMsg('a1', 'assistant', '2', 'u1', 200);
    const u2 = createMockMsg('u2', 'user', '3', 'a1', 300);
    const a2 = createMockMsg('a2', 'assistant', '4', 'u2', 400);

    const chain = getAncestorChain([u1, a1, u2, a2], 'u2');
    expect(chain.map((m) => m.id)).toEqual(['u1', 'a1', 'u2']);
  });
});
